import {
  acknowledgeIntegrationAlerts,
  getIntegrationAlerts,
  getIntegrationAlertsForUser,
  type IntegrationAlert,
  type IntegrationAlertType,
} from "./integration-alerts";
import {
  getActiveIntegrationSecret,
  markIntegrationSecretUsed,
} from "./integration-api-keys";
import { persistInAppAlerts } from "./in-app-notifications";

export type LoginOtpWebhookPayload = {
  type: "login_otp";
  email: string;
  name: string;
  message: string;
  otp: string;
  otpExpiresMinutes: number;
};

export type AlertWebhookPayload = {
  type: IntegrationAlertType | "custom";
  email: string;
  name: string;
  message: string;
  hoursToday: number;
  hoursTarget: number;
  notifyTeams: boolean;
  dashboardUrl: string;
  settingsUrl: string;
  helpUrl: string;
  outOfOfficeUrl: string;
};

export type WebhookPayload = LoginOtpWebhookPayload | AlertWebhookPayload;

type ActiveSecret = {
  id: string;
  actorId: string;
  secret: string;
};

type DispatchDependencies = {
  webhookUrl?: string | null;
  getSecret?: () => Promise<ActiveSecret | null>;
  fetcher?: typeof fetch;
  markUsed?: (id: string) => Promise<void>;
};

function toWebhookPayload(alert: IntegrationAlert): AlertWebhookPayload {
  return {
    type: alert.type,
    email: alert.email,
    name: alert.name ?? alert.email,
    message: alert.message,
    hoursToday: alert.hoursToday,
    hoursTarget: alert.hoursTarget,
    notifyTeams: alert.notifyTeams,
    dashboardUrl: alert.dashboardUrl,
    settingsUrl: alert.settingsUrl,
    helpUrl: alert.helpUrl,
    outOfOfficeUrl: alert.outOfOfficeUrl,
  };
}

async function resolveWebhookConfig(
  dependencies: DispatchDependencies = {},
): Promise<{ url: string; activeSecret: ActiveSecret } | null> {
  const url =
    dependencies.webhookUrl === undefined
      ? process.env.POWER_AUTOMATE_WEBHOOK_URL?.trim()
      : dependencies.webhookUrl?.trim();
  if (!url) return null;

  const activeSecret = await (dependencies.getSecret ?? getActiveIntegrationSecret)();
  if (!activeSecret) return null;
  return { url, activeSecret };
}

export async function postWebhookPayload(
  payload: WebhookPayload,
  dependencies: DispatchDependencies = {},
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const config = await resolveWebhookConfig(dependencies);
  if (!config) {
    return { ok: false, error: "not_configured" };
  }

  try {
    const response = await (dependencies.fetcher ?? fetch)(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Office-Pulse-Token": config.activeSecret.secret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`[power-automate] Webhook returned HTTP ${response.status}`);
      return { ok: false, status: response.status };
    }
    try {
      await (dependencies.markUsed ?? markIntegrationSecretUsed)(config.activeSecret.id);
    } catch {
      console.error("[power-automate] Failed to update secret usage timestamp");
    }
    return { ok: true, status: response.status };
  } catch {
    console.error("[power-automate] Webhook request failed");
    return { ok: false, error: "webhook_request_failed" };
  }
}

export async function dispatchAlert(
  alert: IntegrationAlert,
  dependencies: DispatchDependencies = {},
) {
  const result = await postWebhookPayload(toWebhookPayload(alert), dependencies);
  return result.ok
    ? { sent: true, skipped: false as const }
    : {
        sent: false,
        skipped: result.error === "not_configured",
        reason: result.error ?? `http_${result.status}`,
      };
}

async function dispatchAlerts(
  alerts: IntegrationAlert[],
  dependencies: DispatchDependencies = {},
) {
  const appAlerts = alerts.filter((alert) => alert.deliveryChannel === "app");
  const teamsAlerts = alerts.filter((alert) => alert.deliveryChannel === "teams");
  const inApp = await persistInAppAlerts(appAlerts);

  const config = await resolveWebhookConfig(dependencies);
  if (!config) {
    return {
      ok: true,
      configured: false,
      checked: alerts.length,
      sent: 0,
      failed: 0,
      inApp,
    };
  }

  let sent = 0;
  let failed = 0;
  for (const alert of teamsAlerts) {
    const result = await postWebhookPayload(toWebhookPayload(alert), dependencies);
    if (!result.ok) {
      failed += 1;
      continue;
    }
    await acknowledgeIntegrationAlerts(config.activeSecret.actorId, [
      { userId: alert.userId, type: alert.type, dayKey: alert.dayKey },
    ]);
    sent += 1;
  }

  return {
    ok: true,
    configured: true,
    checked: alerts.length,
    sent,
    failed,
    inApp,
  };
}

export async function dispatchPendingAlerts(dependencies: DispatchDependencies = {}) {
  const pending = await getIntegrationAlerts();
  return dispatchAlerts(pending.alerts, dependencies);
}

export async function dispatchUserAlerts(
  userId: string,
  types: IntegrationAlertType[],
  dependencies: DispatchDependencies = {},
) {
  const alerts = await getIntegrationAlertsForUser(userId, types);
  return dispatchAlerts(alerts, dependencies);
}

export async function sendTestNotification(
  admin: { email: string; name: string | null },
  dependencies: DispatchDependencies = {},
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://office-tracker-theta.vercel.app";
  const result = await postWebhookPayload(
    {
      type: "hours_started",
      email: admin.email,
      name: admin.name ?? admin.email,
      message: "This is a test notification from PwC Office Pulse.",
      hoursToday: 1,
      hoursTarget: 5,
      notifyTeams: true,
      dashboardUrl: `${baseUrl}/dashboard`,
      settingsUrl: `${baseUrl}/settings`,
      helpUrl: `${baseUrl}/help`,
      outOfOfficeUrl: `${baseUrl}/settings#out-of-office`,
    },
    dependencies,
  );
  return result.ok
    ? { sent: true }
    : { sent: false, reason: result.error ?? `http_${result.status}` };
}
