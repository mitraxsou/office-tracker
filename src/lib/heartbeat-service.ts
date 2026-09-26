import { prisma } from "./db";
import { DEFAULT_OFFICE_SSIDS, isOfficeSsid, normalizeSsid } from "./constants";
import { getAppConfig, getAgentStaleMs, getEventModeAgentStaleMs, agentHealthGraceMs } from "./app-config";
import {
  activityTickToSignal,
  agentModeUsesActivityTicks,
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
import { resolveLaptopActiveForDay, laptopActiveHoursForDay, type LaptopActiveParams } from "./laptop-active";
import { daySpanMsForDay, dayKeyInTimezone, effectiveVisitEnd, type DaySpanParams } from "./visits";
import { dayBoundsFromKey, getDayBounds } from "./timezone-dates";
import { validateVisitTimestamps } from "./visit-validation";

/** Skip repeat maintenance on dashboard reads within this window. */
export const VISIT_MAINTENANCE_THROTTLE_MS = 15 * 60 * 1000;

export type DayPulseRow = {
  at: Date;
  ssid: string | null;
  inOffice: boolean;
};

export function filterInOfficeDayPulses(
  dayPulses: DayPulseRow[],
  useActivity: boolean,
  officeSsids: string[],
): DayPulseRow[] {
  if (useActivity) return dayPulses.filter((p) => p.inOffice);
  return dayPulses.filter((p) => heartbeatInOffice(p, officeSsids));
}

export async function loadDayPulseRowsForDay(
  userId: string,
  dayStart: Date,
  dayEnd: Date,
  useActivity: boolean,
): Promise<DayPulseRow[]> {
  if (useActivity) {
    const dayTicks = await prisma.activityTick.findMany({
      where: { userId, at: { gte: dayStart, lte: dayEnd } },
      orderBy: { at: "asc" },
      select: { at: true, ssid: true, inOffice: true },
    });
    return dayTicks.map((tick) => ({
      at: tick.at,
      ssid: tick.ssid,
      inOffice: tick.inOffice,
    }));
  }

  const dayHeartbeats = await prisma.heartbeat.findMany({
    where: {
      userId,
      recordedAt: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { recordedAt: "asc" },
    select: { recordedAt: true, ssid: true, inOffice: true },
  });
  return dayHeartbeats.map((row) => ({
    at: row.recordedAt,
    ssid: row.ssid,
    inOffice: row.inOffice,
  }));
}

const lastMaintenanceAtByUser = new Map<string, number>();

export function resetVisitMaintenanceThrottle(userId?: string) {
  if (userId) {
    lastMaintenanceAtByUser.delete(userId);
    return;
  }
  lastMaintenanceAtByUser.clear();
}

export async function loadDaySpanContext(
  userId: string,
  dayKey: string,
  timezone: string,
  options?: { skipMaintenance?: boolean },
): Promise<{
  visits: Awaited<ReturnType<typeof prisma.visit.findMany>>;
  params: DaySpanParams;
  lastHeartbeat: AgentSignalSnapshot | null;
  laptopActiveParams: LaptopActiveParams;
  firstAgentOnAt: Date | null;
}> {
  const config = await getAppConfig();
  const allowlist = config.officeSsids;
  const staleMs = config.agentStaleMinutes * 60 * 1000;
  if (!options?.skipMaintenance) {
    await maybeRunVisitMaintenance(userId, timezone, staleMs);
  }

  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(dayKey, timezone);
  const now = new Date();
  const { useActivity, lastActivity, lastHeartbeat: lastHeartbeatRow } =
    await resolveAgentSignalMode(userId, { agentMode: config.agentMode });

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
  let lastSignalOverall: Date | null = null;
  let lastHeartbeat: AgentSignalSnapshot | null = null;
  let uptimeSignals: import("./laptop-active").UptimeSignal[] = [];
  let agentLaptopActiveMs: number | null = null;
  let agentFirstAgentOnAt: Date | null = null;

  const dailySummary = await prisma.dailySummary.findUnique({
    where: { userId_dayKey: { userId, dayKey } },
    select: { laptopActiveMs: true, firstAgentOnAt: true },
  });
  if (dailySummary) {
    agentLaptopActiveMs = dailySummary.laptopActiveMs;
    agentFirstAgentOnAt = dailySummary.firstAgentOnAt;
  }

  const dayPulses = await loadDayPulseRowsForDay(userId, dayStart, dayEnd, useActivity);
  const inOfficeToday = filterInOfficeDayPulses(dayPulses, useActivity, allowlist);
  firstInOfficeHeartbeatAt = inOfficeToday[0]?.at ?? null;
  lastInOfficeHeartbeatAt = inOfficeToday[inOfficeToday.length - 1]?.at ?? null;
  if (useActivity) {
    lastSignalOverall = lastActivity?.at ?? null;
    lastHeartbeat = lastActivity ? activityTickToSignal(lastActivity) : null;
  } else {
    lastSignalOverall = lastHeartbeatRow?.recordedAt ?? null;
    lastHeartbeat = lastHeartbeatRow ? heartbeatToSignal(lastHeartbeatRow, allowlist) : null;
  }
  uptimeSignals = dayPulses.map((row) => ({ at: row.at, kind: "tick" as const }));

  const sessionResumes = await prisma.presenceTransition.findMany({
    where: {
      userId,
      type: "session_resume",
      at: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { at: "asc" },
    select: { at: true },
  });
  for (const row of sessionResumes) {
    uptimeSignals.push({ at: row.at, kind: "session_resume" });
  }
  uptimeSignals.sort((a, b) => a.at.getTime() - b.at.getTime());

  const laptopActiveParams: LaptopActiveParams = {
    dayStart,
    dayEnd,
    now,
    staleMs,
    agentLaptopActiveMs,
    agentFirstAgentOnAt,
    uptimeSignals,
    lastSignalOverall,
  };
  const { firstAgentOnAt } = resolveLaptopActiveForDay(laptopActiveParams);

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
      agentLaptopActiveMs,
      agentFirstAgentOnAt,
      uptimeSignals,
      lastSignalOverall,
    },
    firstAgentOnAt,
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
  if (at.getTime() < open.startAt.getTime()) return;

  await prisma.visit.update({
    where: { id: open.id },
    data: { endAt: at },
  });
}

/** Close visits left open when the agent stopped sending heartbeats. */
export async function closeStaleOpenVisits(
  userId: string,
  staleMs?: number,
  options?: { lastConfirmedPulseAt?: Date | null },
) {
  const config = await getAppConfig();
  const useActivity = agentModeUsesActivityTicks(config.agentMode);
  const gap =
    staleMs ??
    (useActivity ? await getEventModeAgentStaleMs() : await getAgentStaleMs());
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

  // Prefer the agent's last confirmed local pulse for checkout, not detection time.
  let checkoutAt =
    options?.lastConfirmedPulseAt ??
    (await getLastConfirmedLocalPulseAt(userId)) ??
    lastSignalAt;

  if (checkoutAt && checkoutAt.getTime() < open.startAt.getTime()) {
    checkoutAt = open.startAt;
  }
  if (checkoutAt && checkoutAt.getTime() > now.getTime()) {
    checkoutAt = now;
  }

  const endAt =
    checkoutAt ??
    effectiveVisitEnd({
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

async function getLastConfirmedLocalPulseAt(userId: string): Promise<Date | null> {
  const healthEvent = await prisma.agentEvent.findFirst({
    where: { userId, type: "health_ping", status: "accepted" },
    orderBy: { createdAt: "desc" },
    select: { payload: true },
  });
  if (healthEvent?.payload && typeof healthEvent.payload === "object") {
    const payload = healthEvent.payload as Record<string, unknown>;
    const raw = payload.lastLocalPulseAt;
    if (typeof raw === "string") {
      const parsed = Date.parse(raw);
      if (!Number.isNaN(parsed)) return new Date(parsed);
    }
  }

  const tick = await prisma.activityTick.findFirst({
    where: { userId },
    orderBy: { at: "desc" },
    select: { at: true },
  });
  return tick?.at ?? null;
}

/**
 * Close visits still open after their calendar day ended.
 * Prefers agent-reported office Wi-Fi disconnect; falls back to last activity tick.
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
  const config = await getAppConfig();
  const allowlist = config.officeSsids;
  const officeDisconnectAt = await getLastOfficeDisconnectAt(
    userId,
    open.startAt,
    dayEnd,
    allowlist,
  );

  const { useActivity } = await resolveAgentSignalMode(userId, { agentMode: config.agentMode });
  const lastSignalAt = await getLastAgentSignalOnDay(
    userId,
    { gte: open.startAt, lte: dayEnd },
    useActivity,
  );

  const fallback = open.updatedAt <= dayEnd ? open.updatedAt : open.startAt;
  const endAt = officeDisconnectAt ?? lastSignalAt ?? fallback;
  const cappedEnd = endAt > dayEnd ? dayEnd : endAt;

  await prisma.visit.update({
    where: { id: open.id },
    data: { endAt: cappedEnd },
  });
  return true;
}

/** Run end-of-day and stale-visit cleanup after agent events are applied. */
export async function runVisitMaintenance(
  userId: string,
  timezone: string,
  staleMs?: number,
  options?: { lastConfirmedPulseAt?: Date | null },
) {
  await closeEndOfDayOpenVisits(userId, timezone);
  const config = await getAppConfig();
  const gapMs =
    staleMs ??
    (agentModeUsesActivityTicks(config.agentMode)
      ? await getEventModeAgentStaleMs()
      : config.agentStaleMinutes * 60 * 1000);
  await closeStaleOpenVisits(userId, gapMs, {
    lastConfirmedPulseAt: options?.lastConfirmedPulseAt,
  });
}

export async function maybeRunVisitMaintenance(
  userId: string,
  timezone: string,
  staleMs?: number,
  options?: { force?: boolean; lastConfirmedPulseAt?: Date | null },
) {
  if (!options?.force) {
    const lastAt = lastMaintenanceAtByUser.get(userId) ?? 0;
    if (Date.now() - lastAt < VISIT_MAINTENANCE_THROTTLE_MS) {
      return false;
    }
  }

  await runVisitMaintenance(userId, timezone, staleMs, {
    lastConfirmedPulseAt: options?.lastConfirmedPulseAt,
  });
  lastMaintenanceAtByUser.set(userId, Date.now());
  return true;
}

async function getLastOfficeDisconnectAt(
  userId: string,
  since: Date,
  dayEnd: Date,
  allowlist: string[],
): Promise<Date | null> {
  const transitions = await prisma.presenceTransition.findMany({
    where: {
      userId,
      at: { gte: since, lte: dayEnd },
      type: { in: ["wifi_disconnected", "ssid_changed"] },
    },
    orderBy: { at: "desc" },
    select: { at: true, type: true, previousSsid: true },
  });

  for (const transition of transitions) {
    const previousSsid = transition.previousSsid
      ? normalizeSsid(transition.previousSsid)
      : null;
    if (isOfficeSsid(previousSsid, allowlist)) {
      return transition.at;
    }
  }
  return null;
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
  const { visits, params, lastHeartbeat, laptopActiveParams, firstAgentOnAt } = await loadDaySpanContext(
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
    firstAgentOnAt,
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

export async function loadLaptopActiveForDay(
  userId: string,
  dayKey: string,
  timezone: string,
) {
  const { laptopActiveParams, firstAgentOnAt } = await loadDaySpanContext(
    userId,
    dayKey,
    timezone,
    { skipMaintenance: true },
  );
  return {
    hours: laptopActiveHoursForDay(laptopActiveParams),
    firstAgentOnAt,
  };
}

export async function getPulseStats(userId: string, graceHours: number) {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const config = await getAppConfig();
  const { useActivity, lastActivity, lastHeartbeat, activityCount24h } =
    await resolveAgentSignalMode(userId, { agentMode: config.agentMode });

  const [recentActivity, activity24h, recentPulses, heartbeats24h, pulsesLast24h] =
    await Promise.all([
      useActivity
        ? prisma.activityTick.findMany({
            where: { userId },
            orderBy: { at: "desc" },
            take: 12,
            select: { at: true, inOffice: true, ssid: true },
          })
        : Promise.resolve([]),
      useActivity
        ? prisma.activityTick.findMany({
            where: { userId, at: { gte: since24h } },
            select: { at: true },
            orderBy: { at: "asc" },
          })
        : Promise.resolve([]),
      useActivity
        ? Promise.resolve([])
        : prisma.heartbeat.findMany({
            where: { userId },
            orderBy: { recordedAt: "desc" },
            take: 12,
            select: {
              recordedAt: true,
              inOffice: true,
              ssid: true,
              vpnGateway: true,
              source: true,
            },
          }),
      useActivity
        ? Promise.resolve([])
        : prisma.heartbeat.findMany({
            where: { userId, recordedAt: { gte: since24h } },
            select: { recordedAt: true },
            orderBy: { recordedAt: "asc" },
          }),
      useActivity
        ? Promise.resolve(0)
        : prisma.heartbeat.count({
            where: { userId, recordedAt: { gte: since24h } },
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
