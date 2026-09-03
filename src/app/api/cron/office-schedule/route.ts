import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { syncOfficeSchedulesFromHistory } from "@/lib/office-schedule-sync";

export async function GET(request: Request) {
  const auth = authorizeCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await syncOfficeSchedulesFromHistory();
  return NextResponse.json({ ok: true, ...result });
}
