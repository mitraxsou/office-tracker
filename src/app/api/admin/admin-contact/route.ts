import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listAdminContactThreads } from "@/lib/admin-contact-server";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const threads = await listAdminContactThreads({ status, limit });
  return NextResponse.json({ threads, submissions: threads });
}
