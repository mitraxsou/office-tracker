import { prisma } from "./db";
import { logAuditEvent } from "./audit-log";
import { createManualVisit } from "./heartbeat-service";
import { allDayKeysInMonth, parseMonthKey, shiftMonth } from "./month-range";
import { isValidMonthKey, monthKeyFromDayKey } from "./compliance-exemptions";
import { datetimeInTimezone } from "./timezone-dates";
import { monthKeyInTimezone } from "./monthly-progress";

export const PRIOR_COMPLIANCE_STATUSES = ["open", "approved", "rejected"] as const;
export type PriorComplianceStatus = (typeof PRIOR_COMPLIANCE_STATUSES)[number];

export const PRIOR_COMPLIANCE_SOURCES = ["onboarding", "settings"] as const;
export type PriorComplianceSource = (typeof PRIOR_COMPLIANCE_SOURCES)[number];

const CHECK_IN_TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export type PriorComplianceMonthInput = {
  monthKey: string;
  typicalCheckInTime: string;
  qualifyingDaysCount?: number;
};

export type PriorComplianceDeclarationSummary = {
  id: string;
  monthKey: string;
  typicalCheckInTime: string;
  qualifyingDaysCount: number;
  message: string | null;
  status: string;
  source: string;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function parseCheckInTime(value: string): { hour: number; minute: number } | null {
  const match = CHECK_IN_TIME_RE.exec(value.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function eligiblePriorComplianceMonths(params: {
  pilotStartMonthKey: string;
  currentMonthKey: string;
  joinedMonthKey: string;
}): string[] {
  const months: string[] = [];
  let cursor = params.pilotStartMonthKey;
  const lastCompleteMonth = shiftMonth(params.currentMonthKey, -1);

  while (cursor <= lastCompleteMonth) {
    if (cursor < params.joinedMonthKey) {
      months.push(cursor);
    }
    cursor = shiftMonth(cursor, 1);
  }

  return months;
}

export function isWeekdayDayKey(dayKey: string): boolean {
  const { year, month } = parseMonthKey(monthKeyFromDayKey(dayKey));
  const day = Number(dayKey.slice(8, 10));
  const dow = new Date(year, month - 1, day).getDay();
  return dow >= 1 && dow <= 5;
}

export function pickBackfillDayKeys(monthKey: string, count: number): string[] {
  const weekdays = allDayKeysInMonth(monthKey).filter(isWeekdayDayKey);
  if (count <= 0) return [];
  if (count >= weekdays.length) return weekdays;

  const selected: string[] = [];
  const step = weekdays.length / count;
  for (let i = 0; i < count; i++) {
    const index = Math.min(weekdays.length - 1, Math.floor(i * step));
    const dayKey = weekdays[index]!;
    if (!selected.includes(dayKey)) {
      selected.push(dayKey);
    }
  }

  if (selected.length < count) {
    for (const dayKey of weekdays) {
      if (selected.length >= count) break;
      if (!selected.includes(dayKey)) selected.push(dayKey);
    }
  }

  return selected.slice(0, count);
}

export function validatePriorComplianceMonthInput(
  input: PriorComplianceMonthInput,
  monthlyDaysTarget: number,
): string | null {
  if (!isValidMonthKey(input.monthKey)) {
    return `Invalid month ${input.monthKey}`;
  }
  if (!parseCheckInTime(input.typicalCheckInTime)) {
    return "Typical check-in time must be HH:MM (24-hour)";
  }
  const count = input.qualifyingDaysCount ?? monthlyDaysTarget;
  if (!Number.isInteger(count) || count < 1 || count > monthlyDaysTarget) {
    return `Qualifying days must be between 1 and ${monthlyDaysTarget}`;
  }
  return null;
}

export function validatePriorComplianceSubmission(params: {
  months: PriorComplianceMonthInput[];
  eligibleMonthKeys: string[];
  monthlyDaysTarget: number;
}): string | null {
  if (params.months.length === 0) return null;

  const eligible = new Set(params.eligibleMonthKeys);
  const seen = new Set<string>();

  for (const month of params.months) {
    const fieldError = validatePriorComplianceMonthInput(month, params.monthlyDaysTarget);
    if (fieldError) return fieldError;
    if (!eligible.has(month.monthKey)) {
      return `Month ${month.monthKey} is not eligible for prior compliance`;
    }
    if (seen.has(month.monthKey)) {
      return `Duplicate month ${month.monthKey}`;
    }
    seen.add(month.monthKey);
  }

  return null;
}

export function serializePriorComplianceDeclaration(row: {
  id: string;
  monthKey: string;
  typicalCheckInTime: string;
  qualifyingDaysCount: number;
  message: string | null;
  status: string;
  source: string;
  adminNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}): PriorComplianceDeclarationSummary {
  return {
    id: row.id,
    monthKey: row.monthKey,
    typicalCheckInTime: row.typicalCheckInTime,
    qualifyingDaysCount: row.qualifyingDaysCount,
    message: row.message,
    status: row.status,
    source: row.source,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

export async function getPendingPriorComplianceMonthKeys(userId: string): Promise<string[]> {
  const rows = await prisma.priorComplianceDeclaration.findMany({
    where: { userId, status: "open" },
    select: { monthKey: true },
  });
  return rows.map((row) => row.monthKey);
}

export async function getUserPriorComplianceState(userId: string) {
  const rows = await prisma.priorComplianceDeclaration.findMany({
    where: { userId },
    orderBy: [{ monthKey: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const byMonth = new Map<string, PriorComplianceDeclarationSummary>();
  for (const row of rows) {
    if (!byMonth.has(row.monthKey)) {
      byMonth.set(row.monthKey, serializePriorComplianceDeclaration(row));
    }
  }

  return {
    declarations: [...byMonth.values()],
    openRequests: rows
      .filter((row) => row.status === "open")
      .map(serializePriorComplianceDeclaration),
  };
}

export async function needsPriorComplianceOnboarding(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { priorComplianceOnboardingAt: true, createdAt: true, timezone: true },
  });
  if (!user || user.priorComplianceOnboardingAt) return false;

  const { getAppConfig } = await import("./app-config");
  const config = await getAppConfig();
  const currentMonthKey = monthKeyInTimezone(new Date(), user.timezone);
  const joinedMonthKey = monthKeyInTimezone(user.createdAt, user.timezone);
  const eligible = eligiblePriorComplianceMonths({
    pilotStartMonthKey: config.pilotStartMonthKey,
    currentMonthKey,
    joinedMonthKey,
  });

  return eligible.length > 0;
}

export async function completePriorComplianceOnboarding(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { priorComplianceOnboardingAt: new Date() },
  });
}

async function hasConflictingDeclaration(userId: string, monthKey: string) {
  const [open, approved] = await Promise.all([
    prisma.priorComplianceDeclaration.findFirst({
      where: { userId, monthKey, status: "open" },
      select: { id: true },
    }),
    prisma.priorComplianceDeclaration.findFirst({
      where: { userId, monthKey, status: "approved" },
      select: { id: true },
    }),
  ]);
  return { hasOpen: !!open, hasApproved: !!approved };
}

export async function submitPriorComplianceDeclarations(params: {
  userId: string;
  timezone: string;
  months: PriorComplianceMonthInput[];
  message?: string | null;
  source: PriorComplianceSource;
  monthlyDaysTarget: number;
  pilotStartMonthKey: string;
  markOnboardingComplete?: boolean;
}) {
  const currentMonthKey = monthKeyInTimezone(new Date(), params.timezone);
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { createdAt: true },
  });
  if (!user) {
    return { error: "User not found", status: 404 } as const;
  }

  const joinedMonthKey = monthKeyInTimezone(user.createdAt, params.timezone);
  const eligibleMonthKeys = eligiblePriorComplianceMonths({
    pilotStartMonthKey: params.pilotStartMonthKey,
    currentMonthKey,
    joinedMonthKey,
  });

  const validationError = validatePriorComplianceSubmission({
    months: params.months,
    eligibleMonthKeys,
    monthlyDaysTarget: params.monthlyDaysTarget,
  });
  if (validationError) {
    return { error: validationError, status: 400 } as const;
  }

  for (const month of params.months) {
    const conflict = await hasConflictingDeclaration(params.userId, month.monthKey);
    if (conflict.hasOpen) {
      return {
        error: `You already have a pending declaration for ${month.monthKey}`,
        status: 409,
      } as const;
    }
    if (conflict.hasApproved) {
      return {
        error: `Prior compliance for ${month.monthKey} is already approved. Contact admin to change it.`,
        status: 409,
      } as const;
    }
  }

  const sharedMessage = params.message?.trim().slice(0, 500) || null;
  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const month of params.months) {
      const row = await tx.priorComplianceDeclaration.create({
        data: {
          userId: params.userId,
          monthKey: month.monthKey,
          typicalCheckInTime: month.typicalCheckInTime.trim(),
          qualifyingDaysCount: month.qualifyingDaysCount ?? params.monthlyDaysTarget,
          message: sharedMessage,
          source: params.source,
          status: "open",
        },
      });
      rows.push(row);
    }

    if (params.markOnboardingComplete || params.months.length === 0) {
      await tx.user.update({
        where: { id: params.userId },
        data: { priorComplianceOnboardingAt: new Date() },
      });
    }

    return rows;
  });

  for (const row of created) {
    await logAuditEvent({
      actorId: params.userId,
      action: "prior_compliance_request",
      targetUserId: params.userId,
      details: {
        requestId: row.id,
        monthKey: row.monthKey,
        source: params.source,
      },
    });
  }

  return {
    declarations: created.map(serializePriorComplianceDeclaration),
  } as const;
}

export async function createBackfillVisitsForDeclaration(params: {
  userId: string;
  timezone: string;
  monthKey: string;
  typicalCheckInTime: string;
  qualifyingDaysCount: number;
  hoursTarget: number;
}) {
  const checkIn = parseCheckInTime(params.typicalCheckInTime);
  if (!checkIn) {
    throw new Error("Invalid check-in time");
  }

  const dayKeys = pickBackfillDayKeys(params.monthKey, params.qualifyingDaysCount);
  const durationMs = params.hoursTarget * 60 * 60 * 1000;

  for (const dayKey of dayKeys) {
    const startAt = datetimeInTimezone(
      dayKey,
      checkIn.hour,
      checkIn.minute,
      params.timezone,
    );
    const endAt = new Date(startAt.getTime() + durationMs);
    await createManualVisit({
      userId: params.userId,
      startAt,
      endAt,
      ssid: "Prior compliance backfill",
    });
  }

  return dayKeys.length;
}

export async function resolvePriorComplianceDeclaration(params: {
  adminId: string;
  requestId: string;
  status: "approved" | "rejected";
  adminNote?: string | null;
}) {
  const existing = await prisma.priorComplianceDeclaration.findUnique({
    where: { id: params.requestId },
    include: { user: { select: { id: true, timezone: true, hoursTarget: true } } },
  });
  if (!existing) {
    return { error: "Request not found", status: 404 } as const;
  }
  if (existing.status !== "open") {
    return { error: "Request is already resolved", status: 400 } as const;
  }

  const adminNote =
    params.adminNote !== undefined && params.adminNote !== null
      ? params.adminNote.trim().slice(0, 2000) || null
      : null;

  if (params.status === "approved") {
    const { getUserHoursTarget } = await import("./app-config");
    const hoursTarget = await getUserHoursTarget(existing.user);
    await createBackfillVisitsForDeclaration({
      userId: existing.userId,
      timezone: existing.user.timezone,
      monthKey: existing.monthKey,
      typicalCheckInTime: existing.typicalCheckInTime,
      qualifyingDaysCount: existing.qualifyingDaysCount,
      hoursTarget,
    });
  }

  const updated = await prisma.priorComplianceDeclaration.update({
    where: { id: existing.id },
    data: {
      status: params.status,
      adminNote,
      reviewedAt: new Date(),
      reviewedById: params.adminId,
    },
  });

  await logAuditEvent({
    actorId: params.adminId,
    action: params.status === "approved" ? "prior_compliance_approve" : "prior_compliance_reject",
    targetUserId: existing.userId,
    details: {
      requestId: updated.id,
      monthKey: existing.monthKey,
      adminNote,
    },
  });

  return { declaration: serializePriorComplianceDeclaration(updated) } as const;
}

export async function cancelPriorComplianceDeclaration(userId: string, requestId: string) {
  const existing = await prisma.priorComplianceDeclaration.findFirst({
    where: { id: requestId, userId },
  });
  if (!existing) {
    return { error: "Request not found", status: 404 } as const;
  }
  if (existing.status !== "open") {
    return { error: "Only open requests can be cancelled", status: 400 } as const;
  }

  await prisma.priorComplianceDeclaration.delete({ where: { id: existing.id } });

  await logAuditEvent({
    actorId: userId,
    action: "prior_compliance_cancel",
    targetUserId: userId,
    details: {
      requestId: existing.id,
      monthKey: existing.monthKey,
    },
  });

  return { ok: true } as const;
}
