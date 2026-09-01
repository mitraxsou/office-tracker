import { prisma } from "./db";
import { getAppConfig, getUserHoursTarget } from "./app-config";
import { getTodaySummary, getPulseStats } from "./heartbeat-service";
import { dayBoundsFromKey, dayKeyInTimezone } from "./timezone-dates";
import { roundHours } from "./visits";
import {
  getMinutesInTimezone,
  getNotificationPrefs,
  isWorkDayNow,
  parseTimeToMinutes,
  type NotificationPrefsData,
} from "./notification-prefs";
import { buildOutOfOfficeLinkUrl, isUserOutOfOffice } from "./out-of-office";

export type IntegrationAlertType = "absent" | "stale" | "behind";

export type IntegrationAlert = {
  type: IntegrationAlertType;
  userId: string;
  email: string;
  name: string | null;
  message: string;
  hoursToday: number;
  hoursTarget: number;
  agentHealthy: boolean;
  inOfficeNow: boolean;
  notifyTeams: boolean;
  notifyEmail: boolean;
  dayKey: string;
  dashboardUrl: string;
  settingsUrl: string;
  outOfOfficeUrl: string;
};

const INTEGRATION_ALERT_ACTION = "integration_alert";

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://office-tracker-theta.vercel.app";
}

export { verifyIntegrationApiKey } from "./integration-api-keys";

async function wasAlertSentToday(
  userId: string,
  type: IntegrationAlertType,
  dayKey: string,
): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: {
      targetUserId: userId,
      action: INTEGRATION_ALERT_ACTION,
      details: { contains: `"type":"${type}"` },
      createdAt: { gte: dayBoundsFromKey(dayKey, "Asia/Kolkata").start },
    },
  });
  if (!existing?.details) return false;
  try {
    const parsed = JSON.parse(existing.details) as { type?: string; dayKey?: string };
    return parsed.type === type && parsed.dayKey === dayKey;
  } catch {
    return false;
  }
}

export async function acknowledgeIntegrationAlerts(
  actorId: string,
  items: Array<{ userId: string; type: IntegrationAlertType; dayKey: string }>,
) {
  for (const item of items) {
    if (await wasAlertSentToday(item.userId, item.type, item.dayKey)) continue;
    await prisma.auditLog.create({
      data: {
        actorId,
        action: INTEGRATION_ALERT_ACTION,
        targetUserId: item.userId,
        details: JSON.stringify({
          type: item.type,
          dayKey: item.dayKey,
          acknowledgedAt: new Date().toISOString(),
        }),
      },
    });
  }
}

async function hadInOfficeHeartbeatToday(userId: string, dayStart: Date): Promise<boolean> {
  const beat = await prisma.heartbeat.findFirst({
    where: { userId, recordedAt: { gte: dayStart }, inOffice: true },
  });
  return beat !== null;
}

function buildAbsentMessage(prefs: NotificationPrefsData): string {
  return `No office Wi-Fi detected yet today. You usually start around ${prefs.officeStartTime}. Open the dashboard to check in manually if you are in the office.`;
}

function buildStaleMessage(minutes: number | null): string {
  if (minutes != null) {
    return `Your Office Pulse agent has not sent a heartbeat in about ${minutes} minutes. Re-run the install command from Settings.`;
  }
  return "Your Office Pulse agent is not sending heartbeats. Re-run the install command from Settings.";
}

function buildBehindMessage(hoursToday: number, minExpected: number, target: number): string {
  return `You have logged ${hoursToday.toFixed(1)}h in the office so far. On a typical day you aim for at least ${minExpected}h by now (${target}h total).`;
}

async function evaluateUserAlerts(
  user: {
    id: string;
    email: string;
    name: string | null;
    timezone: string;
    hoursTarget: number | null;
  },
  types: Set<IntegrationAlertType>,
  now: Date,
): Promise<IntegrationAlert[]> {
  const prefs = await getNotificationPrefs(user.id);
  if (!prefs.notificationsEnabled) return [];
  if (!prefs.notifyTeams && !prefs.notifyEmail) return [];

  const hoursTarget = await getUserHoursTarget(user);
  const summary = await getTodaySummary(user.id, user.timezone, hoursTarget);
  const config = await getAppConfig();
  const pulse = await getPulseStats(user.id, config.agentStaleMinutes);

  const dayKey = dayKeyInTimezone(now, user.timezone);
  if (await isUserOutOfOffice(user.id, dayKey)) return [];

  const dayStart = dayBoundsFromKey(dayKey, user.timezone).start;
  const nowMinutes = getMinutesInTimezone(now, user.timezone);
  const workDay = isWorkDayNow(prefs, now, user.timezone);
  if (!workDay) return [];

  const baseUrl = appBaseUrl();
  const outOfOfficeUrl = await buildOutOfOfficeLinkUrl(user.id, dayKey);

  const alerts: IntegrationAlert[] = [];

  const base = {
    userId: user.id,
    email: user.email,
    name: user.name,
    hoursToday: roundHours(summary.totalHours),
    hoursTarget,
    agentHealthy: pulse.agentHealthy,
    inOfficeNow: summary.inOfficeNow,
    notifyTeams: prefs.notifyTeams,
    notifyEmail: prefs.notifyEmail,
    dayKey,
    dashboardUrl: `${baseUrl}/dashboard`,
    settingsUrl: `${baseUrl}/settings`,
    outOfOfficeUrl,
  };

  if (types.has("stale") && prefs.alertIfAgentStale && workDay && !pulse.agentHealthy) {
    const hasDevice = (await prisma.agentDevice.count({ where: { userId: user.id } })) > 0;
    if (hasDevice && !(await wasAlertSentToday(user.id, "stale", dayKey))) {
      alerts.push({
        ...base,
        type: "stale",
        message: buildStaleMessage(pulse.minutesSinceLastPulse),
      });
    }
  }

  if (types.has("absent") && prefs.alertIfNotInOffice && workDay) {
    const startMinutes = parseTimeToMinutes(prefs.officeStartTime) + prefs.graceMinutes;
    if (nowMinutes >= startMinutes) {
      const inOfficeToday = await hadInOfficeHeartbeatToday(user.id, dayStart);
      if (
        !inOfficeToday &&
        !summary.inOfficeNow &&
        !(await wasAlertSentToday(user.id, "absent", dayKey))
      ) {
        alerts.push({
          ...base,
          type: "absent",
          message: buildAbsentMessage(prefs),
        });
      }
    }
  }

  if (types.has("behind") && prefs.alertIfBehindHours && workDay) {
    const checkMinutes = parseTimeToMinutes(prefs.behindHoursCheckTime);
    if (
      nowMinutes >= checkMinutes &&
      summary.totalHours < prefs.behindHoursMinExpected &&
      !(await wasAlertSentToday(user.id, "behind", dayKey))
    ) {
      alerts.push({
        ...base,
        type: "behind",
        message: buildBehindMessage(
          summary.totalHours,
          prefs.behindHoursMinExpected,
          hoursTarget,
        ),
      });
    }
  }

  return alerts;
}

export async function getIntegrationAlerts(typesParam?: string | null): Promise<{
  generatedAt: string;
  alerts: IntegrationAlert[];
}> {
  const allTypes: IntegrationAlertType[] = ["absent", "stale", "behind"];
  const types = new Set<IntegrationAlertType>(
    typesParam
      ? typesParam
          .split(",")
          .map((t) => t.trim() as IntegrationAlertType)
          .filter((t) => allTypes.includes(t))
      : allTypes,
  );

  const now = new Date();
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, timezone: true, hoursTarget: true },
  });

  const alerts: IntegrationAlert[] = [];
  for (const user of users) {
    const userAlerts = await evaluateUserAlerts(user, types, now);
    alerts.push(...userAlerts);
  }

  return {
    generatedAt: now.toISOString(),
    alerts,
  };
}

/** Exported for unit tests */
export { evaluateUserAlerts, buildAbsentMessage, buildStaleMessage, buildBehindMessage };
