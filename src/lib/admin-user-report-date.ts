import { addDaysToDayKey } from "./office-schedule";
import { currentMonthKey, daysInMonth, parseMonthKey } from "./month-range";
import { dayKeyInTimezone } from "./timezone-dates";

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDayKey(value: string | null | undefined): value is string {
  if (!value || !DAY_KEY_RE.test(value)) return false;
  const { year, month } = parseMonthKey(value.slice(0, 7));
  const day = Number(value.slice(8, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function monthKeyFromDayKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function lastDayKeyOfMonth(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  const last = daysInMonth(year, month);
  return `${monthKey}-${String(last).padStart(2, "0")}`;
}

export function shiftDayKey(dayKey: string, delta: number): string {
  return addDaysToDayKey(dayKey, delta);
}

export type DailyTrendPoint = {
  date: string;
  totalHours: number;
  metTarget?: boolean;
};

/**
 * Pick a useful selected day for the admin user report.
 * Prefer an explicit URL/date param in the viewed month, else today when
 * viewing the current month, else the latest day with office hours, else
 * the last calendar day of the month.
 */
export function resolveDefaultSelectedDate(params: {
  monthKey: string;
  timezone: string;
  dailyTrend: DailyTrendPoint[];
  preferredDate?: string | null;
  now?: Date;
}): string {
  const { monthKey, timezone, dailyTrend, preferredDate, now = new Date() } = params;

  if (preferredDate && isValidDayKey(preferredDate) && monthKeyFromDayKey(preferredDate) === monthKey) {
    return preferredDate;
  }

  const todayKey = dayKeyInTimezone(now, timezone);
  if (monthKeyFromDayKey(todayKey) === monthKey) {
    return todayKey;
  }

  const withHours = dailyTrend
    .filter((d) => d.date.startsWith(monthKey) && d.totalHours > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (withHours[0]) return withHours[0].date;

  return lastDayKeyOfMonth(monthKey);
}

export function buildAdminUserReportHref(
  userId: string,
  opts?: { month?: string | null; date?: string | null },
): string {
  const qs = new URLSearchParams();
  if (opts?.month && /^\d{4}-\d{2}$/.test(opts.month)) {
    qs.set("month", opts.month);
  }
  if (opts?.date && isValidDayKey(opts.date)) {
    qs.set("date", opts.date);
  }
  const query = qs.toString();
  return query
    ? `/admin/reports/users/${userId}?${query}`
    : `/admin/reports/users/${userId}`;
}

export function parseAdminUserReportQuery(searchParams: URLSearchParams): {
  month: string | null;
  date: string | null;
} {
  const monthRaw = searchParams.get("month");
  const dateRaw = searchParams.get("date");
  return {
    month: monthRaw && /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : null,
    date: isValidDayKey(dateRaw) ? dateRaw : null,
  };
}

export function shouldJumpToCurrentMonth(timezone: string, now = new Date()): string {
  return currentMonthKey(timezone, now);
}

export type SelectedDayVisit = {
  id: string;
  startAt: string;
  endAt: string | null;
  source: string;
  ssid: string | null;
};

export type SelectedDaySummary = {
  dayKey: string;
  totalHours: number;
  metTarget: boolean;
  visitCount: number;
  openVisit: boolean;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  visits: SelectedDayVisit[];
};

export function summarizeSelectedDay(params: {
  dayKey: string;
  timezone: string;
  hoursTarget: number;
  dailyTrend: DailyTrendPoint[];
  visits: SelectedDayVisit[];
}): SelectedDaySummary {
  const { dayKey, timezone, hoursTarget, dailyTrend, visits } = params;
  const trend = dailyTrend.find((d) => d.date === dayKey);
  const dayVisits = visits
    .filter((v) => dayKeyInTimezone(new Date(v.startAt), timezone) === dayKey)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  let firstActivityAt: string | null = null;
  let lastActivityAt: string | null = null;
  let openVisit = false;

  for (const visit of dayVisits) {
    if (!firstActivityAt || visit.startAt < firstActivityAt) {
      firstActivityAt = visit.startAt;
    }
    if (visit.endAt === null) {
      openVisit = true;
      const candidate = new Date().toISOString();
      if (!lastActivityAt || candidate > lastActivityAt) lastActivityAt = candidate;
    } else if (!lastActivityAt || visit.endAt > lastActivityAt) {
      lastActivityAt = visit.endAt;
    }
  }

  const totalHours = trend?.totalHours ?? 0;
  const metTarget = trend?.metTarget ?? totalHours >= hoursTarget;

  return {
    dayKey,
    totalHours,
    metTarget,
    visitCount: dayVisits.length,
    openVisit,
    firstActivityAt,
    lastActivityAt: openVisit ? lastActivityAt : lastActivityAt,
    visits: dayVisits,
  };
}
