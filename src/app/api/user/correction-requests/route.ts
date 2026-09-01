import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  parseCorrectionSummary,
  parseVisitSnapshot,
  serializeThreadMessage,
} from "@/lib/visit-corrections";

function serializeRequest(
  r: {
    id: string;
    status: string;
    message: string;
    issueType: string | null;
    adminNote: string | null;
    visitSnapshot: string | null;
    correctionSummary: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
    visit: {
      id: string;
      startAt: Date;
      endAt: Date | null;
      source: string;
      ssid: string | null;
    } | null;
    messages: Array<{
      id: string;
      authorRole: string;
      body: string;
      createdAt: Date;
      author: { email: string; name: string | null };
    }>;
  },
  timezone: string,
) {
  return {
    id: r.id,
    status: r.status,
    message: r.message,
    issueType: r.issueType,
    adminNote: r.adminNote,
    visitSnapshot: parseVisitSnapshot(r.visitSnapshot),
    correctionSummary: parseCorrectionSummary(r.correctionSummary),
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    visit: r.visit
      ? {
          id: r.visit.id,
          startAt: r.visit.startAt.toISOString(),
          endAt: r.visit.endAt?.toISOString() ?? null,
          source: r.visit.source,
          ssid: r.visit.ssid,
        }
      : null,
    messages: r.messages.map(serializeThreadMessage),
    timezone,
  };
}

const requestInclude = {
  visit: { select: { id: true, startAt: true, endAt: true, source: true, ssid: true } },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { email: true, name: true } } },
  },
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await prisma.visitCorrectionRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: requestInclude,
  });

  const openCount = requests.filter((r) => r.status === "open").length;

  return NextResponse.json({
    requests: requests.map((r) => serializeRequest(r, user.timezone)),
    openCount,
  });
}
