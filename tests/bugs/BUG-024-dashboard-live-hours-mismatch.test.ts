import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  dashboardOfficeTimeSegments,
  shouldEstimateUnconfirmedOfficeTail,
  type DashboardOfficeTimeInput,
} from "@/lib/dashboard-live-hours";
import { formatHoursHms, formatTime, idealCheckoutAt } from "@/lib/visits";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/dashboard-live-hours-mismatch.json"),
    "utf8",
  ),
) as {
  timezone: string;
  targetHours: number;
  firstCheckIn: string;
  lastActivity: string;
  earlierPulse: string;
  pageOpenedAt: string;
  idealCheckout: string;
};

const HOUR_MS = 1000 * 60 * 60;

function hoursBetween(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / HOUR_MS;
}

/** Old Today-card formula: confirmed span plus time since the last pulse. */
function naiveConfirmedPlusPulseGap(input: DashboardOfficeTimeInput, now: Date, pulse: Date): number {
  const extra = Math.max(0, now.getTime() - pulse.getTime()) / HOUR_MS;
  return Math.max(input.liveHours, input.confirmedHours + extra);
}

describe("BUG-024 Today office hours and Today's office time share one day total", () => {
  const spanHours = hoursBetween(fixture.firstCheckIn, fixture.lastActivity);

  it("spans 12:41 pm to 3:36:03 pm as 2h 55m 3s, not 2h 5m 3s", () => {
    expect(formatHoursHms(spanHours)).toBe("2h 55m 3s");
    expect(formatHoursHms(spanHours - 50 / 60)).toBe("2h 5m 3s");
    expect(formatHoursHms(fixture.targetHours)).toBe("5h 0m 0s");
  });

  it("keeps the finalized span after leaving, including a 50 minute gap already in the day", () => {
    const input: DashboardOfficeTimeInput = {
      liveHours: spanHours,
      confirmedHours: spanHours - 50 / 60,
      inOfficeNow: false,
      asOf: fixture.lastActivity,
    };
    const now = new Date(fixture.pageOpenedAt);
    const desk = dashboardOfficeTimeSegments(input, now);
    const card = dashboardOfficeTimeSegments(input, now);

    expect(card).toEqual(desk);
    expect(formatHoursHms(desk.liveHours)).toBe("2h 55m 3s");
    expect(formatHoursHms(desk.confirmedHours)).toBe("2h 55m 3s");
    expect(desk.estimatedHours).toBe(0);
    expect(desk.liveHours).toBeLessThan(hoursBetween(fixture.firstCheckIn, fixture.pageOpenedAt));
  });

  it("does not add the 50 minutes between an earlier pulse and 15:36 a second time", () => {
    const asOf = new Date(fixture.lastActivity);
    const pulse = new Date(fixture.earlierPulse);
    const input: DashboardOfficeTimeInput = {
      liveHours: spanHours,
      confirmedHours: spanHours,
      inOfficeNow: true,
      asOf,
    };
    const segments = dashboardOfficeTimeSegments(input, asOf);
    const naive = naiveConfirmedPlusPulseGap(input, asOf, pulse);

    expect(formatHoursHms(segments.liveHours)).toBe("2h 55m 3s");
    expect(formatHoursHms(naive)).toBe("3h 45m 3s");
    expect(naive - segments.liveHours).toBeCloseTo(50 / 60, 6);
  });

  it("paints only the in-office tail after 15:36 as estimated", () => {
    const asOf = new Date(fixture.lastActivity);
    const now = new Date(asOf.getTime() + 50 * 60 * 1000);
    const segments = dashboardOfficeTimeSegments(
      {
        liveHours: spanHours,
        confirmedHours: spanHours,
        inOfficeNow: true,
        asOf,
      },
      now,
    );

    expect(formatHoursHms(segments.confirmedHours)).toBe("2h 55m 3s");
    expect(formatHoursHms(segments.estimatedHours)).toBe("0h 50m 0s");
    expect(formatHoursHms(segments.liveHours)).toBe("3h 45m 3s");
    expect(segments.confirmedHours + segments.estimatedHours).toBeCloseTo(segments.liveHours, 8);
  });

  it("keeps a silent laptop counting in yellow after the last confirmed signal", () => {
    const asOf = new Date(fixture.pageOpenedAt);
    const now = new Date(asOf.getTime() + 30 * 1000);
    const segments = dashboardOfficeTimeSegments(
      {
        liveHours: hoursBetween(fixture.firstCheckIn, fixture.pageOpenedAt),
        confirmedHours: spanHours,
        inOfficeNow: false,
        estimateUnconfirmedTail: true,
        asOf,
      },
      now,
    );

    expect(formatHoursHms(segments.confirmedHours)).toBe("2h 55m 3s");
    expect(segments.estimatedHours).toBeCloseTo(
      hoursBetween(fixture.lastActivity, fixture.pageOpenedAt) + 30 / 3600,
      5,
    );
    expect(segments.confirmedHours + segments.estimatedHours).toBeCloseTo(segments.liveHours, 8);
  });

  it("stops the yellow tail after an agent, manual, or admin checkout", () => {
    const end = new Date(fixture.lastActivity);
    expect(
      shouldEstimateUnconfirmedOfficeTail({
        isCurrentDay: true,
        visits: [{ endAt: end, endSource: "inferred" }],
      }),
    ).toBe(true);
    expect(
      shouldEstimateUnconfirmedOfficeTail({
        isCurrentDay: true,
        visits: [{ endAt: null, endSource: null }],
      }),
    ).toBe(true);
    for (const endSource of ["agent", "manual", "admin"] as const) {
      expect(
        shouldEstimateUnconfirmedOfficeTail({
          isCurrentDay: true,
          visits: [{ endAt: end, endSource }],
        }),
      ).toBe(false);
    }
    expect(
      shouldEstimateUnconfirmedOfficeTail({
        isCurrentDay: false,
        visits: [{ endAt: null }],
      }),
    ).toBe(false);
  });

  it("keeps ideal checkout at first check-in plus 5 hours (05:41 pm)", () => {
    const ideal = idealCheckoutAt(new Date(fixture.firstCheckIn), fixture.targetHours);
    expect(ideal.toISOString()).toBe(new Date(fixture.idealCheckout).toISOString());
    expect(formatTime(ideal, fixture.timezone).toLowerCase().replace(/\s+/g, " ")).toBe("05:41 pm");
  });

  it("renders both dashboard surfaces from dashboardOfficeTimeSegments", () => {
    const desk = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/DeskClockPanel.tsx"),
      "utf8",
    );
    const card = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/DashboardHeroSummary.tsx"),
      "utf8",
    );
    expect(desk).toContain("dashboardOfficeTimeSegments");
    expect(card).toContain("dashboardOfficeTimeSegments");
    expect(desk).not.toContain("liveOfficeHoursFromStats");
    expect(card).not.toContain("function liveHoursNow");
    expect(desk).not.toContain("confirmedHours + extra");
    expect(card).not.toContain("confirmedHours + extra");
  });
});
