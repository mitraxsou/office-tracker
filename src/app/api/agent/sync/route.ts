import { NextResponse } from "next/server";
import { backfillInstallTokenEncIfNeeded, getUserByAgentToken } from "@/lib/auth";
import {
  authenticateAgentToken,
  bindAgentTokenToSerial,
  logAgentDeviceRegistered,
  registerOrUpdateDevice,
} from "@/lib/agent-auth";
import { recordHeartbeatLifecycle } from "@/lib/agent-lifecycle";
import {
  parseAgentSyncEvents,
  parseAgentSyncOpenVisit,
  processAgentSync,
} from "@/lib/agent-sync";
import { recordDeviceScriptVersion } from "@/lib/agent-update";
import {
  checkRateLimit,
  extractTokenFromBody,
  resolveRequestAppOrigin,
  sanitizeAgentApiUrl,
  sanitizeScriptVersion,
  sanitizeSerialNumber,
} from "@/lib/security";
import { sanitizeSyncTrigger } from "@/lib/presence-timeline";
import { AGENT_API_ROUTES, recordAgentApiHit } from "@/lib/agent-api-hits";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = extractTokenFromBody(body);
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const serialNumber = sanitizeSerialNumber(body.serialNumber);
  if (!serialNumber) {
    return NextResponse.json({ error: "serialNumber is required" }, { status: 400 });
  }

  if (!checkRateLimit(`agent-sync:${token.slice(0, 8)}`)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const auth = await authenticateAgentToken(token);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await backfillInstallTokenEncIfNeeded(auth.userId, token, auth.agentToken);
  } catch {
    console.error("[agent-sync] Failed to backfill pendingTokenEnc");
  }

  const bindResult = await bindAgentTokenToSerial(auth.agentTokenId, serialNumber);
  if (!bindResult.ok) {
    return NextResponse.json({ error: bindResult.error }, { status: bindResult.status });
  }

  const agentApiUrl = sanitizeAgentApiUrl(body.apiUrl) ?? resolveRequestAppOrigin(request);

  const deviceResult = await registerOrUpdateDevice(
    auth.userId,
    serialNumber,
    auth.agentTokenId,
    agentApiUrl,
  );
  if (!deviceResult.ok) {
    return NextResponse.json({ error: deviceResult.error }, { status: deviceResult.status });
  }

  if (deviceResult.registered || bindResult.newlyBound) {
    await logAgentDeviceRegistered({
      userId: auth.userId,
      serialNumber,
    });
  }

  await recordHeartbeatLifecycle({
    userId: auth.userId,
    deviceId: deviceResult.device.id,
    serialNumber,
    registered: deviceResult.registered,
    tokenPrefix: auth.agentToken.tokenPrefix,
  });

  const scriptVersion = sanitizeScriptVersion(body.scriptVersion);
  if (scriptVersion) {
    await recordDeviceScriptVersion(auth.userId, serialNumber, scriptVersion);
  }

  const user = await getUserByAgentToken(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = parseAgentSyncEvents(body.events);
  const openVisit = parseAgentSyncOpenVisit(body.openVisit);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    agentApiUrl ??
    resolveRequestAppOrigin(request) ??
    "";

  const syncTrigger = sanitizeSyncTrigger(body.syncTrigger);

  try {
    await recordAgentApiHit({
      userId: user.id,
      deviceId: deviceResult.device.id,
      route: AGENT_API_ROUTES.SYNC,
      timezone: user.timezone,
    });
  } catch {
    console.error("[agent-sync] Failed to record API hit");
  }

  const result = await processAgentSync({
    userId: user.id,
    userTimezone: user.timezone,
    deviceId: deviceResult.device.id,
    serialNumber,
    events,
    openVisit,
    appUrl,
    syncTrigger,
  });

  return NextResponse.json(result);
}
