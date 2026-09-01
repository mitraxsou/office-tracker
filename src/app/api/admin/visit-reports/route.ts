import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const reports = await prisma.visitCorrectionRequest.findMany({
    where: status === "all" ? undefined : { status },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, email: true, name: true } },
      visit: { select: { id: true, startAt: true, endAt: true, source: true, ssid: true } },
      resolvedBy: { select: { email: true } },
    },
  });

  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      issueType: r.issueType,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      user: r.user,
      visit: r.visit
        ? {
            id: r.visit.id,
            startAt: r.visit.startAt.toISOString(),
            endAt: r.visit.endAt?.toISOString() ?? null,
            source: r.visit.source,
            ssid: r.visit.ssid,
          }
        : null,
      resolvedByEmail: r.resolvedBy?.email ?? null,
    })),
  });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id?: string; status?: string; adminNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.visitCorrectionRequest.findUnique({
    where: { id: body.id },
    include: { user: { select: { id: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const status = body.status ?? "resolved";
  if (status !== "open" && status !== "resolved") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const adminNote = body.adminNote !== undefined ? body.adminNote.trim().slice(0, 2000) || null : undefined;

  const report = await prisma.visitCorrectionRequest.update({
    where: { id: body.id },
    data: {
      status,
      adminNote,
      resolvedAt: status === "resolved" ? new Date() : null,
      resolvedById: status === "resolved" ? admin.id : null,
    },
  });

  if (status === "resolved") {
    await logAuditEvent({
      actorId: admin.id,
      action: "visit_report_resolve",
      targetUserId: existing.user.id,
      details: { reportId: report.id, visitId: existing.visitId, adminNote: adminNote ?? null },
    });
  }

  return NextResponse.json({
    report: {
      id: report.id,
      status: report.status,
      adminNote: report.adminNote,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
    },
  });
}
