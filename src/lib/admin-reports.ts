import { summarizeAgentTokens } from "./auth";
import { prisma } from "./db";
import { getAppConfig, getUserHoursTarget } from "./app-config";
import { getTodaySummary, closeStaleOpenVisits, closeEndOfDayOpenVisits } from "./heartbeat-service";
import { allDayKeysInMonth, currentMonthKey } from "./month-range";
import { revokeExpiredPendingTokens } from "./token-expiry";
import { daySpanMsForDay, roundHours } from "./visits";
import { dayBoundsFromKey } from "./timezone-dates";

async function aggregateHoursForDay(userId: string, timezone: string, dayKey: string) {
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
  return daySpanMsForDay(visits, {
    dayStart,
    dayEnd,
    now,
    staleMs,
    lastHeartbeatAt: lastHeartbeat?.recordedAt ?? null,
  });
}

export async function getAdminReports(options?: { days?: number; monthKey?: string }) {
  const config = await getAppConfig();
  const defaultTz = "Asia/Kolkata";
  const monthKey = options?.monthKey ?? currentMonthKey(defaultTz);
  const monthDayKeys = allDayKeysInMonth(monthKey);

  await revokeExpiredPendingTokens();

  const users = await prisma.user.findMany({
    include: {
      agentDevices: { orderBy: { lastSeenAt: "desc" } },
      agentTokens: { where: { revokedAt: null }, orderBy: { createdAt: "desc" } },
    },
    orderBy: { email: "asc" },
  });

  const userSummaries = await Promise.all(
    users.map(async (user) => {
      const hoursTarget = await getUserHoursTarget(user);
      const summary = await getTodaySummary(user.id, user.timezone, hoursTarget);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hoursTarget,
        devices: user.agentDevices.map((d) => ({
          id: d.id,
          serialNumber: d.serialNumber,
          lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
        })),
        tokens: summarizeAgentTokens(user.agentTokens),
        today: {
          totalHours: summary.totalHours,
          metTarget: summary.metTarget,
          agentHealthy: summary.agentHealthy,
          inOfficeNow: summary.inOfficeNow,
          lastHeartbeat: summary.lastHeartbeat?.recordedAt?.toISOString() ?? null,
        },
      };
    })
  );

  const inOfficeNow = userSummaries.filter((u) => u.today.inOfficeNow).length;
  const metToday = userSummaries.filter((u) => u.today.metTarget).length;
  const withAgent = userSummaries.filter((u) => u.today.agentHealthy).length;
  const noAgent = userSummaries.length - withAgent;
  const avgHours =
    userSummaries.length > 0
      ? userSummaries.reduce((s, u) => s + u.today.totalHours, 0) / userSummaries.length
      : 0;

  const dailyTrend: Array<{
    date: string;
    totalHours: number;
    compliancePct: number;
    activeUsers: number;
  }> = [];

  for (const key of monthDayKeys) {
    let dayTotalMs = 0;
    let metCount = 0;

    for (const user of users) {
      const hoursTarget = await getUserHoursTarget(user);
      const ms = await aggregateHoursForDay(user.id, user.timezone, key);
      const hours = ms / (1000 * 60 * 60);
      dayTotalMs += ms;
      if (hours >= hoursTarget) metCount += 1;
    }

    dailyTrend.push({
      date: key,
      totalHours: Math.round((dayTotalMs / (1000 * 60 * 60)) * 10) / 10,
      compliancePct:
        users.length > 0 ? Math.round((metCount / users.length) * 100) : 0,
      activeUsers: users.length,
    });
  }

  const statusBreakdown = {
    inOffice: userSummaries.filter((u) => u.today.inOfficeNow).length,
    notInOffice: userSummaries.filter((u) => !u.today.inOfficeNow && u.today.agentHealthy).length,
    noAgent,
  };

  return {
    summary: {
      totalUsers: users.length,
      inOfficeNow,
      metTodayPct:
        users.length > 0 ? Math.round((metToday / users.length) * 100) : 0,
      avgHours: Math.round(avgHours * 10) / 10,
      hoursTarget: config.hoursTarget,
    },
    dailyTrend,
    statusBreakdown,
    users: userSummaries,
    range: { days: monthDayKeys.length, monthKey },
  };
}

export type InOfficeNowUser = {
  userId: string;
  email: string;
  name: string | null;
  hoursToday: number;
  hoursTarget: number;
  metTarget: boolean;
  visitStartAt: string | null;
  visitSource: string | null;
  visitSsid: string | null;
  lastHeartbeatAt: string | null;
  lastHeartbeatSource: string | null;
  inOfficeNow: true;
};

export async function getInOfficeNowUsers(): Promise<{
  count: number;
  updatedAt: string;
  users: InOfficeNowUser[];
}> {
  const users = await prisma.user.findMany({ orderBy: { email: "asc" } });
  const rows = await Promise.all(
    users.map(async (user) => {
      const hoursTarget = await getUserHoursTarget(user);
      const summary = await getTodaySummary(user.id, user.timezone, hoursTarget);
      if (!summary.inOfficeNow) return null;

      const openVisit = summary.visits.find((v) => v.endAt === null);
      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        hoursToday: roundHours(summary.totalHours),
        hoursTarget,
        metTarget: summary.metTarget,
        visitStartAt: openVisit?.startAt.toISOString() ?? null,
        visitSource: openVisit?.source ?? null,
        visitSsid: openVisit?.ssid ?? null,
        lastHeartbeatAt: summary.lastHeartbeat?.recordedAt.toISOString() ?? null,
        lastHeartbeatSource: summary.lastHeartbeat?.source ?? null,
        inOfficeNow: true as const,
      };
    }),
  );

  const inOffice = rows.filter((row): row is InOfficeNowUser => row !== null);
  return {
    count: inOffice.length,
    updatedAt: new Date().toISOString(),
    users: inOffice,
  };
}

export async function getAdminDayDetail(dateKey: string) {
  const users = await prisma.user.findMany({ orderBy: { email: "asc" } });
  const rows = await Promise.all(
    users.map(async (user) => {
      const hoursTarget = await getUserHoursTarget(user);
      const ms = await aggregateHoursForDay(user.id, user.timezone, dateKey);
      const hours = ms / (1000 * 60 * 60);
      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        hours: Math.round(hours * 10) / 10,
        hoursTarget,
        metTarget: hours >= hoursTarget,
      };
    }),
  );
  return { date: dateKey, users: rows };
}
