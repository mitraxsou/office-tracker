import { userHasInstalledAgentForStaleChecks } from "./agent-deregister";
import {
  agentModeUsesActivityTicks,
  dayPulsesInRange,
  getLastAgentSignalBefore,
  groupAgentPulseRowsByUserId,
  lastAgentSignalAtOrBefore,
} from "./activity-signal";
import { getAppConfig, getEffectiveAgentStaleGraceHours, getUserHoursTarget } from "./app-config";
import {
  filterInOfficeDayPulses,
  loadDayPulseRowsForDay,
  type DayPulseRow,
} from "./heartbeat-service";
import { isoWeekdayFromDayKey } from "./office-schedule";
import { isDayKeyInRange, isUserOutOfOffice } from "./out-of-office";
import { prisma } from "./db";
import { dayBoundsFromKey, dayKeyInTimezone, isCurrentCalendarDay, isFutureDayKey } from "./timezone-dates";
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
 * Office presence overrides OOO and stale-agent exclusion: users with logged hours or
 * in-office activity count as attended even when OOO or agent health would otherwise exclude them.
 */
export function resolveDayUserStatus(input: {
  ooo: boolean;
  agentStaleOnDay: boolean;
  attended: boolean;
  metTarget: boolean;
}): AdminDayUserStatus {
  if (input.attended) {
    if (input.metTarget) {
      return "attended_met";
    }
    return "attended_not_met";
  }
  if (input.agentStaleOnDay) {
    return "excluded_stale";
  }
  if (input.ooo) {
    return "excluded_ooo";
  }
  return "no_visit";
}

/** True when the user had office presence on the day (visit segment or in-office pulse). */
export function userAttendedOnDay(input: {
  visits: Array<{ startAt: Date; endAt: Date | null }>;
  dayStart: Date;
  dayEnd: Date;
  inOfficeHeartbeats: Date[];
  totalMs: number;
  now?: Date;
}): boolean {
  if (input.totalMs > 0) return true;
  if (input.inOfficeHeartbeats.length > 0) return true;

  const now = input.now ?? new Date();
  if (now.getTime() < input.dayStart.getTime()) return false;

  const isCurrentDay = isCurrentCalendarDay(input.dayStart, input.dayEnd, now);

  for (const visit of input.visits) {
    const start = visit.startAt.getTime();
    if (visit.endAt === null) {
      if (!isCurrentDay) {
        if (
          input.inOfficeHeartbeats.length > 0 &&
          start <= input.dayEnd.getTime()
        ) {
          return true;
        }
        continue;
      }
      const end = now.getTime();
      if (start <= input.dayEnd.getTime() && end >= input.dayStart.getTime()) return true;
      continue;
    }
    const end = visit.endAt.getTime();
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
  agentDeregisteredAt: Date | null;
};

type DayVisitRow = VisitForDaySpan;

function visitsOverlappingDay(visits: DayVisitRow[], dayStart: Date, dayEnd: Date) {
  return visits.filter((v) => {
    const start = v.startAt.getTime();
    const end = (v.endAt ?? dayEnd).getTime();
    return start <= dayEnd.getTime() && end >= dayStart.getTime();
  });
}

export function computeUserDayComplianceRow(input: {
  user: ComplianceUser;
  dayKey: string;
  hadInstalledDevice: boolean;
  lastHeartbeatBeforeDayEnd: Date | null;
  ooo: boolean;
  visits: DayVisitRow[];
  dayPulses: DayPulseRow[];
  useActivity: boolean;
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

  const inOfficeToday = filterInOfficeDayPulses(
    input.dayPulses,
    input.useActivity,
    input.officeSsids,
  );
  const firstInOfficeHeartbeatAt = inOfficeToday[0]?.at ?? null;
  const lastInOfficeHeartbeatAt = inOfficeToday[inOfficeToday.length - 1]?.at ?? null;

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

  const inOfficeHeartbeats = inOfficeToday.map((h) => h.at);
  const attended = userAttendedOnDay({
    visits: input.visits,
    dayStart,
    dayEnd,
    inOfficeHeartbeats,
    totalMs,
    now,
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
  lastHeartbeatBeforeDayEnd?: Date | null;
  useActivity?: boolean;
  agentMode?: string;
}): Promise<AdminDayUserRow> {
  const { user, dayKey } = input;
  const [hoursTarget, graceHours, config] = await Promise.all([
    getUserHoursTarget(user),
    getEffectiveAgentStaleGraceHours(user),
    getAppConfig(),
  ]);
  const agentMode = input.agentMode ?? config.agentMode;
  const useActivity = input.useActivity ?? agentModeUsesActivityTicks(agentMode);
  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(dayKey, user.timezone);
  const now = new Date();

  const lastHeartbeatBeforeDayEnd =
    input.lastHeartbeatBeforeDayEnd !== undefined
      ? input.lastHeartbeatBeforeDayEnd
      : await getLastAgentSignalBefore(user.id, dayEnd, useActivity);

  const [ooo, visits, dayPulses] = await Promise.all([
    isUserOutOfOffice(user.id, dayKey),
    prisma.visit.findMany({
      where: {
        userId: user.id,
        startAt: { lte: dayEnd },
        OR: [{ endAt: null }, { endAt: { gte: dayStart } }],
      },
      orderBy: { startAt: "asc" },
    }),
    loadDayPulseRowsForDay(user.id, dayStart, dayEnd, useActivity),
  ]);

  return computeUserDayComplianceRow({
    user,
    dayKey,
    hadInstalledDevice: input.hadInstalledDevice,
    lastHeartbeatBeforeDayEnd,
    ooo,
    visits,
    dayPulses,
    useActivity,
    officeSsids: config.officeSsids,
    hoursTarget,
    graceHours,
    now,
  });
}

export async function getAdminDayCompliance(
  dayKey: string,
  timezone = "Asia/Kolkata",
): Promise<AdminDayComplianceSummary> {
  const config = await getAppConfig();
  const useActivity = agentModeUsesActivityTicks(config.agentMode);
  const officeSsids = config.officeSsids;

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

  const now = new Date();
  if (isFutureDayKey(dayKey, timezone, now)) {
    const hoursTargets = new Map<string, number>();
    await Promise.all(
      users.map(async (user) => {
        hoursTargets.set(user.id, await getUserHoursTarget(user));
      }),
    );
    return emptyFutureDayCompliance(dayKey, users, hoursTargets);
  }

  const userIds = users.map((u) => u.id);
  const userBounds = users.map((user) => {
    const { start, end } = dayBoundsFromKey(dayKey, user.timezone);
    return { userId: user.id, dayStart: start, dayEnd: end };
  });
  const rangeStartMs = Math.min(...userBounds.map((b) => b.dayStart.getTime()));
  const rangeEndMs = Math.max(...userBounds.map((b) => b.dayEnd.getTime()));
  const rangeStart = new Date(rangeStartMs);
  const rangeEnd = new Date(rangeEndMs);

  const graceHoursList = await Promise.all(
    users.map((user) => getEffectiveAgentStaleGraceHours(user)),
  );
  const maxGraceHours = Math.max(...graceHoursList, 24);
  const staleLookbackStart = new Date(rangeStartMs - maxGraceHours * 60 * 60 * 1000);

  const [oooRows, visitRows, pulseRows, hoursTargets] = await Promise.all([
    prisma.userOutOfOffice.findMany({
      where: {
        userId: { in: userIds },
        startDate: { lte: dayKey },
        endDate: { gte: dayKey },
      },
      select: { userId: true, startDate: true, endDate: true },
    }),
    prisma.visit.findMany({
      where: {
        userId: { in: userIds },
        startAt: { lte: rangeEnd },
        OR: [{ endAt: null }, { endAt: { gte: rangeStart } }],
      },
      select: {
        userId: true,
        id: true,
        startAt: true,
        endAt: true,
        source: true,
        ssid: true,
        updatedAt: true,
      },
      orderBy: { startAt: "asc" },
    }),
    useActivity
      ? prisma.activityTick.findMany({
          where: {
            userId: { in: userIds },
            at: { gte: staleLookbackStart, lte: rangeEnd },
          },
          select: { userId: true, at: true, ssid: true, inOffice: true },
          orderBy: [{ userId: "asc" }, { at: "asc" }],
        })
      : prisma.heartbeat.findMany({
          where: {
            userId: { in: userIds },
            recordedAt: { gte: staleLookbackStart, lte: rangeEnd },
          },
          select: {
            userId: true,
            recordedAt: true,
            ssid: true,
            inOffice: true,
          },
          orderBy: [{ userId: "asc" }, { recordedAt: "asc" }],
        }).then((rows) =>
          rows.map((row) => ({
            userId: row.userId,
            at: row.recordedAt,
            ssid: row.ssid,
            inOffice: row.inOffice,
          })),
        ),
    Promise.all(users.map((user) => getUserHoursTarget(user))),
  ]);

  const oooByUser = new Map<string, Array<{ startDate: string; endDate: string }>>();
  for (const row of oooRows) {
    const list = oooByUser.get(row.userId) ?? [];
    list.push({ startDate: row.startDate, endDate: row.endDate });
    oooByUser.set(row.userId, list);
  }

  const visitsByUser = new Map<string, DayVisitRow[]>();
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

  const pulsesByUser = groupAgentPulseRowsByUserId(pulseRows);

  const rows = users.map((user, index) => {
    const bounds = userBounds.find((b) => b.userId === user.id)!;
    const userPulses = pulsesByUser.get(user.id) ?? [];
    const dayPulses = dayPulsesInRange(userPulses, bounds.dayStart, bounds.dayEnd);
    const lastSignal = lastAgentSignalAtOrBefore(userPulses, bounds.dayEnd);
    const dayVisits = visitsOverlappingDay(visitsByUser.get(user.id) ?? [], bounds.dayStart, bounds.dayEnd);
    const oooRanges = oooByUser.get(user.id) ?? [];
    const ooo = oooRanges.some((r) => isDayKeyInRange(dayKey, r.startDate, r.endDate));

    return computeUserDayComplianceRow({
      user,
      dayKey,
      hadInstalledDevice: userHasInstalledAgentForStaleChecks({
        agentDeregisteredAt: user.agentDeregisteredAt,
        agentDevices: user.agentDevices,
      }),
      lastHeartbeatBeforeDayEnd: lastSignal,
      ooo,
      visits: dayVisits,
      dayPulses,
      useActivity,
      officeSsids,
      hoursTarget: hoursTargets[index] ?? 0,
      graceHours: graceHoursList[index] ?? maxGraceHours,
      now,
    });
  });

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

function emptyFutureDayUserRow(user: ComplianceUser, hoursTarget: number): AdminDayUserRow {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    hours: 0,
    hoursTarget,
    metTarget: false,
    attended: false,
    status: "no_visit",
    agentHealthy: true,
    agentStaleOnDay: false,
  };
}

export function emptyFutureDayCompliance(
  dayKey: string,
  users: ComplianceUser[],
  hoursTargets: Map<string, number>,
): AdminDayComplianceSummary {
  const rows = users.map((user) =>
    emptyFutureDayUserRow(user, hoursTargets.get(user.id) ?? 0),
  );
  return {
    date: dayKey,
    isWeekend: isWeekendDay(dayKey),
    ...summarizeDayCompliance(rows),
    users: rows,
  };
}
