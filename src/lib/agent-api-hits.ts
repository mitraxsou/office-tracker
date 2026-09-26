import { prisma } from "./db";
import { dayKeyInTimezone } from "./timezone-dates";

export const AGENT_API_ROUTES = {
  SYNC: "agent_sync",
  HEARTBEAT: "heartbeat",
  CONFIG: "agent_config",
} as const;

export type AgentApiRoute = (typeof AGENT_API_ROUTES)[keyof typeof AGENT_API_ROUTES];

const NO_DEVICE_KEY = "";

export type AgentApiHitPeriodTotals = {
  day: number;
  month: number;
  year: number;
};

export type AgentApiHitTotals = AgentApiHitPeriodTotals & {
  byRoute: Record<string, AgentApiHitPeriodTotals>;
};

function emptyTotals(): AgentApiHitPeriodTotals {
  return { day: 0, month: 0, year: 0 };
}

function addToTotals(
  totals: AgentApiHitPeriodTotals,
  hitCount: number,
  dayKey: string,
  todayKey: string,
  monthPrefix: string,
) {
  totals.year += hitCount;
  if (dayKey.startsWith(monthPrefix)) {
    totals.month += hitCount;
  }
  if (dayKey === todayKey) {
    totals.day += hitCount;
  }
}

function rollupHitRows(
  rows: Array<{ route: string; dayKey: string; hitCount: number }>,
  timezone: string,
): AgentApiHitTotals {
  const now = new Date();
  const todayKey = dayKeyInTimezone(now, timezone);
  const monthPrefix = todayKey.slice(0, 7);
  const yearPrefix = todayKey.slice(0, 4);

  const totals = emptyTotals();
  const byRoute: Record<string, AgentApiHitPeriodTotals> = {};

  for (const row of rows) {
    if (!row.dayKey.startsWith(yearPrefix)) continue;
    addToTotals(totals, row.hitCount, row.dayKey, todayKey, monthPrefix);
    const routeTotals = byRoute[row.route] ?? emptyTotals();
    addToTotals(routeTotals, row.hitCount, row.dayKey, todayKey, monthPrefix);
    byRoute[row.route] = routeTotals;
  }

  return { ...totals, byRoute };
}

export async function recordAgentApiHit(params: {
  userId: string;
  deviceId?: string | null;
  route: AgentApiRoute;
  timezone: string;
  at?: Date;
}) {
  const dayKey = dayKeyInTimezone(params.at ?? new Date(), params.timezone);
  const deviceId = params.deviceId?.trim() ? params.deviceId : NO_DEVICE_KEY;

  await prisma.agentApiHitDaily.upsert({
    where: {
      userId_deviceId_route_dayKey: {
        userId: params.userId,
        deviceId,
        route: params.route,
        dayKey,
      },
    },
    create: {
      userId: params.userId,
      deviceId,
      route: params.route,
      dayKey,
      hitCount: 1,
    },
    update: {
      hitCount: { increment: 1 },
    },
  });
}

export async function getUserAgentApiHitTotals(
  userId: string,
  timezone: string,
): Promise<AgentApiHitTotals> {
  const todayKey = dayKeyInTimezone(new Date(), timezone);
  const yearPrefix = todayKey.slice(0, 4);

  const rows = await prisma.agentApiHitDaily.findMany({
    where: {
      userId,
      dayKey: { gte: `${yearPrefix}-01-01`, lte: `${yearPrefix}-12-31` },
    },
    select: { route: true, dayKey: true, hitCount: true },
  });

  return rollupHitRows(rows, timezone);
}

export async function getDeviceAgentApiHitTotals(
  deviceId: string,
  timezone: string,
): Promise<AgentApiHitTotals> {
  const todayKey = dayKeyInTimezone(new Date(), timezone);
  const yearPrefix = todayKey.slice(0, 4);

  const rows = await prisma.agentApiHitDaily.findMany({
    where: {
      deviceId,
      dayKey: { gte: `${yearPrefix}-01-01`, lte: `${yearPrefix}-12-31` },
    },
    select: { route: true, dayKey: true, hitCount: true },
  });

  return rollupHitRows(rows, timezone);
}

export type AgentApiHitDayBreakdown = {
  dayKey: string;
  total: number;
  byRoute: Record<string, number>;
  byDevice: Array<{ deviceId: string; total: number; byRoute: Record<string, number> }>;
};

export async function getUserAgentApiHitsForDay(
  userId: string,
  dayKey: string,
): Promise<AgentApiHitDayBreakdown> {
  const rows = await prisma.agentApiHitDaily.findMany({
    where: { userId, dayKey },
    select: { deviceId: true, route: true, hitCount: true },
  });

  const byRoute: Record<string, number> = {};
  const byDeviceMap = new Map<string, { total: number; byRoute: Record<string, number> }>();
  let total = 0;

  for (const row of rows) {
    total += row.hitCount;
    byRoute[row.route] = (byRoute[row.route] ?? 0) + row.hitCount;
    const device = byDeviceMap.get(row.deviceId) ?? { total: 0, byRoute: {} };
    device.total += row.hitCount;
    device.byRoute[row.route] = (device.byRoute[row.route] ?? 0) + row.hitCount;
    byDeviceMap.set(row.deviceId, device);
  }

  return {
    dayKey,
    total,
    byRoute,
    byDevice: [...byDeviceMap.entries()].map(([deviceId, value]) => ({
      deviceId,
      total: value.total,
      byRoute: value.byRoute,
    })),
  };
}
