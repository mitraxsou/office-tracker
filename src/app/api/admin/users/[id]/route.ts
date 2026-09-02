import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";
import { validateAdminDirectProfileUpdate } from "@/lib/admin-users";

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

  const hasRole = body.role !== undefined;
  const hasProfile = body.name !== undefined || body.email !== undefined;

  if (!hasRole && !hasProfile) {
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

  let profileUpdates: { name?: string | null; email?: string } | null = null;
  if (hasProfile) {
    const validation = validateAdminDirectProfileUpdate({
      currentName: target.name,
      currentEmail: target.email,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
    });
    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    profileUpdates = validation.updates;

    if (profileUpdates.email) {
      const existing = await prisma.user.findUnique({
        where: { email: profileUpdates.email },
        select: { id: true },
      });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
      }
    }
  }

  const data: Prisma.UserUpdateInput = {};
  if (hasRole && body.role && target.role !== body.role) {
    data.role = body.role;
  }
  if (profileUpdates) {
    if (profileUpdates.name !== undefined) data.name = profileUpdates.name;
    if (profileUpdates.email) data.email = profileUpdates.email;
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

  if (profileUpdates) {
    await logAuditEvent({
      actorId: admin.id,
      action: "admin_profile_edit",
      targetUserId: id,
      details: {
        from: { name: target.name, email: target.email },
        to: {
          ...(profileUpdates.name !== undefined ? { name: profileUpdates.name } : {}),
          ...(profileUpdates.email ? { email: profileUpdates.email } : {}),
        },
      },
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
