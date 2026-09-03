import { NextResponse } from "next/server";
import { authorizeCronRequest } from "./cron-auth";
import { runCronJob, type CronJobName } from "./cron-jobs";

export async function runScheduledCron(request: Request, jobName: CronJobName) {
  const auth = authorizeCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await runCronJob(jobName, "schedule");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron job failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
