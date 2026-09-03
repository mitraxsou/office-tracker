import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { isCronJobName, runCronJob } from "@/lib/cron-jobs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ job: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { job } = await params;
  if (!isCronJobName(job)) {
    return NextResponse.json({ error: "Unknown cron job" }, { status: 404 });
  }

  try {
    const result = await runCronJob(job, "manual");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron job failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
