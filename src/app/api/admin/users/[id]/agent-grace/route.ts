import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";
import { getAppConfig, getEffectiveAgentStaleGraceHours } from "@/lib/app-config";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, agentStaleGraceHours: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const config = await getAppConfig();
  const effectiveGraceHours = await getEffectiveAgentStaleGraceHours(user);

  return NextResponse.json({
    globalGraceHours: config.agentStaleGraceHours,
    userGraceHours: user.agentStaleGraceHours,
    effectiveGraceHours,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, agentStaleGraceHours: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: { agentStaleGraceHours?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.agentStaleGraceHours === undefined) {
    return NextResponse.json({ error: "agentStaleGraceHours is required" }, { status: 400 });
  }

  let value: number | null = null;
  if (body.agentStaleGraceHours !== null) {
    if (
      typeof body.agentStaleGraceHours !== "number" ||
      body.agentStaleGraceHours < 1 ||
      body.agentStaleGraceHours > 168
    ) {
      return NextResponse.json(
        { error: "agentStaleGraceHours must be 1-168 or null" },
        { status: 400 },
      );
    }
    value = Math.round(body.agentStaleGraceHours);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { agentStaleGraceHours: value },
    select: { agentStaleGraceHours: true },
  });

  await logAuditEvent({
    actorId: admin.id,
    action: "admin_agent_grace_update",
    targetUserId: id,
    details: {
      userEmail: user.email,
      from: user.agentStaleGraceHours,
      to: value,
    },
  });

  const config = await getAppConfig();
  const effectiveGraceHours = await getEffectiveAgentStaleGraceHours(updated);

  return NextResponse.json({
    globalGraceHours: config.agentStaleGraceHours,
    userGraceHours: updated.agentStaleGraceHours,
    effectiveGraceHours,
  });
}
