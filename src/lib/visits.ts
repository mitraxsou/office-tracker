import {
  DEFAULT_HOURS_TARGET,
  DEFAULT_TIMEZONE,
  VISIT_GAP_MS,
} from "./constants";
import {
  dayBoundsFromKey,
  dayKeyInTimezone,
  getDayBounds,
  isCurrentCalendarDay,
} from "./timezone-dates";

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

function mergeIntervalMs(intervals: Array<{ start: number; end: number }>): number {
  const sorted = intervals
    .filter((interval) => interval.end >= interval.start)
    .sort((a, b) => a.start - b.start);
  if (sorted.length === 0) return 0;

  const merged: Array<{ start: number; end: number }> = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged.reduce((sum, interval) => sum + Math.max(0, interval.end - interval.start), 0);
}

type OfficeInterval = {
  start: number;
  end: number;
  source: string;
  closed: boolean;
};

function officeIntervalsForDay(
  visits: VisitForDaySpan[],
  params: DaySpanParams,
): Array<{ start: number; end: number }> {
  const dayEndMs = params.dayEnd.getTime();
  const isCurrentDay = isCurrentCalendarDay(params.dayStart, params.dayEnd, params.now);
  // Confirmed allowlisted office only. Never fall back to any agent sync.
  const lastHb = params.lastInOfficeHeartbeatAt ?? null;
  const intervals: OfficeInterval[] = [];

  for (const visit of visits) {
    if (visit.endAt === null && !isCurrentDay) continue;
    if (visit.endAt === null && isManualSource(visit.source) && isCurrentDay) continue;
    const end = effectiveVisitEnd({
      endAt: visit.endAt,
      updatedAt: visit.updatedAt ?? visit.startAt,
      startAt: visit.startAt,
      now: params.now,
      staleMs: params.staleMs,
      lastHeartbeatAt: params.lastHeartbeatAt,
      dayEnd: params.dayEnd,
    });
    const clippedEnd = Math.min(end.getTime(), dayEndMs);
    const start = clipToDay(visit.startAt.getTime(), params.dayStart, params.dayEnd);
    if (start === null || clippedEnd < start) continue;
    intervals.push({
      start,
      end: clippedEnd,
      source: visit.source,
      closed: visit.endAt !== null,
    });
  }

  const openVisit = visits.find((visit) => visit.endAt === null) ?? null;
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
    const start = clipToDay(openVisit.startAt.getTime(), params.dayStart, params.dayEnd);
    const endMs = Math.min(end.getTime(), dayEndMs);
    if (start !== null && endMs >= start) {
      intervals.push({
        start,
        end: endMs,
        source: openVisit.source,
        closed: false,
      });
    }
  }

  if (lastHb) {
    const hbEnd = Math.min(lastHb.getTime(), dayEndMs);
    const host = intervals
      .filter(
        (interval) =>
          interval.start <= hbEnd &&
          !(isManualSource(interval.source) && interval.closed),
      )
      .sort((a, b) => b.start - a.start)[0];
    if (host) {
      host.end = Math.max(host.end, hbEnd);
    }
  }

  const firstHb = params.firstInOfficeHeartbeatAt
    ? clipToDay(params.firstInOfficeHeartbeatAt.getTime(), params.dayStart, params.dayEnd)
    : null;
  if (firstHb !== null) {
    const host = intervals
      .filter(
        (interval) =>
          interval.end >= firstHb &&
          !(isManualSource(interval.source) && interval.closed),
      )
      .sort((a, b) => a.start - b.start)[0];
    if (host && firstHb < host.start && host.start - firstHb <= params.staleMs) {
      host.start = firstHb;
    }
  }

  if (intervals.length === 0 && lastHb) {
    const hbEnd = Math.min(lastHb.getTime(), dayEndMs);
    const hbStart =
      firstHb ??
      clipToDay(lastHb.getTime(), params.dayStart, params.dayEnd);
    if (hbStart !== null && hbEnd >= hbStart && (openVisit || firstHb !== null)) {
      intervals.push({
        start: hbStart,
        end: hbEnd,
        source: "wifi",
        closed: false,
      });
    }
  }

  return intervals.map(({ start, end }) => ({ start, end }));
}

/** First clipped check-in on the day from visits, or a nearby in-office pulse. */
export function firstOfficeInMsForDay(
  visits: VisitForDaySpan[],
  params: DaySpanParams,
): number | null {
  const firstHb = params.firstInOfficeHeartbeatAt ?? null;
  let firstIn: number | null = null;
  const isCurrentDay = isCurrentCalendarDay(params.dayStart, params.dayEnd, params.now);

  for (const v of visits) {
    if (v.endAt === null && !isCurrentDay) {
      continue;
    }
    const start = clipToDay(v.startAt.getTime(), params.dayStart, params.dayEnd);
    if (start === null) continue;
    if (firstIn === null || start < firstIn) firstIn = start;
  }

  if (firstHb) {
    const hbStart = clipToDay(firstHb.getTime(), params.dayStart, params.dayEnd);
    if (hbStart !== null) {
      if (firstIn === null || (hbStart < firstIn && firstIn - hbStart <= params.staleMs)) {
        firstIn = hbStart;
      }
    }
  }

  return firstIn;
}

/**
 * While still in office, stretch the current session to the page clock so the user
 * can see remaining time until the 5h target. Does not change stored hours.
 */
export function liveOfficeMsForDay(
  visits: VisitForDaySpan[],
  params: DaySpanParams,
  inOfficeNow: boolean,
): number {
  const intervals = officeIntervalsForDay(visits, params);
  if (
    inOfficeNow &&
    isCurrentCalendarDay(params.dayStart, params.dayEnd, params.now)
  ) {
    const nowMs = Math.min(params.now.getTime(), params.dayEnd.getTime());
    const last = [...intervals].sort((a, b) => b.start - a.start)[0];
    if (last) {
      last.end = Math.max(last.end, nowMs);
    } else {
      const firstIn = firstOfficeInMsForDay(visits, params);
      if (firstIn !== null && nowMs >= firstIn) {
        intervals.push({ start: firstIn, end: nowMs });
      }
    }
  }
  return Math.min(mergeIntervalMs(intervals), MS_PER_DAY);
}

/**
 * Daily total: time actually spent in office (merged visit segments).
 * Gaps between separate visits do not count. Overlapping segments are not
 * double-counted. A later in-office snapshot can extend the last session.
 * A stray early pulse does not open a day-long span. Capped at 24 hours.
 */
export function daySpanMsForDay(
  visits: VisitForDaySpan[],
  params: DaySpanParams
): number {
  return Math.min(mergeIntervalMs(officeIntervalsForDay(visits, params)), MS_PER_DAY);
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

/** Daily total for visits already scoped to one day: merged in-office segments. */
export function totalHoursFromVisits(visits: VisitPoint[], now = new Date()): number {
  if (visits.length === 0) return 0;
  return (
    Math.min(
      mergeIntervalMs(
        visits.map((visit) => ({
          start: visit.startAt.getTime(),
          end: (visit.endAt ?? now).getTime(),
        })),
      ),
      MS_PER_DAY,
    ) / MS_PER_HOUR
  );
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

/**
 * Round to the nearest minute. Use this for totals shown as "Xh Ym" so the total
 * matches the check-in and check-out times on screen. Rounding to 0.1 h first
 * shifts a total by up to 3 minutes.
 */
export function roundHoursToMinute(hours: number): number {
  return Math.round(hours * 60) / 60;
}

export function formatHours(hours: number): string {
  const safe = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const h = Math.floor(safe);
  const m = Math.round((safe - h) * 60);
  return `${h}h ${m}m`;
}

/** Live dashboard durations: hours, minutes, and seconds. */
export function formatHoursHms(hours: number): string {
  const safe = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const totalSeconds = Math.floor(safe * 3600 + 1e-9);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

/** First check-in plus the daily hours target. */
export function idealCheckoutAt(firstCheckIn: Date, targetHours: number): Date {
  const hours = Number.isFinite(targetHours) ? Math.max(0, targetHours) : 0;
  return new Date(firstCheckIn.getTime() + hours * 60 * 60 * 1000);
}

/** True when a closed visit has endAt strictly before startAt. */
export function visitHasInvalidTimestamps(visit: {
  startAt: Date;
  endAt: Date | null;
}): boolean {
  return Boolean(visit.endAt && visit.endAt.getTime() < visit.startAt.getTime());
}

/** Duration label that surfaces corrupted end-before-start rows instead of 0h 0m. */
export function formatVisitDurationLabel(
  visit: { startAt: Date; endAt: Date | null },
  now = new Date(),
): string {
  if (visitHasInvalidTimestamps(visit)) return "Invalid times";
  const end = visit.endAt ?? now;
  const hours = Math.max(0, end.getTime() - visit.startAt.getTime()) / (1000 * 60 * 60);
  return formatHours(hours);
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

function formatTimeLower(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .toLowerCase();
}

/** Last heartbeat label: "Today, 1:14 am" or "5 Sep 2026, 8:18 pm". */
export function formatLastHeartbeat(
  date: Date,
  todayDayKey: string,
  timezone = DEFAULT_TIMEZONE,
): string {
  const heartbeatDayKey = dayKeyInTimezone(date, timezone);
  const time = formatTimeLower(date, timezone);
  if (heartbeatDayKey === todayDayKey) {
    return `Today, ${time}`;
  }
  const datePart = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  return `${datePart}, ${time}`;
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
