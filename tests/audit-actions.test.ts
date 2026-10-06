import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_GUIDE,
  describeAuditAction,
  formatAuditDetailsSummary,
  formatAuditTimestamp,
  resolveAuditTimezone,
} from "../src/lib/audit-actions";
import type { AuditAction } from "../src/lib/audit-log";

describe("audit timezone and actions", () => {
  it("formats UTC instants in the chosen timezone with a zone label", () => {
    const iso = "2026-10-06T10:30:09.331Z";
    expect(formatAuditTimestamp(iso, "UTC")).toMatch(/30/i);
    const ist = formatAuditTimestamp(iso, "Asia/Kolkata");
    expect(ist).toMatch(/4:00:09/i);
    expect(ist).toMatch(/pm/i);
  });

  it("rewrites ISO timestamps inside details", () => {
    const summary = formatAuditDetailsSummary(
      JSON.stringify({
        type: "hours_met",
        dayKey: "2026-10-06",
        acknowledgedAt: "2026-10-06T10:30:09.331Z",
      }),
      "Asia/Kolkata",
    );
    expect(summary).toContain("type: hours_met");
    expect(summary).not.toContain("T10:30:09");
    expect(summary).toMatch(/4:00:09/i);
  });

  it("falls back to the admin timezone when tz is missing or invalid", () => {
    expect(resolveAuditTimezone(undefined, "Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(resolveAuditTimezone("not-a-zone", "Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(resolveAuditTimezone("UTC", "Asia/Kolkata")).toBe("UTC");
    expect(resolveAuditTimezone("America/New_York", "Asia/Kolkata")).toBe("America/New_York");
  });

  it("covers every audit action code", () => {
    expect(describeAuditAction("integration_alert").label).toBe("Teams/email alert sent");
    expect(Object.keys(AUDIT_ACTION_GUIDE).length).toBeGreaterThan(40);
    const sample: AuditAction = "otp_verify_failed";
    expect(AUDIT_ACTION_GUIDE[sample].summary.length).toBeGreaterThan(10);
  });
});
