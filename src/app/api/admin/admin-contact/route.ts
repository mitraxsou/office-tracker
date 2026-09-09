import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { serializeAdminContactSubmission } from "@/lib/admin-contact";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const submissions = await prisma.adminContactSubmission.findMany({
    where: status === "all" ? undefined : { status },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, email: true, name: true } },
      reviewedBy: { select: { email: true } },
    },
  });

  return NextResponse.json({
    submissions: submissions.map((row) => ({
      ...serializeAdminContactSubmission(row),
      user: row.user,
      reviewedByEmail: row.reviewedBy?.email ?? null,
    })),
  });
}
