import { prisma } from "./db";
import { DEFAULT_OFFICE_SSIDS, isOfficeSsid } from "./constants";
import { getAppConfig, getAgentStaleMs } from "./app-config";
import { maybePurgeOldHeartbeats } from "./heartbeat-retention";
import { effectiveVisitEnd } from "./visits";

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
  const staleMs = await getAgentStaleMs();
  await closeStaleOpenVisits(userId, staleMs);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayKey = formatter.format(now);
  const dayStart = new Date(`${dayKey}T00:00:00`);
  const dayEnd = new Date(`${dayKey}T23:59:59.999`);

  const visits = await prisma.visit.findMany({
    where: {
      userId,
      startAt: { lte: dayEnd },
      OR: [{ endAt: null }, { endAt: { gte: dayStart } }],
    },
    orderBy: { startAt: "asc" },
  });

  const lastHeartbeat = await prisma.heartbeat.findFirst({
    where: { userId },
    orderBy: { recordedAt: "desc" },
  });

  const agentHealthy =
    lastHeartbeat !== null && now.getTime() - lastHeartbeat.recordedAt.getTime() <= staleMs;

  const openVisit = visits.find((v) => v.endAt === null);
  const totalMs = visits.reduce((sum, v) => {
    const start = v.startAt < dayStart ? dayStart : v.startAt;
    const end = effectiveVisitEnd({
      endAt: v.endAt,
      updatedAt: v.updatedAt,
      startAt: v.startAt,
      now,
      staleMs,
      lastHeartbeatAt: lastHeartbeat?.recordedAt ?? null,
    });
    const clippedEnd = end > dayEnd ? dayEnd : end;
    return sum + Math.max(0, clippedEnd.getTime() - start.getTime());
  }, 0);

  const totalHours = totalMs / (1000 * 60 * 60);

  return {
    dayKey,
    totalHours,
    hoursTarget,
    metTarget: totalHours >= hoursTarget,
    remainingHours: Math.max(0, hoursTarget - totalHours),
    inOfficeNow:
      agentHealthy && openVisit !== undefined && lastHeartbeat?.inOffice === true,
    visits,
    lastHeartbeat,
    agentHealthy,
  };
}

export async function getPulseStats(userId: string, staleMinutes: number) {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [pulsesLast24h, recentPulses, lastHeartbeat] = await Promise.all([
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
  ]);

  const minutesSinceLastPulse = lastHeartbeat
    ? Math.round((now.getTime() - lastHeartbeat.recordedAt.getTime()) / 60000)
    : null;

  const agentHealthy =
    lastHeartbeat !== null &&
    now.getTime() - lastHeartbeat.recordedAt.getTime() <= staleMinutes * 60 * 1000;

  return {
    pulsesLast24h,
    expectedPulsesPerDay: 720,
    minutesSinceLastPulse,
    agentHealthy,
    lastHeartbeat: lastHeartbeat?.recordedAt.toISOString() ?? null,
    recentPulses: recentPulses.map((p) => ({
      recordedAt: p.recordedAt.toISOString(),
      inOffice: p.inOffice,
      ssid: p.ssid,
    })),
  };
}

export { DEFAULT_OFFICE_SSIDS };
