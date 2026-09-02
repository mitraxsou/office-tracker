import { daysInMonth, parseMonthKey } from "./month-range";

export type ResetPeriod = "all" | "day" | "month" | "year" | "custom";

export type ResetDayRange = { fromDayKey: string; toDayKey: string };

export const RESET_PERIOD_LABELS: Record<ResetPeriod, string> = {
  all: "All time",
  day: "A single day",
  month: "A month",
  year: "A year",
  custom: "Custom date range",
};

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;
const YEAR_KEY_PATTERN = /^\d{4}$/;

export function isValidDayKey(value: string): boolean {
  if (!DAY_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

/**
 * Day-key bounds for the period an admin picked. Returns null for "all time" (no bounds)
 * and for input that does not describe a real date range.
 */
export function resetRangeFromPeriod(
  period: ResetPeriod,
  input: { day?: string; month?: string; year?: string; from?: string; to?: string },
): ResetDayRange | null {
  if (period === "all") return null;

  if (period === "day") {
    const day = input.day ?? "";
    return isValidDayKey(day) ? { fromDayKey: day, toDayKey: day } : null;
  }

  if (period === "month") {
    const monthKey = input.month ?? "";
    if (!MONTH_KEY_PATTERN.test(monthKey)) return null;
    const { year, month } = parseMonthKey(monthKey);
    if (month < 1 || month > 12) return null;
    const lastDay = String(daysInMonth(year, month)).padStart(2, "0");
    return { fromDayKey: `${monthKey}-01`, toDayKey: `${monthKey}-${lastDay}` };
  }

  if (period === "year") {
    const year = input.year ?? "";
    if (!YEAR_KEY_PATTERN.test(year)) return null;
    return { fromDayKey: `${year}-01-01`, toDayKey: `${year}-12-31` };
  }

  const from = input.from ?? "";
  const to = input.to ?? "";
  if (!isValidDayKey(from) || !isValidDayKey(to)) return null;
  if (from > to) return null;
  return { fromDayKey: from, toDayKey: to };
}

/** Short description of what a reset will clear, for confirmation copy. */
export function describeResetRange(range: ResetDayRange | null): string {
  if (!range) return "all tracking data";
  if (range.fromDayKey === range.toDayKey) return range.fromDayKey;
  return `${range.fromDayKey} to ${range.toDayKey}`;
}
