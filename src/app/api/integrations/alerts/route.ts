import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  acknowledgeIntegrationAlerts,
  getIntegrationAlerts,
  type IntegrationAlertType,
  verifyIntegrationApiKey,
} from "@/lib/integration-alerts";

const ALERT_TYPES: IntegrationAlertType[] = [
  "absent",
  "stale",
  "behind",
  "hours_started",
  "hours_met",
];

async function getIntegrationActorId() {
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  return admin?.id ?? null;
}

export async function GET(request: Request) {
  if (!(await verifyIntegrationApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const types = new URL(request.url).searchParams.get("types");
  const result = await getIntegrationAlerts(types);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  if (!(await verifyIntegrationApiKey(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actorId = await getIntegrationActorId();
  if (!actorId) {
    return NextResponse.json({ error: "No admin user for audit log" }, { status: 503 });
  }

  let body: { alerts?: Array<{ userId: string; type: string; dayKey: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = (body.alerts ?? []).filter(
    (a) =>
      a.userId &&
      a.dayKey &&
      ALERT_TYPES.includes(a.type as IntegrationAlertType),
  ) as Array<{ userId: string; type: IntegrationAlertType; dayKey: string }>;

  await acknowledgeIntegrationAlerts(actorId, items);
  return NextResponse.json({ ok: true, acknowledged: items.length });
}
