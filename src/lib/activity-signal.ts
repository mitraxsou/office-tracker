import { prisma } from "./db";
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

export async function resolveAgentSignalMode(userId: string): Promise<{
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
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [activityCount24h, lastActivity, lastHeartbeat] = await Promise.all([
    prisma.activityTick.count({
      where: { userId, at: { gte: since24h } },
    }),
    prisma.activityTick.findFirst({
      where: { userId },
      orderBy: { at: "desc" },
      select: { at: true, inOffice: true, ssid: true },
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

  const useActivity = shouldUseActivityTicks(
    activityCount24h,
    lastActivity !== null,
    lastHeartbeat !== null,
  );

  return { useActivity, lastActivity, lastHeartbeat, activityCount24h };
}

export async function getLastAgentSignalAt(userId: string): Promise<Date | null> {
  const { useActivity, lastActivity, lastHeartbeat } = await resolveAgentSignalMode(userId);
  if (useActivity) return lastActivity?.at ?? null;
  return lastHeartbeat?.recordedAt ?? null;
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
