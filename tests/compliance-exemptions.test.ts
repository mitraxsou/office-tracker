import { describe, expect, it } from "vitest";
import {
  isValidComplianceExemptionStatus,
  isValidComplianceExemptionType,
  isValidDayKey,
  isValidMonthKey,
  validateComplianceExemptionSubmission,
} from "../src/lib/compliance-exemptions";
import {
  countExemptQualifyingDays,
  resolveMonthCompliance,
} from "../src/lib/monthly-progress";

describe("compliance exemption validation", () => {
  it("accepts valid month and day keys", () => {
    expect(isValidMonthKey("2026-09")).toBe(true);
    expect(isValidDayKey("2026-09-15")).toBe(true);
    expect(isValidMonthKey("2026-13")).toBe(false);
    expect(isValidDayKey("2026-02-30")).toBe(false);
  });

  it("accepts valid statuses and types", () => {
    expect(isValidComplianceExemptionStatus("open")).toBe(true);
    expect(isValidComplianceExemptionStatus("approved")).toBe(true);
    expect(isValidComplianceExemptionType("month")).toBe(true);
    expect(isValidComplianceExemptionType("day")).toBe(true);
  });

  it("rejects future month exemption requests", () => {
    expect(
      validateComplianceExemptionSubmission({
        type: "month",
        monthKey: "2026-12",
        currentMonthKey: "2026-09",
        currentDayKey: "2026-09-02",
        hasOpenMonthRequest: false,
        hasOpenDayRequest: false,
        hasApprovedMonth: false,
        hasApprovedDay: false,
      }),
    ).toBe("Cannot notify admin about an HR exemption for a future month");
  });

  it("allows valid month exemption submission", () => {
    expect(
      validateComplianceExemptionSubmission({
        type: "month",
        monthKey: "2026-08",
        currentMonthKey: "2026-09",
        currentDayKey: "2026-09-02",
        hasOpenMonthRequest: false,
        hasOpenDayRequest: false,
        hasApprovedMonth: false,
        hasApprovedDay: false,
      }),
    ).toBeNull();
  });
});

describe("year compliance exemption counting", () => {
  it("adds exempt days that were not naturally qualifying", () => {
    const qualifyingDayKeys = new Set(["2026-08-01", "2026-08-02"]);
    expect(
      countExemptQualifyingDays(qualifyingDayKeys, ["2026-08-03", "2026-08-01"]),
    ).toBe(3);
  });

  it("marks month met via whole-month exemption", () => {
    const result = resolveMonthCompliance({
      monthKey: "2026-08",
      currentMonthKey: "2026-09",
      qualifyingDays: 2,
      monthlyDaysTarget: 8,
      hasMonthExemption: true,
      exemptDayKeysInMonth: [],
      qualifyingDayKeys: new Set(["2026-08-01", "2026-08-02"]),
    });
    expect(result.status).toBe("exemption");
    expect(result.metTarget).toBe(true);
  });

  it("marks month met via day exemptions when natural days fall short", () => {
    const qualifyingDayKeys = new Set([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
    ]);
    const result = resolveMonthCompliance({
      monthKey: "2026-08",
      currentMonthKey: "2026-09",
      qualifyingDays: 7,
      monthlyDaysTarget: 8,
      hasMonthExemption: false,
      exemptDayKeysInMonth: ["2026-08-08"],
      qualifyingDayKeys,
    });
    expect(result.status).toBe("exemption");
    expect(result.qualifyingDays).toBe(8);
  });

  it("marks month met as earned without exemptions", () => {
    const result = resolveMonthCompliance({
      monthKey: "2026-08",
      currentMonthKey: "2026-09",
      qualifyingDays: 8,
      monthlyDaysTarget: 8,
      hasMonthExemption: false,
      exemptDayKeysInMonth: [],
      qualifyingDayKeys: new Set(
        Array.from({ length: 8 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`),
      ),
    });
    expect(result.status).toBe("earned");
  });
});
