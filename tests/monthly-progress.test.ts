import { describe, expect, it } from "vitest";
import {
  countExemptQualifyingDays,
  resolveMonthCompliance,
  countQualifyingDays,
  countOfficeVisitDays,
  dayKeysForMonth,
  dayKeysInMonthUpToToday,
  dayQualifiesForTarget,
  getMonthlyProgressState,
  monthKeyInTimezone,
  monthDayKeysFromTrend,
  monthKeysInYear,
  monthKeysInYearUpToMonth,
  validateMonthlyDaysTarget,
  yearFromDate,
  yearMonthStatus,
} from "../src/lib/monthly-progress";

describe("validateMonthlyDaysTarget", () => {
  it("accepts integers from 1 to 31", () => {
    expect(validateMonthlyDaysTarget(8)).toBe(8);
    expect(validateMonthlyDaysTarget(1)).toBe(1);
    expect(validateMonthlyDaysTarget(31)).toBe(31);
  });

  it("rejects invalid values", () => {
    expect(validateMonthlyDaysTarget(0)).toBeNull();
    expect(validateMonthlyDaysTarget(32)).toBeNull();
    expect(validateMonthlyDaysTarget(8.5)).toBeNull();
    expect(validateMonthlyDaysTarget("8")).toBeNull();
    expect(validateMonthlyDaysTarget(null)).toBeNull();
  });
});

describe("countQualifyingDays", () => {
  it("counts days meeting the hours target", () => {
    const hours = [5, 4.9, 6, 0, 5];
    expect(countQualifyingDays(hours, 5)).toBe(3);
  });

  it("treats exact target as qualifying", () => {
    expect(dayQualifiesForTarget(5, 5)).toBe(true);
    expect(dayQualifiesForTarget(4.99, 5)).toBe(false);
  });
});

describe("countOfficeVisitDays", () => {
  it("counts days with any logged hours", () => {
    expect(countOfficeVisitDays([0, 0.5, 5, 0, 2])).toBe(3);
  });
});

describe("getMonthlyProgressState", () => {
  it("marks target met when qualifying days reach the monthly goal", () => {
    expect(getMonthlyProgressState(8, 8, 15, 30)).toBe("met");
  });

  it("marks on track when pace matches elapsed days", () => {
    expect(getMonthlyProgressState(1, 8, 4, 30)).toBe("on_track");
  });

  it("marks behind when pace is below expected", () => {
    expect(getMonthlyProgressState(0, 8, 10, 30)).toBe("behind");
  });
});

describe("dayKeysInMonthUpToToday", () => {
  it("returns day keys from the 1st through today in timezone", () => {
    const date = new Date("2026-09-02T10:00:00+05:30");
    expect(dayKeysInMonthUpToToday(date, "Asia/Kolkata")).toEqual([
      "2026-09-01",
      "2026-09-02",
    ]);
    expect(monthKeyInTimezone(date, "Asia/Kolkata")).toBe("2026-09");
  });
});

describe("dayKeysForMonth", () => {
  it("returns all days for a past month", () => {
    const ref = new Date("2026-09-02T10:00:00+05:30");
    expect(dayKeysForMonth("2026-08", "Asia/Kolkata", ref)).toHaveLength(31);
  });

  it("caps at today for the current month", () => {
    const ref = new Date("2026-09-02T10:00:00+05:30");
    expect(dayKeysForMonth("2026-09", "Asia/Kolkata", ref)).toEqual([
      "2026-09-01",
      "2026-09-02",
    ]);
  });
});

describe("monthDayKeysFromTrend", () => {
  it("counts qualifying days within a month from trend data", () => {
    const trend = [
      { date: "2026-09-01", totalHours: 5 },
      { date: "2026-09-02", totalHours: 3 },
      { date: "2026-08-31", totalHours: 6 },
    ];
    const result = monthDayKeysFromTrend(trend, "2026-09", 5);
    expect(result.qualifyingDays).toBe(1);
    expect(result.officeVisitDays).toBe(2);
    expect(result.daysInRange).toBe(2);
    expect(result.daysInMonth).toBe(30);
  });
});

describe("year compliance helpers", () => {
  it("returns month keys from January through the current month", () => {
    const ref = new Date("2026-09-02T10:00:00+05:30");
    expect(yearFromDate(ref, "Asia/Kolkata")).toBe(2026);
    expect(monthKeysInYearUpToMonth(2026, "Asia/Kolkata", ref)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("returns all twelve months for a completed year", () => {
    const ref = new Date("2026-09-02T10:00:00+05:30");
    expect(monthKeysInYearUpToMonth(2025, "Asia/Kolkata", ref)).toHaveLength(12);
  });

  it("returns all twelve month keys for any calendar year", () => {
    expect(monthKeysInYear(2026)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
  });

  it("classifies year month status for past, current, and future months", () => {
    expect(yearMonthStatus("2026-08", "2026-09", true)).toBe("met");
    expect(yearMonthStatus("2026-08", "2026-09", false)).toBe("not_met");
    expect(yearMonthStatus("2026-09", "2026-09", false)).toBe("not_met");
    expect(yearMonthStatus("2026-10", "2026-09", false)).toBe("pending");
  });

  it("counts exempt qualifying days without double counting", () => {
    const keys = new Set(["2026-09-01", "2026-09-02"]);
    expect(countExemptQualifyingDays(keys, ["2026-09-03"])).toBe(3);
    expect(countExemptQualifyingDays(keys, ["2026-09-01"])).toBe(2);
  });

  it("resolves month compliance with exemption metVia", () => {
    const resolved = resolveMonthCompliance({
      monthKey: "2026-08",
      currentMonthKey: "2026-09",
      qualifyingDays: 3,
      monthlyDaysTarget: 8,
      hasMonthExemption: true,
      exemptDayKeysInMonth: [],
      qualifyingDayKeys: new Set(),
    });
    expect(resolved.metTarget).toBe(true);
    expect(resolved.metVia).toBe("exemption");
  });
});
