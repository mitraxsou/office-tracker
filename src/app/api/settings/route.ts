import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateTimezone } from "@/lib/security";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { timezone?: string; hoursTarget?: unknown; ssids?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.hoursTarget !== undefined || body.ssids !== undefined) {
    return NextResponse.json(
      { error: "Hours target and office SSIDs are managed by admin only" },
      { status: 403 }
    );
  }

  const { timezone } = body;
  if (timezone === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (!validateTimezone(timezone)) {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { timezone },
    include: { agentToken: true, agentDevices: true },
  });

  return NextResponse.json({ user: updated });
}
