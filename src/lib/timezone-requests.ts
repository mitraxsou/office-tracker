import { prisma } from "./db";
import { logAuditEvent } from "./audit-log";
import { validateTimezone } from "./security";

export const TIMEZONE_REQUEST_STATUSES = ["open", "approved", "rejected"] as const;
export type TimezoneRequestStatus = (typeof TIMEZONE_REQUEST_STATUSES)[number];

export function isValidTimezoneRequestStatus(value: string): value is TimezoneRequestStatus {
  return (TIMEZONE_REQUEST_STATUSES as readonly string[]).includes(value);
}

export function validateTimezoneChangeSubmission(params: {
  currentTimezone: string;
  requestedTimezone: string;
  hasOpenRequest: boolean;
}): string | null {
  if (!validateTimezone(params.requestedTimezone)) {
    return "Invalid timezone";
  }
  if (params.requestedTimezone === params.currentTimezone) {
    return "Requested timezone matches your current timezone";
  }
  if (params.hasOpenRequest) {
    return "You already have a pending timezone change request";
  }
  return null;
}

export function timezoneOnApproval(
  status: "approved" | "rejected",
  requestedTimezone: string,
  currentTimezone: string,
): string {
  return status === "approved" ? requestedTimezone : currentTimezone;
}

export type TimezoneRequestSummary = {
  id: string;
  status: string;
  requestedTimezone: string;
  currentTimezone: string;
  message: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function serializeTimezoneRequest(request: {
  id: string;
  status: string;
  requestedTimezone: string;
  currentTimezone: string;
  message: string | null;
  adminNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}): TimezoneRequestSummary {
  return {
    id: request.id,
    status: request.status,
    requestedTimezone: request.requestedTimezone,
    currentTimezone: request.currentTimezone,
    message: request.message,
    adminNote: request.adminNote,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  };
}

export async function getUserTimezoneRequestState(userId: string) {
  const [openRequest, latestRequest] = await Promise.all([
    prisma.timezoneChangeRequest.findFirst({
      where: { userId, status: "open" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.timezoneChangeRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    openRequest: openRequest ? serializeTimezoneRequest(openRequest) : null,
    latestRequest:
      latestRequest && latestRequest.status !== "open"
        ? serializeTimezoneRequest(latestRequest)
        : null,
  };
}

export async function createTimezoneChangeRequest(params: {
  userId: string;
  currentTimezone: string;
  requestedTimezone: string;
  message?: string | null;
}) {
  const hasOpenRequest = !!(await prisma.timezoneChangeRequest.findFirst({
    where: { userId: params.userId, status: "open" },
    select: { id: true },
  }));

  const validationError = validateTimezoneChangeSubmission({
    currentTimezone: params.currentTimezone,
    requestedTimezone: params.requestedTimezone,
    hasOpenRequest,
  });
  if (validationError) {
    return { error: validationError, status: hasOpenRequest ? 409 : 400 } as const;
  }

  const message = params.message?.trim().slice(0, 500) || null;

  const request = await prisma.timezoneChangeRequest.create({
    data: {
      userId: params.userId,
      currentTimezone: params.currentTimezone,
      requestedTimezone: params.requestedTimezone,
      message,
    },
  });

  await logAuditEvent({
    actorId: params.userId,
    action: "timezone_change_request",
    targetUserId: params.userId,
    details: {
      requestId: request.id,
      from: params.currentTimezone,
      to: params.requestedTimezone,
    },
  });

  return { request: serializeTimezoneRequest(request) } as const;
}

export async function cancelTimezoneChangeRequest(userId: string, requestId: string) {
  const existing = await prisma.timezoneChangeRequest.findFirst({
    where: { id: requestId, userId },
  });
  if (!existing) {
    return { error: "Request not found", status: 404 } as const;
  }
  if (existing.status !== "open") {
    return { error: "Only open requests can be cancelled", status: 400 } as const;
  }

  await prisma.timezoneChangeRequest.delete({ where: { id: existing.id } });

  await logAuditEvent({
    actorId: userId,
    action: "timezone_change_cancel",
    targetUserId: userId,
    details: {
      requestId: existing.id,
      from: existing.currentTimezone,
      to: existing.requestedTimezone,
    },
  });

  return { ok: true } as const;
}

export async function resolveTimezoneChangeRequest(params: {
  adminId: string;
  requestId: string;
  status: "approved" | "rejected";
  adminNote?: string | null;
}) {
  const existing = await prisma.timezoneChangeRequest.findUnique({
    where: { id: params.requestId },
    include: { user: { select: { id: true, timezone: true } } },
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

  if (params.status === "approved") {
    await prisma.user.update({
      where: { id: existing.userId },
      data: { timezone: existing.requestedTimezone },
    });
  }

  const updated = await prisma.timezoneChangeRequest.update({
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
    action: params.status === "approved" ? "timezone_change_approve" : "timezone_change_reject",
    targetUserId: existing.userId,
    details: {
      requestId: updated.id,
      from: existing.currentTimezone,
      to: existing.requestedTimezone,
      adminNote,
    },
  });

  return {
    request: serializeTimezoneRequest(updated),
    userTimezone: timezoneOnApproval(
      params.status,
      existing.requestedTimezone,
      existing.user.timezone,
    ),
  } as const;
}
