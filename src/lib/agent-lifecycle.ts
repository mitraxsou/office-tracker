import { prisma } from "./db";

export type AgentLifecycleEventType =
  | "install"
  | "uninstall"
  | "first_heartbeat"
  | "reinstall";

export type AgentLifecycleSource =
  | "agent_script"
  | "heartbeat_bind"
  | "admin"
  | "api";

const INSTALL_LIKE_EVENTS: AgentLifecycleEventType[] = [
  "install",
  "first_heartbeat",
  "reinstall",
];

export function isInstallLikeLifecycleEvent(
  eventType: string,
): eventType is AgentLifecycleEventType {
  return (INSTALL_LIKE_EVENTS as string[]).includes(eventType);
}

/** True when the device should not appear in stale-agent follow-up. */
export function isDeviceExcludedFromFollowUp(input: {
  uninstalledAt: Date | null;
  latestLifecycleEventType: string | null;
  pendingRemoval: boolean;
  approvedRemoval: boolean;
  lastSeenAt: Date | null;
}): boolean {
  if (input.pendingRemoval || input.approvedRemoval) return true;
  if (!input.lastSeenAt) return true;
  if (input.uninstalledAt) return true;
  if (input.latestLifecycleEventType === "uninstall") return true;
  return false;
}

export function resolveHeartbeatLifecycleEventType(input: {
  registered: boolean;
  uninstalledAt: Date | null;
  installedAt: Date | null;
}): AgentLifecycleEventType | null {
  if (input.registered) return "install";
  if (input.uninstalledAt) return "reinstall";
  if (!input.installedAt) return "first_heartbeat";
  return null;
}

export async function recordAgentLifecycleEvent(params: {
  userId: string;
  deviceId?: string | null;
  serialNumber: string;
  eventType: AgentLifecycleEventType;
  source: AgentLifecycleSource;
  metadata?: Record<string, unknown>;
}) {
  return prisma.agentLifecycleEvent.create({
    data: {
      userId: params.userId,
      deviceId: params.deviceId ?? null,
      serialNumber: params.serialNumber,
      eventType: params.eventType,
      source: params.source,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}

export async function recordHeartbeatLifecycle(params: {
  userId: string;
  deviceId: string;
  serialNumber: string;
  registered: boolean;
  tokenPrefix?: string;
  hostname?: string;
}) {
  const device = await prisma.agentDevice.findUnique({
    where: { id: params.deviceId },
    select: { installedAt: true, uninstalledAt: true },
  });
  if (!device) return null;

  const eventType = resolveHeartbeatLifecycleEventType({
    registered: params.registered,
    uninstalledAt: device.uninstalledAt,
    installedAt: device.installedAt,
  });
  if (!eventType) return null;

  const now = new Date();
  const metadata: Record<string, unknown> = {};
  if (params.tokenPrefix) metadata.tokenPrefix = params.tokenPrefix;
  if (params.hostname) metadata.hostname = params.hostname;

  await recordAgentLifecycleEvent({
    userId: params.userId,
    deviceId: params.deviceId,
    serialNumber: params.serialNumber,
    eventType,
    source: "heartbeat_bind",
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  });

  await prisma.agentDevice.update({
    where: { id: params.deviceId },
    data: {
      installedAt: device.installedAt ?? now,
      uninstalledAt: null,
    },
  });

  return eventType;
}

export async function recordAgentUninstall(params: {
  userId: string;
  deviceId?: string | null;
  serialNumber: string;
  source: AgentLifecycleSource;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date();

  await recordAgentLifecycleEvent({
    userId: params.userId,
    deviceId: params.deviceId ?? null,
    serialNumber: params.serialNumber,
    eventType: "uninstall",
    source: params.source,
    metadata: params.metadata,
  });

  if (params.deviceId) {
    await prisma.agentDevice.update({
      where: { id: params.deviceId },
      data: { uninstalledAt: now },
    });
  }

  return { ok: true as const };
}

export async function getLatestLifecycleEventByDevice(
  deviceIds: string[],
): Promise<Map<string, string>> {
  if (deviceIds.length === 0) return new Map();

  const events = await prisma.agentLifecycleEvent.findMany({
    where: { deviceId: { in: deviceIds } },
    orderBy: { createdAt: "desc" },
    select: { deviceId: true, eventType: true },
  });

  const latestByDevice = new Map<string, string>();
  for (const event of events) {
    if (!event.deviceId || latestByDevice.has(event.deviceId)) continue;
    latestByDevice.set(event.deviceId, event.eventType);
  }
  return latestByDevice;
}

export async function getApprovedRemovalDeviceIds(deviceIds: string[]): Promise<Set<string>> {
  if (deviceIds.length === 0) return new Set();

  const approved = await prisma.deviceRemovalRequest.findMany({
    where: { deviceId: { in: deviceIds }, status: "approved" },
    select: { deviceId: true },
  });
  return new Set(approved.map((r) => r.deviceId));
}

export async function getRecentLifecycleEvents(limit = 50) {
  const events = await prisma.agentLifecycleEvent.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true, name: true } },
    },
  });

  return events.map((event) => ({
    id: event.id,
    userId: event.userId,
    userEmail: event.user.email,
    userName: event.user.name,
    deviceId: event.deviceId,
    serialNumber: event.serialNumber,
    eventType: event.eventType,
    source: event.source,
    metadata: event.metadata ? (JSON.parse(event.metadata) as Record<string, unknown>) : null,
    createdAt: event.createdAt.toISOString(),
  }));
}

export async function getLifecycleEventsForUser(
  userId: string,
  limit = 20,
  options?: { from?: Date; to?: Date },
) {
  const events = await prisma.agentLifecycleEvent.findMany({
    where: {
      userId,
      ...(options?.from || options?.to
        ? {
            createdAt: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lte: options.to } : {}),
            },
          }
        : {}),
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return events.map((event) => ({
    id: event.id,
    deviceId: event.deviceId,
    serialNumber: event.serialNumber,
    eventType: event.eventType,
    source: event.source,
    metadata: event.metadata ? (JSON.parse(event.metadata) as Record<string, unknown>) : null,
    createdAt: event.createdAt.toISOString(),
  }));
}

export async function userHasActiveInstalledDevice(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agentDeregisteredAt: true },
  });
  if (user?.agentDeregisteredAt) return false;

  const devices = await prisma.agentDevice.findMany({
    where: { userId },
    select: { id: true, lastSeenAt: true, uninstalledAt: true },
  });
  if (devices.length === 0) return false;

  const deviceIds = devices.map((d) => d.id);
  const [latestEvents, approvedRemovals, openRequests] = await Promise.all([
    getLatestLifecycleEventByDevice(deviceIds),
    getApprovedRemovalDeviceIds(deviceIds),
    prisma.deviceRemovalRequest.findMany({
      where: { userId, status: "open" },
      select: { deviceId: true },
    }),
  ]);
  const pendingIds = new Set(openRequests.map((r) => r.deviceId));

  return devices.some(
    (device) =>
      !isDeviceExcludedFromFollowUp({
        uninstalledAt: device.uninstalledAt,
        latestLifecycleEventType: latestEvents.get(device.id) ?? null,
        pendingRemoval: pendingIds.has(device.id),
        approvedRemoval: approvedRemovals.has(device.id),
        lastSeenAt: device.lastSeenAt,
      }),
  );
}
