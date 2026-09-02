import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { serializeProfileChangeRequest } from "@/lib/profile-change-requests";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const requests = await prisma.profileChangeRequest.findMany({
    where: status === "all" ? undefined : { status },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, email: true, name: true } },
      reviewedBy: { select: { email: true } },
    },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      ...serializeProfileChangeRequest(r),
      user: r.user,
      reviewedByEmail: r.reviewedBy?.email ?? null,
    })),
  });
}
