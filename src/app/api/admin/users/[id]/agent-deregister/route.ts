import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { deregisterUserAgent } from "@/lib/agent-deregister";
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

  const result = await deregisterUserAgent(id, admin.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    alreadyDeregistered: result.alreadyDeregistered ?? false,
    deviceCount: result.deviceCount ?? 0,
    revokedTokenCount: result.revokedTokenCount ?? 0,
  });
}
