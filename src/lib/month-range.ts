import { dayBoundsFromKey } from "./timezone-dates";

export type MonthRange = {
  monthKey: string;
  from: Date;
  to: Date;
  fromKey: string;
  toKey: string;
};

export type CalendarCell = {
  dayKey: string | null;
  dayOfMonth: number | null;
};

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, month };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function currentMonthKey(timezone: string, ref = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(ref);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function shiftMonth(monthKey: string, delta: number): string {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    monthKey = currentMonthKey("Asia/Kolkata");
  }
  const { year, month } = parseMonthKey(monthKey);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function allDayKeysInMonth(monthKey: string): string[] {
  const { year, month } = parseMonthKey(monthKey);
  const count = daysInMonth(year, month);
  const monthPart = String(month).padStart(2, "0");
  return Array.from(
    { length: count },
    (_, i) => `${year}-${monthPart}-${String(i + 1).padStart(2, "0")}`,
  );
}

export function monthBoundsFromKey(monthKey: string, timezone: string): MonthRange {
  const keys = allDayKeysInMonth(monthKey);
  const fromKey = keys[0]!;
  const toKey = keys[keys.length - 1]!;
  const { start: from } = dayBoundsFromKey(fromKey, timezone);
  const { end: to } = dayBoundsFromKey(toKey, timezone);
  return { monthKey, from, to, fromKey, toKey };
}

export function formatMonthLabel(monthKey: string, timezone = "Asia/Kolkata"): string {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    monthKey = currentMonthKey(timezone);
  }
  const { year, month } = parseMonthKey(monthKey);
  const ref = new Date(year, month - 1, 15);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    month: "long",
    year: "numeric",
  }).format(ref);
}

export function parseReportMonth(
  searchParams: URLSearchParams,
  timezone = "Asia/Kolkata",
): MonthRange {
  const monthParam = searchParams.get("month");
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    return monthBoundsFromKey(monthParam, timezone);
  }
  return monthBoundsFromKey(currentMonthKey(timezone), timezone);
}

export function calendarWeeksForMonth(
  monthKey: string,
  weekStartsOn: 0 | 1 = 1,
): CalendarCell[][] {
  const keys = allDayKeysInMonth(monthKey);
  const { year, month } = parseMonthKey(monthKey);
  const firstDow = new Date(year, month - 1, 1).getDay();
  const offset = weekStartsOn === 1 ? (firstDow === 0 ? 6 : firstDow - 1) : firstDow;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < offset; i++) {
    cells.push({ dayKey: null, dayOfMonth: null });
  }
  for (const dayKey of keys) {
    cells.push({ dayKey, dayOfMonth: Number(dayKey.slice(8, 10)) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ dayKey: null, dayOfMonth: null });
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function dailyTrendMap(
  dailyTrend: Array<{ date: string; totalHours: number; metTarget: boolean }>,
): Map<string, { totalHours: number; metTarget: boolean }> {
  return new Map(dailyTrend.map((d) => [d.date, d]));
}
