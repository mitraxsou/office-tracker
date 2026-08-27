import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAppConfig, updateAppConfig } from "@/lib/app-config";
import { validateSsids } from "@/lib/security";
import { normalizeSsid } from "@/lib/constants";
import { logAuditEvent } from "@/lib/audit-log";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getAppConfig();
  return NextResponse.json({ config });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { hoursTarget?: number; officeSsids?: string[]; maxDevicesPerUser?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Parameters<typeof updateAppConfig>[0] = {};

  if (body.hoursTarget !== undefined) {
    if (typeof body.hoursTarget !== "number" || body.hoursTarget <= 0 || body.hoursTarget > 24) {
      return NextResponse.json({ error: "Invalid hoursTarget" }, { status: 400 });
    }
    update.hoursTarget = body.hoursTarget;
  }

  if (body.officeSsids !== undefined) {
    const normalized = validateSsids(body.officeSsids.map(normalizeSsid));
    if (!normalized) {
      return NextResponse.json({ error: "Invalid SSID list" }, { status: 400 });
    }
    update.officeSsids = normalized;
  }

  if (body.maxDevicesPerUser !== undefined) {
    if (body.maxDevicesPerUser < 1 || body.maxDevicesPerUser > 50) {
      return NextResponse.json({ error: "Invalid maxDevicesPerUser" }, { status: 400 });
    }
    update.maxDevicesPerUser = body.maxDevicesPerUser;
  }

  const config = await updateAppConfig(update);

  await logAuditEvent({
    actorId: admin.id,
    action: "config_update",
    details: update as Record<string, unknown>,
  });

  return NextResponse.json({ config });
}
