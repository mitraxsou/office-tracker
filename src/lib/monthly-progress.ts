import { allDayKeysInMonth, daysInMonth, parseMonthKey } from "./month-range";
import { aggregateHoursForDay } from "./user-reports";

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

export type YearMonthCompliance = {
  monthKey: string;
  metTarget: boolean;
  qualifyingDays: number;
  monthlyDaysTarget: number;
};

export type YearCompliance = {
  year: number;
  compliantMonths: number;
  monthsElapsed: number;
  monthDetails: YearMonthCompliance[];
};

export function yearFromDate(date: Date, timezone: string): number {
  return Number(monthKeyInTimezone(date, timezone).slice(0, 4));
}

export function monthKeysInYearUpToMonth(
  year: number,
  timezone: string,
  referenceDate: Date = new Date(),
): string[] {
  const currentYear = yearFromDate(referenceDate, timezone);
  if (year > currentYear) return [];
  const monthCount = year < currentYear ? 12 : Number(monthKeyInTimezone(referenceDate, timezone).slice(5, 7));
  return Array.from({ length: monthCount }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
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
): Promise<MonthlyProgress> {
  const targetMonth = monthKey ?? monthKeyInTimezone(referenceDate, timezone);
  const dayKeys = dayKeysForMonth(targetMonth, timezone, referenceDate);
  const dailyHours = await Promise.all(
    dayKeys.map((dayKey) => aggregateHoursForDay(userId, timezone, dayKey)),
  );
  const qualifyingDays = countQualifyingDays(dailyHours, hoursTarget);
  const officeVisitDays = countOfficeVisitDays(dailyHours);
  const totalHours = dailyHours.reduce((sum, hours) => sum + hours, 0);
  const { year, month } = parseMonthKey(targetMonth);
  const daysInCalendarMonth = daysInMonth(year, month);

  return {
    monthKey: targetMonth,
    qualifyingDays,
    officeVisitDays,
    totalHours: Math.round(totalHours * 10) / 10,
    daysInMonth: daysInCalendarMonth,
    monthlyDaysTarget,
    metTarget: qualifyingDays >= monthlyDaysTarget,
    remainingDays: Math.max(0, monthlyDaysTarget - qualifyingDays),
    daysElapsed: dayKeys.length,
    progressState: getMonthlyProgressState(
      qualifyingDays,
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
): Promise<YearCompliance> {
  const year = yearFromDate(referenceDate, timezone);
  const monthKeys = monthKeysInYearUpToMonth(year, timezone, referenceDate);
  const monthDetails = await Promise.all(
    monthKeys.map(async (monthKey) => {
      const progress = await getMonthlyProgress(
        userId,
        timezone,
        hoursTarget,
        monthlyDaysTarget,
        referenceDate,
        monthKey,
      );
      return {
        monthKey,
        metTarget: progress.metTarget,
        qualifyingDays: progress.qualifyingDays,
        monthlyDaysTarget,
      };
    }),
  );

  return {
    year,
    compliantMonths: monthDetails.filter((month) => month.metTarget).length,
    monthsElapsed: monthKeys.length,
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
