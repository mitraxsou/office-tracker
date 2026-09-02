import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { clearImpersonationSession, getImpersonatingUserId } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/db";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const impersonatingUserId = await getImpersonatingUserId();
  if (!impersonatingUserId) {
    return NextResponse.json({ error: "Not impersonating a user" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: impersonatingUserId },
    select: { id: true, email: true },
  });

  await clearImpersonationSession(admin.id);

  await logAuditEvent({
    actorId: admin.id,
    action: "impersonate_end",
    targetUserId: impersonatingUserId,
    details: target ? { email: target.email } : undefined,
  });

  return NextResponse.json({ ok: true, redirectTo: "/admin" });
}
