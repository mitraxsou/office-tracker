import { isUserAgentDeregistered } from "./agent-deregister";
import { prisma } from "./db";
import { getAppConfig, getUserHoursTarget, getEffectiveAgentStaleGraceHours } from "./app-config";
import { aggregateHoursForDay, aggregateLaptopActiveForDay } from "./day-hours";
import { getTodaySummary, getPulseStats } from "./heartbeat-service";
import {
  activityTickToSignal,
  heartbeatToSignal,
  resolveAgentSignalMode,
} from "./activity-signal";
import { summarizeAgentTokens } from "./auth";
import { getLifecycleEventsForUser } from "./agent-lifecycle";
import { revokeExpiredPendingTokens } from "./token-expiry";
import { roundHoursToMinute } from "./visits";
import { getAgentVersion } from "./agent-version";
import { isDeviceAgentVersionStale } from "./agent-update";
import { getDeviceAgentApiHitTotals, getUserAgentApiHitTotals } from "./agent-api-hits";

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

  const { useActivity } = await resolveAgentSignalMode(userId);
  const recentSignals = useActivity
    ? await prisma.activityTick.findMany({
        where: { userId, at: { gte: from, lte: end } },
        orderBy: { at: "desc" },
        take: 100,
        select: { id: true, at: true, inOffice: true, ssid: true },
      })
    : await prisma.heartbeat.findMany({
        where: {
          userId,
          recordedAt: { gte: from, lte: end },
        },
        orderBy: { recordedAt: "desc" },
        take: 100,
        select: {
          id: true,
          recordedAt: true,
          inOffice: true,
          ssid: true,
          vpnGateway: true,
          source: true,
        },
      });

  const [apiHitTotals, deviceApiHits] = await Promise.all([
    getUserAgentApiHitTotals(userId, user.timezone),
    Promise.all(
      user.agentDevices.map(async (device) => ({
        deviceId: device.id,
        totals: await getDeviceAgentApiHitTotals(device.id, user.timezone),
      })),
    ),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      timezone: user.timezone,
      hoursTarget,
      agentDeregisteredAt: user.agentDeregisteredAt?.toISOString() ?? null,
    },
    today: {
      totalHours: today.totalHours,
      laptopActiveHours: today.laptopActiveHours,
      metTarget: today.metTarget,
      agentHealthy: isUserAgentDeregistered(user.agentDeregisteredAt) ? true : today.agentHealthy,
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
    heartbeats: useActivity
      ? recentSignals.map((tick) => {
          const signal = activityTickToSignal(tick);
          return {
            id: tick.id,
            recordedAt: signal.recordedAt.toISOString(),
            inOffice: signal.inOffice,
            ssid: signal.ssid,
            vpnGateway: signal.vpnGateway,
            source: signal.source,
          };
        })
      : recentSignals.map((h) => {
          const signal = heartbeatToSignal(h, config.officeSsids);
          return {
            id: h.id,
            recordedAt: signal.recordedAt.toISOString(),
            inOffice: signal.inOffice,
            ssid: signal.ssid,
            vpnGateway: signal.vpnGateway,
            source: signal.source,
          };
        }),
    agentTracking: {
      serverAgentMode: config.agentMode,
      signalSource: useActivity ? "activity_tick" : "heartbeat",
    },
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
      agentApiUrl: d.agentApiUrl,
      forceAgentUpdate: d.forceAgentUpdate,
    })),
    lifecycleEvents: await getLifecycleEventsForUser(user.id),
    tokens: summarizeAgentTokens(user.agentTokens),
    serverAppUrl: process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? null,
    apiHits: {
      totals: apiHitTotals,
      byDevice: deviceApiHits,
    },
  };
}

/**
 * Clear operational tracking data for a user. Visit records are never deleted (compliance).
 * A range limits the purge to heartbeats recorded inside it.
 * Token and device removal is only available on a full reset.
 */
export async function resetUserData(
  userId: string,
  scope: "tracking" | "all",
  range?: { from: Date; to: Date },
) {
  const heartbeatWhere = range
    ? { userId, recordedAt: { gte: range.from, lte: range.to } }
    : { userId };

  const heartbeats = await prisma.heartbeat.deleteMany({ where: heartbeatWhere });

  if (scope === "all" && !range) {
    await prisma.agentToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), pendingTokenEnc: null },
    });
    await prisma.agentDevice.deleteMany({ where: { userId } });
  }

  return { visitsDeleted: 0, heartbeatsDeleted: heartbeats.count };
}

export { addDays, dayKeyForTimezone };
