import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";
import {
  buildCorrectionSummary,
  isValidCorrectionStatus,
  parseVisitSnapshot,
  serializeThreadMessage,
  visitToSnapshot,
  type VisitSnapshot,
} from "@/lib/visit-corrections";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.visitCorrectionRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  let body: { body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.body?.trim();
  if (!text || text.length < 2) {
    return NextResponse.json({ error: "Reply must be at least 2 characters" }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "Reply is too long" }, { status: 400 });
  }

  const message = await prisma.visitCorrectionMessage.create({
    data: {
      requestId: id,
      authorId: admin.id,
      authorRole: "admin",
      body: text,
    },
    include: { author: { select: { email: true, name: true } } },
  });

  await logAuditEvent({
    actorId: admin.id,
    action: "visit_correction_reply",
    targetUserId: existing.user.id,
    details: { requestId: id, role: "admin" },
  });

  return NextResponse.json({ message: serializeThreadMessage(message) }, { status: 201 });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: {
    status?: string;
    adminNote?: string;
    correctionSummary?: {
      before?: Partial<VisitSnapshot>;
      after?: Partial<VisitSnapshot>;
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.visitCorrectionRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true } },
      visit: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const status = body.status ?? "resolved";
  if (!isValidCorrectionStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const adminNote = body.adminNote?.trim().slice(0, 2000) ?? null;
  if (status === "resolved" && (!adminNote || adminNote.length < 5)) {
    return NextResponse.json(
      { error: "Resolution note is required (at least 5 characters explaining what changed)" },
      { status: 400 },
    );
  }

  let correctionSummaryJson: string | null | undefined = undefined;
  if (status === "resolved") {
    const before =
      (body.correctionSummary?.before as VisitSnapshot | undefined) ??
      parseVisitSnapshot(existing.visitSnapshot);
    let after = (body.correctionSummary?.after as VisitSnapshot | undefined) ?? null;
    if (!after && existing.visit) {
      after = visitToSnapshot(existing.visit);
    }
    const summary = buildCorrectionSummary({
      visitId: existing.visitId,
      before,
      after,
    });
    correctionSummaryJson = summary ? JSON.stringify(summary) : null;
  } else if (status === "open") {
    correctionSummaryJson = null;
  }

  const report = await prisma.$transaction(async (tx) => {
    const updated = await tx.visitCorrectionRequest.update({
      where: { id },
      data: {
        status,
        adminNote: adminNote ?? undefined,
        correctionSummary: correctionSummaryJson,
        resolvedAt: status === "resolved" || status === "closed" ? new Date() : null,
        resolvedById: status === "resolved" || status === "closed" ? admin.id : null,
      },
    });

    if (status === "resolved" && adminNote) {
      await tx.visitCorrectionMessage.create({
        data: {
          requestId: id,
          authorId: admin.id,
          authorRole: "admin",
          body: adminNote,
        },
      });
    }

    return updated;
  });

  if (status === "resolved") {
    await logAuditEvent({
      actorId: admin.id,
      action: "visit_report_resolve",
      targetUserId: existing.user.id,
      details: {
        reportId: report.id,
        visitId: existing.visitId,
        adminNote,
        correctionSummary: correctionSummaryJson,
      },
    });
  }

  return NextResponse.json({
    report: {
      id: report.id,
      status: report.status,
      adminNote: report.adminNote,
      correctionSummary: report.correctionSummary,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
    },
  });
}
