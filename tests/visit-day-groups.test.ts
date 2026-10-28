import { describe, expect, it } from "vitest";
import {
  buildVisitDayGroups,
  visitOverlapsLocalDay,
} from "../src/lib/visit-day-groups";

const TZ = "Asia/Kolkata";

describe("visitOverlapsLocalDay", () => {
  it("matches overnight spill onto the next local day", () => {
    const visit = {
      startAt: "2026-10-14T16:30:00.000Z", // 22:00 IST
      endAt: "2026-10-14T20:30:00.000Z", // 02:00 IST next day
    };
    expect(visitOverlapsLocalDay(visit, "2026-10-14", TZ)).toBe(true);
    expect(visitOverlapsLocalDay(visit, "2026-10-15", TZ)).toBe(true);
    expect(visitOverlapsLocalDay(visit, "2026-10-16", TZ)).toBe(false);
  });

  it("does not use UTC ISO prefix matching", () => {
    // 00:30 IST on Oct 15 = 19:00 UTC on Oct 14
    const visit = {
      startAt: "2026-10-14T19:00:00.000Z",
      endAt: "2026-10-14T20:00:00.000Z",
    };
    expect(visit.startAt.startsWith("2026-10-15")).toBe(false);
    expect(visitOverlapsLocalDay(visit, "2026-10-15", TZ)).toBe(true);
  });
});

describe("buildVisitDayGroups", () => {
  it("lists both calendar days for a closed overnight visit", () => {
    const visits = [
      {
        id: "overnight",
        startAt: "2026-10-14T16:30:00.000Z",
        endAt: "2026-10-14T20:30:00.000Z",
        source: "wifi",
        ssid: "OfficeConnect",
      },
    ];
    const dailyTrend = [
      { date: "2026-10-14", totalHours: 2, metTarget: false },
      { date: "2026-10-15", totalHours: 2, metTarget: false },
    ];
    const groups = buildVisitDayGroups(visits, dailyTrend, TZ, {
      now: new Date("2026-10-15T12:00:00+05:30"),
    });
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-10-15", "2026-10-14"]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.visits.length === 1)).toBe(true);
  });

  it("keeps presence day count aligned with dailyTrend hours > 0", () => {
    const visits = [
      {
        id: "a",
        startAt: "2026-10-01T03:30:00.000Z",
        endAt: "2026-10-01T10:30:00.000Z",
        source: "wifi",
        ssid: null,
      },
      {
        id: "b",
        startAt: "2026-10-02T04:00:00.000Z",
        endAt: "2026-10-02T06:00:00.000Z",
        source: "manual",
        ssid: "manual",
      },
      {
        id: "c",
        startAt: "2026-10-03T03:30:00.000Z",
        endAt: "2026-10-03T09:00:00.000Z",
        source: "wifi",
        ssid: null,
      },
    ];
    const dailyTrend = [
      { date: "2026-10-01", totalHours: 7, metTarget: true },
      { date: "2026-10-02", totalHours: 2, metTarget: false },
      { date: "2026-10-03", totalHours: 5.5, metTarget: true },
    ];
    const groups = buildVisitDayGroups(visits, dailyTrend, TZ);
    expect(groups).toHaveLength(3);
    expect(dailyTrend.filter((d) => d.totalHours > 0)).toHaveLength(3);
  });

  it("drops visit-overlap days with zero countable hours so Visits matches Office days", () => {
    const visits = [
      {
        id: "overnight",
        // Ends 20s after IST midnight on Oct 15 - visit overlaps day 2 but hours round to 0.
        startAt: "2026-10-14T16:30:00.000Z",
        endAt: "2026-10-14T18:30:20.000Z",
        source: "wifi",
        ssid: null,
      },
    ];
    const dailyTrend = [
      { date: "2026-10-14", totalHours: 2, metTarget: false },
      { date: "2026-10-15", totalHours: 0, metTarget: false },
    ];
    const groups = buildVisitDayGroups(visits, dailyTrend, TZ, {
      now: new Date("2026-10-15T12:00:00+05:30"),
    });
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-10-14"]);
  });

  it("filters to the selected local day including overnight second day", () => {
    const visits = [
      {
        id: "overnight",
        startAt: "2026-10-14T16:30:00.000Z",
        endAt: "2026-10-14T20:30:00.000Z",
        source: "wifi",
        ssid: null,
      },
    ];
    const dailyTrend = [
      { date: "2026-10-14", totalHours: 2, metTarget: false },
      { date: "2026-10-15", totalHours: 2, metTarget: false },
    ];
    const groups = buildVisitDayGroups(visits, dailyTrend, TZ, {
      selectedDate: "2026-10-15",
      now: new Date("2026-10-15T12:00:00+05:30"),
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].dayKey).toBe("2026-10-15");
    expect(groups[0].visits).toHaveLength(1);
  });
});
