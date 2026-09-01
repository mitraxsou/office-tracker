export type MaintenanceTable =
  | "heartbeats"
  | "audit_logs"
  | "resolved_corrections"
  | "resolved_device_removals"
  | "old_visits";

export type RetentionPeriod = "1_month" | "3_months" | "6_months" | "1_year";

export const MAINTENANCE_TABLE_LABELS: Record<MaintenanceTable, string> = {
  heartbeats: "Heartbeats",
  audit_logs: "Audit logs",
  resolved_corrections: "Resolved correction requests",
  resolved_device_removals: "Resolved device removal requests",
  old_visits: "Visits (closed only)",
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
    default:
      return { deleted: 0 };
  }
}
