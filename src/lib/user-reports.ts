import { isUserAgentDeregistered } from "./agent-deregister";
import { prisma } from "./db";
import { getAppConfig, getUserHoursTarget, getEffectiveAgentStaleGraceHours } from "./app-config";
import { aggregateHoursForDay, aggregateLaptopActiveForDay } from "./day-hours";
import { getTodaySummary, getPulseStats } from "./heartbeat-service";
import {
  buildAgentStatusDiagnostics,
  fetchAgentStatusEvidence,
} from "./agent-status-diagnostics";
import {
  activityTickToSignal,
  agentModeUsesActivityTicks,
  heartbeatToSignal,
} from "./activity-signal";
import { summarizeAgentTokens } from "./auth";
import { getLifecycleEventsForUser } from "./agent-lifecycle";
import { revokeExpiredPendingTokens } from "./token-expiry";
import { roundHoursToMinute } from "./visits";
import { resolveAgentTargetVersionFromConfig } from "./agent-rollout";
import { isDeviceAgentVersionStale } from "./agent-update";
import { getDeviceAgentApiHitTotals, getUserAgentApiHitTotals, getUserAgentApiHitsForDay } from "./agent-api-hits";
import { dayBoundsFromKey, dayKeyInTimezone } from "./timezone-dates";

function dayKeyForTimezone(date: Date, timezone: string) {
  return dayKeyInTimezone(date, timezone);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function getUserReport(
  userId: string,
  from: Date,
  to: Date,
  options?: { selectedDayKey?: string | null },
) {
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
  const [today, pulse, evidence] = await Promise.all([
    getTodaySummary(user.id, user.timezone, hoursTarget, graceHours),
    getPulseStats(user.id, graceHours),
    fetchAgentStatusEvidence(user.id),
  ]);
  const serverAgentVersion = resolveAgentTargetVersionFromConfig(config, {
    id: user.id,
    email: user.email,
  });

  const dailyTrend: Array<{
    date: string;
    totalHours: number;
    laptopActiveHours: number;
    metTarget: boolean;
  }> = [];
  // Walk local calendar day keys (not UTC Date.setHours), so IST months do not
  // pick up Sep 30 / Nov 1 or skip days when the server runs in UTC.
  let dayKey = dayKeyForTimezone(from, user.timezone);
  const lastDayKey = dayKeyForTimezone(to, user.timezone);
  while (dayKey <= lastDayKey) {
    const key = dayKey;
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
    const { end: dayEnd } = dayBoundsFromKey(key, user.timezone);
    const nextKey = dayKeyForTimezone(new Date(dayEnd.getTime() + 1), user.timezone);
    if (nextKey <= key) break;
    dayKey = nextKey;
  }

  const visits = await prisma.visit.findMany({
    where: {
      userId,
      startAt: { lte: to },
      OR: [{ endAt: null }, { endAt: { gte: from } }],
    },
    orderBy: { startAt: "desc" },
  });

  const useActivity = agentModeUsesActivityTicks(config.agentMode);
  const selectedDayKey =
    options?.selectedDayKey && /^\d{4}-\d{2}-\d{2}$/.test(options.selectedDayKey)
      ? options.selectedDayKey
      : null;
  const dayBounds = selectedDayKey
    ? dayBoundsFromKey(selectedDayKey, user.timezone)
    : null;

  const [apiHitTotals, deviceApiHits, selectedDayApiHits, dayLifecycle] = await Promise.all([
    getUserAgentApiHitTotals(userId, user.timezone),
    Promise.all(
      user.agentDevices.map(async (device) => ({
        deviceId: device.id,
        totals: await getDeviceAgentApiHitTotals(device.id, user.timezone),
      })),
    ),
    selectedDayKey
      ? getUserAgentApiHitsForDay(userId, selectedDayKey)
      : Promise.resolve(null),
    dayBounds
      ? getLifecycleEventsForUser(userId, 50, { from: dayBounds.start, to: dayBounds.end })
      : getLifecycleEventsForUser(user.id),
  ]);

  const dayHeartbeats = useActivity
    ? (
        await prisma.activityTick.findMany({
          where: dayBounds
            ? { userId, at: { gte: dayBounds.start, lte: dayBounds.end } }
            : { userId, at: { gte: from, lte: to } },
          orderBy: { at: "desc" },
          take: dayBounds ? 800 : 100,
          select: { id: true, at: true, inOffice: true, ssid: true },
        })
      ).map((tick) => {
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
    : (
        await prisma.heartbeat.findMany({
          where: dayBounds
            ? { userId, recordedAt: { gte: dayBounds.start, lte: dayBounds.end } }
            : { userId, recordedAt: { gte: from, lte: to } },
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
        })
      ).map((h) => {
        const signal = heartbeatToSignal(h, config.officeSsids);
        return {
          id: h.id,
          recordedAt: signal.recordedAt.toISOString(),
          inOffice: signal.inOffice,
          ssid: signal.ssid,
          vpnGateway: signal.vpnGateway,
          source: signal.source,
        };
      });

  let dayDiagnostics: {
    dayKey: string;
    apiHits: NonNullable<typeof selectedDayApiHits>;
    pulseCount: number;
    firstSignalAt: string | null;
    lastSignalAt: string | null;
    largestGapMinutes: number | null;
    laptopActiveHours: number;
    officeHours: number;
    officeTransitions: number;
  } | null = null;

  if (selectedDayKey && selectedDayApiHits && dayBounds) {
    const sortedSignals = [...dayHeartbeats].sort(
      (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt),
    );
    let largestGapMinutes: number | null = null;
    for (let i = 1; i < sortedSignals.length; i++) {
      const gap =
        (Date.parse(sortedSignals[i].recordedAt) -
          Date.parse(sortedSignals[i - 1].recordedAt)) /
        60000;
      if (largestGapMinutes == null || gap > largestGapMinutes) {
        largestGapMinutes = Math.round(gap * 10) / 10;
      }
    }
    const dayTrend = dailyTrend.find((row) => row.date === selectedDayKey);
    const transitions = await prisma.presenceTransition.count({
      where: {
        userId,
        at: { gte: dayBounds.start, lte: dayBounds.end },
        type: { in: ["ssid_changed", "wifi_connected", "wifi_disconnected", "visit_start", "visit_end"] },
      },
    });
    dayDiagnostics = {
      dayKey: selectedDayKey,
      apiHits: selectedDayApiHits,
      pulseCount: dayHeartbeats.length,
      firstSignalAt: sortedSignals[0]?.recordedAt ?? null,
      lastSignalAt: sortedSignals[sortedSignals.length - 1]?.recordedAt ?? null,
      largestGapMinutes,
      laptopActiveHours: dayTrend?.laptopActiveHours ?? 0,
      officeHours: dayTrend?.totalHours ?? 0,
      officeTransitions: transitions,
    };
  }

  const openVisit = today.visits.find((visit) => visit.endAt === null) ?? null;

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
      endSource: v.endSource ?? null,
      source: v.source,
      ssid: v.ssid,
    })),
    heartbeats: dayHeartbeats,
    agentTracking: {
      serverAgentMode: config.agentMode,
      signalSource: useActivity ? ("activity_tick" as const) : ("heartbeat" as const),
    },
    pulse,
    agentStatus: buildAgentStatusDiagnostics({
      evidence,
      devices: user.agentDevices.map((device) => ({
        id: device.id,
        serialNumber: device.serialNumber,
        lastSeenAt: device.lastSeenAt,
      })),
      officeSsids: config.officeSsids,
      openVisit: openVisit
        ? { startAt: openVisit.startAt, ssid: openVisit.ssid, source: openVisit.source }
        : null,
      inOfficeNowSignal: today.livePresence,
    }),
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
    lifecycleEvents: dayLifecycle,
    tokens: summarizeAgentTokens(user.agentTokens),
    serverAppUrl: process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? null,
    apiHits: {
      totals: apiHitTotals,
      byDevice: deviceApiHits,
    },
    dayDiagnostics,
    heartbeatRetentionDays: config.heartbeatRetentionDays,
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
