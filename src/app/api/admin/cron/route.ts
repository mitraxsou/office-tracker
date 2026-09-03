import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listCronJobs } from "@/lib/cron-jobs";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ jobs: await listCronJobs() });
}
