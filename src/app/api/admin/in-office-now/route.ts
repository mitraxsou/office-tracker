import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getInOfficeNowUsers } from "@/lib/admin-reports";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getInOfficeNowUsers();
  return NextResponse.json(data);
}
