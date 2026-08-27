import { prisma } from "./db";

export type AuditAction =
  | "visit_create"
  | "visit_update"
  | "visit_delete"
  | "device_remove"
  | "config_update";

export async function logAuditEvent(params: {
  actorId: string;
  action: AuditAction;
  targetUserId?: string | null;
  details?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetUserId: params.targetUserId ?? null,
      details: params.details ? JSON.stringify(params.details) : null,
    },
  });
}

export async function getRecentAuditLogs(limit = 20) {
  const logs = await prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      actor: { select: { email: true, name: true } },
      targetUser: { select: { email: true, name: true } },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    createdAt: log.createdAt.toISOString(),
    actorEmail: log.actor.email,
    targetEmail: log.targetUser?.email ?? null,
    details: log.details ? (JSON.parse(log.details) as Record<string, unknown>) : null,
  }));
}
