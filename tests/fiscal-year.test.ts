import { describe, expect, it } from "vitest";
import {
  currentFyParam,
  fiscalYearBounds,
  fiscalYearEndMonthForStart,
  fiscalYearLabel,
  fiscalYearStartYear,
  isValidFiscalYearSpan,
  monthKeysInFiscalYear,
  normalizeFiscalYearConfig,
} from "../src/lib/fiscal-year";

describe("fiscal-year", () => {
  it("defaults to April through March", () => {
    const config = normalizeFiscalYearConfig({});
    expect(config).toEqual({ startMonth: 4, endMonth: 3 });
    expect(isValidFiscalYearSpan(4, 3)).toBe(true);
    expect(fiscalYearEndMonthForStart(4)).toBe(3);
  });

  it("computes India FY bounds", () => {
    const fy = fiscalYearBounds("2025-26", { startMonth: 4, endMonth: 3 });
    expect(fy).not.toBeNull();
    expect(fy!.fromKey).toBe("2025-04-01");
    expect(fy!.toKey).toBe("2026-03-31");
    expect(fy!.label).toBe("FY 2025-26");
  });

  it("lists months across a fiscal year", () => {
    const keys = monthKeysInFiscalYear(2025, { startMonth: 4, endMonth: 3 });
    expect(keys[0]).toBe("2025-04");
    expect(keys[keys.length - 1]).toBe("2026-03");
    expect(keys).toHaveLength(12);
  });

  it("resolves current FY param before and after start month", () => {
    const config = { startMonth: 4, endMonth: 3 };
    expect(
      currentFyParam("Asia/Kolkata", config, new Date("2026-02-10T10:00:00+05:30")),
    ).toBe("2025-26");
    expect(
      currentFyParam("Asia/Kolkata", config, new Date("2026-05-01T10:00:00+05:30")),
    ).toBe("2026-27");
  });

  it("labels fiscal years from start year", () => {
    expect(fiscalYearLabel(2026, { startMonth: 4, endMonth: 3 })).toBe("FY 2026-27");
  });

  it("uses the prior calendar year for months before FY start", () => {
    const config = { startMonth: 4, endMonth: 3 };
    expect(
      fiscalYearStartYear(new Date("2027-02-10T10:00:00+05:30"), "Asia/Kolkata", config),
    ).toBe(2026);
    expect(
      fiscalYearStartYear(new Date("2027-05-01T10:00:00+05:30"), "Asia/Kolkata", config),
    ).toBe(2027);
  });
});
