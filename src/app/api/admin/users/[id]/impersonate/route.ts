import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { setImpersonationSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import { getImpersonationBlockReason } from "@/lib/impersonation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true },
  });

  const blockReason = getImpersonationBlockReason({ admin, target });
  if (blockReason) {
    const status = blockReason === "User not found" ? 404 : 403;
    return NextResponse.json({ error: blockReason }, { status });
  }

  await setImpersonationSession(admin.id, target!.id);

  await logAuditEvent({
    actorId: admin.id,
    action: "impersonate_start",
    targetUserId: target!.id,
    details: { email: target!.email },
  });

  return NextResponse.json({
    ok: true,
    redirectTo: "/dashboard",
    user: { id: target!.id, email: target!.email, name: target!.name },
  });
}
