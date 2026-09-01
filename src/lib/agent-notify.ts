import { prisma } from "./db";
import { getAppConfig } from "./app-config";
import { getPulseStats } from "./heartbeat-service";
import { logAuditEvent } from "./audit-log";

const ALERT_ACTION = "agent_stale_email";

type ResendConfig = {
  apiKey: string;
  from: string;
};

function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AGENT_ALERT_FROM_EMAIL?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export function isAgentEmailConfigured(): boolean {
  return getResendConfig() !== null;
}

async function alreadyAlertedToday(userId: string, dayKey: string) {
  const existing = await prisma.auditLog.findFirst({
    where: {
      targetUserId: userId,
      action: ALERT_ACTION,
      details: { contains: dayKey },
    },
    orderBy: { createdAt: "desc" },
  });
  return Boolean(existing);
}

async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const config = getResendConfig();
  if (!config) return { ok: false as const, reason: "not_configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false as const, reason: body || res.statusText };
  }

  return { ok: true as const };
}

export async function sendStaleAgentEmail(params: {
  userId: string;
  email: string;
  minutesSinceLastPulse: number | null;
  actorId: string;
  dayKey: string;
}) {
  if (await alreadyAlertedToday(params.userId, params.dayKey)) {
    return { sent: false, reason: "already_sent_today" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://office-tracker-theta.vercel.app";
  const minutes = params.minutesSinceLastPulse ?? "unknown";
  const html = `
    <p>Your PwC Office Pulse agent on your laptop has stopped sending heartbeats.</p>
    <p><strong>Last pulse:</strong> about ${minutes} minutes ago.</p>
    <p>Office hours are not updating until the agent is fixed.</p>
    <p><strong>What to do:</strong></p>
    <ol>
      <li>Open <a href="${appUrl}/settings">Settings</a> and re-run the install command.</li>
      <li>Check Task Scheduler for <code>PwCOfficePulse</code>.</li>
      <li>If it still fails, contact your admin.</li>
    </ol>
    <p><a href="${appUrl}/dashboard">Open dashboard</a></p>
  `;

  const result = await sendResendEmail({
    to: params.email,
    subject: "PwC Office Pulse: agent not responding",
    html,
  });

  if (!result.ok) {
    return { sent: false, reason: result.reason };
  }

  await logAuditEvent({
    actorId: params.actorId,
    action: ALERT_ACTION,
    targetUserId: params.userId,
    details: { dayKey: params.dayKey, minutesSinceLastPulse: params.minutesSinceLastPulse },
  });

  return { sent: true };
}

/**
 * Find users with registered devices whose agent has been stale for 30+ minutes.
 * Sends at most one email per user per calendar day (UTC) when Resend is configured.
 */
export async function notifyStaleAgents() {
  const resend = getResendConfig();
  if (!resend) {
    return { ok: true, configured: false, checked: 0, sent: 0 };
  }

  const config = await getAppConfig();
  const staleThresholdMinutes = Math.max(30, config.agentStaleMinutes * 2);
  const actor = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!actor) {
    return { ok: false, error: "no_admin_actor" };
  }

  const dayKey = new Date().toISOString().slice(0, 10);
  const users = await prisma.user.findMany({
    where: { agentDevices: { some: {} } },
    select: { id: true, email: true },
  });

  let sent = 0;
  for (const user of users) {
    const pulse = await getPulseStats(user.id, config.agentStaleMinutes);
    if (pulse.agentHealthy) continue;
    if (
      pulse.minutesSinceLastPulse !== null &&
      pulse.minutesSinceLastPulse < staleThresholdMinutes
    ) {
      continue;
    }

    const result = await sendStaleAgentEmail({
      userId: user.id,
      email: user.email,
      minutesSinceLastPulse: pulse.minutesSinceLastPulse,
      actorId: actor.id,
      dayKey,
    });
    if (result.sent) sent += 1;
  }

  return { ok: true, configured: true, checked: users.length, sent };
}
