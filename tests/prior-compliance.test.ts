import { describe, expect, it } from "vitest";
import {
  eligiblePriorComplianceMonths,
  isWeekdayDayKey,
  parseCheckInTime,
  pickBackfillDayKeys,
  validatePriorComplianceMonthInput,
  validatePriorComplianceSubmission,
} from "../src/lib/prior-compliance";

describe("parseCheckInTime", () => {
  it("parses valid 24-hour times", () => {
    expect(parseCheckInTime("09:30")).toEqual({ hour: 9, minute: 30 });
    expect(parseCheckInTime("18:00")).toEqual({ hour: 18, minute: 0 });
  });

  it("rejects invalid times", () => {
    expect(parseCheckInTime("invalid")).toBeNull();
    expect(parseCheckInTime("25:00")).toBeNull();
    expect(parseCheckInTime("09:60")).toBeNull();
  });
});

describe("eligiblePriorComplianceMonths", () => {
  it("returns pilot months before the user joined", () => {
    expect(
      eligiblePriorComplianceMonths({
        pilotStartMonthKey: "2026-09",
        currentMonthKey: "2026-12",
        joinedMonthKey: "2026-12",
      }),
    ).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  it("returns no months when the user joined at pilot start", () => {
    expect(
      eligiblePriorComplianceMonths({
        pilotStartMonthKey: "2026-09",
        currentMonthKey: "2026-09",
        joinedMonthKey: "2026-09",
      }),
    ).toEqual([]);
  });
});

describe("pickBackfillDayKeys", () => {
  it("picks weekdays spread across the month", () => {
    const keys = pickBackfillDayKeys("2026-09", 4);
    expect(keys).toHaveLength(4);
    expect(keys.every(isWeekdayDayKey)).toBe(true);
  });
});

describe("validatePriorComplianceMonthInput", () => {
  it("accepts a valid month declaration", () => {
    expect(
      validatePriorComplianceMonthInput(
        { monthKey: "2026-09", typicalCheckInTime: "09:30", qualifyingDaysCount: 8 },
        8,
      ),
    ).toBeNull();
  });

  it("rejects too many qualifying days", () => {
    expect(
      validatePriorComplianceMonthInput(
        { monthKey: "2026-09", typicalCheckInTime: "09:30", qualifyingDaysCount: 9 },
        8,
      ),
    ).toContain("Qualifying days");
  });
});

describe("validatePriorComplianceSubmission", () => {
  it("rejects ineligible months", () => {
    expect(
      validatePriorComplianceSubmission({
        months: [{ monthKey: "2026-12", typicalCheckInTime: "09:30" }],
        eligibleMonthKeys: ["2026-09", "2026-10"],
        monthlyDaysTarget: 8,
      }),
    ).toContain("not eligible");
  });

  it("allows an empty submission", () => {
    expect(
      validatePriorComplianceSubmission({
        months: [],
        eligibleMonthKeys: ["2026-09"],
        monthlyDaysTarget: 8,
      }),
    ).toBeNull();
  });
});
