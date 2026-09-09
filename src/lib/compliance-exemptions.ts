import { prisma } from "./db";
import { logAuditEvent } from "./audit-log";
import { getAppConfig } from "./app-config";

export const COMPLIANCE_EXEMPTION_STATUSES = ["open", "approved", "rejected"] as const;
export type ComplianceExemptionStatus = (typeof COMPLIANCE_EXEMPTION_STATUSES)[number];

export const COMPLIANCE_EXEMPTION_TYPES = ["month", "day"] as const;
export type ComplianceExemptionType = (typeof COMPLIANCE_EXEMPTION_TYPES)[number];

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidComplianceExemptionStatus(
  value: string,
): value is ComplianceExemptionStatus {
  return (COMPLIANCE_EXEMPTION_STATUSES as readonly string[]).includes(value);
}

export function isValidComplianceExemptionType(value: string): value is ComplianceExemptionType {
  return (COMPLIANCE_EXEMPTION_TYPES as readonly string[]).includes(value);
}

export function isValidMonthKey(value: string): boolean {
  if (!MONTH_KEY_RE.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

export function isValidDayKey(value: string): boolean {
  if (!DAY_KEY_RE.test(value)) return false;
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return date.toISOString().slice(0, 10) === value;
}

export function monthKeyFromDayKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export type ApprovedExemptions = {
  monthKeys: string[];
  dayKeys: string[];
};

export type ComplianceExemptionSummary = {
  id: string;
  type: ComplianceExemptionType;
  monthKey: string | null;
  dayKey: string | null;
  message: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function serializeComplianceExemptionRequest(request: {
  id: string;
  type: string;
  monthKey: string | null;
  dayKey: string | null;
  message: string | null;
  status: string;
  adminNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}): ComplianceExemptionSummary {
  return {
    id: request.id,
    type: request.type as ComplianceExemptionType,
    monthKey: request.monthKey,
    dayKey: request.dayKey,
    message: request.message,
    status: request.status,
    adminNote: request.adminNote,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  };
}

export function validateComplianceExemptionSubmission(params: {
  type: ComplianceExemptionType;
  monthKey?: string | null;
  dayKey?: string | null;
  currentMonthKey: string;
  currentDayKey: string;
  hasOpenMonthRequest: boolean;
  hasOpenDayRequest: boolean;
  hasApprovedMonth: boolean;
  hasApprovedDay: boolean;
}): string | null {
  if (params.type === "month") {
    if (!params.monthKey || !isValidMonthKey(params.monthKey)) {
      return "Invalid monthKey (expected YYYY-MM)";
    }
    if (params.monthKey > params.currentMonthKey) {
      return "Cannot notify admin about an HR exemption for a future month";
    }
    if (params.hasOpenMonthRequest) {
      return "You already have a pending HR exemption notification for this month";
    }
    if (params.hasApprovedMonth) {
      return "An HR exemption is already logged for this month";
    }
    return null;
  }

  if (!params.dayKey || !isValidDayKey(params.dayKey)) {
    return "Invalid dayKey (expected YYYY-MM-DD)";
  }
  if (params.dayKey > params.currentDayKey) {
    return "Cannot notify admin about an HR exemption for a future day";
  }
  if (params.hasOpenDayRequest) {
    return "You already have a pending HR exemption notification for this day";
  }
  if (params.hasApprovedDay) {
    return "An HR exemption is already logged for this day";
  }
  return null;
}

export async function getApprovedExemptionsForUser(
  userId: string,
  year?: number,
): Promise<ApprovedExemptions> {
  const where: {
    userId: string;
    status: string;
    OR?: Array<{ monthKey: { startsWith: string } } | { dayKey: { startsWith: string } }>;
  } = {
    userId,
    status: "approved",
  };

  if (year !== undefined) {
    const prefix = String(year);
    where.OR = [{ monthKey: { startsWith: prefix } }, { dayKey: { startsWith: prefix } }];
  }

  const rows = await prisma.complianceExemptionRequest.findMany({
    where,
    select: { type: true, monthKey: true, dayKey: true },
  });

  const monthKeys: string[] = [];
  const dayKeys: string[] = [];
  for (const row of rows) {
    if (row.type === "month" && row.monthKey) {
      monthKeys.push(row.monthKey);
    } else if (row.type === "day" && row.dayKey) {
      dayKeys.push(row.dayKey);
    }
  }
  return { monthKeys, dayKeys };
}

export async function getPendingExemptionMonthKeys(userId: string): Promise<string[]> {
  const open = await prisma.complianceExemptionRequest.findMany({
    where: { userId, status: "open" },
    select: { type: true, monthKey: true, dayKey: true },
  });
  const keys = new Set<string>();
  for (const row of open) {
    if (row.type === "month" && row.monthKey) {
      keys.add(row.monthKey);
    } else if (row.type === "day" && row.dayKey) {
      keys.add(row.dayKey.slice(0, 7));
    }
  }
  return [...keys];
}

export async function getUserComplianceExemptionState(userId: string) {
  const requests = await prisma.complianceExemptionRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const openRequests = requests
    .filter((r) => r.status === "open")
    .map(serializeComplianceExemptionRequest);
  const recentRequests = requests
    .filter((r) => r.status !== "open")
    .slice(0, 10)
    .map(serializeComplianceExemptionRequest);

  return { openRequests, recentRequests };
}

async function hasConflictingRequest(
  userId: string,
  type: ComplianceExemptionType,
  monthKey: string | null,
  dayKey: string | null,
) {
  if (type === "month" && monthKey) {
    const [open, approved] = await Promise.all([
      prisma.complianceExemptionRequest.findFirst({
        where: { userId, type: "month", monthKey, status: "open" },
        select: { id: true },
      }),
      prisma.complianceExemptionRequest.findFirst({
        where: { userId, type: "month", monthKey, status: "approved" },
        select: { id: true },
      }),
    ]);
    return { hasOpen: !!open, hasApproved: !!approved };
  }

  if (type === "day" && dayKey) {
    const [open, approved] = await Promise.all([
      prisma.complianceExemptionRequest.findFirst({
        where: { userId, type: "day", dayKey, status: "open" },
        select: { id: true },
      }),
      prisma.complianceExemptionRequest.findFirst({
        where: { userId, type: "day", dayKey, status: "approved" },
        select: { id: true },
      }),
    ]);
    return { hasOpen: !!open, hasApproved: !!approved };
  }

  return { hasOpen: false, hasApproved: false };
}

export async function createComplianceExemptionRequest(params: {
  userId: string;
  type: ComplianceExemptionType;
  monthKey?: string | null;
  dayKey?: string | null;
  message?: string | null;
  currentMonthKey: string;
  currentDayKey: string;
  autoApprove?: boolean;
  reviewedById?: string | null;
}) {
  const monthKey = params.type === "month" ? (params.monthKey?.trim() ?? null) : null;
  const dayKey = params.type === "day" ? (params.dayKey?.trim() ?? null) : null;

  const conflict = await hasConflictingRequest(params.userId, params.type, monthKey, dayKey);
  const validationError = validateComplianceExemptionSubmission({
    type: params.type,
    monthKey,
    dayKey,
    currentMonthKey: params.currentMonthKey,
    currentDayKey: params.currentDayKey,
    hasOpenMonthRequest: conflict.hasOpen,
    hasOpenDayRequest: conflict.hasOpen,
    hasApprovedMonth: conflict.hasApproved,
    hasApprovedDay: conflict.hasApproved,
  });

  if (validationError) {
    return {
      error: validationError,
      status: conflict.hasOpen ? 409 : 400,
    } as const;
  }

  const message = params.message?.trim().slice(0, 500) || null;
  const autoApprove = params.autoApprove ?? false;
  const reviewedAt = autoApprove ? new Date() : null;

  const request = await prisma.complianceExemptionRequest.create({
    data: {
      userId: params.userId,
      type: params.type,
      monthKey,
      dayKey,
      message,
      status: autoApprove ? "approved" : "open",
      reviewedAt,
      reviewedById: autoApprove ? (params.reviewedById ?? null) : null,
    },
  });

  await logAuditEvent({
    actorId: params.reviewedById ?? params.userId,
    action: autoApprove ? "compliance_exemption_approve" : "compliance_exemption_request",
    targetUserId: params.userId,
    details: {
      requestId: request.id,
      type: params.type,
      monthKey,
      dayKey,
      autoApprove,
    },
  });

  return { request: serializeComplianceExemptionRequest(request) } as const;
}

export async function cancelComplianceExemptionRequest(userId: string, requestId: string) {
  const existing = await prisma.complianceExemptionRequest.findFirst({
    where: { id: requestId, userId },
  });
  if (!existing) {
    return { error: "Request not found", status: 404 } as const;
  }
  if (existing.status !== "open") {
    return { error: "Only open requests can be cancelled", status: 400 } as const;
  }

  await prisma.complianceExemptionRequest.delete({ where: { id: existing.id } });

  await logAuditEvent({
    actorId: userId,
    action: "compliance_exemption_cancel",
    targetUserId: userId,
    details: {
      requestId: existing.id,
      type: existing.type,
      monthKey: existing.monthKey,
      dayKey: existing.dayKey,
    },
  });

  return { ok: true } as const;
}

export async function resolveComplianceExemptionRequest(params: {
  adminId: string;
  requestId: string;
  status: "approved" | "rejected";
  adminNote?: string | null;
}) {
  const existing = await prisma.complianceExemptionRequest.findUnique({
    where: { id: params.requestId },
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
  const reviewedAt = new Date();

  const updated = await prisma.complianceExemptionRequest.update({
    where: { id: existing.id },
    data: {
      status: params.status,
      adminNote,
      reviewedAt,
      reviewedById: params.adminId,
    },
  });

  await logAuditEvent({
    actorId: params.adminId,
    action:
      params.status === "approved"
        ? "compliance_exemption_approve"
        : "compliance_exemption_reject",
    targetUserId: existing.userId,
    details: {
      requestId: updated.id,
      type: existing.type,
      monthKey: existing.monthKey,
      dayKey: existing.dayKey,
      adminNote,
    },
  });

  return { request: serializeComplianceExemptionRequest(updated) } as const;
}

export async function submitUserComplianceExemptionRequest(params: {
  userId: string;
  type: ComplianceExemptionType;
  monthKey?: string | null;
  dayKey?: string | null;
  message?: string | null;
  currentMonthKey: string;
  currentDayKey: string;
}) {
  const config = await getAppConfig();
  const autoApprove = !config.complianceExemptionRequiresApproval;
  return createComplianceExemptionRequest({
    ...params,
    autoApprove,
    reviewedById: autoApprove ? params.userId : null,
  });
}

export async function grantComplianceExemptionDirectly(params: {
  adminId: string;
  userId: string;
  type: ComplianceExemptionType;
  monthKey?: string | null;
  dayKey?: string | null;
  message?: string | null;
  currentMonthKey: string;
  currentDayKey: string;
}) {
  return createComplianceExemptionRequest({
    ...params,
    autoApprove: true,
    reviewedById: params.adminId,
  });
}
