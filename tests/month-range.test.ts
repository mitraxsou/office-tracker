import { describe, expect, it } from "vitest";
import {
  allDayKeysInMonth,
  calendarWeeksForMonth,
  currentMonthKey,
  formatMonthLabel,
  monthBoundsFromKey,
  shiftMonth,
} from "../src/lib/month-range";

describe("monthBoundsFromKey", () => {
  it("returns first and last day keys for a month in Asia/Kolkata", () => {
    const bounds = monthBoundsFromKey("2026-09", "Asia/Kolkata");
    expect(bounds.monthKey).toBe("2026-09");
    expect(bounds.fromKey).toBe("2026-09-01");
    expect(bounds.toKey).toBe("2026-09-30");
    expect(bounds.from.getTime()).toBeLessThan(bounds.to.getTime());
  });

  it("handles February in a leap year", () => {
    const keys = allDayKeysInMonth("2024-02");
    expect(keys).toHaveLength(29);
    expect(keys[0]).toBe("2024-02-01");
    expect(keys[28]).toBe("2024-02-29");
  });
});

describe("shiftMonth", () => {
  it("moves forward and backward across year boundary", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-09", 0)).toBe("2026-09");
  });
});

describe("currentMonthKey", () => {
  it("uses the reference date in the given timezone", () => {
    const ref = new Date("2026-09-02T10:00:00+05:30");
    expect(currentMonthKey("Asia/Kolkata", ref)).toBe("2026-09");
  });
});

describe("formatMonthLabel", () => {
  it("formats month and year for display", () => {
    expect(formatMonthLabel("2026-09", "Asia/Kolkata")).toMatch(/September 2026/);
  });
});

describe("calendarWeeksForMonth", () => {
  it("pads weeks to start on Monday", () => {
    const weeks = calendarWeeksForMonth("2026-09", 1);
    expect(weeks[0]![0]).toEqual({ dayKey: null, dayOfMonth: null });
    expect(weeks[0]![1]?.dayKey).toBe("2026-09-01");
    const allDays = weeks.flat().filter((c) => c.dayKey);
    expect(allDays).toHaveLength(30);
  });
});
