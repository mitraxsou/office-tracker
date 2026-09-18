import { prisma } from "./db";
import {
  DEFAULT_WORK_DAYS,
  parseAlertDeliveryChannel,
  toNotificationPrefsData,
  type NotificationPrefsData,
} from "./notification-prefs";

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefsData> {
  let row = await prisma.userNotificationPrefs.findUnique({ where: { userId } });
  if (!row) {
    row = await prisma.userNotificationPrefs.create({
      data: {
        userId,
        workDays: JSON.stringify(DEFAULT_WORK_DAYS),
        channelHoursStarted: "both",
        channelHoursMet: "both",
      },
    });
  } else if (row.channelHoursStarted === "teams" || row.channelHoursMet === "teams") {
    // Legacy Teams-only hours alerts skipped in-app when the webhook was missing.
    row = await prisma.userNotificationPrefs.update({
      where: { userId },
      data: {
        ...(row.channelHoursStarted === "teams" ? { channelHoursStarted: "both" } : {}),
        ...(row.channelHoursMet === "teams" ? { channelHoursMet: "both" } : {}),
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
  if (data.notifyEmail !== undefined) update.notifyEmail = false;
  if (data.alertIfNotInOffice !== undefined) update.alertIfNotInOffice = data.alertIfNotInOffice;
  if (data.alertIfAgentStale !== undefined) update.alertIfAgentStale = data.alertIfAgentStale;
  if (data.alertIfBehindHours !== undefined) update.alertIfBehindHours = data.alertIfBehindHours;
  if (data.alertIfHoursStarted !== undefined) update.alertIfHoursStarted = data.alertIfHoursStarted;
  if (data.alertIfHoursMet !== undefined) update.alertIfHoursMet = data.alertIfHoursMet;
  if (data.channelNotInOffice !== undefined) {
    update.channelNotInOffice = parseAlertDeliveryChannel(data.channelNotInOffice, "app");
  }
  if (data.channelAgentStale !== undefined) {
    update.channelAgentStale = parseAlertDeliveryChannel(data.channelAgentStale, "app");
  }
  if (data.channelBehindHours !== undefined) {
    update.channelBehindHours = parseAlertDeliveryChannel(data.channelBehindHours, "app");
  }
  if (data.channelHoursStarted !== undefined) {
    update.channelHoursStarted = parseAlertDeliveryChannel(data.channelHoursStarted, "both");
  }
  if (data.channelHoursMet !== undefined) {
    update.channelHoursMet = parseAlertDeliveryChannel(data.channelHoursMet, "both");
  }
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
