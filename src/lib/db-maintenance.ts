export type MaintenanceTable =
  | "heartbeats"
  | "old_visits"
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
  "AgentDevice",
  "AgentToken",
  "AppConfig",
  "IntegrationApiKey",
  "UserNotificationPrefs",
  "InAppNotification",
] as const;

export const MAINTENANCE_TABLE_LABELS: Record<MaintenanceTable, string> = {
  heartbeats: "Heartbeats",
  old_visits: "Visits (closed only)",
  agent_lifecycle_events: "Agent lifecycle events",
  audit_logs: "Audit logs",
  resolved_corrections: "Resolved correction requests",
  resolved_device_removals: "Resolved device removal requests",
  resolved_timezone_requests: "Resolved timezone requests",
  resolved_profile_changes: "Resolved profile change requests",
  resolved_compliance_exemptions: "Resolved compliance exemption requests",
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

const RESOLVED_REQUEST_WHERE = (cutoff: Date) => ({
  status: { in: ["approved", "rejected"] },
  reviewedAt: { lt: cutoff },
});

export async function countRowsForPurge(table: MaintenanceTable, cutoff: Date): Promise<number> {
  const { prisma } = await import("./db");

  switch (table) {
    case "heartbeats":
      return prisma.heartbeat.count({ where: { recordedAt: { lt: cutoff } } });
    case "audit_logs":
      return prisma.auditLog.count({ where: { createdAt: { lt: cutoff } } });
    case "resolved_corrections":
      return prisma.visitCorrectionRequest.count({
        where: { status: "resolved", resolvedAt: { lt: cutoff } },
      });
    case "resolved_device_removals":
      return prisma.deviceRemovalRequest.count({
        where: { status: { not: "open" }, resolvedAt: { lt: cutoff } },
      });
    case "old_visits":
      return prisma.visit.count({
        where: {
          endAt: { not: null, lt: cutoff },
          correctionRequests: { none: { status: "open" } },
        },
      });
    case "agent_lifecycle_events":
      return prisma.agentLifecycleEvent.count({ where: { createdAt: { lt: cutoff } } });
    case "resolved_timezone_requests":
      return prisma.timezoneChangeRequest.count({ where: RESOLVED_REQUEST_WHERE(cutoff) });
    case "resolved_profile_changes":
      return prisma.profileChangeRequest.count({ where: RESOLVED_REQUEST_WHERE(cutoff) });
    case "resolved_compliance_exemptions":
      return prisma.complianceExemptionRequest.count({ where: RESOLVED_REQUEST_WHERE(cutoff) });
    case "past_out_of_office": {
      const cutoffDayKey = dayKeyFromDate(cutoff);
      return prisma.userOutOfOffice.count({ where: { endDate: { lt: cutoffDayKey } } });
    }
    default:
      return 0;
  }
}

export async function purgeTableRows(
  table: MaintenanceTable,
  cutoff: Date,
): Promise<{ deleted: number }> {
  const { prisma } = await import("./db");

  switch (table) {
    case "heartbeats": {
      const result = await prisma.heartbeat.deleteMany({
        where: { recordedAt: { lt: cutoff } },
      });
      return { deleted: result.count };
    }
    case "audit_logs": {
      const result = await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      return { deleted: result.count };
    }
    case "resolved_corrections": {
      const ids = await prisma.visitCorrectionRequest.findMany({
        where: { status: "resolved", resolvedAt: { lt: cutoff } },
        select: { id: true },
      });
      if (ids.length === 0) return { deleted: 0 };
      await prisma.visitCorrectionMessage.deleteMany({
        where: { requestId: { in: ids.map((r) => r.id) } },
      });
      const result = await prisma.visitCorrectionRequest.deleteMany({
        where: { id: { in: ids.map((r) => r.id) } },
      });
      return { deleted: result.count };
    }
    case "resolved_device_removals": {
      const result = await prisma.deviceRemovalRequest.deleteMany({
        where: { status: { not: "open" }, resolvedAt: { lt: cutoff } },
      });
      return { deleted: result.count };
    }
    case "old_visits": {
      const result = await prisma.visit.deleteMany({
        where: {
          endAt: { not: null, lt: cutoff },
          correctionRequests: { none: { status: "open" } },
        },
      });
      return { deleted: result.count };
    }
    case "agent_lifecycle_events": {
      const result = await prisma.agentLifecycleEvent.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      return { deleted: result.count };
    }
    case "resolved_timezone_requests": {
      const result = await prisma.timezoneChangeRequest.deleteMany({
        where: RESOLVED_REQUEST_WHERE(cutoff),
      });
      return { deleted: result.count };
    }
    case "resolved_profile_changes": {
      const result = await prisma.profileChangeRequest.deleteMany({
        where: RESOLVED_REQUEST_WHERE(cutoff),
      });
      return { deleted: result.count };
    }
    case "resolved_compliance_exemptions": {
      const result = await prisma.complianceExemptionRequest.deleteMany({
        where: RESOLVED_REQUEST_WHERE(cutoff),
      });
      return { deleted: result.count };
    }
    case "past_out_of_office": {
      const cutoffDayKey = dayKeyFromDate(cutoff);
      const result = await prisma.userOutOfOffice.deleteMany({
        where: { endDate: { lt: cutoffDayKey } },
      });
      return { deleted: result.count };
    }
    default:
      return { deleted: 0 };
  }
}
