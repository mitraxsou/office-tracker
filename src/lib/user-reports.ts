import { prisma } from "./db";
import { getAppConfig, getUserHoursTarget } from "./app-config";
import { getTodaySummary, getPulseStats, closeStaleOpenVisits, closeEndOfDayOpenVisits } from "./heartbeat-service";
import { summarizeAgentTokens } from "./auth";
import { getLifecycleEventsForUser } from "./agent-lifecycle";
import { revokeExpiredPendingTokens } from "./token-expiry";
import { daySpanMsForDay } from "./visits";
import { dayBoundsFromKey } from "./timezone-dates";

function dayKeyForTimezone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function aggregateHoursForDay(userId: string, timezone: string, dayKey: string) {
  const config = await getAppConfig();
  const staleMs = config.agentStaleMinutes * 60 * 1000;
  await closeEndOfDayOpenVisits(userId, timezone);
  await closeStaleOpenVisits(userId, staleMs);

  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(dayKey, timezone);

  const visits = await prisma.visit.findMany({
    where: {
      userId,
      startAt: { lte: dayEnd },
      OR: [{ endAt: null }, { endAt: { gte: dayStart } }],
    },
  });

  const lastHeartbeat = await prisma.heartbeat.findFirst({
    where: { userId },
    orderBy: { recordedAt: "desc" },
  });

  const now = new Date();
  const totalMs = daySpanMsForDay(visits, {
    dayStart,
    dayEnd,
    now,
    staleMs,
    lastHeartbeatAt: lastHeartbeat?.recordedAt ?? null,
  });

  return totalMs / (1000 * 60 * 60);
}

export async function getUserReport(userId: string, from: Date, to: Date) {
  await revokeExpiredPendingTokens();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      agentDevices: { orderBy: { lastSeenAt: "desc" } },
      agentTokens: { where: { revokedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!user) return null;

  const config = await getAppConfig();
  const hoursTarget = await getUserHoursTarget(user);
  const today = await getTodaySummary(user.id, user.timezone, hoursTarget);
  const pulse = await getPulseStats(user.id, config.agentStaleMinutes);

  const dailyTrend: Array<{ date: string; totalHours: number; metTarget: boolean }> = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    const key = dayKeyForTimezone(cursor, user.timezone);
    const hours = await aggregateHoursForDay(user.id, user.timezone, key);
    dailyTrend.push({
      date: key,
      totalHours: Math.round(hours * 10) / 10,
      metTarget: hours >= hoursTarget,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const visits = await prisma.visit.findMany({
    where: {
      userId,
      startAt: { lte: end },
      OR: [{ endAt: null }, { endAt: { gte: from } }],
    },
    orderBy: { startAt: "desc" },
  });

  const heartbeats = await prisma.heartbeat.findMany({
    where: {
      userId,
      recordedAt: { gte: from, lte: end },
    },
    orderBy: { recordedAt: "desc" },
    take: 100,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      timezone: user.timezone,
      hoursTarget,
    },
    today: {
      totalHours: today.totalHours,
      metTarget: today.metTarget,
      agentHealthy: today.agentHealthy,
      inOfficeNow: today.inOfficeNow,
      lastHeartbeat: today.lastHeartbeat?.recordedAt?.toISOString() ?? null,
    },
    dailyTrend,
    visits: visits.map((v) => ({
      id: v.id,
      startAt: v.startAt.toISOString(),
      endAt: v.endAt?.toISOString() ?? null,
      source: v.source,
      ssid: v.ssid,
    })),
    heartbeats: heartbeats.map((h) => ({
      id: h.id,
      recordedAt: h.recordedAt.toISOString(),
      inOffice: h.inOffice,
      ssid: h.ssid,
    })),
    pulse,
    devices: user.agentDevices.map((d) => ({
      id: d.id,
      serialNumber: d.serialNumber,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      installedAt: d.installedAt?.toISOString() ?? null,
      uninstalledAt: d.uninstalledAt?.toISOString() ?? null,
    })),
    lifecycleEvents: await getLifecycleEventsForUser(user.id),
    tokens: summarizeAgentTokens(user.agentTokens),
  };
}

export async function resetUserData(
  userId: string,
  scope: "tracking" | "all",
) {
  await prisma.visit.deleteMany({ where: { userId } });
  await prisma.heartbeat.deleteMany({ where: { userId } });

  if (scope === "all") {
    await prisma.agentToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), pendingTokenEnc: null },
    });
    await prisma.agentDevice.deleteMany({ where: { userId } });
  }
}

export { addDays, dayKeyForTimezone };
