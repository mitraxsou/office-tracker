import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";
import { resetUserData } from "@/lib/user-reports";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: { scope?: string; confirm?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.confirm !== "RESET") {
    return NextResponse.json({ error: 'Type RESET to confirm' }, { status: 400 });
  }

  const scope = body.scope === "all" ? "all" : "tracking";
  await resetUserData(id, scope);

  await logAuditEvent({
    actorId: admin.id,
    action: "user_data_reset",
    targetUserId: id,
    details: { scope },
  });

  return NextResponse.json({ ok: true, scope });
}
