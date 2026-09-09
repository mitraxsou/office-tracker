import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppConfig } from "@/lib/app-config";
import { monthKeyInTimezone } from "@/lib/monthly-progress";
import {
  cancelPriorComplianceDeclaration,
  completePriorComplianceOnboarding,
  eligiblePriorComplianceMonths,
  getUserPriorComplianceState,
  submitPriorComplianceDeclarations,
  type PriorComplianceMonthInput,
} from "@/lib/prior-compliance";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getAppConfig();
  const currentMonthKey = monthKeyInTimezone(new Date(), user.timezone);
  const joinedMonthKey = monthKeyInTimezone(user.createdAt, user.timezone);
  const eligibleMonthKeys = eligiblePriorComplianceMonths({
    pilotStartMonthKey: config.pilotStartMonthKey,
    currentMonthKey,
    joinedMonthKey,
  });

  const state = await getUserPriorComplianceState(user.id);

  return NextResponse.json({
    eligibleMonthKeys,
    monthlyDaysTarget: config.monthlyDaysTarget,
    pilotStartMonthKey: config.pilotStartMonthKey,
    needsOnboarding: !user.priorComplianceOnboardingAt && eligibleMonthKeys.length > 0,
    ...state,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    months?: PriorComplianceMonthInput[];
    message?: string;
    source?: "onboarding" | "settings";
    skip?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const config = await getAppConfig();

  if (body.skip) {
    await completePriorComplianceOnboarding(user.id);
    return NextResponse.json({ ok: true, skipped: true });
  }

  const months = body.months ?? [];
  const source = body.source === "settings" ? "settings" : "onboarding";
  const markOnboardingComplete = source === "onboarding";

  const result = await submitPriorComplianceDeclarations({
    userId: user.id,
    timezone: user.timezone,
    months,
    message: body.message,
    source,
    monthlyDaysTarget: config.monthlyDaysTarget,
    pilotStartMonthKey: config.pilotStartMonthKey,
    markOnboardingComplete,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const result = await cancelPriorComplianceDeclaration(user.id, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
