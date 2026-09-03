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

type WebhookPayload = Omit<
  Pick<
  IntegrationAlert,
  | "type"
  | "email"
  | "name"
  | "message"
  | "hoursToday"
  | "hoursTarget"
  | "notifyTeams"
  | "notifyEmail"
  | "dashboardUrl"
  | "settingsUrl"
  | "helpUrl"
  | "outOfOfficeUrl"
  >,
  "name"
> & { name: string };

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

function toWebhookPayload(alert: IntegrationAlert): WebhookPayload {
  return {
    type: alert.type,
    email: alert.email,
    name: alert.name ?? alert.email,
    message: alert.message,
    hoursToday: alert.hoursToday,
    hoursTarget: alert.hoursTarget,
    notifyTeams: alert.notifyTeams,
    notifyEmail: alert.notifyEmail,
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

async function postPayload(
  payload: WebhookPayload,
  config: { url: string; activeSecret: ActiveSecret },
  dependencies: DispatchDependencies = {},
): Promise<{ ok: boolean; status?: number; error?: string }> {
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
  const config = await resolveWebhookConfig(dependencies);
  if (!config) return { sent: false, skipped: true as const, reason: "not_configured" };

  const result = await postPayload(toWebhookPayload(alert), config, dependencies);
  return result.ok
    ? { sent: true, skipped: false as const }
    : { sent: false, skipped: false as const, reason: result.error ?? `http_${result.status}` };
}

async function dispatchAlerts(
  alerts: IntegrationAlert[],
  dependencies: DispatchDependencies = {},
) {
  const config = await resolveWebhookConfig(dependencies);
  if (!config) {
    return { ok: true, configured: false, checked: alerts.length, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  for (const alert of alerts) {
    const result = await postPayload(toWebhookPayload(alert), config, dependencies);
    if (!result.ok) {
      failed += 1;
      continue;
    }
    await acknowledgeIntegrationAlerts(config.activeSecret.actorId, [
      { userId: alert.userId, type: alert.type, dayKey: alert.dayKey },
    ]);
    sent += 1;
  }

  return { ok: true, configured: true, checked: alerts.length, sent, failed };
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
  const config = await resolveWebhookConfig(dependencies);
  if (!config) return { sent: false, reason: "not_configured" };

  const result = await postPayload(
    {
      type: "hours_started",
      email: admin.email,
      name: admin.name ?? admin.email,
      message: "This is a test notification from PwC Office Pulse.",
      hoursToday: 1,
      hoursTarget: 5,
      notifyTeams: true,
      notifyEmail: true,
      dashboardUrl: `${baseUrl}/dashboard`,
      settingsUrl: `${baseUrl}/settings`,
      helpUrl: `${baseUrl}/help`,
      outOfOfficeUrl: `${baseUrl}/settings#out-of-office`,
    },
    config,
    dependencies,
  );
  return result.ok
    ? { sent: true }
    : { sent: false, reason: result.error ?? `http_${result.status}` };
}
