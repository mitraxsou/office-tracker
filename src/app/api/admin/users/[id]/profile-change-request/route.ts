import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import {
  createProfileChangeRequest,
  getProfileChangeBlockReason,
} from "@/lib/profile-change-requests";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const blockReason = getProfileChangeBlockReason(target.email);
  if (blockReason) {
    return NextResponse.json({ error: blockReason }, { status: 403 });
  }

  let body: { requestedName?: string; requestedEmail?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await createProfileChangeRequest({
    userId: target.id,
    currentName: target.name,
    currentEmail: target.email,
    requestedName: body.requestedName,
    requestedEmail: body.requestedEmail,
    message: body.message,
    actorId: admin.id,
    auditAction: "profile_change_request_admin",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ request: result.request }, { status: 201 });
}
