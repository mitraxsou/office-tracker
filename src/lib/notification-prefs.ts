/** ISO weekday: 1 = Monday through 7 = Sunday */
export const DEFAULT_WORK_DAYS = [3, 5];

export type AlertDeliveryChannel = "app" | "teams" | "both";

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
  channelNotInOffice: AlertDeliveryChannel;
  channelAgentStale: AlertDeliveryChannel;
  channelBehindHours: AlertDeliveryChannel;
  channelHoursStarted: AlertDeliveryChannel;
  channelHoursMet: AlertDeliveryChannel;
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
  notifyEmail: false,
  alertIfNotInOffice: false,
  alertIfAgentStale: false,
  alertIfBehindHours: false,
  alertIfHoursStarted: true,
  alertIfHoursMet: true,
  channelNotInOffice: "app",
  channelAgentStale: "app",
  channelBehindHours: "app",
  channelHoursStarted: "both",
  channelHoursMet: "both",
  behindHoursCheckTime: "15:00",
  behindHoursMinExpected: 2.5,
};

export function parseAlertDeliveryChannel(
  value: unknown,
  fallback: AlertDeliveryChannel,
): AlertDeliveryChannel {
  return value === "app" || value === "teams" || value === "both" ? value : fallback;
}

export function deliversToApp(channel: AlertDeliveryChannel): boolean {
  return channel === "app" || channel === "both";
}

export function deliversToTeams(channel: AlertDeliveryChannel): boolean {
  return channel === "teams" || channel === "both";
}

export function deliveryFlagsFromChannel(channel: AlertDeliveryChannel): {
  app: boolean;
  teams: boolean;
} {
  return {
    app: deliversToApp(channel),
    teams: deliversToTeams(channel),
  };
}

export function deliveryChannelFromFlags(app: boolean, teams: boolean): AlertDeliveryChannel {
  if (app && teams) return "both";
  if (teams) return "teams";
  return "app";
}

export function toggleDeliveryChannel(
  current: AlertDeliveryChannel,
  target: "app" | "teams",
  checked: boolean,
): AlertDeliveryChannel {
  const flags = deliveryFlagsFromChannel(current);
  if (target === "app") flags.app = checked;
  else flags.teams = checked;
  if (!flags.app && !flags.teams) {
    if (target === "app") flags.app = true;
    else flags.teams = true;
  }
  return deliveryChannelFromFlags(flags.app, flags.teams);
}

export function channelForAlert(
  prefs: NotificationPrefsData,
  type: "absent" | "stale" | "behind" | "hours_started" | "hours_met" | "ooo_cleared",
): AlertDeliveryChannel {
  switch (type) {
    case "absent":
      return prefs.channelNotInOffice;
    case "stale":
      return prefs.channelAgentStale;
    case "behind":
      return prefs.channelBehindHours;
    case "hours_started":
    case "ooo_cleared":
      return prefs.channelHoursStarted;
    case "hours_met":
      return prefs.channelHoursMet;
  }
}

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
  channelNotInOffice?: string;
  channelAgentStale?: string;
  channelBehindHours?: string;
  channelHoursStarted?: string;
  channelHoursMet?: string;
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
    channelNotInOffice: parseAlertDeliveryChannel(
      row.channelNotInOffice,
      DEFAULT_NOTIFICATION_PREFS.channelNotInOffice,
    ),
    channelAgentStale: parseAlertDeliveryChannel(
      row.channelAgentStale,
      DEFAULT_NOTIFICATION_PREFS.channelAgentStale,
    ),
    channelBehindHours: parseAlertDeliveryChannel(
      row.channelBehindHours,
      DEFAULT_NOTIFICATION_PREFS.channelBehindHours,
    ),
    channelHoursStarted: parseAlertDeliveryChannel(
      row.channelHoursStarted,
      DEFAULT_NOTIFICATION_PREFS.channelHoursStarted,
    ),
    channelHoursMet: parseAlertDeliveryChannel(
      row.channelHoursMet,
      DEFAULT_NOTIFICATION_PREFS.channelHoursMet,
    ),
    behindHoursCheckTime: isValidTime(row.behindHoursCheckTime)
      ? row.behindHoursCheckTime
      : "15:00",
    behindHoursMinExpected: row.behindHoursMinExpected,
  };
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
