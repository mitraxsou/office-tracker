import { getAppConfig, getEffectiveAgentStaleGraceHours, getUserHoursTarget } from "./app-config";
import { heartbeatInOffice } from "./heartbeat-office";
import { loadDaySpanContext } from "./heartbeat-service";
import { isoWeekdayFromDayKey } from "./office-schedule";
import { isUserOutOfOffice } from "./out-of-office";
import { prisma } from "./db";
import { dayBoundsFromKey, dayKeyInTimezone } from "./timezone-dates";
import { daySpanMsForDay, roundHoursToMinute } from "./visits";

export type AdminDayUserStatus =
  | "attended_met"
  | "attended_not_met"
  | "excluded_ooo"
  | "excluded_stale"
  | "no_visit";

export type AdminDayUserRow = {
  userId: string;
  email: string;
  name: string | null;
  hours: number;
  hoursTarget: number;
  metTarget: boolean;
  attended: boolean;
  status: AdminDayUserStatus;
  agentHealthy: boolean;
  agentStaleOnDay: boolean;
};

export type AdminDayComplianceSummary = {
  date: string;
  isWeekend: boolean;
  totalUsers: number;
  attendedCount: number;
  metTargetCount: number;
  compliancePct: number;
  excludedStale: number;
  excludedOoo: number;
  excludedNoVisit: number;
  users: AdminDayUserRow[];
};

/** Saturday or Sunday (ISO weekday 6 or 7). */
export function isWeekendDay(dayKey: string): boolean {
  const weekday = isoWeekdayFromDayKey(dayKey);
  return weekday === 6 || weekday === 7;
}

/** Agent stale at end of day for compliance. Weekends never count as stale. */
export function wasAgentStaleAtDayEnd(input: {
  dayKey: string;
  dayEnd: Date;
  lastHeartbeatBeforeDayEnd: Date | null;
  graceHours: number;
  hadInstalledDevice: boolean;
}): boolean {
  if (isWeekendDay(input.dayKey)) return false;
  if (!input.hadInstalledDevice) return false;
  if (!input.lastHeartbeatBeforeDayEnd) return true;
  const graceMs = input.graceHours * 60 * 60 * 1000;
  return input.dayEnd.getTime() - input.lastHeartbeatBeforeDayEnd.getTime() > graceMs;
}

/** True when the user had office presence on the day (visit segment or in-office pulse). */
export function userAttendedOnDay(input: {
  visits: Array<{ startAt: Date; endAt: Date | null }>;
  dayStart: Date;
  dayEnd: Date;
  inOfficeHeartbeats: Date[];
  totalMs: number;
}): boolean {
  if (input.totalMs > 0) return true;
  if (input.inOfficeHeartbeats.length > 0) return true;
  for (const visit of input.visits) {
    const start = visit.startAt.getTime();
    const end = (visit.endAt ?? input.dayEnd).getTime();
    if (start <= input.dayEnd.getTime() && end >= input.dayStart.getTime()) return true;
  }
  return false;
}

export function summarizeDayCompliance(users: AdminDayUserRow[]): Omit<
  AdminDayComplianceSummary,
  "date" | "isWeekend" | "users"
> {
  const totalUsers = users.length;
  const attended = users.filter((u) => u.attended);
  const excludedOoo = users.filter((u) => u.status === "excluded_ooo").length;
  const excludedStale = users.filter((u) => u.status === "excluded_stale").length;
  const excludedNoVisit = users.filter((u) => u.status === "no_visit").length;
  const metTargetCount = attended.filter((u) => u.metTarget).length;
  const attendedCount = attended.length;

  return {
    totalUsers,
    attendedCount,
    metTargetCount,
    compliancePct:
      attendedCount > 0 ? Math.round((metTargetCount / attendedCount) * 100) : 0,
    excludedStale,
    excludedOoo,
    excludedNoVisit,
  };
}

export function isAgentStaleForReporting(dayKey: string, agentStale: boolean): boolean {
  if (isWeekendDay(dayKey)) return false;
  return agentStale;
}

export async function evaluateUserDayCompliance(input: {
  user: {
    id: string;
    email: string;
    name: string | null;
    timezone: string;
    hoursTarget: number | null;
    agentStaleGraceHours: number | null;
  };
  dayKey: string;
  hadInstalledDevice: boolean;
  lastHeartbeatBeforeDayEnd: Date | null;
}): Promise<AdminDayUserRow> {
  const { user, dayKey } = input;
  const hoursTarget = await getUserHoursTarget(user);
  const graceHours = await getEffectiveAgentStaleGraceHours(user);
  const config = await getAppConfig();
  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(dayKey, user.timezone);

  const ooo = await isUserOutOfOffice(user.id, dayKey);
  const agentStaleOnDay = wasAgentStaleAtDayEnd({
    dayKey,
    dayEnd,
    lastHeartbeatBeforeDayEnd: input.lastHeartbeatBeforeDayEnd,
    graceHours,
    hadInstalledDevice: input.hadInstalledDevice,
  });

  const { visits, params } = await loadDaySpanContext(user.id, dayKey, user.timezone);
  const totalMs = daySpanMsForDay(visits, params);
  const hours = roundHoursToMinute(totalMs / (1000 * 60 * 60));
  const metTarget = hours >= hoursTarget;

  const dayHeartbeats = await prisma.heartbeat.findMany({
    where: { userId: user.id, recordedAt: { gte: dayStart, lte: dayEnd } },
    select: { recordedAt: true, ssid: true, inOffice: true },
  });
  const inOfficeHeartbeats = dayHeartbeats
    .filter((h) => heartbeatInOffice(h, config.officeSsids))
    .map((h) => h.recordedAt);

  const attended = userAttendedOnDay({
    visits,
    dayStart,
    dayEnd,
    inOfficeHeartbeats,
    totalMs,
  });

  let status: AdminDayUserStatus;
  if (ooo) {
    status = "excluded_ooo";
  } else if (agentStaleOnDay) {
    status = "excluded_stale";
  } else if (!attended) {
    status = "no_visit";
  } else if (metTarget) {
    status = "attended_met";
  } else {
    status = "attended_not_met";
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    hours,
    hoursTarget,
    metTarget,
    attended: status === "attended_met" || status === "attended_not_met",
    status,
    agentHealthy: !agentStaleOnDay,
    agentStaleOnDay,
  };
}

export async function getAdminDayCompliance(
  dayKey: string,
  timezone = "Asia/Kolkata",
): Promise<AdminDayComplianceSummary> {
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      hoursTarget: true,
      agentStaleGraceHours: true,
      agentDevices: { select: { id: true, lastSeenAt: true } },
    },
  });

  const { end: dayEnd } = dayBoundsFromKey(dayKey, timezone);

  const rows = await Promise.all(
    users.map(async (user) => {
      const hadInstalledDevice = user.agentDevices.some((d) => d.lastSeenAt !== null);
      const lastHeartbeat = await prisma.heartbeat.findFirst({
        where: { userId: user.id, recordedAt: { lte: dayEnd } },
        orderBy: { recordedAt: "desc" },
        select: { recordedAt: true },
      });

      return evaluateUserDayCompliance({
        user,
        dayKey,
        hadInstalledDevice,
        lastHeartbeatBeforeDayEnd: lastHeartbeat?.recordedAt ?? null,
      });
    }),
  );

  return {
    date: dayKey,
    isWeekend: isWeekendDay(dayKey),
    ...summarizeDayCompliance(rows),
    users: rows,
  };
}

export function todayKeyForTimezone(timezone: string, now = new Date()): string {
  return dayKeyInTimezone(now, timezone);
}
