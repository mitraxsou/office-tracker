import { describe, expect, it } from "vitest";
import {
  countExemptQualifyingDays,
  resolveMonthCompliance,
  countQualifyingDays,
  countOfficeVisitDays,
  dayKeysForMonth,
  dayKeysInMonthUpToToday,
  dayQualifiesForTarget,
  fiscalYearLabel,
  fiscalYearStartYear,
  getMonthlyProgressState,
  getYearMonthVisualStatus,
  isCompliantYearMonthStatus,
  isPrePilotMonth,
  monthKeyInTimezone,
  monthDayKeysFromTrend,
  monthKeysInFiscalYear,
  monthKeysInYear,
  monthKeysInYearUpToMonth,
  validateMonthlyDaysTarget,
  yearFromDate,
  yearMonthStatus,
  yearMonthTooltipText,
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

  it("orders a fiscal year from April through March", () => {
    expect(monthKeysInFiscalYear(2026)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
    ]);
    expect(fiscalYearLabel(2026)).toBe("FY 2026-27");
  });

  it("uses the prior calendar year for January through March", () => {
    expect(
      fiscalYearStartYear(new Date("2027-02-10T10:00:00+05:30"), "Asia/Kolkata"),
    ).toBe(2026);
    expect(
      fiscalYearStartYear(new Date("2027-05-01T10:00:00+05:30"), "Asia/Kolkata"),
    ).toBe(2027);
  });

  it("counts exempt qualifying days without double counting", () => {
    const keys = new Set(["2026-09-01", "2026-09-02"]);
    expect(countExemptQualifyingDays(keys, ["2026-09-03"])).toBe(3);
    expect(countExemptQualifyingDays(keys, ["2026-09-01"])).toBe(2);
  });

  it("classifies year month status for past, current, and future months", () => {
    expect(yearMonthStatus("2026-08", "2026-09", true)).toBe("earned");
    expect(yearMonthStatus("2026-08", "2026-09", false)).toBe("not_met");
    expect(yearMonthStatus("2026-09", "2026-09", false)).toBe("not_met");
    expect(yearMonthStatus("2026-10", "2026-09", false)).toBe("pending");
  });

  it("identifies months before the pilot start as pre-pilot", () => {
    expect(isPrePilotMonth("2026-01", "2026-09")).toBe(true);
    expect(isPrePilotMonth("2026-08", "2026-09")).toBe(true);
    expect(isPrePilotMonth("2026-09", "2026-09")).toBe(false);
    expect(isPrePilotMonth("2026-10", "2026-09")).toBe(false);
  });

  it("counts only earned and exempt months as compliant", () => {
    expect(isCompliantYearMonthStatus("earned")).toBe(true);
    expect(isCompliantYearMonthStatus("exemption")).toBe(true);
    expect(isCompliantYearMonthStatus("no_data")).toBe(false);
    expect(isCompliantYearMonthStatus("not_met")).toBe(false);
    expect(isCompliantYearMonthStatus("pending")).toBe(false);
  });

  it("resolves month compliance with exemption status", () => {
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
    expect(resolved.status).toBe("exemption");
  });

  it("identifies pre-pilot months without treating them as compliant", () => {
    const pilotStart = "2026-09";
    const prePilotMonths = monthKeysInYear(2026).slice(0, 8);
    for (const monthKey of prePilotMonths) {
      expect(isPrePilotMonth(monthKey, pilotStart)).toBe(true);
      expect(isCompliantYearMonthStatus("no_data")).toBe(false);
    }
    expect(isPrePilotMonth("2026-09", pilotStart)).toBe(false);
  });

  it("maps year month records to visual status for the FY grid", () => {
    const current = "2026-09";
    expect(
      getYearMonthVisualStatus({ monthKey: "2026-08", status: "earned" }, current),
    ).toBe("compliant");
    expect(
      getYearMonthVisualStatus({ monthKey: "2026-08", status: "exemption" }, current),
    ).toBe("compliant");
    expect(
      getYearMonthVisualStatus({ monthKey: "2026-08", status: "not_met" }, current),
    ).toBe("non_compliant");
    expect(
      getYearMonthVisualStatus({ monthKey: "2026-09", status: "not_met" }, current),
    ).toBe("in_progress");
    expect(
      getYearMonthVisualStatus({ monthKey: "2026-07", status: "no_data" }, current),
    ).toBe("no_data");
    expect(
      getYearMonthVisualStatus({ monthKey: "2026-10", status: "pending" }, current),
    ).toBe("pending");
  });

  it("builds tooltip copy for each visual status", () => {
    const current = "2026-09";
    expect(
      yearMonthTooltipText(
        {
          monthKey: "2026-08",
          metTarget: true,
          qualifyingDays: 8,
          monthlyDaysTarget: 8,
          status: "earned",
        },
        current,
        "Asia/Kolkata",
      ),
    ).toContain("Compliant (8/8 qualifying days)");

    expect(
      yearMonthTooltipText(
        {
          monthKey: "2026-09",
          metTarget: false,
          qualifyingDays: 3,
          monthlyDaysTarget: 8,
          status: "not_met",
        },
        current,
        "Asia/Kolkata",
      ),
    ).toContain("In progress (3/8 qualifying days so far)");

    expect(
      yearMonthTooltipText(
        {
          monthKey: "2026-07",
          metTarget: false,
          qualifyingDays: 0,
          monthlyDaysTarget: 8,
          status: "no_data",
          noDataReason: "no_visits",
        },
        current,
        "Asia/Kolkata",
      ),
    ).toBe("July 2026: No data for this month");
  });
});
