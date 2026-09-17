import { getAppConfig } from "./app-config";
import { prisma } from "./db";
import { computeDeviceAgentStatus, type AgentDeviceStatus } from "./device-status";
import { heartbeatInOffice } from "./heartbeat-office";

export type AgentSignalSnapshot = {
  recordedAt: Date;
  inOffice: boolean;
  ssid: string | null;
  vpnGateway: string | null;
  source: string;
};

export type AgentDeviceReference = {
  createdAt: Date;
  lastSeenAt: Date | null;
  installedAt: Date | null;
};

/** Expected activity ticks in a full 24h window at the configured interval. */
export function expectedTicksPerDay(heartbeatIntervalMinutes: number): number {
  return Math.floor((24 * 60) / heartbeatIntervalMinutes);
}

export function shouldUseActivityTicks(
  activityCount24h: number,
  hasLastActivity: boolean,
  hasLastHeartbeat: boolean,
): boolean {
  return activityCount24h > 0 || (hasLastActivity && !hasLastHeartbeat);
}

/** Server reporting uses activity ticks unless admin explicitly set legacy heartbeat mode. */
export function agentModeUsesActivityTicks(agentMode: string | null | undefined): boolean {
  return (agentMode ?? "events") !== "heartbeat";
}

export type AgentPulseRow = {
  at: Date;
  ssid: string | null;
  inOffice: boolean;
};

/** Rows must be sorted ascending by `at`. */
export function lastAgentSignalAtOrBefore(
  rows: Array<{ at: Date }>,
  lte: Date,
): Date | null {
  let last: Date | null = null;
  for (const row of rows) {
    if (row.at.getTime() > lte.getTime()) break;
    last = row.at;
  }
  return last;
}

export function dayPulsesInRange(
  rows: AgentPulseRow[],
  dayStart: Date,
  dayEnd: Date,
): AgentPulseRow[] {
  const startMs = dayStart.getTime();
  const endMs = dayEnd.getTime();
  return rows.filter((p) => p.at.getTime() >= startMs && p.at.getTime() <= endMs);
}

export function groupAgentPulseRowsByUserId<
  T extends { userId: string; at: Date; ssid: string | null; inOffice: boolean },
>(rows: T[]): Map<string, AgentPulseRow[]> {
  const byUser = new Map<string, AgentPulseRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push({ at: row.at, ssid: row.ssid, inOffice: row.inOffice });
    byUser.set(row.userId, list);
  }
  return byUser;
}

/**
 * Minimum ticks before flagging low activity. Returns null when the device is too new
 * (under 24h since install/registration) to evaluate fairly.
 */
export function lowActivityThreshold(
  expectedPerDay: number,
  referenceAt: Date | null,
  now: Date = new Date(),
): number | null {
  if (!referenceAt) return null;
  const hoursSince = (now.getTime() - referenceAt.getTime()) / (60 * 60 * 1000);
  if (hoursSince < 24) return null;
  const scaledExpected = expectedPerDay * Math.min(1, hoursSince / 24);
  return Math.max(10, Math.floor(scaledExpected * 0.1));
}

export function isLowActivityCount(
  pulsesLast24h: number,
  expectedPerDay: number,
  referenceAt: Date | null,
  now?: Date,
): boolean {
  const threshold = lowActivityThreshold(expectedPerDay, referenceAt, now);
  if (threshold === null) return false;
  return pulsesLast24h < threshold;
}

export function latestDeviceLastSeenAt(
  devices: AgentDeviceReference[],
): Date | null {
  let latest: Date | null = null;
  for (const device of devices) {
    if (!device.lastSeenAt) continue;
    if (!latest || device.lastSeenAt > latest) {
      latest = device.lastSeenAt;
    }
  }
  return latest;
}

export function minutesSinceAt(at: Date | null, now: Date = new Date()): number | null {
  if (!at) return null;
  return Math.round((now.getTime() - at.getTime()) / 60000);
}

export type AgentSyncHealthInput = {
  lastSyncedAt: Date | null;
  graceHours: number;
  pulseAgentHealthy: boolean;
  pulsesLast24h: number;
  expectedPulsesPerDay: number;
  deviceReferenceAt: Date | null;
};

export type AgentSyncHealth = {
  /** Agent is receiving expected sync activity. */
  healthy: boolean;
  /** Show stale sync warning (genuinely not syncing). */
  showStaleWarning: boolean;
  lowActivity: boolean;
  minutesSinceLastSync: number | null;
  syncStatus: AgentDeviceStatus;
};

/**
 * Dashboard sync health: stale warnings only when the agent is genuinely not syncing.
 * Healthy when recent pulse, device lastSeen within grace, or expected tick volume in 24h.
 */
export function resolveAgentSyncHealth(
  input: AgentSyncHealthInput,
  now: Date = new Date(),
): AgentSyncHealth {
  const minutesSinceLastSync = minutesSinceAt(input.lastSyncedAt, now);
  const syncStatus = computeDeviceAgentStatus(input.lastSyncedAt, input.graceHours, now);
  const lastSeenWithinGrace = syncStatus === "healthy";
  const lowActivity = isLowActivityCount(
    input.pulsesLast24h,
    input.expectedPulsesPerDay,
    input.deviceReferenceAt,
    now,
  );

  const healthy =
    input.pulseAgentHealthy || lastSeenWithinGrace || !lowActivity;

  const showStaleWarning = !!input.lastSyncedAt && !healthy;

  return {
    healthy,
    showStaleWarning,
    lowActivity,
    minutesSinceLastSync,
    syncStatus,
  };
}

export async function getLastOfficeActivityAt(userId: string): Promise<Date | null> {
  const tick = await prisma.activityTick.findFirst({
    where: { userId, inOffice: true },
    orderBy: { at: "desc" },
    select: { at: true },
  });
  return tick?.at ?? null;
}

export function deviceRegistrationReferenceAt(
  devices: AgentDeviceReference[],
): Date | null {
  if (devices.length === 0) return null;
  return devices.reduce<Date>((earliest, device) => {
    const at = device.installedAt ?? device.lastSeenAt ?? device.createdAt;
    return at < earliest ? at : earliest;
  }, devices[0].installedAt ?? devices[0].lastSeenAt ?? devices[0].createdAt);
}

/** Open visit is authoritative; pulse is a secondary signal when no visit is open. */
export function resolveInOfficeNow(params: {
  hasOpenVisit: boolean;
  pulseRecent: boolean;
  lastPulseInOffice: boolean;
}): boolean {
  if (params.hasOpenVisit) return true;
  return params.pulseRecent && params.lastPulseInOffice;
}

export async function resolveAgentSignalMode(
  userId: string,
  options?: { agentMode?: string },
): Promise<{
  useActivity: boolean;
  lastActivity: { at: Date; inOffice: boolean; ssid: string | null } | null;
  lastHeartbeat: {
    recordedAt: Date;
    inOffice: boolean;
    ssid: string | null;
    vpnGateway: string | null;
    source: string;
  } | null;
  activityCount24h: number;
}> {
  let agentMode = options?.agentMode;
  if (agentMode === undefined) {
    agentMode = (await getAppConfig()).agentMode ?? "events";
  }
  const useActivity = agentModeUsesActivityTicks(agentMode);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (useActivity) {
    const [activityCount24h, lastActivity] = await Promise.all([
      prisma.activityTick.count({
        where: { userId, at: { gte: since24h } },
      }),
      prisma.activityTick.findFirst({
        where: { userId },
        orderBy: { at: "desc" },
        select: { at: true, inOffice: true, ssid: true },
      }),
    ]);
    return { useActivity: true, lastActivity, lastHeartbeat: null, activityCount24h };
  }

  const [activityCount24h, lastHeartbeat] = await Promise.all([
    prisma.heartbeat.count({
      where: { userId, recordedAt: { gte: since24h } },
    }),
    prisma.heartbeat.findFirst({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      select: {
        recordedAt: true,
        inOffice: true,
        ssid: true,
        vpnGateway: true,
        source: true,
      },
    }),
  ]);

  return { useActivity: false, lastActivity: null, lastHeartbeat, activityCount24h };
}

export async function getLastAgentSignalAt(userId: string): Promise<Date | null> {
  const { useActivity, lastActivity, lastHeartbeat } = await resolveAgentSignalMode(userId);
  if (useActivity) return lastActivity?.at ?? null;
  return lastHeartbeat?.recordedAt ?? null;
}

/** Last agent signal at or before `lte` (any prior day), for historical stale checks. */
export async function getLastAgentSignalBefore(
  userId: string,
  lte: Date,
  useActivity: boolean,
): Promise<Date | null> {
  if (useActivity) {
    const tick = await prisma.activityTick.findFirst({
      where: { userId, at: { lte } },
      orderBy: { at: "desc" },
      select: { at: true },
    });
    return tick?.at ?? null;
  }

  const heartbeat = await prisma.heartbeat.findFirst({
    where: { userId, recordedAt: { lte } },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true },
  });
  return heartbeat?.recordedAt ?? null;
}

export async function getLastAgentSignalOnDay(
  userId: string,
  range: { gte: Date; lte: Date },
  useActivity: boolean,
): Promise<Date | null> {
  if (useActivity) {
    const tick = await prisma.activityTick.findFirst({
      where: { userId, at: { gte: range.gte, lte: range.lte } },
      orderBy: { at: "desc" },
      select: { at: true },
    });
    return tick?.at ?? null;
  }

  const heartbeat = await prisma.heartbeat.findFirst({
    where: { userId, recordedAt: { gte: range.gte, lte: range.lte } },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true },
  });
  return heartbeat?.recordedAt ?? null;
}

export function activityTickToSignal(
  tick: { at: Date; inOffice: boolean; ssid: string | null },
): AgentSignalSnapshot {
  return {
    recordedAt: tick.at,
    inOffice: tick.inOffice,
    ssid: tick.ssid,
    vpnGateway: null,
    source: "activity_tick",
  };
}

export function heartbeatToSignal(
  heartbeat: {
    recordedAt: Date;
    inOffice: boolean;
    ssid: string | null;
    vpnGateway: string | null;
    source: string;
  },
  officeSsids: string[],
): AgentSignalSnapshot {
  return {
    recordedAt: heartbeat.recordedAt,
    inOffice: heartbeatInOffice(heartbeat, officeSsids),
    ssid: heartbeat.ssid,
    vpnGateway: heartbeat.vpnGateway,
    source: heartbeat.source,
  };
}
