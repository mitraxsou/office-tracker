import { NextResponse } from "next/server";
import { getUserByAgentToken } from "@/lib/auth";
import { getAppConfig, getUserHoursTarget } from "@/lib/app-config";
import { getAgentVersion } from "@/lib/agent-version";
import { getDeviceForceAgentUpdate } from "@/lib/agent-update";
import {
  agentScriptFilesBaseUrl,
  vercelProtectionBypassSecret,
} from "@/lib/agent-download";
import { API_VERSION, extractBearerToken, sanitizeSerialNumber } from "@/lib/security";

export async function GET(request: Request) {
  const token = extractBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Missing agent token" }, { status: 401 });
  }

  const user = await getUserByAgentToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const globalConfig = await getAppConfig();
  const hoursTarget = await getUserHoursTarget(user);

  const { searchParams } = new URL(request.url);
  const serialNumber = sanitizeSerialNumber(searchParams.get("serialNumber"));
  const forceAgentUpdate = serialNumber
    ? await getDeviceForceAgentUpdate(user.id, serialNumber)
    : false;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  return NextResponse.json({
    ssids: globalConfig.officeSsids,
    hoursTarget,
    timezone: user.timezone,
    heartbeatIntervalMinutes: globalConfig.heartbeatIntervalMinutes,
    apiVersion: API_VERSION,
    agentScriptVersion: getAgentVersion(),
    agentScriptFilesBase: appUrl ? agentScriptFilesBaseUrl(appUrl) : null,
    vercelProtectionBypass: vercelProtectionBypassSecret(),
    forceAgentUpdate,
  });
}
