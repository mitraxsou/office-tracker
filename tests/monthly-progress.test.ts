import { describe, expect, it } from "vitest";
import {
  countQualifyingDays,
  dayKeysForMonth,
  dayKeysInMonthUpToToday,
  dayQualifiesForTarget,
  monthKeyInTimezone,
  monthDayKeysFromTrend,
  validateMonthlyDaysTarget,
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
    expect(result.daysInRange).toBe(2);
  });
});
