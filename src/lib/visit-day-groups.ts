import { dayBoundsFromKey } from "./timezone-dates";
import {
  clipVisitToDay,
  dayKeyInTimezone,
  type VisitPoint,
} from "./visits";

export type VisitDayGroupVisit = {
  id: string;
  startAt: string;
  endAt: string | null;
  source: string;
  ssid: string | null;
};

export type VisitDayTrend = {
  date: string;
  totalHours: number;
  metTarget: boolean;
};

export type VisitDayGroup = {
  dayKey: string;
  visits: VisitDayGroupVisit[];
  totalHours: number;
  metTarget: boolean;
  firstIn: Date | null;
  lastOut: Date | null;
  hasOpenVisit: boolean;
};

/** True when a visit overlaps the local calendar day (including overnight spill). */
export function visitOverlapsLocalDay(
  visit: { startAt: string; endAt: string | null },
  dayKey: string,
  timezone: string,
  now: Date = new Date(),
): boolean {
  const { start, end } = dayBoundsFromKey(dayKey, timezone);
  const visitStart = new Date(visit.startAt);
  const visitEnd = visit.endAt ? new Date(visit.endAt) : now;
  return visitStart.getTime() <= end.getTime() && visitEnd.getTime() >= start.getTime();
}

function toVisitPoint(visit: VisitDayGroupVisit): VisitPoint {
  return {
    id: visit.id,
    startAt: new Date(visit.startAt),
    endAt: visit.endAt ? new Date(visit.endAt) : null,
    source: visit.source,
    ssid: visit.ssid,
  };
}

function dayKeysTouchedByVisit(
  visit: VisitDayGroupVisit,
  timezone: string,
  now: Date,
): string[] {
  const startKey = dayKeyInTimezone(new Date(visit.startAt), timezone);
  const endKey = dayKeyInTimezone(
    visit.endAt ? new Date(visit.endAt) : now,
    timezone,
  );
  if (startKey === endKey) return [startKey];
  const keys: string[] = [];
  let cursor = startKey;
  // Walk local calendar days inclusively (cap at 14 to avoid runaway loops).
  for (let i = 0; i < 14; i++) {
    keys.push(cursor);
    if (cursor === endKey) break;
    const { end } = dayBoundsFromKey(cursor, timezone);
    cursor = dayKeyInTimezone(new Date(end.getTime() + 1), timezone);
  }
  return keys;
}

/**
 * Group visits by local calendar day using presence (dailyTrend hours > 0) and
 * visit overlap, not visit start day alone. Overnight midnight splits then appear
 * as their own day rows, matching "Office days counted".
 */
export function buildVisitDayGroups(
  visits: VisitDayGroupVisit[],
  dailyTrend: VisitDayTrend[],
  timezone: string,
  options?: { selectedDate?: string | null; now?: Date },
): VisitDayGroup[] {
  const now = options?.now ?? new Date();
  const selectedDate = options?.selectedDate ?? null;
  const trendByDate = new Map(dailyTrend.map((day) => [day.date, day]));
  const dayKeys = new Set<string>();

  if (selectedDate) {
    dayKeys.add(selectedDate);
  } else {
    // Prefer days touched by the provided visits (start through end), so an
    // overnight checkout still creates a second-day row. When the caller
    // source-filters visits, manual-only days drop out naturally.
    for (const visit of visits) {
      for (const key of dayKeysTouchedByVisit(visit, timezone, now)) {
        dayKeys.add(key);
      }
    }
    // Fallback when visits are empty but daily hours exist (e.g. trend-only).
    if (dayKeys.size === 0) {
      for (const day of dailyTrend) {
        if (day.totalHours > 0) dayKeys.add(day.date);
      }
    }
  }

  return Array.from(dayKeys)
    .map((dayKey) => {
      const { start, end } = dayBoundsFromKey(dayKey, timezone);
      const dayVisits: VisitDayGroupVisit[] = [];
      for (const visit of visits) {
        const clipped = clipVisitToDay(toVisitPoint(visit), start, end, now);
        if (!clipped) continue;
        dayVisits.push({
          id: visit.id,
          startAt: clipped.startAt.toISOString(),
          endAt: clipped.endAt ? clipped.endAt.toISOString() : null,
          source: visit.source,
          ssid: visit.ssid,
        });
      }
      dayVisits.sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );

      const firstIn = dayVisits[0] ? new Date(dayVisits[0].startAt) : null;
      const ends = dayVisits
        .map((visit) => (visit.endAt ? new Date(visit.endAt) : null))
        .filter((value): value is Date => value !== null);
      const hasOpenVisit = dayVisits.some((visit) => visit.endAt === null);
      const lastOut =
        ends.length > 0
          ? new Date(Math.max(...ends.map((date) => date.getTime())))
          : null;
      const trend = trendByDate.get(dayKey);

      return {
        dayKey,
        visits: dayVisits,
        totalHours: trend?.totalHours ?? 0,
        metTarget: trend?.metTarget ?? false,
        firstIn,
        lastOut,
        hasOpenVisit,
      };
    })
    .filter((group) => group.totalHours > 0 || group.visits.length > 0)
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}
