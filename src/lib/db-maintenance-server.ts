import { prisma } from "./db";
import type { MaintenanceTable } from "./db-maintenance";
import { dayKeyFromDate } from "./db-maintenance";

const RESOLVED_REQUEST_WHERE = (cutoff: Date) => ({
  status: { in: ["approved", "rejected"] },
  reviewedAt: { lt: cutoff },
});

export async function countRowsForPurge(table: MaintenanceTable, cutoff: Date): Promise<number> {
  switch (table) {
    case "heartbeats":
      return prisma.heartbeat.count({ where: { recordedAt: { lt: cutoff } } });
    case "activity_ticks":
      return prisma.activityTick.count({ where: { at: { lt: cutoff } } });
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
  switch (table) {
    case "heartbeats": {
      const result = await prisma.heartbeat.deleteMany({
        where: { recordedAt: { lt: cutoff } },
      });
      return { deleted: result.count };
    }
    case "activity_ticks": {
      const result = await prisma.activityTick.deleteMany({
        where: { at: { lt: cutoff } },
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
