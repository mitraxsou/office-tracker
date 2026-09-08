import { daysInMonth } from "./month-range";
import { dayBoundsFromKey } from "./timezone-dates";

export const DEFAULT_FISCAL_YEAR_START_MONTH = 4;
export const DEFAULT_FISCAL_YEAR_END_MONTH = 3;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type FiscalYearConfig = {
  startMonth: number;
  endMonth: number;
};

export function normalizeFiscalYearConfig(input?: Partial<FiscalYearConfig>): FiscalYearConfig {
  const startMonth = clampMonth(input?.startMonth, DEFAULT_FISCAL_YEAR_START_MONTH);
  const endMonth = clampMonth(input?.endMonth, fiscalYearEndMonthForStart(startMonth));
  if (!isValidFiscalYearSpan(startMonth, endMonth)) {
    return {
      startMonth: DEFAULT_FISCAL_YEAR_START_MONTH,
      endMonth: DEFAULT_FISCAL_YEAR_END_MONTH,
    };
  }
  return { startMonth, endMonth };
}

function clampMonth(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 12) {
    return fallback;
  }
  return value;
}

/** End month for a 12-month FY that begins on startMonth. */
export function fiscalYearEndMonthForStart(startMonth: number): number {
  let month = startMonth;
  for (let i = 0; i < 11; i++) {
    month = month === 12 ? 1 : month + 1;
  }
  return month;
}

export function isValidFiscalYearSpan(startMonth: number, endMonth: number): boolean {
  if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) return false;
  return fiscalYearEndMonthForStart(startMonth) === endMonth;
}

export function formatFiscalYearSpanLabel(config: FiscalYearConfig): string {
  return `${MONTH_NAMES[config.startMonth - 1]} through ${MONTH_NAMES[config.endMonth - 1]}`;
}

function lastDayKeyOfMonth(year: number, month: number): string {
  const day = daysInMonth(year, month);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** FY param format YYYY-YY where the first year is when the FY starts (e.g. 2025-26). */
export function fiscalYearBounds(
  fyParam: string,
  config: FiscalYearConfig = normalizeFiscalYearConfig({}),
  timezone = "Asia/Kolkata",
): { fromKey: string; toKey: string; label: string } | null {
  const normalized = normalizeFiscalYearConfig(config);
  const match = /^(\d{4})-(\d{2})$/.exec(fyParam.trim());
  if (!match) return null;
  const startYear = Number(match[1]);
  const endSuffix = Number(match[2]);
  const endYear = normalized.endMonth < normalized.startMonth ? startYear + 1 : startYear;
  if (endYear % 100 !== endSuffix) return null;

  const fromKey = `${startYear}-${String(normalized.startMonth).padStart(2, "0")}-01`;
  const toKey = lastDayKeyOfMonth(endYear, normalized.endMonth);
  const { start: from } = dayBoundsFromKey(fromKey, timezone);
  const { end: to } = dayBoundsFromKey(toKey, timezone);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;

  return {
    fromKey,
    toKey,
    label: `FY ${startYear}-${String(endSuffix).padStart(2, "0")}`,
  };
}

export function currentFyParam(
  timezone = "Asia/Kolkata",
  config: FiscalYearConfig = normalizeFiscalYearConfig({}),
  ref = new Date(),
): string {
  const normalized = normalizeFiscalYearConfig(config);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(ref);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? ref.getFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  const startYear = month >= normalized.startMonth ? year : year - 1;
  const endYear = normalized.endMonth < normalized.startMonth ? startYear + 1 : startYear;
  const endSuffix = String(endYear % 100).padStart(2, "0");
  return `${startYear}-${endSuffix}`;
}

export function fiscalYearStartYear(
  date: Date,
  timezone: string,
  config: FiscalYearConfig = normalizeFiscalYearConfig({}),
): number {
  const fyParam = currentFyParam(timezone, config, date);
  const match = /^(\d{4})-\d{2}$/.exec(fyParam);
  return Number(match?.[1] ?? new Date().getFullYear());
}

export function monthKeysInFiscalYear(
  startYear: number,
  config: FiscalYearConfig = normalizeFiscalYearConfig({}),
): string[] {
  const normalized = normalizeFiscalYearConfig(config);
  const keys: string[] = [];
  let year = startYear;
  let month = normalized.startMonth;
  for (let i = 0; i < 12; i++) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

export function fiscalYearLabel(
  startYear: number,
  config: FiscalYearConfig = normalizeFiscalYearConfig({}),
): string {
  const normalized = normalizeFiscalYearConfig(config);
  const endYear = normalized.endMonth < normalized.startMonth ? startYear + 1 : startYear;
  return `FY ${startYear}-${String(endYear % 100).padStart(2, "0")}`;
}
