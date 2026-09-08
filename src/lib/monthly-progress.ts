import { allDayKeysInMonth, daysInMonth, formatMonthLabel, parseMonthKey } from "./month-range";
import { aggregateHoursForDay } from "./day-hours";
import type { ApprovedExemptions } from "./compliance-exemptions";
import { DEFAULT_PILOT_START_MONTH_KEY, fiscalYearConfigFromApp, getAppConfig } from "./app-config";
import { prisma } from "./db";
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
  month: Pick<YearMonthCompliance, "monthKey" | "status">,
  currentMonthKey: string,
): YearMonthVisualStatus {
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
  if (month.hasPendingExemption) {
    return `${label}: Exemption request pending`;
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
      return `${label}: Compliant via admin exemption (${month.qualifyingDays}/${month.monthlyDaysTarget} qualifying days)`;
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
}): Pick<YearMonthCompliance, "metTarget" | "qualifyingDays" | "status" | "hasPendingExemption"> {
  if (params.monthKey > params.currentMonthKey) {
    return {
      metTarget: false,
      qualifyingDays: params.qualifyingDays,
      status: "pending",
      hasPendingExemption: params.hasPendingExemption,
    };
  }

  if (params.hasMonthExemption) {
    return {
      metTarget: true,
      qualifyingDays: params.qualifyingDays,
      status: "exemption",
      hasPendingExemption: params.hasPendingExemption,
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

export async function getMonthlyProgress(
  userId: string,
  timezone: string,
  hoursTarget: number,
  monthlyDaysTarget: number,
  referenceDate: Date = new Date(),
  monthKey?: string,
  approvedExemptions?: ApprovedExemptions,
): Promise<MonthlyProgress> {
  const targetMonth = monthKey ?? monthKeyInTimezone(referenceDate, timezone);
  const dayKeys = dayKeysForMonth(targetMonth, timezone, referenceDate);
  const dailyHours = await Promise.all(
    dayKeys.map((dayKey) => aggregateHoursForDay(userId, timezone, dayKey)),
  );
  const qualifyingDayKeys = new Set(
    dayKeys.filter((_, index) => dayQualifiesForTarget(dailyHours[index] ?? 0, hoursTarget)),
  );
  const qualifyingDays = qualifyingDayKeys.size;
  const exemptDayKeysInMonth =
    approvedExemptions?.dayKeys.filter((dayKey) => dayKey.startsWith(`${targetMonth}-`)) ?? [];
  const hasMonthExemption = approvedExemptions?.monthKeys.includes(targetMonth) ?? false;
  const effectiveQualifyingDays = hasMonthExemption
    ? qualifyingDays
    : countExemptQualifyingDays(qualifyingDayKeys, exemptDayKeysInMonth);
  const naturalMet = qualifyingDays >= monthlyDaysTarget;
  const metTarget = hasMonthExemption || naturalMet || effectiveQualifyingDays >= monthlyDaysTarget;
  const officeVisitDays = countOfficeVisitDays(dailyHours);
  const totalHours = dailyHours.reduce((sum, hours) => sum + hours, 0);
  const { year, month } = parseMonthKey(targetMonth);
  const daysInCalendarMonth = daysInMonth(year, month);

  return {
    monthKey: targetMonth,
    qualifyingDays: hasMonthExemption ? qualifyingDays : effectiveQualifyingDays,
    officeVisitDays,
    totalHours: Math.round(totalHours * 10) / 10,
    daysInMonth: daysInCalendarMonth,
    monthlyDaysTarget,
    metTarget,
    remainingDays: Math.max(0, monthlyDaysTarget - (hasMonthExemption ? monthlyDaysTarget : effectiveQualifyingDays)),
    daysElapsed: dayKeys.length,
    progressState: getMonthlyProgressState(
      hasMonthExemption ? monthlyDaysTarget : effectiveQualifyingDays,
      monthlyDaysTarget,
      dayKeys.length,
      daysInCalendarMonth,
    ),
  };
}

export async function countQualifyingDaysInMonth(
  userId: string,
  timezone: string,
  hoursTarget: number,
  referenceDate: Date = new Date(),
): Promise<number> {
  const dayKeys = dayKeysInMonthUpToToday(referenceDate, timezone);
  const dailyHours = await Promise.all(
    dayKeys.map((dayKey) => aggregateHoursForDay(userId, timezone, dayKey)),
  );
  return countQualifyingDays(dailyHours, hoursTarget);
}

export async function getYearCompliance(
  userId: string,
  timezone: string,
  hoursTarget: number,
  monthlyDaysTarget: number,
  referenceDate: Date = new Date(),
  approvedExemptions?: ApprovedExemptions,
  pendingExemptionMonthKeys: string[] = [],
  pilotStartMonthKey: string = DEFAULT_PILOT_START_MONTH_KEY,
): Promise<YearCompliance> {
  const appConfig = await getAppConfig();
  const fyConfig = fiscalYearConfigFromApp(appConfig);
  const year = fiscalYearStartYear(referenceDate, timezone, fyConfig);
  const currentMonthKey = monthKeyInTimezone(referenceDate, timezone);
  const monthKeys = monthKeysInFiscalYear(year, fyConfig);
  const monthsElapsed = monthKeys.filter((monthKey) => monthKey <= currentMonthKey).length;
  const exemptions = approvedExemptions ?? { monthKeys: [], dayKeys: [] };
  const pendingMonths = new Set(pendingExemptionMonthKeys);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  const joinedMonthKey = user ? monthKeyInTimezone(user.createdAt, timezone) : null;

  const monthDetails = await Promise.all(
    monthKeys.map(async (monthKey) => {
      if (monthKey > currentMonthKey) {
        return {
          monthKey,
          metTarget: false,
          qualifyingDays: 0,
          monthlyDaysTarget,
          status: "pending" as const,
          hasPendingExemption: pendingMonths.has(monthKey),
        };
      }

      const dayKeys = dayKeysForMonth(monthKey, timezone, referenceDate);
      const dailyHours = await Promise.all(
        dayKeys.map((dayKey) => aggregateHoursForDay(userId, timezone, dayKey)),
      );
      const hasOfficeData = dailyHours.some((hours) => hours > 0);
      const qualifyingDayKeys = new Set(
        dayKeys.filter((_, index) => dayQualifiesForTarget(dailyHours[index] ?? 0, hoursTarget)),
      );
      const qualifyingDays = qualifyingDayKeys.size;
      const exemptDayKeysInMonth = exemptions.dayKeys.filter((dayKey) =>
        dayKey.startsWith(`${monthKey}-`),
      );
      const resolved = resolveMonthCompliance({
        monthKey,
        currentMonthKey,
        qualifyingDays,
        monthlyDaysTarget,
        hasMonthExemption: exemptions.monthKeys.includes(monthKey),
        exemptDayKeysInMonth,
        qualifyingDayKeys,
        hasPendingExemption: pendingMonths.has(monthKey),
      });

      if (!hasOfficeData && resolved.status !== "exemption") {
        // Pre-pilot months used to count as compliant automatically. Empty months now stay
        // truthful to recorded office data and never increase the fiscal year score.
        const noDataReason: YearMonthNoDataReason =
          joinedMonthKey && monthKey < joinedMonthKey
            ? "joined_late"
            : isPrePilotMonth(monthKey, pilotStartMonthKey)
              ? "pre_pilot"
              : "no_visits";
        return {
          monthKey,
          metTarget: false,
          qualifyingDays: 0,
          monthlyDaysTarget,
          status: "no_data" as const,
          noDataReason,
          hasPendingExemption: pendingMonths.has(monthKey),
        };
      }

      return {
        monthKey,
        monthlyDaysTarget,
        ...resolved,
      };
    }),
  );

  return {
    year,
    fiscalYearLabel: fiscalYearLabel(year, fyConfig),
    compliantMonths: monthDetails.filter((month) => isCompliantYearMonthStatus(month.status)).length,
    monthsInYear: 12,
    monthsElapsed,
    monthDetails,
  };
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
