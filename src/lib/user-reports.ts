import { prisma } from "./db";
import { getAppConfig, getUserHoursTarget, getEffectiveAgentStaleGraceHours } from "./app-config";
import { getTodaySummary, getPulseStats, loadDaySpanContext } from "./heartbeat-service";
import { summarizeAgentTokens } from "./auth";
import { getLifecycleEventsForUser } from "./agent-lifecycle";
import { revokeExpiredPendingTokens } from "./token-expiry";
import { daySpanMsForDay, roundHoursToMinute } from "./visits";
import { laptopActiveHoursForDay } from "./laptop-active";
import { heartbeatInOffice } from "./heartbeat-office";
import { getAgentVersion } from "./agent-version";
import { isDeviceAgentVersionStale } from "./agent-update";

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
  const { visits, params } = await loadDaySpanContext(userId, dayKey, timezone);
  return daySpanMsForDay(visits, params) / (1000 * 60 * 60);
}

export async function aggregateLaptopActiveForDay(
  userId: string,
  timezone: string,
  dayKey: string,
) {
  const { laptopActiveParams } = await loadDaySpanContext(userId, dayKey, timezone);
  return laptopActiveHoursForDay(laptopActiveParams);
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
  const graceHours = await getEffectiveAgentStaleGraceHours(user);
  const today = await getTodaySummary(user.id, user.timezone, hoursTarget, graceHours);
  const pulse = await getPulseStats(user.id, graceHours);
  const serverAgentVersion = getAgentVersion();

  const dailyTrend: Array<{
    date: string;
    totalHours: number;
    laptopActiveHours: number;
    metTarget: boolean;
  }> = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    const key = dayKeyForTimezone(cursor, user.timezone);
    const [hours, laptopHours] = await Promise.all([
      aggregateHoursForDay(user.id, user.timezone, key),
      aggregateLaptopActiveForDay(user.id, user.timezone, key),
    ]);
    dailyTrend.push({
      date: key,
      totalHours: roundHoursToMinute(hours),
      laptopActiveHours: roundHoursToMinute(laptopHours),
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
      laptopActiveHours: today.laptopActiveHours,
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
      inOffice: heartbeatInOffice(h, config.officeSsids),
      ssid: h.ssid,
    })),
    pulse,
    serverAgentVersion,
    devices: user.agentDevices.map((d) => ({
      id: d.id,
      serialNumber: d.serialNumber,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      installedAt: d.installedAt?.toISOString() ?? null,
      uninstalledAt: d.uninstalledAt?.toISOString() ?? null,
      agentScriptVersion: d.agentScriptVersion,
      agentVersionReportedAt: d.agentVersionReportedAt?.toISOString() ?? null,
      agentVersionStale: isDeviceAgentVersionStale(
        d.agentScriptVersion,
        serverAgentVersion,
      ),
    })),
    lifecycleEvents: await getLifecycleEventsForUser(user.id),
    tokens: summarizeAgentTokens(user.agentTokens),
  };
}

/**
 * Clear tracking data for a user. A range limits the purge to visits that start inside it
 * and heartbeats recorded inside it, so an admin can drop one bad day instead of everything.
 * Token and device removal is only available on a full reset.
 */
export async function resetUserData(
  userId: string,
  scope: "tracking" | "all",
  range?: { from: Date; to: Date },
) {
  if (range) {
    const visits = await prisma.visit.deleteMany({
      where: { userId, startAt: { gte: range.from, lte: range.to } },
    });
    const heartbeats = await prisma.heartbeat.deleteMany({
      where: { userId, recordedAt: { gte: range.from, lte: range.to } },
    });
    return { visitsDeleted: visits.count, heartbeatsDeleted: heartbeats.count };
  }

  const visits = await prisma.visit.deleteMany({ where: { userId } });
  const heartbeats = await prisma.heartbeat.deleteMany({ where: { userId } });

  if (scope === "all") {
    await prisma.agentToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), pendingTokenEnc: null },
    });
    await prisma.agentDevice.deleteMany({ where: { userId } });
  }

  return { visitsDeleted: visits.count, heartbeatsDeleted: heartbeats.count };
}

export { addDays, dayKeyForTimezone };
