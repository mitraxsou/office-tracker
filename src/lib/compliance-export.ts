import { getAdminOrgCalendarDays } from "./admin-reports";
import { getAppConfig, fiscalYearConfigFromApp, getUserHoursTarget } from "./app-config";
import { formatFiscalYearSpanLabel } from "./fiscal-year";
import { aggregateHoursForDay } from "./day-hours";
import { type ExportRange, monthKeysBetween } from "./export-range";
import { prisma } from "./db";
import { csvSection } from "./spreadsheet-export";
import { formatHours, formatTime, roundHoursToMinute, visitDurationMs } from "./visits";

function formatDurationHours(startAt: Date, endAt: Date | null, now = new Date()): string {
  const ms = visitDurationMs({ id: "", startAt, endAt, source: "" }, endAt ? endAt : now);
  return formatHours(ms / (1000 * 60 * 60));
}

export async function buildUserComplianceCsvSections(
  userId: string,
  range: ExportRange,
): Promise<string[][]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, timezone: true, hoursTarget: true },
  });
  if (!user) return [];

  const hoursTarget = await getUserHoursTarget(user);
  const config = await getAppConfig();
  const fySpan = formatFiscalYearSpanLabel(fiscalYearConfigFromApp(config));
  const generatedAt = new Date().toISOString();

  const visits = await prisma.visit.findMany({
    where: {
      userId,
      startAt: { lte: range.to },
      OR: [{ endAt: null }, { endAt: { gte: range.from } }],
    },
    orderBy: { startAt: "asc" },
  });

  const dailyRows: string[][] = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    const dayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: user.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(cursor);
    const hours = await aggregateHoursForDay(userId, user.timezone, dayKey);
    dailyRows.push([
      dayKey,
      roundHoursToMinute(hours).toFixed(2),
      hours >= hoursTarget ? "Yes" : "No",
      hours > 0 ? "Yes" : "No",
    ]);
    cursor.setDate(cursor.getDate() + 1);
  }

  const visitRows = visits.map((v) => {
    const dayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: user.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(v.startAt);
    return [
      dayKey,
      formatTime(v.startAt, user.timezone),
      v.endAt ? formatTime(v.endAt, user.timezone) : "Open",
      formatDurationHours(v.startAt, v.endAt),
      v.source,
      v.ssid ?? "",
    ];
  });

  const qualifyingDays = dailyRows.filter((r) => r[2] === "Yes").length;
  const officeDays = dailyRows.filter((r) => r[3] === "Yes").length;

  return [
    csvSection("Office Pulse compliance export", ["Field", "Value"], [
      ["Generated at", generatedAt],
      ["User", user.email],
      ["Name", user.name ?? ""],
      ["Period", range.periodLabel],
      ["From", range.fromKey],
      ["To", range.toKey],
      ["Timezone", user.timezone],
      ["Daily hours target", String(hoursTarget)],
      ["Monthly office-days target", String(config.monthlyDaysTarget)],
      ["Fiscal year span", fySpan],
      ["Days met daily target", String(qualifyingDays)],
      ["Days with office presence", String(officeDays)],
    ]),
    csvSection(
      "Daily summary",
      ["Date", "Office hours", "Met daily target", "Had office presence"],
      dailyRows,
    ),
    csvSection(
      "Visit log (compliance record)",
      ["Date", "Start", "End", "Duration", "Source", "SSID"],
      visitRows,
    ),
  ];
}

export async function buildOrgComplianceCsvSections(
  range: ExportRange,
  timezone = "Asia/Kolkata",
): Promise<string[][]> {
  const config = await getAppConfig();
  const fySpan = formatFiscalYearSpanLabel(fiscalYearConfigFromApp(config));
  const generatedAt = new Date().toISOString();
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, timezone: true, hoursTarget: true },
  });

  const userStatsRows: string[][] = [];
  for (const user of users) {
    const hoursTarget = await getUserHoursTarget(user);
    let qualifyingDays = 0;
    let officeDays = 0;
    let totalHours = 0;
    const cursor = new Date(range.from);
    while (cursor <= range.to) {
      const dayKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: user.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(cursor);
      const hours = await aggregateHoursForDay(user.id, user.timezone, dayKey);
      if (hours > 0) officeDays += 1;
      if (hours >= hoursTarget) qualifyingDays += 1;
      totalHours += hours;
      cursor.setDate(cursor.getDate() + 1);
    }
    userStatsRows.push([
      user.email,
      user.name ?? "",
      user.timezone,
      String(hoursTarget),
      String(qualifyingDays),
      String(officeDays),
      roundHoursToMinute(totalHours).toFixed(2),
      officeDays > 0 ? roundHoursToMinute(totalHours / officeDays).toFixed(2) : "0",
    ]);
  }

  const monthKeys =
    range.periodKind === "fy"
      ? monthKeysBetween(range.fromKey, range.toKey)
      : [range.monthKey];

  const monthlyRows: string[][] = [];
  for (const monthKey of monthKeys) {
    const calendar = await getAdminOrgCalendarDays(monthKey, timezone);
    const pastDays = calendar.days.filter((d) => d.attendedCount > 0);
    const totalAttended = pastDays.reduce((s, d) => s + d.attendedCount, 0);
    const totalMet = pastDays.reduce((s, d) => s + d.metTargetCount, 0);
    const totalHours = pastDays.reduce((s, d) => s + d.totalAttendedHours, 0);
    monthlyRows.push([
      monthKey,
      String(pastDays.length),
      String(totalAttended),
      String(totalMet),
      totalAttended > 0 ? String(Math.round((totalMet / totalAttended) * 100)) : "0",
      totalHours.toFixed(1),
      String(users.length),
    ]);
  }

  const calendarRows: string[][] = [];
  for (const monthKey of monthKeys) {
    const calendar = await getAdminOrgCalendarDays(monthKey, timezone);
    for (const day of calendar.days) {
      calendarRows.push([
        day.dayKey,
        String(day.attendedCount),
        String(day.metTargetCount),
        String(day.compliancePct),
        day.totalAttendedHours.toFixed(1),
        String(day.excludedOoo),
        String(day.excludedStale),
        day.isWeekend ? "Yes" : "No",
      ]);
    }
  }

  const visits = await prisma.visit.findMany({
    where: {
      startAt: { lte: range.to },
      OR: [{ endAt: null }, { endAt: { gte: range.from } }],
    },
    include: { user: { select: { email: true, timezone: true } } },
    orderBy: [{ user: { email: "asc" } }, { startAt: "asc" }],
  });

  const visitRows = visits.map((v) => {
    const tz = v.user.timezone;
    const dayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(v.startAt);
    return [
      v.user.email,
      dayKey,
      formatTime(v.startAt, tz),
      v.endAt ? formatTime(v.endAt, tz) : "Open",
      formatDurationHours(v.startAt, v.endAt),
      v.source,
      v.ssid ?? "",
    ];
  });

  return [
    csvSection("Org compliance export", ["Field", "Value"], [
      ["Generated at", generatedAt],
      ["Period", range.periodLabel],
      ["From", range.fromKey],
      ["To", range.toKey],
      ["Timezone", timezone],
      ["Registered users", String(users.length)],
      ["Daily hours target (default)", String(config.hoursTarget)],
      ["Monthly office-days target", String(config.monthlyDaysTarget)],
      ["Fiscal year span", fySpan],
    ]),
    csvSection(
      "Monthly org summary",
      [
        "Month",
        "Days with attendance",
        "Total attended user-days",
        "Total met-target user-days",
        "Compliance % (attended only)",
        "Total attended hours",
        "Registered users",
      ],
      monthlyRows,
    ),
    csvSection(
      "Per-user summary",
      [
        "Email",
        "Name",
        "Timezone",
        "Hours target",
        "Days met daily target",
        "Days with office presence",
        "Total office hours",
        "Avg hours on office days",
      ],
      userStatsRows,
    ),
    csvSection(
      "Org calendar (daily)",
      [
        "Date",
        "Attended count",
        "Met target count",
        "Compliance %",
        "Total attended hours",
        "Excluded OOO",
        "Excluded stale",
        "Weekend",
      ],
      calendarRows,
    ),
    csvSection(
      "All visit logs (compliance record)",
      ["Email", "Date", "Start", "End", "Duration", "Source", "SSID"],
      visitRows,
    ),
  ];
}

export function exportFilename(prefix: string, range: ExportRange): string {
  const safe = range.periodLabel.replace(/[^\w-]+/g, "_");
  return `${prefix}-${safe}.csv`;
}
