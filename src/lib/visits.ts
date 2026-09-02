import {
  DEFAULT_HOURS_TARGET,
  DEFAULT_TIMEZONE,
  VISIT_GAP_MS,
} from "./constants";
import { dayBoundsFromKey, dayKeyInTimezone, getDayBounds } from "./timezone-dates";

export { dayKeyInTimezone, getDayBounds, dayBoundsFromKey };

export type VisitPoint = {
  id: string;
  startAt: Date;
  endAt: Date | null;
  source: string;
  ssid?: string | null;
};

export type HeartbeatPoint = {
  recordedAt: Date;
  inOffice: boolean;
};

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function visitDurationMs(visit: VisitPoint, now = new Date()): number {
  const end = visit.endAt ?? now;
  return Math.max(0, end.getTime() - visit.startAt.getTime());
}

export type VisitForDaySpan = VisitPoint & {
  updatedAt?: Date;
};

export type DaySpanParams = {
  dayStart: Date;
  dayEnd: Date;
  now: Date;
  staleMs: number;
  /** Latest heartbeat overall (agent health / open visit stale detection). */
  lastHeartbeatAt: Date | null;
  /** First in-office heartbeat on this calendar day. */
  firstInOfficeHeartbeatAt?: Date | null;
  /** Last in-office heartbeat on this calendar day (implicit wifi checkout). */
  lastInOfficeHeartbeatAt?: Date | null;
};

function clipToDay(ts: number, dayStart: Date, dayEnd: Date): number | null {
  const clipped = Math.max(ts, dayStart.getTime());
  if (clipped > dayEnd.getTime()) return null;
  return clipped;
}

function isManualSource(source: string): boolean {
  return source === "manual";
}

/**
 * Daily total: first check-in to last check-out on the day (gaps between visits count).
 * Open visits on the current day extend to now (or effectiveVisitEnd).
 * Manual check-out caps the day only when there is no open visit (user left office).
 * Last in-office heartbeat extends wifi days when no open visit and no manual cap.
 * Capped at 24 hours.
 */
export function daySpanMsForDay(
  visits: VisitForDaySpan[],
  params: DaySpanParams
): number {
  const dayStartMs = params.dayStart.getTime();
  const dayEndMs = params.dayEnd.getTime();
  const firstHb = params.firstInOfficeHeartbeatAt ?? null;
  const lastHb =
    params.lastInOfficeHeartbeatAt ??
    (params.lastHeartbeatAt &&
    params.lastHeartbeatAt.getTime() >= dayStartMs &&
    params.lastHeartbeatAt.getTime() <= dayEndMs
      ? params.lastHeartbeatAt
      : null);

  let firstIn: number | null = null;

  for (const v of visits) {
    const start = clipToDay(v.startAt.getTime(), params.dayStart, params.dayEnd);
    if (start === null) continue;
    if (firstIn === null || start < firstIn) firstIn = start;
  }

  if (firstHb) {
    const hbStart = clipToDay(firstHb.getTime(), params.dayStart, params.dayEnd);
    if (hbStart !== null && (firstIn === null || hbStart < firstIn)) {
      firstIn = hbStart;
    }
  }

  if (firstIn === null) return 0;

  const manualEndsOnDay = visits
    .filter(
      (v) =>
        isManualSource(v.source) &&
        v.endAt !== null &&
        v.endAt.getTime() >= dayStartMs &&
        v.endAt.getTime() <= dayEndMs
    )
    .map((v) => v.endAt!.getTime());

  const latestManualEnd =
    manualEndsOnDay.length > 0 ? Math.max(...manualEndsOnDay) : null;

  const openVisit = visits.find((v) => v.endAt === null);
  const isCurrentDay = params.now.getTime() <= dayEndMs;

  let lastOut: number | null = null;

  if (openVisit && isCurrentDay) {
    const end = isManualSource(openVisit.source)
      ? params.now
      : effectiveVisitEnd({
          endAt: null,
          updatedAt: openVisit.updatedAt ?? openVisit.startAt,
          startAt: openVisit.startAt,
          now: params.now,
          staleMs: params.staleMs,
          lastHeartbeatAt: params.lastHeartbeatAt,
          dayEnd: params.dayEnd,
        });
    lastOut = Math.min(end.getTime(), dayEndMs);
  } else if (latestManualEnd !== null) {
    lastOut = Math.min(latestManualEnd, dayEndMs);
  } else {
    for (const v of visits) {
      const end = effectiveVisitEnd({
        endAt: v.endAt,
        updatedAt: v.updatedAt ?? v.startAt,
        startAt: v.startAt,
        now: params.now,
        staleMs: params.staleMs,
        lastHeartbeatAt: params.lastHeartbeatAt,
        dayEnd: params.dayEnd,
      });
      const clippedEnd = Math.min(end.getTime(), dayEndMs);
      const start = clipToDay(v.startAt.getTime(), params.dayStart, params.dayEnd);
      if (start === null || clippedEnd < start) continue;
      if (lastOut === null || clippedEnd > lastOut) lastOut = clippedEnd;
    }

    if (lastHb) {
      const hbEnd = Math.min(lastHb.getTime(), dayEndMs);
      if (lastOut === null || hbEnd > lastOut) lastOut = hbEnd;
    }
  }

  if (lastOut === null) return 0;

  const spanMs = Math.max(0, lastOut - firstIn);
  return Math.min(spanMs, MS_PER_DAY);
}

export function daySpanHoursForDay(
  visits: VisitForDaySpan[],
  params: DaySpanParams
): number {
  return daySpanMsForDay(visits, params) / MS_PER_HOUR;
}

/** Alias for report and dashboard daily hour totals. */
export function dailyOfficeHours(
  visits: VisitForDaySpan[],
  params: DaySpanParams
): number {
  return daySpanHoursForDay(visits, params);
}

/**
 * Open visits normally end on the next out-of-office heartbeat or after a gap.
 * If the agent goes silent, infer end at last activity + staleMs.
 * When the calendar day has ended, treat the last heartbeat as logout (not "now").
 */
export function effectiveVisitEnd(params: {
  endAt: Date | null;
  updatedAt: Date;
  startAt: Date;
  now: Date;
  staleMs: number;
  lastHeartbeatAt: Date | null;
  dayEnd?: Date | null;
}): Date {
  if (params.endAt) return params.endAt;

  const lastActivity = params.updatedAt ?? params.startAt;

  if (params.dayEnd && params.now > params.dayEnd) {
    if (params.lastHeartbeatAt && params.lastHeartbeatAt <= params.dayEnd) {
      return params.lastHeartbeatAt;
    }
    if (params.lastHeartbeatAt && params.lastHeartbeatAt > params.dayEnd) {
      return params.dayEnd;
    }
    return lastActivity <= params.dayEnd ? lastActivity : params.dayEnd;
  }

  const agentStale =
    !params.lastHeartbeatAt ||
    params.now.getTime() - params.lastHeartbeatAt.getTime() > params.staleMs;

  if (!agentStale) return params.now;

  return new Date(lastActivity.getTime() + params.staleMs);
}

/** Daily total for visits already scoped to one day: first in to last out. */
export function totalHoursFromVisits(visits: VisitPoint[], now = new Date()): number {
  if (visits.length === 0) return 0;
  const firstIn = Math.min(...visits.map((v) => v.startAt.getTime()));
  const lastOut = Math.max(...visits.map((v) => (v.endAt ?? now).getTime()));
  const spanMs = Math.max(0, lastOut - firstIn);
  return Math.min(spanMs, MS_PER_DAY) / MS_PER_HOUR;
}

export function meetsHoursTarget(
  visits: VisitPoint[],
  targetHours = DEFAULT_HOURS_TARGET,
  now = new Date()
): boolean {
  return totalHoursFromVisits(visits, now) >= targetHours;
}

export function remainingHours(
  visits: VisitPoint[],
  targetHours = DEFAULT_HOURS_TARGET,
  now = new Date()
): number {
  return Math.max(0, targetHours - totalHoursFromVisits(visits, now));
}

export function mergeHeartbeatsIntoVisits(
  heartbeats: HeartbeatPoint[],
  gapMs = VISIT_GAP_MS
): Array<{ startAt: Date; endAt: Date }> {
  if (heartbeats.length === 0) return [];

  const sorted = [...heartbeats].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
  );

  const visits: Array<{ startAt: Date; endAt: Date }> = [];
  let currentStart: Date | null = null;
  let currentEnd: Date | null = null;
  let lastInOfficeAt: Date | null = null;

  for (const beat of sorted) {
    if (!beat.inOffice) {
      if (currentStart && currentEnd) {
        visits.push({ startAt: currentStart, endAt: currentEnd });
        currentStart = null;
        currentEnd = null;
        lastInOfficeAt = null;
      }
      continue;
    }

    if (!currentStart) {
      currentStart = beat.recordedAt;
      currentEnd = beat.recordedAt;
      lastInOfficeAt = beat.recordedAt;
      continue;
    }

    const gap = beat.recordedAt.getTime() - lastInOfficeAt!.getTime();
    if (gap <= gapMs) {
      currentEnd = beat.recordedAt;
    } else {
      visits.push({ startAt: currentStart, endAt: currentEnd! });
      currentStart = beat.recordedAt;
      currentEnd = beat.recordedAt;
    }
    lastInOfficeAt = beat.recordedAt;
  }

  if (currentStart && currentEnd) {
    visits.push({ startAt: currentStart, endAt: currentEnd });
  }

  return visits;
}

export function roundHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

export function formatTime(date: Date, timezone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDate(date: Date, timezone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function isVisitOnDay(
  visit: VisitPoint,
  dayStart: Date,
  dayEnd: Date,
  now = new Date()
): boolean {
  const end = visit.endAt ?? now;
  return visit.startAt <= dayEnd && end >= dayStart;
}

export function clipVisitToDay(
  visit: VisitPoint,
  dayStart: Date,
  dayEnd: Date,
  now = new Date()
): VisitPoint | null {
  const end = visit.endAt ?? now;
  if (!isVisitOnDay(visit, dayStart, dayEnd, now)) return null;
  return {
    ...visit,
    startAt: new Date(Math.max(visit.startAt.getTime(), dayStart.getTime())),
    endAt: new Date(Math.min(end.getTime(), dayEnd.getTime())),
  };
}

export function visitsForDay(
  visits: VisitPoint[],
  date: Date,
  timezone = DEFAULT_TIMEZONE,
  now = new Date()
): VisitPoint[] {
  const { start, end } = getDayBounds(date, timezone);
  return visits
    .map((v) => clipVisitToDay(v, start, end, now))
    .filter((v): v is VisitPoint => v !== null);
}
