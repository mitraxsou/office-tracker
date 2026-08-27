import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { getAppConfig } from "./app-config";

export async function authenticateAgentToken(token: string) {
  if (token.length < 16) {
    return { ok: false as const, status: 401, error: "Invalid token" };
  }

  const tokenPrefix = token.slice(0, 8);
  const agentToken = await prisma.agentToken.findUnique({
    where: { tokenPrefix },
    include: { user: true },
  });

  if (!agentToken) {
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
  };
}

export async function registerOrUpdateDevice(userId: string, serialNumber: string) {
  const config = await getAppConfig();

  const existing = await prisma.agentDevice.findUnique({
    where: { userId_serialNumber: { userId, serialNumber } },
  });

  if (existing) {
    await prisma.agentDevice.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
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
      lastSeenAt: new Date(),
    },
  });

  return { ok: true as const, device, registered: true };
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
