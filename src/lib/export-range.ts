import { allDayKeysInMonth, currentMonthKey, monthBoundsFromKey, parseMonthKey } from "./month-range";
import { dayBoundsFromKey } from "./timezone-dates";
import type { ReportRange } from "./report-range";
import {
  currentFyParam,
  fiscalYearBounds,
  normalizeFiscalYearConfig,
  type FiscalYearConfig,
} from "./fiscal-year";

export type ExportRange = ReportRange & {
  periodLabel: string;
  periodKind: "month" | "fy" | "custom";
};

export { type FiscalYearConfig } from "./fiscal-year";
export { fiscalYearBounds, currentFyParam } from "./fiscal-year";

export function monthKeysBetween(fromKey: string, toKey: string): string[] {
  const keys: string[] = [];
  let { year, month } = parseMonthKey(fromKey.slice(0, 7));
  const end = parseMonthKey(toKey.slice(0, 7));
  while (year < end.year || (year === end.year && month <= end.month)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

export function parseExportRange(
  searchParams: URLSearchParams,
  timezone = "Asia/Kolkata",
  fiscalYear: FiscalYearConfig = normalizeFiscalYearConfig({}),
): ExportRange | null {
  const fyParam = searchParams.get("fy");
  if (fyParam) {
    const fy = fiscalYearBounds(fyParam, fiscalYear, timezone);
    if (!fy) return null;
    const fromBounds = dayBoundsFromKey(fy.fromKey, timezone);
    const toBounds = dayBoundsFromKey(fy.toKey, timezone);
    const days =
      Math.ceil(
        (toBounds.end.getTime() - fromBounds.start.getTime()) / (24 * 60 * 60 * 1000),
      ) + 1;
    return {
      from: fromBounds.start,
      to: toBounds.end,
      days,
      fromKey: fy.fromKey,
      toKey: fy.toKey,
      monthKey: fy.fromKey.slice(0, 7),
      periodLabel: fy.label,
      periodKind: "fy",
    };
  }

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
      periodLabel: monthParam,
      periodKind: "month",
    };
  }

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  if (
    fromParam &&
    toParam &&
    /^\d{4}-\d{2}-\d{2}$/.test(fromParam) &&
    /^\d{4}-\d{2}-\d{2}$/.test(toParam) &&
    fromParam <= toParam
  ) {
    const fromBounds = dayBoundsFromKey(fromParam, timezone);
    const toBounds = dayBoundsFromKey(toParam, timezone);
    const days =
      Math.ceil(
        (toBounds.end.getTime() - fromBounds.start.getTime()) / (24 * 60 * 60 * 1000),
      ) + 1;
    return {
      from: fromBounds.start,
      to: toBounds.end,
      days: Math.min(366, days),
      fromKey: fromParam,
      toKey: toParam,
      monthKey: fromParam.slice(0, 7),
      periodLabel: `${fromParam} to ${toParam}`,
      periodKind: "custom",
    };
  }

  const monthKey = searchParams.get("month") ?? currentMonthKey(timezone);
  if (/^\d{4}-\d{2}$/.test(monthKey)) {
    const bounds = monthBoundsFromKey(monthKey, timezone);
    return {
      from: bounds.from,
      to: bounds.to,
      days: allDayKeysInMonth(monthKey).length,
      fromKey: bounds.fromKey,
      toKey: bounds.toKey,
      monthKey,
      periodLabel: monthKey,
      periodKind: "month",
    };
  }

  return null;
}
