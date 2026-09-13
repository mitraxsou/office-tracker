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

export function dayQualifiesForTarget(hours: number, hoursTarget: number): boolean {
  return hours >= hoursTarget;
}

export function countQualifyingDays(dailyHours: number[], hoursTarget: number): number {
  return dailyHours.filter((hours) => dayQualifiesForTarget(hours, hoursTarget)).length;
}

export function countOfficeVisitDays(dailyHours: number[]): number {
  return dailyHours.filter((hours) => hours > 0).length;
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
