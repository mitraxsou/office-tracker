import { NextResponse } from "next/server";
import { getUserByAgentToken } from "@/lib/auth";
import { authenticateAgentToken, registerOrUpdateDevice } from "@/lib/agent-auth";
import { processHeartbeat } from "@/lib/heartbeat-service";
import { getAppConfig, getUserHoursTarget } from "@/lib/app-config";
import {
  checkRateLimit,
  extractTokenFromBody,
  parseTimestamp,
  sanitizeSsid,
  sanitizeSerialNumber,
  sanitizeVpnGateway,
} from "@/lib/security";

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

  const deviceResult = await registerOrUpdateDevice(auth.userId, serialNumber);
  if (!deviceResult.ok) {
    return NextResponse.json({ error: deviceResult.error }, { status: deviceResult.status });
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

  return NextResponse.json({
    ok: true,
    inOffice: result.inOffice,
    deviceRegistered: deviceResult.registered,
  });
}
