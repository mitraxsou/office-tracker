import { prisma } from "./db";
import { getAppConfig, getEffectiveAgentStaleGraceHours } from "./app-config";
import {
  agentStatusLabel,
  computeDeviceAgentStatus,
  type AgentDeviceStatus,
} from "./device-status";
import {
  getApprovedRemovalDeviceIds,
  getLatestLifecycleEventByDevice,
  isDeviceExcludedFromFollowUp,
} from "./agent-lifecycle";
import { isUserOutOfOffice } from "./out-of-office";
import { isWeekendDay } from "./admin-day-compliance";
import { dayKeyInTimezone } from "./notification-prefs";

export type AgentFollowUpStatusFilter = "all" | "stale" | "offline";

export type AgentFollowUpDevice = {
  deviceId: string;
  serialNumber: string;
  label: string | null;
  lastHeartbeatAt: string | null;
  minutesSinceLastPulse: number | null;
  agentStatus: "stale" | "offline";
  agentStatusLabel: string;
  boundTokenLabel: string | null;
  connectionHistory: "had_heartbeats";
  pendingRemoval: false;
};

export type AgentFollowUpRow = {
  userId: string;
  email: string;
  name: string | null;
  timezone: string;
  devices: AgentFollowUpDevice[];
  worstAgentStatus: "stale" | "offline";
  stalestMinutesSinceLastPulse: number;
};

export function minutesSinceLastPulse(
  lastSeenAt: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!lastSeenAt) return null;
  const seen = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  return Math.max(0, Math.floor((now.getTime() - seen.getTime()) / (60 * 1000)));
}

/** Device is installed, not pending uninstall, and agent pulses have gone stale or offline. */
export function shouldIncludeDeviceForFollowUp(input: {
  lastSeenAt: Date | null;
  pendingRemoval: boolean;
  approvedRemoval: boolean;
  uninstalledAt: Date | null;
  latestLifecycleEventType: string | null;
  agentStatus: AgentDeviceStatus;
}): boolean {
  if (
    isDeviceExcludedFromFollowUp({
      uninstalledAt: input.uninstalledAt,
      latestLifecycleEventType: input.latestLifecycleEventType,
      pendingRemoval: input.pendingRemoval,
      approvedRemoval: input.approvedRemoval,
      lastSeenAt: input.lastSeenAt,
    })
  ) {
    return false;
  }
  return input.agentStatus === "stale" || input.agentStatus === "offline";
}

export function matchesFollowUpStatusFilter(
  agentStatus: "stale" | "offline",
  filter: AgentFollowUpStatusFilter,
): boolean {
  if (filter === "all") return true;
  return agentStatus === filter;
}

const statusRank: Record<"stale" | "offline", number> = {
  offline: 0,
  stale: 1,
};

export function compareFollowUpRows(a: AgentFollowUpRow, b: AgentFollowUpRow): number {
  const rankDiff = statusRank[a.worstAgentStatus] - statusRank[b.worstAgentStatus];
  if (rankDiff !== 0) return rankDiff;
  if (a.stalestMinutesSinceLastPulse !== b.stalestMinutesSinceLastPulse) {
    return b.stalestMinutesSinceLastPulse - a.stalestMinutesSinceLastPulse;
  }
  return a.email.localeCompare(b.email);
}

export async function getAgentFollowUpReport(options?: {
  status?: AgentFollowUpStatusFilter;
  now?: Date;
}): Promise<{
  count: number;
  staleThresholdHours: number;
  updatedAt: string;
  users: AgentFollowUpRow[];
}> {
  const filter = options?.status ?? "all";
  const now = options?.now ?? new Date();
  const config = await getAppConfig();

  const [devices, openRequests, boundTokens] = await Promise.all([
    prisma.agentDevice.findMany({
      include: {
        user: {
          select: { id: true, email: true, name: true, timezone: true, agentStaleGraceHours: true },
        },
      },
      orderBy: { lastSeenAt: "asc" },
    }),
    prisma.deviceRemovalRequest.findMany({
      where: { status: "open" },
      select: { deviceId: true },
    }),
    prisma.agentToken.findMany({
      where: { revokedAt: null, boundSerialNumber: { not: null } },
      select: { userId: true, boundSerialNumber: true, label: true },
    }),
  ]);

  const deviceIds = devices.map((d) => d.id);
  const [latestLifecycleEvents, approvedRemovalIds] = await Promise.all([
    getLatestLifecycleEventByDevice(deviceIds),
    getApprovedRemovalDeviceIds(deviceIds),
  ]);

  const pendingDeviceIds = new Set(openRequests.map((r) => r.deviceId));
  const tokenByUserSerial = new Map<string, string | null>();
  for (const token of boundTokens) {
    if (!token.boundSerialNumber) continue;
    tokenByUserSerial.set(`${token.userId}:${token.boundSerialNumber}`, token.label);
  }

  const rowsByUser = new Map<string, AgentFollowUpRow>();
  const oooCache = new Map<string, boolean>();

  for (const device of devices) {
    const userDayKey = dayKeyInTimezone(now, device.user.timezone);
    if (isWeekendDay(userDayKey)) continue;

    let isOoo = oooCache.get(device.userId);
    if (isOoo === undefined) {
      isOoo = await isUserOutOfOffice(device.userId, userDayKey);
      oooCache.set(device.userId, isOoo);
    }
    if (isOoo) continue;

    const graceHours = await getEffectiveAgentStaleGraceHours(device.user);
    const pendingRemoval = pendingDeviceIds.has(device.id);
    const agentStatus = computeDeviceAgentStatus(device.lastSeenAt, graceHours, now);

    if (
      !shouldIncludeDeviceForFollowUp({
        lastSeenAt: device.lastSeenAt,
        pendingRemoval,
        approvedRemoval: approvedRemovalIds.has(device.id),
        uninstalledAt: device.uninstalledAt,
        latestLifecycleEventType: latestLifecycleEvents.get(device.id) ?? null,
        agentStatus,
      })
    ) {
      continue;
    }

    const followUpStatus = agentStatus as "stale" | "offline";
    if (!matchesFollowUpStatusFilter(followUpStatus, filter)) {
      continue;
    }

    const minutes = minutesSinceLastPulse(device.lastSeenAt, now) ?? 0;
    const followUpDevice: AgentFollowUpDevice = {
      deviceId: device.id,
      serialNumber: device.serialNumber,
      label: device.label,
      lastHeartbeatAt: device.lastSeenAt?.toISOString() ?? null,
      minutesSinceLastPulse: minutes,
      agentStatus: followUpStatus,
      agentStatusLabel: agentStatusLabel(followUpStatus),
      boundTokenLabel: tokenByUserSerial.get(`${device.userId}:${device.serialNumber}`) ?? null,
      connectionHistory: "had_heartbeats",
      pendingRemoval: false,
    };

    const existing = rowsByUser.get(device.userId);
    if (!existing) {
      rowsByUser.set(device.userId, {
        userId: device.user.id,
        email: device.user.email,
        name: device.user.name,
        timezone: device.user.timezone,
        devices: [followUpDevice],
        worstAgentStatus: followUpStatus,
        stalestMinutesSinceLastPulse: minutes,
      });
      continue;
    }

    existing.devices.push(followUpDevice);
    if (statusRank[followUpStatus] < statusRank[existing.worstAgentStatus]) {
      existing.worstAgentStatus = followUpStatus;
    }
    if (minutes > existing.stalestMinutesSinceLastPulse) {
      existing.stalestMinutesSinceLastPulse = minutes;
    }
  }

  const users = Array.from(rowsByUser.values()).sort(compareFollowUpRows);

  return {
    count: users.length,
    staleThresholdHours: config.agentStaleGraceHours,
    updatedAt: now.toISOString(),
    users,
  };
}
