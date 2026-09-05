import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminOrgCalendarDays } from "@/lib/admin-reports";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const monthParam = params.get("month");
  const timezone = params.get("timezone") ?? "Asia/Kolkata";

  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json({ error: "month query param required (YYYY-MM)" }, { status: 400 });
  }

  const calendar = await getAdminOrgCalendarDays(monthParam, timezone);
  return NextResponse.json(calendar);
}
