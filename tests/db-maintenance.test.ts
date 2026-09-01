import { describe, expect, it } from "vitest";
import {
  cutoffDateFromRetentionDays,
  isMaintenanceTable,
  isRetentionPeriod,
  retentionDaysFromPeriod,
} from "../src/lib/db-maintenance";

describe("db-maintenance retention", () => {
  it("maps retention periods to days", () => {
    expect(retentionDaysFromPeriod("1_month")).toBe(30);
    expect(retentionDaysFromPeriod("1_year")).toBe(365);
  });

  it("validates table and period enums", () => {
    expect(isMaintenanceTable("heartbeats")).toBe(true);
    expect(isMaintenanceTable("users")).toBe(false);
    expect(isRetentionPeriod("3_months")).toBe(true);
    expect(isRetentionPeriod("2_weeks")).toBe(false);
  });

  it("computes cutoff date from retention days", () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    const cutoff = cutoffDateFromRetentionDays(30, now);
    expect(cutoff.toISOString()).toBe("2026-08-03T12:00:00.000Z");
  });
});
