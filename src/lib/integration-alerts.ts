import { prisma } from "./db";
import { getAppConfig, getUserHoursTarget, getEffectiveAgentStaleGraceHours } from "./app-config";
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
import { userHasActiveInstalledDevice } from "./agent-lifecycle";
import { heartbeatInOffice } from "./heartbeat-office";

export type IntegrationAlertType =
  | "absent"
  | "stale"
  | "behind"
  | "hours_started"
  | "hours_met";

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
  helpUrl: string;
  outOfOfficeUrl: string;
};

const INTEGRATION_ALERT_ACTION = "integration_alert";

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://office-tracker-theta.vercel.app";
}

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
    },
    orderBy: { createdAt: "desc" },
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

async function hadInOfficeHeartbeatToday(
  userId: string,
  dayStart: Date,
  dayEnd: Date,
  allowlist: string[],
): Promise<boolean> {
  const beats = await prisma.heartbeat.findMany({
    where: { userId, recordedAt: { gte: dayStart, lte: dayEnd } },
    select: { ssid: true, inOffice: true },
  });
  return beats.some((b) => heartbeatInOffice(b, allowlist));
}

function buildAbsentMessage(
  prefs: NotificationPrefsData,
  baseUrl: string = appBaseUrl(),
): string {
  return `Office Pulse is not receiving a Wi-Fi name from your laptop. Your usual start time is ${prefs.officeStartTime}. To restore tracking: 1) open ${baseUrl}/settings#install, 2) download and extract the agent zip, 3) open PowerShell in that folder, 4) copy the update command, and 5) paste it. Full steps: ${baseUrl}/help#install-agent`;
}

function buildStaleMessage(minutes: number | null, baseUrl: string = appBaseUrl()): string {
  if (minutes != null) {
    return `Your Office Pulse agent has not sent a heartbeat in about ${minutes} minutes. To restore tracking: 1) open ${baseUrl}/settings#install, 2) download and extract the agent zip, 3) open PowerShell in that folder, 4) copy the update command, and 5) paste it. Full steps: ${baseUrl}/help#install-agent`;
  }
  return `Your Office Pulse agent is not sending heartbeats. Download the zip from ${baseUrl}/settings#install, extract it, open PowerShell in that folder, and paste the update command. Steps: ${baseUrl}/help#install-agent.`;
}

function buildBehindMessage(hoursToday: number, minExpected: number, target: number): string {
  return `You have logged ${hoursToday.toFixed(1)}h in the office so far. On a typical day you aim for at least ${minExpected}h by now (${target}h total).`;
}

function buildHoursStartedMessage(hoursTarget: number): string {
  return `Office Wi-Fi detected. Your office hours count has started for today. Your daily target is ${hoursTarget}h.`;
}

function buildHoursMetMessage(hoursToday: number, hoursTarget: number): string {
  return `You have completed your ${hoursTarget}h office target for today. Office Pulse has counted ${hoursToday.toFixed(1)}h.`;
}

export function classifyPresenceReminder(input: {
  inOfficeToday: boolean;
  inOfficeNow: boolean;
  agentHealthy: boolean;
  lastSsid: string | null;
}): "absent" | "stale" | null {
  if (input.inOfficeToday || input.inOfficeNow) return null;
  if (!input.agentHealthy) return "stale";
  if (!input.lastSsid?.trim()) return "absent";
  return null;
}

export function shouldQueueDailyAlert(eligible: boolean, alreadySent: boolean): boolean {
  return eligible && !alreadySent;
}

async function evaluateUserAlerts(
  user: {
    id: string;
    email: string;
    name: string | null;
    timezone: string;
    hoursTarget: number | null;
    agentStaleGraceHours: number | null;
  },
  types: Set<IntegrationAlertType>,
  now: Date,
): Promise<IntegrationAlert[]> {
  const prefs = await getNotificationPrefs(user.id);
  if (!prefs.notificationsEnabled) return [];
  if (!prefs.notifyTeams && !prefs.notifyEmail) return [];

  const hoursTarget = await getUserHoursTarget(user);
  const graceHours = await getEffectiveAgentStaleGraceHours(user);
  const summary = await getTodaySummary(user.id, user.timezone, hoursTarget, graceHours);
  const config = await getAppConfig();
  const pulse = await getPulseStats(user.id, graceHours);

  const dayKey = dayKeyInTimezone(now, user.timezone);
  if (await isUserOutOfOffice(user.id, dayKey)) return [];

  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(dayKey, user.timezone);
  const nowMinutes = getMinutesInTimezone(now, user.timezone);
  const workDay = isWorkDayNow(prefs, now, user.timezone);

  const baseUrl = appBaseUrl();
  const outOfOfficeUrl = await buildOutOfOfficeLinkUrl(user.id, dayKey);
  const inOfficeToday = await hadInOfficeHeartbeatToday(
    user.id,
    dayStart,
    dayEnd,
    config.officeSsids,
  );

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
    helpUrl: `${baseUrl}/help`,
    outOfOfficeUrl,
  };

  const presenceReminder = classifyPresenceReminder({
    inOfficeToday,
    inOfficeNow: summary.inOfficeNow,
    agentHealthy: pulse.agentHealthy,
    lastSsid: summary.lastHeartbeat?.ssid ?? null,
  });

  if (
    types.has("stale") &&
    prefs.alertIfAgentStale &&
    workDay &&
    presenceReminder === "stale"
  ) {
    const hasDevice = await userHasActiveInstalledDevice(user.id);
    if (hasDevice && !(await wasAlertSentToday(user.id, "stale", dayKey))) {
      alerts.push({
        ...base,
        type: "stale",
        message: buildStaleMessage(pulse.minutesSinceLastPulse, baseUrl),
      });
    }
  }

  if (types.has("absent") && prefs.alertIfNotInOffice && workDay) {
    const startMinutes = parseTimeToMinutes(prefs.officeStartTime) + prefs.graceMinutes;
    if (nowMinutes >= startMinutes && presenceReminder === "absent") {
      if (
        !(await wasAlertSentToday(user.id, "absent", dayKey))
      ) {
        alerts.push({
          ...base,
          type: "absent",
          message: buildAbsentMessage(prefs, baseUrl),
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

  if (
    types.has("hours_started") &&
    prefs.alertIfHoursStarted &&
    shouldQueueDailyAlert(
      inOfficeToday,
      await wasAlertSentToday(user.id, "hours_started", dayKey),
    )
  ) {
    alerts.push({
      ...base,
      type: "hours_started",
      message: buildHoursStartedMessage(hoursTarget),
    });
  }

  if (
    types.has("hours_met") &&
    prefs.alertIfHoursMet &&
    shouldQueueDailyAlert(
      inOfficeToday && summary.totalHours >= hoursTarget,
      await wasAlertSentToday(user.id, "hours_met", dayKey),
    )
  ) {
    alerts.push({
      ...base,
      type: "hours_met",
      message: buildHoursMetMessage(summary.totalHours, hoursTarget),
    });
  }

  return alerts;
}

export async function getIntegrationAlerts(typesParam?: string | null): Promise<{
  generatedAt: string;
  alerts: IntegrationAlert[];
}> {
  const allTypes: IntegrationAlertType[] = [
    "absent",
    "stale",
    "behind",
    "hours_started",
    "hours_met",
  ];
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
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      hoursTarget: true,
      agentStaleGraceHours: true,
    },
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

export async function getIntegrationAlertsForUser(
  userId: string,
  types: IntegrationAlertType[],
): Promise<IntegrationAlert[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      hoursTarget: true,
      agentStaleGraceHours: true,
    },
  });
  if (!user) return [];
  return evaluateUserAlerts(user, new Set(types), new Date());
}

/** Exported for unit tests */
export {
  evaluateUserAlerts,
  buildAbsentMessage,
  buildStaleMessage,
  buildBehindMessage,
  buildHoursStartedMessage,
  buildHoursMetMessage,
};
