import { NextResponse } from "next/server";
import { getUserByAgentToken } from "@/lib/auth";
import { getAppConfig, getUserHoursTarget } from "@/lib/app-config";
import { getAgentVersion } from "@/lib/agent-version";
import { API_VERSION, extractBearerToken } from "@/lib/security";

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

  return NextResponse.json({
    ssids: globalConfig.officeSsids,
    hoursTarget,
    timezone: user.timezone,
    apiVersion: API_VERSION,
    agentScriptVersion: getAgentVersion(),
  });
}
