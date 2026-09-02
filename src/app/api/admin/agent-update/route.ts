import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  requestAgentUpdateForAllDevices,
  requestAgentUpdateForUsers,
} from "@/lib/agent-update";
import { logAuditEvent } from "@/lib/audit-log";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userIds?: string[] } = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (Array.isArray(body.userIds) && body.userIds.length > 0) {
    const userIds = body.userIds.filter((id): id is string => typeof id === "string" && id.length > 0);
    const count = await requestAgentUpdateForUsers(userIds);

    await logAuditEvent({
      actorId: admin.id,
      action: "agent_update_push",
      details: { scope: "users", userIds, deviceCount: count },
    });

    return NextResponse.json({ ok: true, deviceCount: count, userCount: userIds.length });
  }

  const count = await requestAgentUpdateForAllDevices();

  await logAuditEvent({
    actorId: admin.id,
    action: "agent_update_push",
    details: { scope: "all", deviceCount: count },
  });

  return NextResponse.json({ ok: true, deviceCount: count });
}
