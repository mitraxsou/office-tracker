import { describe, expect, it } from "vitest";
import {
  countPresenceDaysFromTrend,
  countQualifyingDays,
  dayCountsAsVisited,
  dayQualifiesForTarget,
  describeMonthlyDayJourney,
} from "../src/lib/monthly-progress";
import { formatCalendarHours, roundHoursToMinute } from "../src/lib/visits";

describe("presence-based monthly day counting", () => {
  it("counts sub-5h presence days toward the monthly goal without marking hours met", () => {
    const dailyHours = [2.5, 0, 5, 1.2, 0, 6];
    expect(countQualifyingDays(dailyHours, 5)).toBe(4);
    expect(dayCountsAsVisited(2.5)).toBe(true);
    expect(dayQualifiesForTarget(2.5, 5)).toBe(false);
    expect(dayQualifiesForTarget(5, 5)).toBe(true);
  });

  it("ignores sub-minute phantom hours that round away in dailyTrend", () => {
    const phantom = 20 / 3600; // 20 seconds past midnight spill
    expect(phantom).toBeGreaterThan(0);
    expect(roundHoursToMinute(phantom)).toBe(0);
    expect(dayCountsAsVisited(phantom)).toBe(false);
    expect(dayCountsAsVisited(60 / 3600)).toBe(true);
  });

  it("keeps Reports KPI presence count aligned with dailyTrend for a month", () => {
    const dailyTrend = [
      { date: "2026-09-30", totalHours: 6 },
      { date: "2026-10-12", totalHours: 5.2 },
      { date: "2026-10-13", totalHours: 5 },
      { date: "2026-10-27", totalHours: 2 / 60 },
      { date: "2026-10-28", totalHours: 0 },
      { date: "2026-11-01", totalHours: 1 },
    ];
    // Sep 30 / Nov 1 must not inflate October; 2-minute Oct 27 still counts.
    expect(countPresenceDaysFromTrend(dailyTrend, "2026-10")).toBe(3);
    expect(formatCalendarHours(2 / 60)).toBe("2m");
    expect(formatCalendarHours(0.04)).toBe("2m");
    expect(formatCalendarHours(5.2)).toBe("5.2h");
  });

  it("secures the journey day on presence while hours remaining stay separate", () => {
    const journey = describeMonthlyDayJourney({
      qualifyingDays: 3,
      monthlyDaysTarget: 8,
      todayMetTarget: false,
      inOfficeNow: false,
      todayHasOfficeTime: true,
    });
    expect(journey.todayAlreadyQualified).toBe(true);
    expect(journey.ongoingLabel).toBe("3rd day secured today");
  });

  it("does not secure today on raw sub-minute hours that round away", () => {
    const subMinute = 20 / 3600;
    expect(dayCountsAsVisited(subMinute)).toBe(false);
    const journey = describeMonthlyDayJourney({
      qualifyingDays: 9,
      monthlyDaysTarget: 8,
      todayMetTarget: false,
      inOfficeNow: false,
      todayHasOfficeTime: dayCountsAsVisited(subMinute),
    });
    expect(journey.todayAlreadyQualified).toBe(false);
    expect(journey.ongoingLabel).toBeNull();
  });
});
