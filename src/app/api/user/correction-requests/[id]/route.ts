import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";
import {
  parseCorrectionSummary,
  parseVisitSnapshot,
  serializeThreadMessage,
} from "@/lib/visit-corrections";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const request = await prisma.visitCorrectionRequest.findUnique({
    where: { id },
    include: {
      visit: { select: { id: true, startAt: true, endAt: true, source: true, ssid: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { email: true, name: true } } },
      },
    },
  });

  if (!request || request.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    request: {
      id: request.id,
      status: request.status,
      message: request.message,
      issueType: request.issueType,
      adminNote: request.adminNote,
      visitSnapshot: parseVisitSnapshot(request.visitSnapshot),
      correctionSummary: parseCorrectionSummary(request.correctionSummary),
      createdAt: request.createdAt.toISOString(),
      resolvedAt: request.resolvedAt?.toISOString() ?? null,
      visit: request.visit
        ? {
            id: request.visit.id,
            startAt: request.visit.startAt.toISOString(),
            endAt: request.visit.endAt?.toISOString() ?? null,
            source: request.visit.source,
            ssid: request.visit.ssid,
          }
        : null,
      messages: request.messages.map(serializeThreadMessage),
      timezone: user.timezone,
    },
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.visitCorrectionRequest.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== "open") {
    return NextResponse.json({ error: "This request is closed" }, { status: 400 });
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
      authorId: user.id,
      authorRole: "user",
      body: text,
    },
    include: { author: { select: { email: true, name: true } } },
  });

  await logAuditEvent({
    actorId: user.id,
    action: "visit_correction_reply",
    targetUserId: user.id,
    details: { requestId: id, role: "user" },
  });

  return NextResponse.json({ message: serializeThreadMessage(message) }, { status: 201 });
}
