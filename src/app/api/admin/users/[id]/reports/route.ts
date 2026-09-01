import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getUserReport } from "@/lib/user-reports";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const days = Math.min(90, Math.max(1, Number(searchParams.get("days") ?? "7")));
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  const report = await getUserReport(id, from, to);
  if (!report) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ...report, range: { from: from.toISOString(), to: to.toISOString(), days } });
}
