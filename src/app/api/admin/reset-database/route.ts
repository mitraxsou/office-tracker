import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAuditEvent } from "@/lib/audit-log";
import { resetPilotDatabase } from "@/lib/db-reset";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { confirm?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.confirm !== "RESET") {
    return NextResponse.json(
      { error: 'Confirmation required. Send { "confirm": "RESET" }.' },
      { status: 400 }
    );
  }

  await logAuditEvent({
    actorId: admin.id,
    action: "db_reset",
    details: { actorEmail: admin.email },
  });

  await resetPilotDatabase();

  return NextResponse.json({
    ok: true,
    message:
      "Database reset complete. Breakglass admin recreated from environment. You may need to sign in again.",
  });
}
