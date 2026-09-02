import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";
import { getAdminDirectProfileUpdateError } from "@/lib/admin-users";

const VALID_ROLES = new Set(["admin", "user"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { role?: string; name?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const profileUpdateError = getAdminDirectProfileUpdateError(body);
  if (profileUpdateError) {
    return NextResponse.json({ error: profileUpdateError }, { status: 400 });
  }

  const hasRole = body.role !== undefined;

  if (!hasRole) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (hasRole) {
    if (!body.role || !VALID_ROLES.has(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (target.role !== body.role) {
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
    }
  }

  const data: Prisma.UserUpdateInput = {};
  if (hasRole && body.role && target.role !== body.role) {
    data.role = body.role;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({
      user: { id: target.id, email: target.email, name: target.name, role: target.role },
    });
  }

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
    }
    throw err;
  }

  if (data.role !== undefined) {
    await logAuditEvent({
      actorId: admin.id,
      action: "user_role_change",
      targetUserId: id,
      details: { from: target.role, to: body.role },
    });
  }

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
