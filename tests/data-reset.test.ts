import { describe, expect, it } from "vitest";
import { describeResetRange, isValidDayKey, resetRangeFromPeriod } from "../src/lib/data-reset";

describe("isValidDayKey", () => {
  it("accepts real dates", () => {
    expect(isValidDayKey("2026-09-03")).toBe(true);
    expect(isValidDayKey("2024-02-29")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    expect(isValidDayKey("2026-9-3")).toBe(false);
    expect(isValidDayKey("2026-13-01")).toBe(false);
    expect(isValidDayKey("2026-02-30")).toBe(false);
    expect(isValidDayKey("")).toBe(false);
  });
});

describe("resetRangeFromPeriod", () => {
  it("returns no bounds for all time", () => {
    expect(resetRangeFromPeriod("all", {})).toBeNull();
  });

  it("scopes a single day", () => {
    expect(resetRangeFromPeriod("day", { day: "2026-09-02" })).toEqual({
      fromDayKey: "2026-09-02",
      toDayKey: "2026-09-02",
    });
  });

  it("covers a full month including the last day", () => {
    expect(resetRangeFromPeriod("month", { month: "2026-09" })).toEqual({
      fromDayKey: "2026-09-01",
      toDayKey: "2026-09-30",
    });
    expect(resetRangeFromPeriod("month", { month: "2024-02" })?.toDayKey).toBe("2024-02-29");
  });

  it("covers a full year", () => {
    expect(resetRangeFromPeriod("year", { year: "2026" })).toEqual({
      fromDayKey: "2026-01-01",
      toDayKey: "2026-12-31",
    });
  });

  it("accepts a custom range and rejects a reversed one", () => {
    expect(resetRangeFromPeriod("custom", { from: "2026-09-01", to: "2026-09-03" })).toEqual({
      fromDayKey: "2026-09-01",
      toDayKey: "2026-09-03",
    });
    expect(resetRangeFromPeriod("custom", { from: "2026-09-03", to: "2026-09-01" })).toBeNull();
  });

  it("rejects incomplete input", () => {
    expect(resetRangeFromPeriod("day", {})).toBeNull();
    expect(resetRangeFromPeriod("month", { month: "2026" })).toBeNull();
    expect(resetRangeFromPeriod("year", { year: "26" })).toBeNull();
  });
});

describe("describeResetRange", () => {
  it("describes all time, a single day, and a range", () => {
    expect(describeResetRange(null)).toBe("all tracking data");
    expect(describeResetRange({ fromDayKey: "2026-09-02", toDayKey: "2026-09-02" })).toBe(
      "2026-09-02",
    );
    expect(describeResetRange({ fromDayKey: "2026-09-01", toDayKey: "2026-09-30" })).toBe(
      "2026-09-01 to 2026-09-30",
    );
  });
});
