import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminDayDetail } from "@/lib/admin-reports";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const date = new URL(request.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date query param required (YYYY-MM-DD)" }, { status: 400 });
  }

  const detail = await getAdminDayDetail(date);
  return NextResponse.json(detail);
}
