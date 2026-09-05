import { getAppConfig, getEffectiveAgentStaleGraceHours, getUserHoursTarget } from "./app-config";
import { heartbeatInOffice } from "./heartbeat-office";
import { loadDaySpanContext } from "./heartbeat-service";
import { isoWeekdayFromDayKey } from "./office-schedule";
import { isUserOutOfOffice } from "./out-of-office";
import { prisma } from "./db";
import { dayBoundsFromKey, dayKeyInTimezone } from "./timezone-dates";
import { daySpanMsForDay, roundHoursToMinute, type VisitForDaySpan } from "./visits";

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

export type AdminOrgCalendarDay = {
  dayKey: string;
  attendedCount: number;
  metTargetCount: number;
  compliancePct: number;
  totalRegistered: number;
  excludedOoo: number;
  excludedStale: number;
  excludedNoVisit: number;
  totalAttendedHours: number;
  isWeekend: boolean;
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

/**
 * Resolve compliance status for one user on one day.
 * Office presence overrides OOO: users with logged hours or in-office activity count as attended
 * even when an OOO range covers the day (incorrect range, partial day, or came in anyway).
 */
export function resolveDayUserStatus(input: {
  ooo: boolean;
  agentStaleOnDay: boolean;
  attended: boolean;
  metTarget: boolean;
}): AdminDayUserStatus {
  if (input.agentStaleOnDay) {
    return "excluded_stale";
  }
  if (input.ooo && !input.attended) {
    return "excluded_ooo";
  }
  if (!input.attended) {
    return "no_visit";
  }
  if (input.metTarget) {
    return "attended_met";
  }
  return "attended_not_met";
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

export function toAdminOrgCalendarDay(
  dayKey: string,
  summary: Omit<AdminDayComplianceSummary, "date" | "isWeekend" | "users">,
  totalAttendedHours: number,
): AdminOrgCalendarDay {
  return {
    dayKey,
    attendedCount: summary.attendedCount,
    metTargetCount: summary.metTargetCount,
    compliancePct: summary.compliancePct,
    totalRegistered: summary.totalUsers,
    excludedOoo: summary.excludedOoo,
    excludedStale: summary.excludedStale,
    excludedNoVisit: summary.excludedNoVisit,
    totalAttendedHours: Math.round(totalAttendedHours * 10) / 10,
    isWeekend: isWeekendDay(dayKey),
  };
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

type ComplianceUser = {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  hoursTarget: number | null;
  agentStaleGraceHours: number | null;
};

type DayHeartbeatRow = {
  recordedAt: Date;
  ssid: string | null;
  inOffice: boolean;
};

type DayVisitRow = VisitForDaySpan;

export function computeUserDayComplianceRow(input: {
  user: ComplianceUser;
  dayKey: string;
  hadInstalledDevice: boolean;
  lastHeartbeatBeforeDayEnd: Date | null;
  ooo: boolean;
  visits: DayVisitRow[];
  dayHeartbeats: DayHeartbeatRow[];
  officeSsids: string[];
  hoursTarget: number;
  graceHours: number;
  now?: Date;
}): AdminDayUserRow {
  const { user, dayKey } = input;
  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(dayKey, user.timezone);
  const now = input.now ?? new Date();

  const agentStaleOnDay = wasAgentStaleAtDayEnd({
    dayKey,
    dayEnd,
    lastHeartbeatBeforeDayEnd: input.lastHeartbeatBeforeDayEnd,
    graceHours: input.graceHours,
    hadInstalledDevice: input.hadInstalledDevice,
  });

  const inOfficeToday = input.dayHeartbeats.filter((h) =>
    heartbeatInOffice(h, input.officeSsids),
  );
  const firstInOfficeHeartbeatAt = inOfficeToday[0]?.recordedAt ?? null;
  const lastInOfficeHeartbeatAt = inOfficeToday[inOfficeToday.length - 1]?.recordedAt ?? null;
  const lastHeartbeatOnDay = input.dayHeartbeats[input.dayHeartbeats.length - 1]?.recordedAt ?? null;

  const params = {
    dayStart,
    dayEnd,
    now,
    staleMs: input.graceHours * 60 * 60 * 1000,
    lastHeartbeatAt: input.lastHeartbeatBeforeDayEnd,
    firstInOfficeHeartbeatAt,
    lastInOfficeHeartbeatAt,
  };
  const totalMs = daySpanMsForDay(input.visits, params);
  const hours = roundHoursToMinute(totalMs / (1000 * 60 * 60));
  const metTarget = hours >= input.hoursTarget;

  const inOfficeHeartbeats = inOfficeToday.map((h) => h.recordedAt);
  const attended = userAttendedOnDay({
    visits: input.visits,
    dayStart,
    dayEnd,
    inOfficeHeartbeats,
    totalMs,
  });

  const status = resolveDayUserStatus({
    ooo: input.ooo,
    agentStaleOnDay,
    attended,
    metTarget,
  });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    hours,
    hoursTarget: input.hoursTarget,
    metTarget,
    attended: status === "attended_met" || status === "attended_not_met",
    status,
    agentHealthy: !agentStaleOnDay,
    agentStaleOnDay,
  };
}

export async function evaluateUserDayCompliance(input: {
  user: ComplianceUser;
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
  const { visits, params } = await loadDaySpanContext(user.id, dayKey, user.timezone);

  const dayHeartbeats = await prisma.heartbeat.findMany({
    where: { userId: user.id, recordedAt: { gte: dayStart, lte: dayEnd } },
    select: { recordedAt: true, ssid: true, inOffice: true },
  });

  return computeUserDayComplianceRow({
    user,
    dayKey,
    hadInstalledDevice: input.hadInstalledDevice,
    lastHeartbeatBeforeDayEnd: input.lastHeartbeatBeforeDayEnd,
    ooo,
    visits,
    dayHeartbeats,
    officeSsids: config.officeSsids,
    hoursTarget,
    graceHours,
    now: params.now,
  });
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
