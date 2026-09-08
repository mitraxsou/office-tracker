import { removeDevice } from "./agent-auth";
import { recordAgentUninstall } from "./agent-lifecycle";
import { logAuditEvent } from "./audit-log";
import { prisma } from "./db";

/** True when the user should be monitored for stale-agent compliance. */
export function userHasInstalledAgentForStaleChecks(input: {
  agentDeregisteredAt: Date | null;
  agentDevices: Array<{ lastSeenAt: Date | null }>;
}): boolean {
  if (input.agentDeregisteredAt) return false;
  return input.agentDevices.some((device) => device.lastSeenAt !== null);
}

export function isUserAgentDeregistered(agentDeregisteredAt: Date | null | undefined): boolean {
  return agentDeregisteredAt != null;
}

export async function clearAgentDeregistration(userId: string) {
  await prisma.user.updateMany({
    where: { id: userId, agentDeregisteredAt: { not: null } },
    data: { agentDeregisteredAt: null },
  });
}

export async function deregisterUserAgent(userId: string, actorId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      agentDevices: true,
      agentTokens: { where: { revokedAt: null } },
    },
  });

  if (!user) {
    return { ok: false as const, status: 404, error: "User not found" };
  }

  if (user.agentDeregisteredAt) {
    return { ok: true as const, alreadyDeregistered: true };
  }

  const now = new Date();

  await prisma.agentToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now, pendingTokenEnc: null },
  });

  for (const device of user.agentDevices) {
    await recordAgentUninstall({
      userId,
      deviceId: device.id,
      serialNumber: device.serialNumber,
      source: "admin",
      metadata: { deregisteredByAdminId: actorId },
    });
    await removeDevice(device.id);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { agentDeregisteredAt: now },
  });

  await logAuditEvent({
    actorId,
    action: "agent_deregister",
    targetUserId: userId,
    details: {
      deviceCount: user.agentDevices.length,
      revokedTokenCount: user.agentTokens.length,
    },
  });

  return {
    ok: true as const,
    alreadyDeregistered: false,
    deviceCount: user.agentDevices.length,
    revokedTokenCount: user.agentTokens.length,
  };
}
