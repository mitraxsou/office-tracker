import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canUserReportVisit } from "@/lib/visit-actions";
import { logAuditEvent } from "@/lib/audit-log";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { visitId?: string; message?: string; issueType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message || message.length < 5) {
    return NextResponse.json({ error: "message is required (at least 5 characters)" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "message is too long" }, { status: 400 });
  }

  if (body.visitId) {
    const visit = await prisma.visit.findUnique({ where: { id: body.visitId } });
    if (!visit) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }
    if (!canUserReportVisit(visit, userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const issueType = body.issueType?.trim().slice(0, 64) || null;

  const report = await prisma.visitCorrectionRequest.create({
    data: {
      userId,
      visitId: body.visitId ?? null,
      message,
      issueType,
    },
  });

  await logAuditEvent({
    actorId: userId,
    action: "visit_correction_request",
    targetUserId: userId,
    details: { reportId: report.id, visitId: body.visitId ?? null, issueType },
  });

  return NextResponse.json({ report: { id: report.id } }, { status: 201 });
}
