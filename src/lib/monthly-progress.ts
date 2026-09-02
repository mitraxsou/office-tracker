import { allDayKeysInMonth, daysInMonth, parseMonthKey } from "./month-range";
import { aggregateHoursForDay } from "./user-reports";
import type { ApprovedExemptions } from "./compliance-exemptions";

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

export type YearMonthStatus = "met" | "not_met" | "pending";

export type YearMonthMetVia = "earned" | "exemption";

export type YearMonthCompliance = {
  monthKey: string;
  metTarget: boolean;
  qualifyingDays: number;
  monthlyDaysTarget: number;
  status: YearMonthStatus;
  metVia?: YearMonthMetVia;
  hasPendingExemption?: boolean;
};

export type YearCompliance = {
  year: number;
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

export function yearMonthStatus(
  monthKey: string,
  currentMonthKey: string,
  metTarget: boolean,
): YearMonthStatus {
  if (monthKey > currentMonthKey) return "pending";
  if (metTarget) return "met";
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
}): Pick<YearMonthCompliance, "metTarget" | "qualifyingDays" | "status" | "metVia" | "hasPendingExemption"> {
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
      status: "met",
      metVia: "exemption",
      hasPendingExemption: params.hasPendingExemption,
    };
  }

  const effectiveQualifyingDays = countExemptQualifyingDays(
    params.qualifyingDayKeys,
    params.exemptDayKeysInMonth,
  );
  const naturalMet = params.qualifyingDays >= params.monthlyDaysTarget;
  const metTarget = naturalMet || effectiveQualifyingDays >= params.monthlyDaysTarget;
  const metVia: YearMonthMetVia | undefined = params.hasMonthExemption
    ? "exemption"
    : metTarget && !naturalMet
      ? "exemption"
      : metTarget
        ? "earned"
        : undefined;
  return {
    metTarget,
    qualifyingDays: effectiveQualifyingDays,
    status: metTarget ? "met" : "not_met",
    metVia,
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
): Promise<YearCompliance> {
  const year = yearFromDate(referenceDate, timezone);
  const currentMonthKey = monthKeyInTimezone(referenceDate, timezone);
  const monthKeys = monthKeysInYear(year);
  const monthsElapsed = monthKeysInYearUpToMonth(year, timezone, referenceDate).length;
  const exemptions = approvedExemptions ?? { monthKeys: [], dayKeys: [] };
  const pendingMonths = new Set(pendingExemptionMonthKeys);

  const monthDetails = await Promise.all(
    monthKeys.map(async (monthKey) => {
      const dayKeys = dayKeysForMonth(monthKey, timezone, referenceDate);
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

      const dailyHours = await Promise.all(
        dayKeys.map((dayKey) => aggregateHoursForDay(userId, timezone, dayKey)),
      );
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

      return {
        monthKey,
        monthlyDaysTarget,
        ...resolved,
      };
    }),
  );

  return {
    year,
    compliantMonths: monthDetails.filter((month) => month.status === "met").length,
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
