import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  cancelComplianceExemptionRequest,
  getUserComplianceExemptionState,
  isValidComplianceExemptionType,
  submitUserComplianceExemptionRequest,
} from "@/lib/compliance-exemptions";
import { monthKeyInTimezone } from "@/lib/monthly-progress";

function currentDayKey(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getUserComplianceExemptionState(user.id);
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type?: string; monthKey?: string; dayKey?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.type || !isValidComplianceExemptionType(body.type)) {
    return NextResponse.json({ error: "type must be month or day" }, { status: 400 });
  }

  const currentMonthKey = monthKeyInTimezone(new Date(), user.timezone);
  const currentDayKeyValue = currentDayKey(user.timezone);

  const result = await submitUserComplianceExemptionRequest({
    userId: user.id,
    type: body.type,
    monthKey: body.monthKey,
    dayKey: body.dayKey,
    message: body.message,
    currentMonthKey,
    currentDayKey: currentDayKeyValue,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ request: result.request }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const result = await cancelComplianceExemptionRequest(user.id, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
