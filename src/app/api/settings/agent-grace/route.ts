import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getAppConfig,
  getEffectiveAgentStaleGraceHours,
} from "@/lib/app-config";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getAppConfig();
  const effectiveGraceHours = await getEffectiveAgentStaleGraceHours(user);

  return NextResponse.json({
    globalGraceHours: config.agentStaleGraceHours,
    userGraceHours: user.agentStaleGraceHours,
    effectiveGraceHours,
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    where: { id: user.id },
    data: { agentStaleGraceHours: value },
    select: { agentStaleGraceHours: true },
  });

  const config = await getAppConfig();
  const effectiveGraceHours = await getEffectiveAgentStaleGraceHours(updated);

  return NextResponse.json({
    globalGraceHours: config.agentStaleGraceHours,
    userGraceHours: updated.agentStaleGraceHours,
    effectiveGraceHours,
  });
}
