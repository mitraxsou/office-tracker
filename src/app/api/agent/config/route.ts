import { NextResponse } from "next/server";
import { getUserByAgentToken } from "@/lib/auth";
import { getUserHoursTarget } from "@/lib/app-config";
import {
  AGENT_CONFIG_CACHE_CONTROL,
  getCachedAppConfig,
} from "@/lib/agent-config-cache";
import { resolveAgentTargetVersionFromConfig } from "@/lib/agent-rollout";
import { getDeviceForceAgentUpdate } from "@/lib/agent-update";
import {
  agentScriptFilesBaseUrl,
  vercelProtectionBypassSecret,
} from "@/lib/agent-download";
import { API_VERSION, extractBearerToken, sanitizeSerialNumber } from "@/lib/security";
import { AGENT_API_ROUTES, recordAgentApiHit } from "@/lib/agent-api-hits";
import { prisma } from "@/lib/db";
import { fleetStableFilesBaseUrl } from "@/lib/agent-release-artifacts";

export async function GET(request: Request) {
  const token = extractBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Missing agent token" }, { status: 401 });
  }

  const user = await getUserByAgentToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const globalConfig = await getCachedAppConfig();
  const hoursTarget = await getUserHoursTarget(user);

  const { searchParams } = new URL(request.url);
  const serialNumber = sanitizeSerialNumber(searchParams.get("serialNumber"));
  const forceAgentUpdate = serialNumber
    ? await getDeviceForceAgentUpdate(user.id, serialNumber)
    : false;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  let deviceId: string | null = null;
  if (serialNumber) {
    const device = await prisma.agentDevice.findFirst({
      where: { userId: user.id, serialNumber },
      select: { id: true },
    });
    deviceId = device?.id ?? null;
  }

  try {
    await recordAgentApiHit({
      userId: user.id,
      deviceId,
      route: AGENT_API_ROUTES.CONFIG,
      timezone: user.timezone,
    });
  } catch {
    console.error("[agent-config] Failed to record API hit");
  }

  const agentScriptVersion = resolveAgentTargetVersionFromConfig(globalConfig, {
    id: user.id,
    email: user.email,
  });

  return NextResponse.json(
    {
      ssids: globalConfig.officeSsids,
      hoursTarget,
      timezone: user.timezone,
      heartbeatIntervalMinutes: globalConfig.heartbeatIntervalMinutes,
      apiVersion: API_VERSION,
      agentScriptVersion,
      agentFleetStableVersion: globalConfig.agentFleetStableVersion,
      agentFleetStableFilesBase: appUrl
        ? fleetStableFilesBaseUrl(appUrl, globalConfig.agentFleetStableVersion)
        : null,
      agentScriptFilesBase: appUrl ? agentScriptFilesBaseUrl(appUrl) : null,
      vercelProtectionBypass: vercelProtectionBypassSecret(),
      forceAgentUpdate,
      agentMode: globalConfig.agentMode,
    },
    {
      headers: {
        "Cache-Control": AGENT_CONFIG_CACHE_CONTROL,
      },
    },
  );
}
