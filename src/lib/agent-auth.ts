import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { getAppConfig } from "./app-config";
import { logAuditEvent } from "./audit-log";

export async function authenticateAgentToken(token: string) {
  if (token.length < 16) {
    return { ok: false as const, status: 401, error: "Invalid token" };
  }

  const tokenPrefix = token.slice(0, 8);
  const agentToken = await prisma.agentToken.findUnique({
    where: { tokenPrefix },
    include: { user: true },
  });

  if (!agentToken || agentToken.revokedAt) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const valid = await bcrypt.compare(token, agentToken.tokenHash);
  if (!valid) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  return {
    ok: true as const,
    userId: agentToken.userId,
    agentTokenId: agentToken.id,
    agentToken,
  };
}

export async function bindAgentTokenToSerial(agentTokenId: string, serialNumber: string) {
  const agentToken = await prisma.agentToken.findUnique({ where: { id: agentTokenId } });
  if (!agentToken || agentToken.revokedAt) {
    return { ok: false as const, status: 401, error: "Invalid token" };
  }

  if (agentToken.boundSerialNumber && agentToken.boundSerialNumber !== serialNumber) {
    return {
      ok: false as const,
      status: 403,
      error: "This install token is already bound to another laptop",
    };
  }

  if (!agentToken.boundSerialNumber) {
    await prisma.agentToken.update({
      where: { id: agentTokenId },
      data: {
        boundSerialNumber: serialNumber,
        lastUsedAt: new Date(),
        pendingTokenEnc: null,
      },
    });
  } else {
    await prisma.agentToken.update({
      where: { id: agentTokenId },
      data: { lastUsedAt: new Date() },
    });
  }

  return { ok: true as const, newlyBound: !agentToken.boundSerialNumber };
}

export async function registerOrUpdateDevice(
  userId: string,
  serialNumber: string,
  agentTokenId?: string,
) {
  const config = await getAppConfig();

  const existing = await prisma.agentDevice.findUnique({
    where: { userId_serialNumber: { userId, serialNumber } },
  });

  if (existing) {
    await prisma.agentDevice.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
        ...(agentTokenId && !existing.agentTokenId ? { agentTokenId } : {}),
      },
    });
    return { ok: true as const, device: existing, registered: false };
  }

  const count = await prisma.agentDevice.count({ where: { userId } });
  if (count >= config.maxDevicesPerUser) {
    return {
      ok: false as const,
      status: 403,
      error: `Device limit reached (${config.maxDevicesPerUser} laptops)`,
    };
  }

  const device = await prisma.agentDevice.create({
    data: {
      userId,
      serialNumber,
      agentTokenId: agentTokenId ?? null,
      lastSeenAt: new Date(),
    },
  });

  return { ok: true as const, device, registered: true };
}

export async function logAgentDeviceRegistered(params: {
  userId: string;
  serialNumber: string;
  actorId?: string | null;
}) {
  return logAuditEvent({
    actorId: params.actorId ?? params.userId,
    action: "agent_device_registered",
    targetUserId: params.userId,
    details: { serialNumber: params.serialNumber },
  });
}

export async function listUserDevices(userId: string) {
  return prisma.agentDevice.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
  });
}

export async function removeDevice(deviceId: string) {
  return prisma.agentDevice.delete({ where: { id: deviceId } });
}

export async function removeDeviceForUser(userId: string, deviceId: string) {
  const device = await prisma.agentDevice.findFirst({
    where: { id: deviceId, userId },
  });
  if (!device) return null;
  return prisma.agentDevice.delete({ where: { id: deviceId } });
}
