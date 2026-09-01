import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { resetUserPasswordByAdmin } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
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

  const tempPassword = await resetUserPasswordByAdmin(id);

  await logAuditEvent({
    actorId: admin.id,
    action: "password_reset",
    targetUserId: id,
    details: { email: target.email },
  });

  return NextResponse.json({ tempPassword });
}
