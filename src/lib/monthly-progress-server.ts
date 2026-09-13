import { aggregateHoursForDay } from "./day-hours";
import type { ApprovedExemptions } from "./compliance-exemptions";
import { DEFAULT_PILOT_START_MONTH_KEY, fiscalYearConfigFromApp, getAppConfig } from "./app-config";
import { prisma } from "./db";
import {
  countExemptQualifyingDays,
  countOfficeVisitDays,
  countQualifyingDays,
  dayKeysForMonth,
  dayKeysInMonthUpToToday,
  dayQualifiesForTarget,
  fiscalYearLabel,
  fiscalYearStartYear,
  getMonthlyProgressState,
  isCompliantYearMonthStatus,
  isPrePilotMonth,
  monthKeyInTimezone,
  monthKeysInFiscalYear,
  resolveMonthCompliance,
  type MonthlyProgress,
  type YearCompliance,
  type YearMonthNoDataReason,
} from "./monthly-progress";
import { daysInMonth, parseMonthKey } from "./month-range";

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
    remainingDays: Math.max(
      0,
      monthlyDaysTarget - (hasMonthExemption ? monthlyDaysTarget : effectiveQualifyingDays),
    ),
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
  pendingPriorComplianceMonthKeys: string[] = [],
): Promise<YearCompliance> {
  const appConfig = await getAppConfig();
  const fyConfig = fiscalYearConfigFromApp(appConfig);
  const year = fiscalYearStartYear(referenceDate, timezone, fyConfig);
  const currentMonthKey = monthKeyInTimezone(referenceDate, timezone);
  const monthKeys = monthKeysInFiscalYear(year, fyConfig);
  const monthsElapsed = monthKeys.filter((monthKey) => monthKey <= currentMonthKey).length;
  const exemptions = approvedExemptions ?? { monthKeys: [], dayKeys: [] };
  const pendingMonths = new Set(pendingExemptionMonthKeys);
  const pendingPriorMonths = new Set(pendingPriorComplianceMonthKeys);
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
          hasPendingPriorCompliance: pendingPriorMonths.has(monthKey),
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
        hasPendingPriorCompliance: pendingPriorMonths.has(monthKey),
      });

      if (!hasOfficeData && resolved.status !== "exemption") {
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
          hasPendingPriorCompliance: pendingPriorMonths.has(monthKey),
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
