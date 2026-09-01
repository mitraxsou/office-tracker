import { allDayKeysInMonth, monthBoundsFromKey, parseReportMonth } from "./month-range";
import { getDayBounds, dayBoundsFromKey } from "./timezone-dates";

export type ReportRange = {
  from: Date;
  to: Date;
  days: number;
  fromKey: string;
  toKey: string;
  monthKey: string;
};

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function dayKeyForTimezone(date: Date, timezone: string) {
  return getDayBounds(date, timezone).dayKey;
}

export function parseReportRange(
  searchParams: URLSearchParams,
  timezone = "Asia/Kolkata",
): ReportRange {
  const monthParam = searchParams.get("month");
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const bounds = monthBoundsFromKey(monthParam, timezone);
    return {
      from: bounds.from,
      to: bounds.to,
      days: allDayKeysInMonth(monthParam).length,
      fromKey: bounds.fromKey,
      toKey: bounds.toKey,
      monthKey: monthParam,
    };
  }

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
    const fromBounds = dayBoundsFromKey(fromParam, timezone);
    const toBounds = dayBoundsFromKey(toParam, timezone);
    const from = fromBounds.start;
    const to = toBounds.end;
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) {
      const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const monthKey = fromParam.slice(0, 7);
      return {
        from,
        to,
        days: Math.min(90, days),
        fromKey: fromParam,
        toKey: toParam,
        monthKey,
      };
    }
  }

  const month = parseReportMonth(searchParams, timezone);
  return {
    from: month.from,
    to: month.to,
    days: allDayKeysInMonth(month.monthKey).length,
    fromKey: month.fromKey,
    toKey: month.toKey,
    monthKey: month.monthKey,
  };
}

export function exportToCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
