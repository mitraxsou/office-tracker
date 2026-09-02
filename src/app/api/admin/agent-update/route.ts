import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { requestAgentUpdateForAllDevices } from "@/lib/agent-update";
import { logAuditEvent } from "@/lib/audit-log";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const count = await requestAgentUpdateForAllDevices();

  await logAuditEvent({
    actorId: admin.id,
    action: "agent_update_push",
    details: { scope: "all", deviceCount: count },
  });

  return NextResponse.json({ ok: true, deviceCount: count });
}
