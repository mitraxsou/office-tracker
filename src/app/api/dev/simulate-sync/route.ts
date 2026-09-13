import { NextResponse } from "next/server";
import {
  buildAgentSyncBody,
  buildSimulatorSyncEvents,
  isDevSimulatorEnabled,
  isRemoteApiMode,
  getRemoteApiUrl,
  listDemoUsers,
  resolveDemoUser,
  type SimulatorScenario,
} from "@/lib/dev-simulator";
import type { AgentSyncOpenVisit } from "@/lib/agent-sync";

export async function POST(request: Request) {
  if (!isDevSimulatorEnabled()) {
    return NextResponse.json({ error: "Simulator disabled" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const scenario = typeof body.scenario === "string" ? body.scenario : "";
  const user = resolveDemoUser(email);
  if (!user) {
    return NextResponse.json({ error: "Unknown demo user. Run npm run seed:demo first." }, { status: 400 });
  }

  const validScenarios: SimulatorScenario[] = [
    "office_arrival",
    "office_departure",
    "activity_tick",
    "session_resume",
    "wifi_home",
    "wifi_office",
    "health_ping",
  ];
  if (!validScenarios.includes(scenario as SimulatorScenario)) {
    return NextResponse.json({ error: "Invalid scenario" }, { status: 400 });
  }

  const ssid = typeof body.ssid === "string" ? body.ssid : undefined;
  const previousSsid = typeof body.previousSsid === "string" ? body.previousSsid : undefined;
  const minutesAgo = typeof body.minutesAgo === "number" ? body.minutesAgo : 0;
  const openVisit = parseOpenVisit(body.openVisit);

  const built = buildSimulatorSyncEvents({
    scenario: scenario as SimulatorScenario,
    ssid,
    previousSsid,
    openVisit,
    minutesAgo,
  });

  const syncBody = buildAgentSyncBody({
    user,
    events: built.events,
    openVisit: built.openVisit,
    apiUrl: isRemoteApiMode() ? getRemoteApiUrl() : undefined,
  });

  const targetUrl = isRemoteApiMode()
    ? `${getRemoteApiUrl()}/api/agent/sync`
    : new URL("/api/agent/sync", request.url).toString();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (bypass && isRemoteApiMode()) {
    headers["x-vercel-protection-bypass"] = bypass;
  }

  const upstream = await fetch(targetUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(syncBody),
  });

  let result: unknown;
  try {
    result = await upstream.json();
  } catch {
    result = { error: "Upstream returned non-JSON" };
  }

  return NextResponse.json(
    {
      ok: upstream.ok,
      scenario,
      email: user.email,
      events: built.events,
      openVisit: built.openVisit,
      targetUrl,
      result,
    },
    { status: upstream.ok ? 200 : upstream.status },
  );
}

function parseOpenVisit(value: unknown): AgentSyncOpenVisit | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.localVisitId !== "string" || typeof row.startAt !== "string") return null;
  return {
    localVisitId: row.localVisitId,
    startAt: row.startAt,
    ssid: typeof row.ssid === "string" ? row.ssid : null,
  };
}
