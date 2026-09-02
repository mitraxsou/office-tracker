import { prisma } from "./db";
import { isOfficeSsid } from "./constants";
import { getAppConfig, getAgentStaleMs } from "./app-config";
import { heartbeatInOffice } from "./heartbeat-office";
import { maybePurgeOldHeartbeats } from "./heartbeat-retention";
import { daySpanMsForDay, dayKeyInTimezone, effectiveVisitEnd, type DaySpanParams } from "./visits";
import { dayBoundsFromKey, getDayBounds } from "./timezone-dates";

export async function loadDaySpanContext(
  userId: string,
  dayKey: string,
  timezone: string,
): Promise<{
  visits: Awaited<ReturnType<typeof prisma.visit.findMany>>;
  params: DaySpanParams;
  lastHeartbeat: Awaited<ReturnType<typeof prisma.heartbeat.findFirst>>;
}> {
  const config = await getAppConfig();
  const allowlist = config.officeSsids;
  const staleMs = config.agentStaleMinutes * 60 * 1000;
  await closeEndOfDayOpenVisits(userId, timezone);
  await closeStaleOpenVisits(userId, staleMs);

  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(dayKey, timezone);
  const now = new Date();

  const [visits, dayHeartbeats, lastHeartbeat] = await Promise.all([
    prisma.visit.findMany({
      where: {
        userId,
        startAt: { lte: dayEnd },
        OR: [{ endAt: null }, { endAt: { gte: dayStart } }],
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.heartbeat.findMany({
      where: {
        userId,
        recordedAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { recordedAt: "asc" },
      select: { recordedAt: true, ssid: true, inOffice: true },
    }),
    prisma.heartbeat.findFirst({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true, ssid: true, inOffice: true },
    }),
  ]);

  const inOfficeToday = dayHeartbeats.filter((h) => heartbeatInOffice(h, allowlist));
  const firstInOfficeHeartbeatAt = inOfficeToday[0]?.recordedAt ?? null;
  const lastInOfficeHeartbeatAt = inOfficeToday[inOfficeToday.length - 1]?.recordedAt ?? null;

  return {
    visits,
    lastHeartbeat,
    params: {
      dayStart,
      dayEnd,
      now,
      staleMs,
      lastHeartbeatAt: lastHeartbeat?.recordedAt ?? null,
      firstInOfficeHeartbeatAt,
      lastInOfficeHeartbeatAt,
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
  const { userId, ssid, vpnGateway, recordedAt, allowlist } = params;
  const inOffice = isOfficeSsid(ssid, allowlist);

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
      ssid,
      vpnGateway: vpnGateway ?? null,
      inOffice,
      source: "wifi",
      recordedAt,
    },
  });

  const staleMs = config.agentStaleMinutes * 60 * 1000;

  if (inOffice) {
    await upsertOpenVisit(userId, recordedAt, ssid, staleMs);
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

  const lastHeartbeat = await prisma.heartbeat.findFirst({
    where: { userId },
    orderBy: { recordedAt: "desc" },
  });

  const agentStale =
    !lastHeartbeat || now.getTime() - lastHeartbeat.recordedAt.getTime() > gap;

  if (!agentStale) return false;

  const endAt = effectiveVisitEnd({
    endAt: null,
    updatedAt: open.updatedAt,
    startAt: open.startAt,
    now,
    staleMs: gap,
    lastHeartbeatAt: lastHeartbeat?.recordedAt ?? null,
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
  const lastHeartbeat = await prisma.heartbeat.findFirst({
    where: {
      userId,
      recordedAt: { gte: open.startAt, lte: dayEnd },
    },
    orderBy: { recordedAt: "desc" },
  });

  const fallback = open.updatedAt <= dayEnd ? open.updatedAt : open.startAt;
  const endAt = lastHeartbeat?.recordedAt ?? fallback;
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
  endAt: Date;
  ssid?: string | null;
}) {
  return prisma.visit.create({
    data: {
      userId: params.userId,
      startAt: params.startAt,
      endAt: params.endAt,
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

export async function getTodaySummary(userId: string, timezone: string, hoursTarget: number) {
  const now = new Date();
  const { dayKey } = getDayBounds(now, timezone);
  const { visits, params, lastHeartbeat } = await loadDaySpanContext(userId, dayKey, timezone);

  const agentHealthy =
    params.lastHeartbeatAt !== null &&
    now.getTime() - params.lastHeartbeatAt.getTime() <= params.staleMs;

  const config = await getAppConfig();
  const openVisit = visits.find((v) => v.endAt === null);
  const totalMs = daySpanMsForDay(visits, params);
  const totalHours = totalMs / (1000 * 60 * 60);
  const lastPulseInOffice = lastHeartbeat
    ? heartbeatInOffice(lastHeartbeat, config.officeSsids)
    : false;

  return {
    dayKey,
    totalHours,
    hoursTarget,
    metTarget: totalHours >= hoursTarget,
    remainingHours: Math.max(0, hoursTarget - totalHours),
    inOfficeNow: agentHealthy && openVisit !== undefined && lastPulseInOffice,
    visits,
    lastHeartbeat,
    agentHealthy,
  };
}

export async function getPulseStats(userId: string, staleMinutes: number) {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [pulsesLast24h, recentPulses, lastHeartbeat, heartbeats24h] = await Promise.all([
    prisma.heartbeat.count({
      where: { userId, recordedAt: { gte: since24h } },
    }),
    prisma.heartbeat.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      take: 12,
      select: { recordedAt: true, inOffice: true, ssid: true },
    }),
    prisma.heartbeat.findFirst({
      where: { userId },
      orderBy: { recordedAt: "desc" },
    }),
    prisma.heartbeat.findMany({
      where: { userId, recordedAt: { gte: since24h } },
      select: { recordedAt: true },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  const minutesSinceLastPulse = lastHeartbeat
    ? Math.round((now.getTime() - lastHeartbeat.recordedAt.getTime()) / 60000)
    : null;

  const agentHealthy =
    lastHeartbeat !== null &&
    now.getTime() - lastHeartbeat.recordedAt.getTime() <= staleMinutes * 60 * 1000;

  const { officeSsids } = await getAppConfig();

  return {
    pulsesLast24h,
    expectedPulsesPerDay: 720,
    minutesSinceLastPulse,
    agentHealthy,
    lastHeartbeat: lastHeartbeat?.recordedAt.toISOString() ?? null,
    pulseTimeline24h: buildPulseTimeline24h(
      heartbeats24h.map((h) => h.recordedAt),
      now,
    ),
    recentPulses: recentPulses.map((p) => ({
      recordedAt: p.recordedAt.toISOString(),
      inOffice: heartbeatInOffice(p, officeSsids),
      ssid: p.ssid,
    })),
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
