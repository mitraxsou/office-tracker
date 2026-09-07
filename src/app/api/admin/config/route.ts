import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAppConfig, updateAppConfig } from "@/lib/app-config";
import { validateMonthlyDaysTarget } from "@/lib/monthly-progress";
import { isValidMonthKey } from "@/lib/compliance-exemptions";
import { validateSsids } from "@/lib/security";
import { normalizeSsid, officeSsidAllowlistChanged } from "@/lib/constants";
import { logAuditEvent } from "@/lib/audit-log";
import { isRegistrationEnvLocked } from "@/lib/auth";
import { backfillHeartbeatsAndVisitsAfterAllowlistChange } from "@/lib/ssid-backfill";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getAppConfig();
  return NextResponse.json({
    config,
    registrationEnvLocked: isRegistrationEnvLocked(),
  });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    hoursTarget?: number;
    monthlyDaysTarget?: number;
    officeSsids?: string[];
    maxDevicesPerUser?: number;
    allowRegistration?: boolean;
    allowOtpSelfRegistration?: boolean;
    pendingTokenTtlDays?: number;
    heartbeatRetentionDays?: number;
    agentStaleMinutes?: number;
    agentStaleGraceHours?: number;
    complianceExemptionRequiresApproval?: boolean;
    pilotStartMonthKey?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prevConfig = await getAppConfig();

  const update: Parameters<typeof updateAppConfig>[0] = {};

  if (body.hoursTarget !== undefined) {
    if (typeof body.hoursTarget !== "number" || body.hoursTarget <= 0 || body.hoursTarget > 24) {
      return NextResponse.json({ error: "Invalid hoursTarget" }, { status: 400 });
    }
    update.hoursTarget = body.hoursTarget;
  }

  if (body.monthlyDaysTarget !== undefined) {
    const validated = validateMonthlyDaysTarget(body.monthlyDaysTarget);
    if (validated === null) {
      return NextResponse.json({ error: "Invalid monthlyDaysTarget" }, { status: 400 });
    }
    update.monthlyDaysTarget = validated;
  }

  if (body.officeSsids !== undefined) {
    const normalized = validateSsids(body.officeSsids.map(normalizeSsid));
    if (!normalized) {
      return NextResponse.json({ error: "Invalid SSID list" }, { status: 400 });
    }
    update.officeSsids = normalized;
  }

  if (body.maxDevicesPerUser !== undefined) {
    if (body.maxDevicesPerUser < 1 || body.maxDevicesPerUser > 50) {
      return NextResponse.json({ error: "Invalid maxDevicesPerUser" }, { status: 400 });
    }
    update.maxDevicesPerUser = body.maxDevicesPerUser;
  }

  if (body.allowRegistration !== undefined) {
    if (typeof body.allowRegistration !== "boolean") {
      return NextResponse.json({ error: "Invalid allowRegistration" }, { status: 400 });
    }
    if (body.allowRegistration && isRegistrationEnvLocked()) {
      return NextResponse.json(
        { error: "Registration is locked off by ALLOW_REGISTRATION=false in environment" },
        { status: 403 }
      );
    }
    update.allowRegistration = body.allowRegistration;
  }

  if (body.allowOtpSelfRegistration !== undefined) {
    if (typeof body.allowOtpSelfRegistration !== "boolean") {
      return NextResponse.json({ error: "Invalid allowOtpSelfRegistration" }, { status: 400 });
    }
    update.allowOtpSelfRegistration = body.allowOtpSelfRegistration;
  }

  if (body.pendingTokenTtlDays !== undefined) {
    if (body.pendingTokenTtlDays < 1 || body.pendingTokenTtlDays > 90) {
      return NextResponse.json({ error: "pendingTokenTtlDays must be 1–90" }, { status: 400 });
    }
    update.pendingTokenTtlDays = body.pendingTokenTtlDays;
  }

  if (body.heartbeatRetentionDays !== undefined) {
    if (body.heartbeatRetentionDays < 1 || body.heartbeatRetentionDays > 30) {
      return NextResponse.json({ error: "heartbeatRetentionDays must be 1–30" }, { status: 400 });
    }
    update.heartbeatRetentionDays = body.heartbeatRetentionDays;
  }

  if (body.agentStaleMinutes !== undefined) {
    if (body.agentStaleMinutes < 2 || body.agentStaleMinutes > 60) {
      return NextResponse.json({ error: "agentStaleMinutes must be 2-60" }, { status: 400 });
    }
    update.agentStaleMinutes = body.agentStaleMinutes;
  }

  if (body.agentStaleGraceHours !== undefined) {
    if (body.agentStaleGraceHours < 1 || body.agentStaleGraceHours > 168) {
      return NextResponse.json({ error: "agentStaleGraceHours must be 1-168" }, { status: 400 });
    }
    update.agentStaleGraceHours = body.agentStaleGraceHours;
  }

  if (body.complianceExemptionRequiresApproval !== undefined) {
    if (typeof body.complianceExemptionRequiresApproval !== "boolean") {
      return NextResponse.json({ error: "Invalid complianceExemptionRequiresApproval" }, { status: 400 });
    }
    update.complianceExemptionRequiresApproval = body.complianceExemptionRequiresApproval;
  }

  if (body.pilotStartMonthKey !== undefined) {
    if (!isValidMonthKey(body.pilotStartMonthKey)) {
      return NextResponse.json({ error: "Invalid pilotStartMonthKey (expected YYYY-MM)" }, { status: 400 });
    }
    update.pilotStartMonthKey = body.pilotStartMonthKey;
  }

  const config = await updateAppConfig(update);

  let backfill: Awaited<ReturnType<typeof backfillHeartbeatsAndVisitsAfterAllowlistChange>> | null =
    null;
  if (
    update.officeSsids !== undefined &&
    officeSsidAllowlistChanged(prevConfig.officeSsids, update.officeSsids)
  ) {
    backfill = await backfillHeartbeatsAndVisitsAfterAllowlistChange(config.officeSsids);
  }

  await logAuditEvent({
    actorId: admin.id,
    action: "config_update",
    details: { ...update, backfill } as Record<string, unknown>,
  });

  return NextResponse.json({ config, backfill });
}
