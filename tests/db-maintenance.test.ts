import { describe, expect, it } from "vitest";
import {
  cutoffDateFromRetentionDays,
  dayKeyFromDate,
  isMaintenanceTable,
  isRetentionPeriod,
  MAINTENANCE_TABLE_LABELS,
  retentionDaysFromPeriod,
} from "../src/lib/db-maintenance";

describe("db-maintenance retention", () => {
  it("maps retention periods to days", () => {
    expect(retentionDaysFromPeriod("1_month")).toBe(30);
    expect(retentionDaysFromPeriod("1_year")).toBe(365);
  });

  it("validates table and period enums", () => {
    expect(isMaintenanceTable("heartbeats")).toBe(true);
    expect(isMaintenanceTable("agent_lifecycle_events")).toBe(true);
    expect(isMaintenanceTable("resolved_compliance_exemptions")).toBe(true);
    expect(isMaintenanceTable("users")).toBe(false);
    expect(isRetentionPeriod("3_months")).toBe(true);
    expect(isRetentionPeriod("2_weeks")).toBe(false);
  });

  it("lists all purgeable tables for the admin UI", () => {
    expect(Object.keys(MAINTENANCE_TABLE_LABELS)).toEqual([
      "heartbeats",
      "old_visits",
      "agent_lifecycle_events",
      "audit_logs",
      "resolved_corrections",
      "resolved_device_removals",
      "resolved_timezone_requests",
      "resolved_profile_changes",
      "resolved_compliance_exemptions",
      "past_out_of_office",
    ]);
  });

  it("formats day keys for out-of-office purge cutoff", () => {
    expect(dayKeyFromDate(new Date("2026-09-02T12:00:00.000Z"))).toBe("2026-09-02");
  });

  it("computes cutoff date from retention days", () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    const cutoff = cutoffDateFromRetentionDays(30, now);
    expect(cutoff.toISOString()).toBe("2026-08-03T12:00:00.000Z");
  });
});
