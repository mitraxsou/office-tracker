import { randomUUID } from "node:crypto";
import { dayKeyInTimezone } from "./notification-prefs";
import { buildOutOfOfficeLinkUrl } from "./out-of-office";
import { dispatchAlert } from "./power-automate-notify";
import { createInAppNotification } from "./in-app-notifications";
import type { IntegrationAlert } from "./integration-alerts";

export const CUSTOM_NOTIFY_CHANNELS = ["app", "teams", "both"] as const;
export type CustomNotifyChannel = (typeof CUSTOM_NOTIFY_CHANNELS)[number];

const MAX_MESSAGE_LENGTH = 1000;

export function parseCustomNotifyChannel(value: unknown): CustomNotifyChannel | null {
  return CUSTOM_NOTIFY_CHANNELS.includes(value as CustomNotifyChannel)
    ? (value as CustomNotifyChannel)
    : null;
}

export function normalizeCustomMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const message = value.trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH) return null;
  return message;
}

type CustomNotifyUser = {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
};

type CustomNotifyDependencies = {
  persistInApp?: typeof createInAppNotification;
  sendTeams?: typeof dispatchAlert;
  oooUrl?: (userId: string, dayKey: string) => Promise<string>;
  now?: Date;
};

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://office-tracker-theta.vercel.app";
}

export async function sendCustomUserNotification(
  user: CustomNotifyUser,
  message: string,
  channel: CustomNotifyChannel,
  dependencies: CustomNotifyDependencies = {},
) {
  const now = dependencies.now ?? new Date();
  const calendarDay = dayKeyInTimezone(now, user.timezone);
  const uniqueDayKey = `${calendarDay}-custom-${randomUUID()}`;
  const sendApp = channel === "app" || channel === "both";
  const sendTeams = channel === "teams" || channel === "both";

  let inApp = false;
  if (sendApp) {
    await (dependencies.persistInApp ?? createInAppNotification)({
      userId: user.id,
      type: "custom",
      dayKey: uniqueDayKey,
      message,
    });
    inApp = true;
  }

  let teams: { sent: boolean; reason?: string } = { sent: false };
  if (sendTeams) {
    const baseUrl = appBaseUrl();
    const outOfOfficeUrl = await (dependencies.oooUrl ?? buildOutOfOfficeLinkUrl)(
      user.id,
      calendarDay,
    );
    const alert: IntegrationAlert = {
      type: "custom",
      userId: user.id,
      email: user.email,
      name: user.name,
      message,
      hoursToday: 0,
      hoursTarget: 0,
      agentHealthy: true,
      inOfficeNow: false,
      notifyTeams: true,
      deliveryChannel: "teams",
      dayKey: uniqueDayKey,
      dashboardUrl: `${baseUrl}/dashboard`,
      settingsUrl: `${baseUrl}/settings`,
      helpUrl: `${baseUrl}/help`,
      outOfOfficeUrl,
    };
    const result = await (dependencies.sendTeams ?? dispatchAlert)(alert);
    teams = result.sent
      ? { sent: true }
      : { sent: false, reason: result.reason ?? "not_configured" };
  }

  return { inApp, teams };
}
