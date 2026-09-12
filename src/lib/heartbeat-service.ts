import { prisma } from "./db";
import { DEFAULT_OFFICE_SSIDS, isOfficeSsid, normalizeSsid } from "./constants";
import { getAppConfig, getAgentStaleMs, agentHealthGraceMs } from "./app-config";
import {
  activityTickToSignal,
  expectedTicksPerDay,
  getLastAgentSignalAt,
  getLastAgentSignalOnDay,
  heartbeatToSignal,
  resolveAgentSignalMode,
  resolveInOfficeNow,
  type AgentSignalSnapshot,
} from "./activity-signal";
import { heartbeatInOffice } from "./heartbeat-office";
import { maybePurgeOldHeartbeats } from "./heartbeat-retention";
import { laptopActiveHoursForDay, type LaptopActiveParams } from "./laptop-active";
import { daySpanMsForDay, dayKeyInTimezone, effectiveVisitEnd, type DaySpanParams } from "./visits";
import { dayBoundsFromKey, getDayBounds } from "./timezone-dates";
import { validateVisitTimestamps } from "./visit-validation";

export async function loadDaySpanContext(
  userId: string,
  dayKey: string,
  timezone: string,
): Promise<{
  visits: Awaited<ReturnType<typeof prisma.visit.findMany>>;
  params: DaySpanParams;
  lastHeartbeat: AgentSignalSnapshot | null;
  laptopActiveParams: LaptopActiveParams;
}> {
  const config = await getAppConfig();
  const allowlist = config.officeSsids;
  const staleMs = config.agentStaleMinutes * 60 * 1000;
  await closeEndOfDayOpenVisits(userId, timezone);
  await closeStaleOpenVisits(userId, staleMs);

  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(dayKey, timezone);
  const now = new Date();
  const { useActivity, lastActivity, lastHeartbeat: lastHeartbeatRow } =
    await resolveAgentSignalMode(userId);

  const visits = await prisma.visit.findMany({
    where: {
      userId,
      startAt: { lte: dayEnd },
      OR: [{ endAt: null }, { endAt: { gte: dayStart } }],
    },
    orderBy: { startAt: "asc" },
  });

  let firstInOfficeHeartbeatAt: Date | null = null;
  let lastInOfficeHeartbeatAt: Date | null = null;
  let firstHeartbeatAt: Date | null = null;
  let lastHeartbeatOnDay: Date | null = null;
  let lastSignalOverall: Date | null = null;
  let lastHeartbeat: AgentSignalSnapshot | null = null;

  if (useActivity) {
    const dayTicks = await prisma.activityTick.findMany({
      where: { userId, at: { gte: dayStart, lte: dayEnd } },
      orderBy: { at: "asc" },
      select: { at: true, ssid: true, inOffice: true },
    });
    const inOfficeToday = dayTicks.filter((tick) => tick.inOffice);
    firstInOfficeHeartbeatAt = inOfficeToday[0]?.at ?? null;
    lastInOfficeHeartbeatAt = inOfficeToday[inOfficeToday.length - 1]?.at ?? null;
    firstHeartbeatAt = dayTicks[0]?.at ?? null;
    lastHeartbeatOnDay = dayTicks[dayTicks.length - 1]?.at ?? null;
    lastSignalOverall = lastActivity?.at ?? null;
    lastHeartbeat = lastActivity ? activityTickToSignal(lastActivity) : null;
  } else {
    const dayHeartbeats = await prisma.heartbeat.findMany({
      where: {
        userId,
        recordedAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { recordedAt: "asc" },
      select: { recordedAt: true, ssid: true, inOffice: true },
    });
    const inOfficeToday = dayHeartbeats.filter((h) => heartbeatInOffice(h, allowlist));
    firstInOfficeHeartbeatAt = inOfficeToday[0]?.recordedAt ?? null;
    lastInOfficeHeartbeatAt =
      inOfficeToday[inOfficeToday.length - 1]?.recordedAt ?? null;
    firstHeartbeatAt = dayHeartbeats[0]?.recordedAt ?? null;
    lastHeartbeatOnDay = dayHeartbeats[dayHeartbeats.length - 1]?.recordedAt ?? null;
    lastSignalOverall = lastHeartbeatRow?.recordedAt ?? null;
    lastHeartbeat = lastHeartbeatRow ? heartbeatToSignal(lastHeartbeatRow, allowlist) : null;
  }

  return {
    visits,
    lastHeartbeat,
    params: {
      dayStart,
      dayEnd,
      now,
      staleMs,
      lastHeartbeatAt: lastSignalOverall,
      firstInOfficeHeartbeatAt,
      lastInOfficeHeartbeatAt,
    },
    laptopActiveParams: {
      dayStart,
      dayEnd,
      now,
      staleMs,
      firstHeartbeatAt,
      lastHeartbeatAt: lastHeartbeatOnDay,
      lastHeartbeatOverall: lastSignalOverall,
    },
  };
}

export async function processHeartbeat(params: {
  userId: string;
  ssid: string | null;
  vpnGateway?: string | null;
  recordedAt: Date;
  allowlist: string[];
}) {
  const { userId, vpnGateway, recordedAt, allowlist } = params;
  const storedSsid = params.ssid ? normalizeSsid(params.ssid) : null;
  const inOffice = isOfficeSsid(storedSsid, allowlist);

  const config = await getAppConfig();
  void maybePurgeOldHeartbeats(config.heartbeatRetentionDays);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  if (user) {
    await closeEndOfDayOpenVisits(userId, user.timezone);
  }

  await prisma.heartbeat.create({
    data: {
      userId,
      ssid: storedSsid,
      vpnGateway: vpnGateway ?? null,
      inOffice,
      source: "wifi",
      recordedAt,
    },
  });

  const staleMs = config.agentStaleMinutes * 60 * 1000;

  if (inOffice) {
    await upsertOpenVisit(userId, recordedAt, storedSsid, staleMs);
  } else {
    await closeOpenVisit(userId, recordedAt);
  }

  return { inOffice };
}

async function upsertOpenVisit(
  userId: string,
  at: Date,
  ssid: string | null,
  visitGapMs: number,
) {
  const open = await prisma.visit.findFirst({
    where: { userId, endAt: null },
    orderBy: { startAt: "desc" },
  });

  if (open) {
    const gap = at.getTime() - (open.updatedAt?.getTime() ?? open.startAt.getTime());
    if (gap <= visitGapMs) {
      await prisma.visit.update({
        where: { id: open.id },
        data: { updatedAt: at },
      });
      return;
    }
    await prisma.visit.update({
      where: { id: open.id },
      data: { endAt: open.updatedAt ?? open.startAt },
    });
  }

  await prisma.visit.create({
    data: {
      userId,
      startAt: at,
      source: "wifi",
      ssid,
    },
  });
}

async function closeOpenVisit(userId: string, at: Date) {
  const open = await prisma.visit.findFirst({
    where: { userId, endAt: null },
    orderBy: { startAt: "desc" },
  });
  if (!open) return;

  await prisma.visit.update({
    where: { id: open.id },
    data: { endAt: at },
  });
}

/** Close visits left open when the agent stopped sending heartbeats. */
export async function closeStaleOpenVisits(userId: string, staleMs?: number) {
  const gap = staleMs ?? (await getAgentStaleMs());
  const now = new Date();

  const open = await prisma.visit.findFirst({
    where: { userId, endAt: null },
    orderBy: { startAt: "desc" },
  });
  if (!open) return false;

  const lastSignalAt = await getLastAgentSignalAt(userId);

  const agentStale =
    !lastSignalAt || now.getTime() - lastSignalAt.getTime() > gap;

  if (!agentStale) return false;

  const endAt = effectiveVisitEnd({
    endAt: null,
    updatedAt: open.updatedAt,
    startAt: open.startAt,
    now,
    staleMs: gap,
    lastHeartbeatAt: lastSignalAt,
  });

  await prisma.visit.update({
    where: { id: open.id },
    data: { endAt },
  });
  return true;
}

/**
 * Close visits still open after their calendar day ended.
 * Uses the last heartbeat that day as logout time.
 */
export async function closeEndOfDayOpenVisits(userId: string, timezone: string) {
  const open = await prisma.visit.findFirst({
    where: { userId, endAt: null },
    orderBy: { startAt: "desc" },
  });
  if (!open) return false;

  const now = new Date();
  const visitDayKey = dayKeyInTimezone(open.startAt, timezone);
  const todayKey = dayKeyInTimezone(now, timezone);
  if (visitDayKey >= todayKey) return false;

  const dayEnd = dayBoundsFromKey(visitDayKey, timezone).end;
  const { useActivity } = await resolveAgentSignalMode(userId);
  const lastSignalAt = await getLastAgentSignalOnDay(
    userId,
    { gte: open.startAt, lte: dayEnd },
    useActivity,
  );

  const fallback = open.updatedAt <= dayEnd ? open.updatedAt : open.startAt;
  const endAt = lastSignalAt ?? fallback;
  const cappedEnd = endAt > dayEnd ? dayEnd : endAt;

  await prisma.visit.update({
    where: { id: open.id },
    data: { endAt: cappedEnd },
  });
  return true;
}

export async function createManualVisit(params: {
  userId: string;
  startAt: Date;
  endAt?: Date | null;
  ssid?: string | null;
}) {
  const timestampError = validateVisitTimestamps(params.startAt, params.endAt);
  if (timestampError) {
    throw new Error(timestampError);
  }
  if (params.endAt && params.endAt <= params.startAt) {
    throw new Error("endAt must be after startAt");
  }
  return prisma.visit.create({
    data: {
      userId: params.userId,
      startAt: params.startAt,
      endAt: params.endAt ?? null,
      source: "manual",
      ssid: params.ssid ?? null,
    },
  });
}

export async function checkInOffice(userId: string) {
  const open = await prisma.visit.findFirst({
    where: { userId, endAt: null },
    orderBy: { startAt: "desc" },
  });
  if (open) return open;

  return prisma.visit.create({
    data: {
      userId,
      startAt: new Date(),
      source: "manual",
      ssid: "Manual check-in",
    },
  });
}

export async function checkOutOffice(userId: string) {
  const open = await prisma.visit.findFirst({
    where: { userId, endAt: null },
    orderBy: { startAt: "desc" },
  });
  if (!open) return null;

  return prisma.visit.update({
    where: { id: open.id },
    data: { endAt: new Date() },
  });
}

export async function getTodaySummary(
  userId: string,
  timezone: string,
  hoursTarget: number,
  graceHours?: number,
) {
  const now = new Date();
  const { dayKey } = getDayBounds(now, timezone);
  const { visits, params, lastHeartbeat, laptopActiveParams } = await loadDaySpanContext(
    userId,
    dayKey,
    timezone,
  );

  const config = await getAppConfig();
  const effectiveGraceHours = graceHours ?? config.agentStaleGraceHours;
  const graceMs = agentHealthGraceMs(effectiveGraceHours);
  const pulseRecent =
    params.lastHeartbeatAt !== null &&
    now.getTime() - params.lastHeartbeatAt.getTime() <= params.staleMs;
  const agentHealthy =
    params.lastHeartbeatAt !== null &&
    now.getTime() - params.lastHeartbeatAt.getTime() <= graceMs;

  const totalMs = daySpanMsForDay(visits, params);
  const totalHours = totalMs / (1000 * 60 * 60);
  const laptopActiveHours = laptopActiveHoursForDay(laptopActiveParams);
  const lastPulseInOffice = lastHeartbeat?.inOffice ?? false;
  const hasOpenVisit = visits.some((visit) => visit.endAt === null);

  return {
    dayKey,
    totalHours,
    laptopActiveHours,
    hoursTarget,
    metTarget: totalHours >= hoursTarget,
    remainingHours: Math.max(0, hoursTarget - totalHours),
    inOfficeNow: resolveInOfficeNow({
      hasOpenVisit,
      pulseRecent,
      lastPulseInOffice,
    }),
    visits,
    lastHeartbeat,
    agentHealthy,
  };
}

/** Lightweight hours-target check for heartbeat alert short-circuit. */
export async function getQuickMetTarget(
  userId: string,
  timezone: string,
  hoursTarget: number,
): Promise<boolean> {
  const now = new Date();
  const { dayKey } = getDayBounds(now, timezone);
  const { visits, params } = await loadDaySpanContext(userId, dayKey, timezone);
  const totalMs = daySpanMsForDay(visits, params);
  return totalMs / (1000 * 60 * 60) >= hoursTarget;
}

export function laptopActiveHoursFromContext(
  laptopActiveParams: LaptopActiveParams,
): number {
  return laptopActiveHoursForDay(laptopActiveParams);
}

export async function getPulseStats(userId: string, graceHours: number) {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const config = await getAppConfig();

  const [
    { useActivity, lastActivity, lastHeartbeat, activityCount24h },
    recentActivity,
    activity24h,
    pulsesLast24h,
    recentPulses,
    heartbeats24h,
  ] = await Promise.all([
    resolveAgentSignalMode(userId),
    prisma.activityTick.findMany({
      where: { userId },
      orderBy: { at: "desc" },
      take: 12,
      select: { at: true, inOffice: true, ssid: true },
    }),
    prisma.activityTick.findMany({
      where: { userId, at: { gte: since24h } },
      select: { at: true },
      orderBy: { at: "asc" },
    }),
    prisma.heartbeat.count({
      where: { userId, recordedAt: { gte: since24h } },
    }),
    prisma.heartbeat.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      take: 12,
      select: { recordedAt: true, inOffice: true, ssid: true, vpnGateway: true, source: true },
    }),
    prisma.heartbeat.findMany({
      where: { userId, recordedAt: { gte: since24h } },
      select: { recordedAt: true },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  const lastSignalAt = useActivity ? lastActivity?.at : lastHeartbeat?.recordedAt;

  const minutesSinceLastPulse = lastSignalAt
    ? Math.round((now.getTime() - lastSignalAt.getTime()) / 60000)
    : null;

  const agentHealthy =
    lastSignalAt !== null &&
    lastSignalAt !== undefined &&
    now.getTime() - lastSignalAt.getTime() <= graceHours * 60 * 60 * 1000;

  const { officeSsids } = config;

  const effectivePulseCount = useActivity ? activityCount24h : pulsesLast24h;
  const timelineSource = useActivity
    ? activity24h.map((t) => t.at)
    : heartbeats24h.map((h) => h.recordedAt);

  const recentMapped = useActivity
    ? recentActivity.map((p) => ({
        recordedAt: p.at.toISOString(),
        inOffice: p.inOffice,
        ssid: p.ssid,
        vpnGateway: null,
        source: "activity_tick",
      }))
    : recentPulses.map((p) => ({
        recordedAt: p.recordedAt.toISOString(),
        inOffice: heartbeatInOffice(p, officeSsids),
        ssid: p.ssid,
        vpnGateway: p.vpnGateway,
        source: p.source,
      }));

  const lastRow = recentMapped[0] ?? null;

  return {
    pulsesLast24h: effectivePulseCount,
    expectedPulsesPerDay: expectedTicksPerDay(config.heartbeatIntervalMinutes),
    minutesSinceLastPulse,
    agentHealthy,
    lastHeartbeat: lastSignalAt?.toISOString() ?? null,
    pulseTimeline24h: buildPulseTimeline24h(timelineSource, now),
    recentPulses: recentMapped,
    lastSignal: lastRow
      ? {
          recordedAt: lastRow.recordedAt,
          inOffice: lastRow.inOffice,
          ssid: lastRow.ssid,
          vpnGateway: lastRow.vpnGateway,
          source: lastRow.source,
        }
      : null,
  };
}

export function buildPulseTimeline24h(
  recordedAts: Date[],
  now: Date = new Date(),
  bucketCount = 24,
): number[] {
  const buckets = Array(bucketCount).fill(0);
  const windowMs = 24 * 60 * 60 * 1000;
  const since = now.getTime() - windowMs;
  const bucketMs = windowMs / bucketCount;

  for (const recordedAt of recordedAts) {
    const t = recordedAt.getTime();
    if (t < since) continue;
    const idx = Math.min(bucketCount - 1, Math.floor((t - since) / bucketMs));
    buckets[idx]++;
  }

  return buckets;
}

export { DEFAULT_OFFICE_SSIDS };
