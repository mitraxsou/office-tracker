import { allDayKeysInMonth, daysInMonth, formatMonthLabel, parseMonthKey } from "./month-range";
import {
  fiscalYearLabel,
  fiscalYearStartYear,
  monthKeysInFiscalYear,
} from "./fiscal-year";

export { fiscalYearLabel, fiscalYearStartYear, monthKeysInFiscalYear } from "./fiscal-year";

export function validateMonthlyDaysTarget(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 31) {
    return null;
  }
  return value;
}

/**
 * Hours-met for a calendar day: reached the daily office-hours target (default 5h).
 * Used for hours_met alerts, day badges, and under-target "behind" hours checks.
 * Monthly office-day counting uses {@link dayCountsAsVisited} instead.
 */
export function dayQualifiesForTarget(hours: number, hoursTarget: number): boolean {
  return hours >= hoursTarget;
}

/** Day counted toward the monthly office-days goal: any real office presence that day. */
export function dayCountsAsVisited(hours: number): boolean {
  return hours > 0;
}

/**
 * Count days that count toward the monthly office-days goal (presence, not hours target).
 * `hoursTarget` is accepted for call-site compatibility and ignored.
 */
export function countQualifyingDays(dailyHours: number[], _hoursTarget?: number): number {
  return dailyHours.filter((hours) => dayCountsAsVisited(hours)).length;
}

export function countOfficeVisitDays(dailyHours: number[]): number {
  return dailyHours.filter((hours) => dayCountsAsVisited(hours)).length;
}

export type MonthlyProgressState = "met" | "on_track" | "behind";

export function getMonthlyProgressState(
  qualifyingDays: number,
  monthlyDaysTarget: number,
  daysElapsed: number,
  daysInCalendarMonth: number,
): MonthlyProgressState {
  if (qualifyingDays >= monthlyDaysTarget) return "met";
  if (daysElapsed <= 0) return "behind";
  const expectedByNow = (monthlyDaysTarget * daysElapsed) / daysInCalendarMonth;
  if (qualifyingDays >= Math.floor(expectedByNow)) return "on_track";
  return "behind";
}

/** 1 -> 1st, 2 -> 2nd, 3 -> 3rd, 4 -> 4th, 11 -> 11th, 21 -> 21st, ... */
export function ordinalLabel(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${abs}th`;
  switch (abs % 10) {
    case 1:
      return `${abs}st`;
    case 2:
      return `${abs}nd`;
    case 3:
      return `${abs}rd`;
    default:
      return `${abs}th`;
  }
}

export type MonthlyDayJourney = {
  qualifyingDays: number;
  monthlyDaysTarget: number;
  remainingDays: number;
  /** Day number being worked toward right now (null when not in an active office day). */
  ongoingDayNumber: number | null;
  todayAlreadyQualified: boolean;
  monthTargetMet: boolean;
  /** Short label for the welcome strip, e.g. "5th day ongoing". */
  ongoingLabel: string | null;
  /** Days still needed after counting completed qualifying days. */
  daysToGoLabel: string;
};

/**
 * Describe which monthly office day the user is covering today, and how many remain.
 * Any office presence today secures the day toward the monthly goal (hours target is separate).
 * When they are in office but still have no counted office time, today is the next day in progress.
 */
export function describeMonthlyDayJourney(input: {
  qualifyingDays: number;
  monthlyDaysTarget: number;
  todayMetTarget: boolean;
  inOfficeNow: boolean;
  todayHasOfficeTime: boolean;
}): MonthlyDayJourney {
  const qualifyingDays = Math.max(0, input.qualifyingDays);
  const monthlyDaysTarget = Math.max(1, input.monthlyDaysTarget);
  const remainingDays = Math.max(0, monthlyDaysTarget - qualifyingDays);
  const monthTargetMet = qualifyingDays >= monthlyDaysTarget;
  // Presence counts the day; hours met also implies the day is secured.
  const todayAlreadyQualified = input.todayHasOfficeTime || input.todayMetTarget;
  const coveringToday =
    !todayAlreadyQualified && (input.inOfficeNow || input.todayHasOfficeTime);

  let ongoingDayNumber: number | null = null;
  let ongoingLabel: string | null = null;

  if (todayAlreadyQualified) {
    ongoingDayNumber = Math.min(qualifyingDays, monthlyDaysTarget);
    ongoingLabel =
      ongoingDayNumber > 0
        ? `${ordinalLabel(ongoingDayNumber)} day secured today`
        : null;
  } else if (coveringToday && !monthTargetMet) {
    ongoingDayNumber = Math.min(qualifyingDays + 1, monthlyDaysTarget);
    ongoingLabel = `${ordinalLabel(ongoingDayNumber)} day ongoing`;
  }

  const daysToGoLabel = monthTargetMet
    ? "Monthly days target met"
    : remainingDays === 1
      ? "1 day to go"
      : `${remainingDays} days to go`;

  return {
    qualifyingDays,
    monthlyDaysTarget,
    remainingDays,
    ongoingDayNumber,
    todayAlreadyQualified,
    monthTargetMet,
    ongoingLabel,
    daysToGoLabel,
  };
}

export function monthKeyInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function dayKeysInMonthUpToToday(date: Date, timezone: string): string[] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? 0);
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 0);
  const todayDay = Number(parts.find((p) => p.type === "day")?.value ?? 0);

  const keys: string[] = [];
  for (let day = 1; day <= todayDay; day++) {
    keys.push(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
  }
  return keys;
}

export type MonthlyProgressDay = {
  dayKey: string;
  hours: number;
  metTarget: boolean;
};

export type MonthlyProgress = {
  monthKey: string;
  qualifyingDays: number;
  officeVisitDays: number;
  totalHours: number;
  daysInMonth: number;
  monthlyDaysTarget: number;
  metTarget: boolean;
  remainingDays: number;
  daysElapsed: number;
  progressState: MonthlyProgressState;
  days: MonthlyProgressDay[];
};

export type YearMonthComplianceStatus =
  | "earned"
  | "exemption"
  | "no_data"
  | "pending"
  | "not_met";

export type YearMonthNoDataReason = "pre_pilot" | "joined_late" | "no_visits";

export type YearMonthCompliance = {
  monthKey: string;
  metTarget: boolean;
  qualifyingDays: number;
  monthlyDaysTarget: number;
  status: YearMonthComplianceStatus;
  noDataReason?: YearMonthNoDataReason;
  hasPendingExemption?: boolean;
  hasPendingPriorCompliance?: boolean;
};

export type YearCompliance = {
  year: number;
  fiscalYearLabel: string;
  compliantMonths: number;
  monthsInYear: number;
  monthsElapsed: number;
  monthDetails: YearMonthCompliance[];
};

export function yearFromDate(date: Date, timezone: string): number {
  return Number(monthKeyInTimezone(date, timezone).slice(0, 4));
}

export function monthKeysInYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
}

export function monthKeysInYearUpToMonth(
  year: number,
  timezone: string,
  referenceDate: Date = new Date(),
): string[] {
  const currentYear = yearFromDate(referenceDate, timezone);
  if (year > currentYear) return [];
  const monthCount = year < currentYear ? 12 : Number(monthKeyInTimezone(referenceDate, timezone).slice(5, 7));
  return monthKeysInYear(year).slice(0, monthCount);
}

export function isPrePilotMonth(monthKey: string, pilotStartMonthKey: string): boolean {
  return monthKey < pilotStartMonthKey;
}

export function isCompliantYearMonthStatus(status: YearMonthComplianceStatus): boolean {
  return status === "earned" || status === "exemption";
}

export type YearMonthVisualStatus =
  | "compliant"
  | "non_compliant"
  | "in_progress"
  | "no_data"
  | "pending";

export function getYearMonthVisualStatus(
  month: Pick<YearMonthCompliance, "monthKey" | "status" | "hasPendingPriorCompliance">,
  currentMonthKey: string,
): YearMonthVisualStatus {
  if (month.hasPendingPriorCompliance) return "pending";
  if (month.status === "pending") return "pending";
  if (month.status === "no_data") return "no_data";
  if (month.status === "earned" || month.status === "exemption") return "compliant";
  if (month.monthKey === currentMonthKey) return "in_progress";
  return "non_compliant";
}

export function yearMonthTooltipText(
  month: YearMonthCompliance,
  currentMonthKey: string,
  timezone: string,
): string {
  const label = formatMonthLabel(month.monthKey, timezone);
  if (month.hasPendingPriorCompliance) {
    return `${label}: Prior compliance declaration pending admin review`;
  }
  if (month.hasPendingExemption) {
    return `${label}: HR exemption pending admin review`;
  }
  const visual = getYearMonthVisualStatus(month, currentMonthKey);
  if (visual === "pending") {
    return `${label}: Not started yet`;
  }
  if (visual === "no_data") {
    if (month.noDataReason === "joined_late") {
      return `${label}: No data for this month (account created after this month)`;
    }
    if (month.noDataReason === "pre_pilot") {
      return `${label}: No data for this month (pilot had not started)`;
    }
    return `${label}: No data for this month`;
  }
  if (visual === "compliant") {
    if (month.status === "exemption") {
      return `${label}: Compliant (HR exemption logged by admin, ${month.qualifyingDays}/${month.monthlyDaysTarget} qualifying days)`;
    }
    return `${label}: Compliant (${month.qualifyingDays}/${month.monthlyDaysTarget} qualifying days)`;
  }
  if (visual === "in_progress") {
    return `${label}: In progress (${month.qualifyingDays}/${month.monthlyDaysTarget} qualifying days so far)`;
  }
  return `${label}: Non-compliant (${month.qualifyingDays}/${month.monthlyDaysTarget} qualifying days)`;
}

export function yearMonthStatus(
  monthKey: string,
  currentMonthKey: string,
  metTarget: boolean,
): YearMonthComplianceStatus {
  if (monthKey > currentMonthKey) return "pending";
  if (metTarget) return "earned";
  return "not_met";
}

export function countExemptQualifyingDays(
  qualifyingDayKeys: Set<string>,
  exemptDayKeysInMonth: string[],
): number {
  let bonus = 0;
  for (const dayKey of exemptDayKeysInMonth) {
    if (!qualifyingDayKeys.has(dayKey)) {
      bonus += 1;
    }
  }
  return qualifyingDayKeys.size + bonus;
}

export function resolveMonthCompliance(params: {
  monthKey: string;
  currentMonthKey: string;
  qualifyingDays: number;
  monthlyDaysTarget: number;
  hasMonthExemption: boolean;
  exemptDayKeysInMonth: string[];
  qualifyingDayKeys: Set<string>;
  hasPendingExemption?: boolean;
  hasPendingPriorCompliance?: boolean;
}): Pick<
  YearMonthCompliance,
  "metTarget" | "qualifyingDays" | "status" | "hasPendingExemption" | "hasPendingPriorCompliance"
> {
  if (params.monthKey > params.currentMonthKey) {
    return {
      metTarget: false,
      qualifyingDays: params.qualifyingDays,
      status: "pending",
      hasPendingExemption: params.hasPendingExemption,
      hasPendingPriorCompliance: params.hasPendingPriorCompliance,
    };
  }

  if (params.hasMonthExemption) {
    return {
      metTarget: true,
      qualifyingDays: params.qualifyingDays,
      status: "exemption",
      hasPendingExemption: params.hasPendingExemption,
      hasPendingPriorCompliance: params.hasPendingPriorCompliance,
    };
  }

  const effectiveQualifyingDays = countExemptQualifyingDays(
    params.qualifyingDayKeys,
    params.exemptDayKeysInMonth,
  );
  const naturalMet = params.qualifyingDays >= params.monthlyDaysTarget;
  const metTarget = naturalMet || effectiveQualifyingDays >= params.monthlyDaysTarget;
  const status: YearMonthComplianceStatus = metTarget
    ? naturalMet
      ? "earned"
      : "exemption"
    : "not_met";
  return {
    metTarget,
    qualifyingDays: effectiveQualifyingDays,
    status,
    hasPendingExemption: params.hasPendingExemption,
    hasPendingPriorCompliance: params.hasPendingPriorCompliance,
  };
}

export function dayKeysForMonth(
  monthKey: string,
  timezone: string,
  referenceDate: Date = new Date(),
): string[] {
  const current = monthKeyInTimezone(referenceDate, timezone);
  if (monthKey < current) {
    return allDayKeysInMonth(monthKey);
  }
  if (monthKey > current) {
    return [];
  }
  return dayKeysInMonthUpToToday(referenceDate, timezone);
}

export function monthDayKeysFromTrend(
  dailyTrend: Array<{ date: string; totalHours: number }>,
  monthKey: string,
  hoursTarget: number,
): {
  qualifyingDays: number;
  officeVisitDays: number;
  daysInRange: number;
  daysInMonth: number;
} {
  const inMonth = dailyTrend.filter((d) => d.date.startsWith(monthKey));
  const hours = inMonth.map((d) => d.totalHours);
  const qualifyingDays = countQualifyingDays(hours, hoursTarget);
  const { year, month } = parseMonthKey(monthKey);
  return {
    qualifyingDays,
    officeVisitDays: countOfficeVisitDays(hours),
    daysInRange: inMonth.length,
    daysInMonth: daysInMonth(year, month),
  };
}
