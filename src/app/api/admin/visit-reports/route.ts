import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import {
  parseCorrectionSummary,
  parseVisitSnapshot,
  serializeThreadMessage,
} from "@/lib/visit-corrections";

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
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { email: true, name: true } } },
      },
    },
  });

  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      issueType: r.issueType,
      adminNote: r.adminNote,
      visitSnapshot: parseVisitSnapshot(r.visitSnapshot),
      correctionSummary: parseCorrectionSummary(r.correctionSummary),
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
      messages: r.messages.map(serializeThreadMessage),
    })),
  });
}
