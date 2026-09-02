import { prisma } from "./db";
import { getEffectiveAgentStaleGraceHours } from "./app-config";
import {
  agentStatusClass,
  agentStatusLabel,
  computeDeviceAgentStatus,
  type AgentDeviceStatus,
} from "./device-status";

export type EnrichedDevice = {
  id: string;
  serialNumber: string;
  label: string | null;
  lastSeenAt: string | null;
  installedAt: string | null;
  uninstalledAt: string | null;
  createdAt: string;
  agentStatus: AgentDeviceStatus;
  agentStatusLabel: string;
  pendingRemoval: boolean;
  boundTokenLabel: string | null;
  isUninstalled: boolean;
};

export async function getEnrichedDevicesForUser(userId: string): Promise<EnrichedDevice[]> {
  const [user] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { agentStaleGraceHours: true },
    }),
  ]);
  const graceHours = await getEffectiveAgentStaleGraceHours(
    user ?? { agentStaleGraceHours: null },
  );
  const [devices, openRequests, boundTokens] = await Promise.all([
    prisma.agentDevice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.deviceRemovalRequest.findMany({
      where: { userId, status: "open" },
      select: { deviceId: true },
    }),
    prisma.agentToken.findMany({
      where: { userId, revokedAt: null, boundSerialNumber: { not: null } },
      select: { boundSerialNumber: true, label: true },
    }),
  ]);

  const pendingDeviceIds = new Set(openRequests.map((r) => r.deviceId));
  const tokenBySerial = new Map(
    boundTokens
      .filter((t) => t.boundSerialNumber)
      .map((t) => [t.boundSerialNumber!, t.label]),
  );

  return devices.map((d) => {
    const isUninstalled = d.uninstalledAt !== null;
    const agentStatus = isUninstalled
      ? "never"
      : computeDeviceAgentStatus(d.lastSeenAt, graceHours);
    return {
      id: d.id,
      serialNumber: d.serialNumber,
      label: d.label,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      installedAt: d.installedAt?.toISOString() ?? null,
      uninstalledAt: d.uninstalledAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      agentStatus,
      agentStatusLabel: isUninstalled ? "Uninstalled" : agentStatusLabel(agentStatus),
      pendingRemoval: pendingDeviceIds.has(d.id),
      boundTokenLabel: tokenBySerial.get(d.serialNumber) ?? null,
      isUninstalled,
    };
  });
}

export { agentStatusClass, agentStatusLabel };
