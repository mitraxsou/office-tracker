import { prisma } from "./db";
import { compareAgentVersions, getAgentVersion } from "./agent-version";

export function isDeviceAgentVersionStale(
  reportedVersion: string | null | undefined,
  serverVersion = getAgentVersion(),
): boolean {
  if (!reportedVersion) return true;
  return compareAgentVersions(serverVersion, reportedVersion) !== 0;
}

export type UserAgentVersionDeviceRow = {
  serialNumber: string;
  reportedVersion: string | null;
  stale: boolean;
  updatePending: boolean;
};

export type UserAgentVersionSummary = {
  serverVersion: string;
  needsUpdate: boolean;
  outdatedDeviceCount: number;
  devices: UserAgentVersionDeviceRow[];
};

/** Active laptops that should run the server’s current agent bundle. */
export function getUserAgentVersionSummary(
  devices: Array<{
    serialNumber: string;
    agentScriptVersion: string | null;
    forceAgentUpdate: boolean;
    uninstalledAt: Date | null;
  }>,
): UserAgentVersionSummary {
  const serverVersion = getAgentVersion();
  const active = devices.filter((d) => d.uninstalledAt === null);
  const rows: UserAgentVersionDeviceRow[] = active.map((d) => {
    const stale = isDeviceAgentVersionStale(d.agentScriptVersion, serverVersion);
    return {
      serialNumber: d.serialNumber,
      reportedVersion: d.agentScriptVersion,
      stale,
      updatePending: d.forceAgentUpdate,
    };
  });
  const needsUpdate = rows.some((r) => r.stale || r.updatePending);
  return {
    serverVersion,
    needsUpdate,
    outdatedDeviceCount: rows.filter((r) => r.stale).length,
    devices: rows,
  };
}

/**
 * Force reinstall signal for agents.
 *
 * Admin "Push update" only. A stale agentScriptVersion must stay a soft update:
 * force wipes the install folder first, so any failure there strands the laptop
 * and stops presence sync. Agents on 1.5.12+ refresh setup.ps1 from the server
 * on the soft path too, so routine version bumps never need force.
 */
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
  return device.forceAgentUpdate;
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

/** Clears admin Push update flags so agents stop force-reinstall loops. */
export async function clearForceAgentUpdateForAllDevices() {
  const result = await prisma.agentDevice.updateMany({
    where: { forceAgentUpdate: true },
    data: { forceAgentUpdate: false },
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
