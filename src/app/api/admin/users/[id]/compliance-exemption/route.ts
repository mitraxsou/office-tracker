import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import {
  grantComplianceExemptionDirectly,
  isValidComplianceExemptionType,
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, timezone: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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

  const currentMonthKey = monthKeyInTimezone(new Date(), targetUser.timezone);
  const currentDayKeyValue = currentDayKey(targetUser.timezone);

  const result = await grantComplianceExemptionDirectly({
    adminId: admin.id,
    userId: targetUser.id,
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
