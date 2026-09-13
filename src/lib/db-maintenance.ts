export type MaintenanceTable =
  | "heartbeats"
  | "agent_lifecycle_events"
  | "audit_logs"
  | "resolved_corrections"
  | "resolved_device_removals"
  | "resolved_timezone_requests"
  | "resolved_profile_changes"
  | "resolved_compliance_exemptions"
  | "past_out_of_office";

export type RetentionPeriod = "1_month" | "3_months" | "6_months" | "1_year";

/** Tables that must never be purged via data maintenance (revoke keys separately). */
export const NEVER_PURGED_TABLES = [
  "User",
  "Visit",
  "AgentDevice",
  "AgentToken",
  "AppConfig",
  "IntegrationApiKey",
  "UserNotificationPrefs",
  "InAppNotification",
] as const;

export const MAINTENANCE_TABLE_LABELS: Record<MaintenanceTable, string> = {
  heartbeats: "Heartbeats",
  agent_lifecycle_events: "Agent lifecycle events",
  audit_logs: "Audit logs",
  resolved_corrections: "Resolved correction requests",
  resolved_device_removals: "Resolved device removal requests",
  resolved_timezone_requests: "Resolved timezone requests",
  resolved_profile_changes: "Resolved profile change requests",
  resolved_compliance_exemptions: "Resolved HR exemption notifications",
  past_out_of_office: "Past out-of-office ranges",
};

export const RETENTION_PERIOD_LABELS: Record<RetentionPeriod, string> = {
  "1_month": "1 month",
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year": "1 year",
};

const RETENTION_DAYS: Record<RetentionPeriod, number> = {
  "1_month": 30,
  "3_months": 90,
  "6_months": 180,
  "1_year": 365,
};

export function isMaintenanceTable(value: string): value is MaintenanceTable {
  return value in MAINTENANCE_TABLE_LABELS;
}

export function isRetentionPeriod(value: string): value is RetentionPeriod {
  return value in RETENTION_DAYS;
}

export function retentionDaysFromPeriod(period: RetentionPeriod): number {
  return RETENTION_DAYS[period];
}

export function cutoffDateFromRetentionDays(retentionDays: number, now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

/** UTC day key (YYYY-MM-DD) for comparing UserOutOfOffice date ranges. */
export function dayKeyFromDate(date: Date): string {
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
