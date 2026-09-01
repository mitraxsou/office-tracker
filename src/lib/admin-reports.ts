import { summarizeAgentTokens } from "./auth";
import { prisma } from "./db";
import { getAppConfig, getUserHoursTarget } from "./app-config";
import { getTodaySummary, closeStaleOpenVisits } from "./heartbeat-service";
import { revokeExpiredPendingTokens } from "./token-expiry";
import { effectiveVisitEnd } from "./visits";

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

async function aggregateHoursForDay(userId: string, timezone: string, dayKey: string) {
  const config = await getAppConfig();
  const staleMs = config.agentStaleMinutes * 60 * 1000;
  await closeStaleOpenVisits(userId, staleMs);

  const dayStart = new Date(`${dayKey}T00:00:00`);
  const dayEnd = new Date(`${dayKey}T23:59:59.999`);

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
  return visits.reduce((sum, v) => {
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
}

export async function getAdminReports() {
  const config = await getAppConfig();
  const defaultTz = "Asia/Kolkata";

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

  const today = new Date();
  const dailyTrend: Array<{
    date: string;
    totalHours: number;
    compliancePct: number;
    activeUsers: number;
  }> = [];

  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    const key = dayKeyForTimezone(day, defaultTz);
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
  };
}
