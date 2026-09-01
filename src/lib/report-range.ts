import { getDayBounds, dayBoundsFromKey } from "./timezone-dates";

export type ReportRange = {
  from: Date;
  to: Date;
  days: number;
  fromKey: string;
  toKey: string;
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
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
    const fromBounds = dayBoundsFromKey(fromParam, timezone);
    const toBounds = dayBoundsFromKey(toParam, timezone);
    const from = fromBounds.start;
    const to = toBounds.end;
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) {
      const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      return {
        from,
        to,
        days: Math.min(90, days),
        fromKey: fromParam,
        toKey: toParam,
      };
    }
  }

  const days = Math.min(90, Math.max(1, Number.parseInt(searchParams.get("days") ?? "30", 10) || 30));
  const to = new Date();
  const from = addDays(to, -(days - 1));
  const toBounds = getDayBounds(to, timezone);
  const fromBounds = getDayBounds(from, timezone);
  return {
    from: fromBounds.start,
    to: toBounds.end,
    days,
    fromKey: fromBounds.dayKey,
    toKey: toBounds.dayKey,
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
