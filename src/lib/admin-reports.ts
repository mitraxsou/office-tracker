import {
  evaluateUserDayCompliance,
  getAdminDayCompliance,
  isAgentStaleForReporting,
  summarizeDayCompliance,
  todayKeyForTimezone,
} from "./admin-day-compliance";
import { summarizeAgentTokens } from "./auth";
import { prisma } from "./db";
import { getAppConfig, getUserHoursTarget } from "./app-config";
import { getTodaySummary } from "./heartbeat-service";
import { allDayKeysInMonth, currentMonthKey } from "./month-range";
import { revokeExpiredPendingTokens } from "./token-expiry";
import { roundHours } from "./visits";
import { dayKeyInTimezone, dayBoundsFromKey } from "./timezone-dates";

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

  const now = new Date();
  const todayComplianceRows = await Promise.all(
    users.map(async (user) => {
      const todayKey = todayKeyForTimezone(user.timezone, now);
      const { end: dayEnd } = dayBoundsFromKey(todayKey, user.timezone);
      const hadInstalledDevice = user.agentDevices.some((d) => d.lastSeenAt !== null);
      const lastHeartbeat = await prisma.heartbeat.findFirst({
        where: { userId: user.id, recordedAt: { lte: dayEnd } },
        orderBy: { recordedAt: "desc" },
        select: { recordedAt: true },
      });
      return evaluateUserDayCompliance({
        user,
        dayKey: todayKey,
        hadInstalledDevice,
        lastHeartbeatBeforeDayEnd: lastHeartbeat?.recordedAt ?? null,
      });
    }),
  );
  const todaySummary = summarizeDayCompliance(todayComplianceRows);

  const userSummaries = await Promise.all(
    users.map(async (user) => {
      const hoursTarget = await getUserHoursTarget(user);
      const summary = await getTodaySummary(user.id, user.timezone, hoursTarget);
      const todayKey = dayKeyInTimezone(now, user.timezone);
      const complianceRow = todayComplianceRows.find((row) => row.userId === user.id);
      const agentStaleForReporting = isAgentStaleForReporting(
        todayKey,
        !summary.agentHealthy,
      );
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
          laptopActiveHours: summary.laptopActiveHours,
          metTarget: complianceRow?.metTarget ?? summary.metTarget,
          attended: complianceRow?.attended ?? false,
          agentHealthy: !agentStaleForReporting,
          inOfficeNow: summary.inOfficeNow,
          lastHeartbeat: summary.lastHeartbeat?.recordedAt?.toISOString() ?? null,
        },
      };
    }),
  );

  const inOfficeNow = userSummaries.filter((u) => u.today.inOfficeNow).length;
  const withAgent = userSummaries.filter((u) => u.today.agentHealthy).length;
  const noAgent = userSummaries.length - withAgent;
  const attendedToday = userSummaries.filter((u) => u.today.attended);
  const avgHours =
    attendedToday.length > 0
      ? attendedToday.reduce((s, u) => s + u.today.totalHours, 0) / attendedToday.length
      : 0;

  const dailyTrend: Array<{
    date: string;
    totalHours: number;
    compliancePct: number;
    attendedCount: number;
    metTargetCount: number;
  }> = [];

  for (const key of monthDayKeys) {
    let dayTotalHours = 0;
    let attendedCount = 0;
    let metTargetCount = 0;

    for (const user of users) {
      const hadInstalledDevice = user.agentDevices.some((d) => d.lastSeenAt !== null);
      const { end: dayEnd } = dayBoundsFromKey(key, user.timezone);
      const lastHeartbeat = await prisma.heartbeat.findFirst({
        where: { userId: user.id, recordedAt: { lte: dayEnd } },
        orderBy: { recordedAt: "desc" },
        select: { recordedAt: true },
      });
      const row = await evaluateUserDayCompliance({
        user,
        dayKey: key,
        hadInstalledDevice,
        lastHeartbeatBeforeDayEnd: lastHeartbeat?.recordedAt ?? null,
      });
      if (row.attended) {
        attendedCount += 1;
        dayTotalHours += row.hours;
        if (row.metTarget) metTargetCount += 1;
      }
    }

    dailyTrend.push({
      date: key,
      totalHours: Math.round(dayTotalHours * 10) / 10,
      compliancePct:
        attendedCount > 0 ? Math.round((metTargetCount / attendedCount) * 100) : 0,
      attendedCount,
      metTargetCount,
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
      attendedToday: todaySummary.attendedCount,
      metTodayPct: todaySummary.compliancePct,
      excludedStaleToday: todaySummary.excludedStale,
      excludedOooToday: todaySummary.excludedOoo,
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
  return getAdminDayCompliance(dateKey);
}
