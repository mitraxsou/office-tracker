import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { serializePriorComplianceDeclaration } from "@/lib/prior-compliance";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  const where =
    status === "all"
      ? {}
      : { status: status === "open" ? "open" : status };

  const requests = await prisma.priorComplianceDeclaration.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, email: true, name: true, timezone: true } },
      reviewedBy: { select: { email: true } },
    },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      ...serializePriorComplianceDeclaration(r),
      user: r.user,
      reviewedByEmail: r.reviewedBy?.email ?? null,
    })),
  });
}
