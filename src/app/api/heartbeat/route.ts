import { NextResponse } from "next/server";
import { getUserByAgentToken } from "@/lib/auth";
import {
  authenticateAgentToken,
  bindAgentTokenToSerial,
  logAgentDeviceRegistered,
  registerOrUpdateDevice,
} from "@/lib/agent-auth";
import { recordHeartbeatLifecycle } from "@/lib/agent-lifecycle";
import { processHeartbeat } from "@/lib/heartbeat-service";
import { getAppConfig, getUserHoursTarget } from "@/lib/app-config";
import {
  checkRateLimit,
  extractTokenFromBody,
  parseTimestamp,
  sanitizeScriptVersion,
  sanitizeSsid,
  sanitizeSerialNumber,
  sanitizeVpnGateway,
} from "@/lib/security";
import { recordDeviceScriptVersion } from "@/lib/agent-update";
import { maybeDispatchHeartbeatAlerts } from "@/lib/heartbeat-alerts";

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

  if (!checkRateLimit(`heartbeat:${token.slice(0, 8)}`)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const auth = await authenticateAgentToken(token);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const bindResult = await bindAgentTokenToSerial(auth.agentTokenId, serialNumber);
  if (!bindResult.ok) {
    return NextResponse.json({ error: bindResult.error }, { status: bindResult.status });
  }

  const deviceResult = await registerOrUpdateDevice(
    auth.userId,
    serialNumber,
    auth.agentTokenId,
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

  const recordedAt = parseTimestamp(body.at);
  if (!recordedAt) {
    return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
  }

  const ssid = sanitizeSsid(body.ssid);
  const vpnGateway = sanitizeVpnGateway(body.vpnGateway);
  const globalConfig = await getAppConfig();
  const allowlist = globalConfig.officeSsids;

  const result = await processHeartbeat({
    userId: user.id,
    ssid,
    vpnGateway,
    recordedAt,
    allowlist,
  });

  try {
    const hoursTarget = await getUserHoursTarget(user);
    await maybeDispatchHeartbeatAlerts({
      userId: user.id,
      timezone: user.timezone,
      recordedAt,
      inOffice: result.inOffice,
      hoursTarget,
    });
  } catch {
    console.error("[heartbeat] Failed to evaluate Power Automate notifications");
  }

  return NextResponse.json({
    ok: true,
    inOffice: result.inOffice,
    deviceRegistered: deviceResult.registered,
    tokenBound: bindResult.newlyBound,
  });
}
