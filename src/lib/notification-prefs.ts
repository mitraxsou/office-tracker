import { prisma } from "./db";

/** ISO weekday: 1 = Monday through 7 = Sunday */
export const DEFAULT_WORK_DAYS = [3, 5];

export type NotificationPrefsData = {
  workDays: number[];
  officeStartTime: string;
  officeEndTime: string;
  graceMinutes: number;
  notificationsEnabled: boolean;
  notifyTeams: boolean;
  notifyEmail: boolean;
  alertIfNotInOffice: boolean;
  alertIfAgentStale: boolean;
  alertIfBehindHours: boolean;
  alertIfHoursStarted: boolean;
  alertIfHoursMet: boolean;
  behindHoursCheckTime: string;
  behindHoursMinExpected: number;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefsData = {
  workDays: DEFAULT_WORK_DAYS,
  officeStartTime: "09:30",
  officeEndTime: "18:00",
  graceMinutes: 45,
  notificationsEnabled: true,
  notifyTeams: true,
  notifyEmail: true,
  alertIfNotInOffice: true,
  alertIfAgentStale: true,
  alertIfBehindHours: false,
  alertIfHoursStarted: true,
  alertIfHoursMet: true,
  behindHoursCheckTime: "15:00",
  behindHoursMinExpected: 2.5,
};

function parseWorkDays(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_WORK_DAYS;
    return parsed.filter((d): d is number => typeof d === "number" && d >= 1 && d <= 7);
  } catch {
    return DEFAULT_WORK_DAYS;
  }
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function toNotificationPrefsData(row: {
  workDays: string;
  officeStartTime: string;
  officeEndTime: string;
  graceMinutes: number;
  notificationsEnabled?: boolean;
  notifyTeams: boolean;
  notifyEmail: boolean;
  alertIfNotInOffice: boolean;
  alertIfAgentStale: boolean;
  alertIfBehindHours: boolean;
  alertIfHoursStarted?: boolean;
  alertIfHoursMet?: boolean;
  behindHoursCheckTime: string;
  behindHoursMinExpected: number;
}): NotificationPrefsData {
  return {
    workDays: parseWorkDays(row.workDays),
    officeStartTime: isValidTime(row.officeStartTime) ? row.officeStartTime : "09:30",
    officeEndTime: isValidTime(row.officeEndTime) ? row.officeEndTime : "18:00",
    graceMinutes: row.graceMinutes,
    notificationsEnabled: row.notificationsEnabled ?? true,
    notifyTeams: row.notifyTeams,
    notifyEmail: row.notifyEmail,
    alertIfNotInOffice: row.alertIfNotInOffice,
    alertIfAgentStale: row.alertIfAgentStale,
    alertIfBehindHours: row.alertIfBehindHours,
    alertIfHoursStarted: row.alertIfHoursStarted ?? true,
    alertIfHoursMet: row.alertIfHoursMet ?? true,
    behindHoursCheckTime: isValidTime(row.behindHoursCheckTime)
      ? row.behindHoursCheckTime
      : "15:00",
    behindHoursMinExpected: row.behindHoursMinExpected,
  };
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefsData> {
  let row = await prisma.userNotificationPrefs.findUnique({ where: { userId } });
  if (!row) {
    row = await prisma.userNotificationPrefs.create({
      data: {
        userId,
        workDays: JSON.stringify(DEFAULT_WORK_DAYS),
      },
    });
  }
  return toNotificationPrefsData(row);
}

export async function updateNotificationPrefs(
  userId: string,
  data: Partial<NotificationPrefsData>,
): Promise<NotificationPrefsData> {
  const update: Record<string, unknown> = {};

  if (data.workDays !== undefined) {
    const days = data.workDays.filter((d) => d >= 1 && d <= 7);
    if (days.length === 0) throw new Error("At least one work day is required");
    update.workDays = JSON.stringify(days);
  }
  if (data.officeStartTime !== undefined) {
    if (!isValidTime(data.officeStartTime)) throw new Error("Invalid office start time");
    update.officeStartTime = data.officeStartTime;
  }
  if (data.officeEndTime !== undefined) {
    if (!isValidTime(data.officeEndTime)) throw new Error("Invalid office end time");
    update.officeEndTime = data.officeEndTime;
  }
  if (
    data.workDays !== undefined ||
    data.officeStartTime !== undefined ||
    data.officeEndTime !== undefined
  ) {
    update.scheduleUserSet = true;
    update.scheduleAutoFilled = false;
  }
  if (data.graceMinutes !== undefined) {
    if (data.graceMinutes < 0 || data.graceMinutes > 180) {
      throw new Error("graceMinutes must be 0–180");
    }
    update.graceMinutes = data.graceMinutes;
  }
  if (data.notificationsEnabled !== undefined) update.notificationsEnabled = data.notificationsEnabled;
  if (data.notifyTeams !== undefined) update.notifyTeams = data.notifyTeams;
  if (data.notifyEmail !== undefined) update.notifyEmail = data.notifyEmail;
  if (data.alertIfNotInOffice !== undefined) update.alertIfNotInOffice = data.alertIfNotInOffice;
  if (data.alertIfAgentStale !== undefined) update.alertIfAgentStale = data.alertIfAgentStale;
  if (data.alertIfBehindHours !== undefined) update.alertIfBehindHours = data.alertIfBehindHours;
  if (data.alertIfHoursStarted !== undefined) update.alertIfHoursStarted = data.alertIfHoursStarted;
  if (data.alertIfHoursMet !== undefined) update.alertIfHoursMet = data.alertIfHoursMet;
  if (data.behindHoursCheckTime !== undefined) {
    if (!isValidTime(data.behindHoursCheckTime)) throw new Error("Invalid behind-hours check time");
    update.behindHoursCheckTime = data.behindHoursCheckTime;
  }
  if (data.behindHoursMinExpected !== undefined) {
    if (data.behindHoursMinExpected < 0 || data.behindHoursMinExpected > 12) {
      throw new Error("behindHoursMinExpected must be 0–12");
    }
    update.behindHoursMinExpected = data.behindHoursMinExpected;
  }

  const row = await prisma.userNotificationPrefs.upsert({
    where: { userId },
    create: {
      userId,
      workDays: JSON.stringify(data.workDays ?? DEFAULT_WORK_DAYS),
      ...update,
    },
    update,
  });

  return toNotificationPrefsData(row);
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function getWeekdayInTimezone(date: Date, timezone: string): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  return WEEKDAY_MAP[short] ?? 0;
}

export function getMinutesInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

export function dayKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isWorkDayNow(prefs: NotificationPrefsData, now: Date, timezone: string): boolean {
  const weekday = getWeekdayInTimezone(now, timezone);
  return prefs.workDays.includes(weekday);
}
