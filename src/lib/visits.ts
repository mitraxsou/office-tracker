import {
  DEFAULT_HOURS_TARGET,
  DEFAULT_TIMEZONE,
  VISIT_GAP_MS,
} from "./constants";

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

export function getDayBounds(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayKey = formatter.format(date);
  const start = new Date(`${dayKey}T00:00:00`);
  const end = new Date(`${dayKey}T23:59:59.999`);
  return { dayKey, start, end };
}

export function visitDurationMs(visit: VisitPoint, now = new Date()): number {
  const end = visit.endAt ?? now;
  return Math.max(0, end.getTime() - visit.startAt.getTime());
}

export function dayKeyInTimezone(date: Date, timezone: string): string {
  return getDayBounds(date, timezone).dayKey;
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

export function totalHoursFromVisits(visits: VisitPoint[], now = new Date()): number {
  const totalMs = visits.reduce((sum, v) => sum + visitDurationMs(v, now), 0);
  return totalMs / (1000 * 60 * 60);
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
