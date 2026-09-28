import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  isValidAccountAccessStatus,
  listAccountAccessRequests,
  type AccountAccessStatus,
} from "@/lib/account-access-requests";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const statusParam = new URL(request.url).searchParams.get("status") ?? "open";
  const status: AccountAccessStatus | "all" =
    statusParam === "all"
      ? "all"
      : isValidAccountAccessStatus(statusParam)
        ? statusParam
        : "open";

  const rows = await listAccountAccessRequests(status);
  return NextResponse.json({
    requests: rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      message: row.message,
      status: row.status,
      adminNote: row.adminNote,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewedBy: row.reviewedBy
        ? { id: row.reviewedBy.id, email: row.reviewedBy.email, name: row.reviewedBy.name }
        : null,
      createdUserId: row.createdUserId,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
