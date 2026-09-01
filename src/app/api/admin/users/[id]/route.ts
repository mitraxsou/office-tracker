import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";

const VALID_ROLES = new Set(["admin", "user"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.role || !VALID_ROLES.has(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.role === body.role) {
    return NextResponse.json({ user: { id: target.id, email: target.email, role: target.role } });
  }

  if (body.role === "user") {
    if (id === admin.id) {
      return NextResponse.json({ error: "You cannot demote yourself" }, { status: 400 });
    }

    if (target.role === "admin") {
      const adminCount = await prisma.user.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot demote the last admin" }, { status: 400 });
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: body.role },
    select: { id: true, email: true, role: true },
  });

  await logAuditEvent({
    actorId: admin.id,
    action: "user_role_change",
    targetUserId: id,
    details: { from: target.role, to: body.role },
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.role === "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Cannot delete the last admin" }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id } });

  await logAuditEvent({
    actorId: admin.id,
    action: "user_delete",
    targetUserId: id,
    details: { email: target.email },
  });

  return NextResponse.json({ ok: true });
}
