import {
  computeUserDayComplianceRow,
  evaluateUserDayCompliance,
  getAdminDayCompliance,
  isAgentStaleForReporting,
  summarizeDayCompliance,
  toAdminOrgCalendarDay,
  todayKeyForTimezone,
  type AdminOrgCalendarDay,
} from "./admin-day-compliance";
import { userHasInstalledAgentForStaleChecks } from "./agent-deregister";
import { summarizeAgentTokens } from "./auth";
import { prisma } from "./db";
import { getAppConfig, getEffectiveAgentStaleGraceHours, getUserHoursTarget } from "./app-config";
import { getTodaySummary } from "./heartbeat-service";
import { allDayKeysInMonth, currentMonthKey, monthBoundsFromKey } from "./month-range";
import { revokeExpiredPendingTokens } from "./token-expiry";
import { roundHours, type VisitForDaySpan } from "./visits";
import { dayKeyInTimezone, dayBoundsFromKey, isFutureDayKey } from "./timezone-dates";
import { isDayKeyInRange } from "./out-of-office";

type CalendarUserRow = {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  hoursTarget: number | null;
  agentStaleGraceHours: number | null;
  agentDeregisteredAt: Date | null;
  agentDevices: Array<{ id: string; lastSeenAt: Date | null }>;
};

type UserCalendarPreload = {
  user: CalendarUserRow;
  hadInstalledDevice: boolean;
  hoursTarget: number;
  graceHours: number;
  oooRanges: Array<{ startDate: string; endDate: string }>;
  visits: VisitForDaySpan[];
  heartbeats: Array<{ recordedAt: Date; ssid: string | null; inOffice: boolean }>;
};

function isUserOooOnDay(ranges: Array<{ startDate: string; endDate: string }>, dayKey: string) {
  return ranges.some((r) => isDayKeyInRange(dayKey, r.startDate, r.endDate));
}

function heartbeatsForDay(
  heartbeats: Array<{ recordedAt: Date; ssid: string | null; inOffice: boolean }>,
  dayStart: Date,
  dayEnd: Date,
) {
  return heartbeats.filter(
    (h) => h.recordedAt.getTime() >= dayStart.getTime() && h.recordedAt.getTime() <= dayEnd.getTime(),
  );
}

function lastHeartbeatBefore(
  heartbeats: Array<{ recordedAt: Date }>,
  dayEnd: Date,
): Date | null {
  let last: Date | null = null;
  for (const h of heartbeats) {
    if (h.recordedAt.getTime() <= dayEnd.getTime()) {
      last = h.recordedAt;
    } else {
      break;
    }
  }
  return last;
}

function visitsForDayWindow(visits: VisitForDaySpan[], dayStart: Date, dayEnd: Date) {
  return visits.filter((v) => {
    const start = v.startAt.getTime();
    const end = (v.endAt ?? dayEnd).getTime();
    return start <= dayEnd.getTime() && end >= dayStart.getTime();
  });
}

async function preloadUserCalendarData(
  users: CalendarUserRow[],
  monthKey: string,
): Promise<UserCalendarPreload[]> {
  const bounds = monthBoundsFromKey(monthKey, "Asia/Kolkata");
  const userIds = users.map((u) => u.id);

  const [oooRows, visitRows, heartbeatRows] = await Promise.all([
    prisma.userOutOfOffice.findMany({
      where: {
        userId: { in: userIds },
        startDate: { lte: bounds.toKey },
        endDate: { gte: bounds.fromKey },
      },
      select: { userId: true, startDate: true, endDate: true },
    }),
    prisma.visit.findMany({
      where: {
        userId: { in: userIds },
        startAt: { lte: bounds.to },
        OR: [{ endAt: null }, { endAt: { gte: bounds.from } }],
      },
      select: { userId: true, id: true, startAt: true, endAt: true, source: true, ssid: true, updatedAt: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.heartbeat.findMany({
      where: {
        userId: { in: userIds },
        recordedAt: { lte: bounds.to },
      },
      select: { userId: true, recordedAt: true, ssid: true, inOffice: true },
      orderBy: [{ userId: "asc" }, { recordedAt: "asc" }],
    }),
  ]);

  const oooByUser = new Map<string, Array<{ startDate: string; endDate: string }>>();
  for (const row of oooRows) {
    const list = oooByUser.get(row.userId) ?? [];
    list.push({ startDate: row.startDate, endDate: row.endDate });
    oooByUser.set(row.userId, list);
  }

  const visitsByUser = new Map<string, VisitForDaySpan[]>();
  for (const row of visitRows) {
    const list = visitsByUser.get(row.userId) ?? [];
    list.push({
      id: row.id,
      startAt: row.startAt,
      endAt: row.endAt,
      source: row.source,
      ssid: row.ssid,
      updatedAt: row.updatedAt,
    });
    visitsByUser.set(row.userId, list);
  }

  const heartbeatsByUser = new Map<
    string,
    Array<{ recordedAt: Date; ssid: string | null; inOffice: boolean }>
  >();
  for (const row of heartbeatRows) {
    const list = heartbeatsByUser.get(row.userId) ?? [];
    list.push({
      recordedAt: row.recordedAt,
      ssid: row.ssid,
      inOffice: row.inOffice,
    });
    heartbeatsByUser.set(row.userId, list);
  }

  return Promise.all(
    users.map(async (user) => ({
      user,
      hadInstalledDevice: userHasInstalledAgentForStaleChecks({
        agentDeregisteredAt: user.agentDeregisteredAt,
        agentDevices: user.agentDevices,
      }),
      hoursTarget: await getUserHoursTarget(user),
      graceHours: await getEffectiveAgentStaleGraceHours(user),
      oooRanges: oooByUser.get(user.id) ?? [],
      visits: visitsByUser.get(user.id) ?? [],
      heartbeats: heartbeatsByUser.get(user.id) ?? [],
    })),
  );
}

export async function getAdminOrgCalendarDays(
  monthKey: string,
  timezone = "Asia/Kolkata",
): Promise<{ monthKey: string; timezone: string; days: AdminOrgCalendarDay[] }> {
  const monthDayKeys = allDayKeysInMonth(monthKey);
  const config = await getAppConfig();

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      hoursTarget: true,
      agentStaleGraceHours: true,
      agentDeregisteredAt: true,
      agentDevices: { select: { id: true, lastSeenAt: true } },
    },
  });

  const preloaded = await preloadUserCalendarData(users, monthKey);
  const now = new Date();

  const days: AdminOrgCalendarDay[] = monthDayKeys.map((dayKey) => {
    if (isFutureDayKey(dayKey, timezone, now)) {
      return toAdminOrgCalendarDay(
        dayKey,
        {
          totalUsers: users.length,
          attendedCount: 0,
          metTargetCount: 0,
          compliancePct: 0,
          excludedStale: 0,
          excludedOoo: 0,
          excludedNoVisit: users.length,
        },
        0,
      );
    }

    let totalAttendedHours = 0;
    const rows = preloaded.map((ctx) => {
      const { start: dayStart, end: dayEnd } = dayBoundsFromKey(dayKey, ctx.user.timezone);
      const dayHeartbeats = heartbeatsForDay(ctx.heartbeats, dayStart, dayEnd);
      const dayVisits = visitsForDayWindow(ctx.visits, dayStart, dayEnd);

      const row = computeUserDayComplianceRow({
        user: ctx.user,
        dayKey,
        hadInstalledDevice: ctx.hadInstalledDevice,
        lastHeartbeatBeforeDayEnd: lastHeartbeatBefore(ctx.heartbeats, dayEnd),
        ooo: isUserOooOnDay(ctx.oooRanges, dayKey),
        visits: dayVisits,
        dayHeartbeats,
        officeSsids: config.officeSsids,
        hoursTarget: ctx.hoursTarget,
        graceHours: ctx.graceHours,
        now,
      });
      if (row.attended) totalAttendedHours += row.hours;
      return row;
    });

    return toAdminOrgCalendarDay(dayKey, summarizeDayCompliance(rows), totalAttendedHours);
  });

  return { monthKey, timezone, days };
}

export async function getAdminReports(options?: { days?: number; monthKey?: string }) {
  const config = await getAppConfig();
  const defaultTz = "Asia/Kolkata";
  const monthKey = options?.monthKey ?? currentMonthKey(defaultTz);

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
      const hadInstalledDevice = userHasInstalledAgentForStaleChecks({
        agentDeregisteredAt: user.agentDeregisteredAt,
        agentDevices: user.agentDevices,
      });
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

  const calendar = await getAdminOrgCalendarDays(monthKey, defaultTz);
  const dailyTrend = calendar.days.map((day) => ({
    date: day.dayKey,
    totalHours: day.totalAttendedHours,
    compliancePct: day.compliancePct,
    attendedCount: day.attendedCount,
    metTargetCount: day.metTargetCount,
  }));

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
    range: { days: calendar.days.length, monthKey },
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
