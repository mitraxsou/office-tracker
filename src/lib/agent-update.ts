import { prisma } from "./db";
import { compareAgentVersions, getAgentVersion } from "./agent-version";

export function isDeviceAgentVersionStale(
  reportedVersion: string | null | undefined,
  serverVersion = getAgentVersion(),
): boolean {
  if (!reportedVersion) return true;
  return compareAgentVersions(serverVersion, reportedVersion) !== 0;
}

export async function getDeviceForceAgentUpdate(
  userId: string,
  serialNumber: string | null,
): Promise<boolean> {
  if (!serialNumber) return false;

  const device = await prisma.agentDevice.findUnique({
    where: { userId_serialNumber: { userId, serialNumber } },
    select: { forceAgentUpdate: true, agentScriptVersion: true },
  });

  if (!device) return false;

  // Config polling is also the recovery path for agents that predate heartbeat version
  // reporting or have a stale script beside a current version.txt. Force a bundle refresh
  // until a subsequent heartbeat reports the expected version.
  return (
    device.forceAgentUpdate ||
    isDeviceAgentVersionStale(device.agentScriptVersion, getAgentVersion())
  );
}

export async function recordDeviceScriptVersion(
  userId: string,
  serialNumber: string,
  scriptVersion: string,
) {
  const serverVersion = getAgentVersion();
  const upToDate = compareAgentVersions(scriptVersion, serverVersion) === 0;

  await prisma.agentDevice.update({
    where: { userId_serialNumber: { userId, serialNumber } },
    data: {
      agentScriptVersion: scriptVersion,
      agentVersionReportedAt: new Date(),
      ...(upToDate ? { forceAgentUpdate: false } : {}),
    },
  });
}

export async function requestAgentUpdateForDevice(deviceId: string) {
  return prisma.agentDevice.update({
    where: { id: deviceId },
    data: { forceAgentUpdate: true },
  });
}

export async function requestAgentUpdateForUser(userId: string) {
  const result = await prisma.agentDevice.updateMany({
    where: { userId, uninstalledAt: null },
    data: { forceAgentUpdate: true },
  });
  return result.count;
}

export async function requestAgentUpdateForAllDevices() {
  const result = await prisma.agentDevice.updateMany({
    where: { uninstalledAt: null },
    data: { forceAgentUpdate: true },
  });
  return result.count;
}

export async function requestAgentUpdateForUsers(userIds: string[]) {
  if (userIds.length === 0) return 0;
  const result = await prisma.agentDevice.updateMany({
    where: { userId: { in: userIds }, uninstalledAt: null },
    data: { forceAgentUpdate: true },
  });
  return result.count;
}
