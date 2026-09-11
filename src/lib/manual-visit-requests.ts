import { prisma } from "./db";
import { logAuditEvent } from "./audit-log";
import { createManualVisit } from "./heartbeat-service";
import { handleOfficePresenceDetected } from "./ooo-presence";
import { validateVisitTimestamps } from "./visit-validation";

export const MANUAL_VISIT_REQUEST_STATUSES = ["open", "approved", "rejected"] as const;
export type ManualVisitRequestStatus = (typeof MANUAL_VISIT_REQUEST_STATUSES)[number];

export function isValidManualVisitRequestStatus(value: string): value is ManualVisitRequestStatus {
  return (MANUAL_VISIT_REQUEST_STATUSES as readonly string[]).includes(value);
}

export type ManualVisitRequestSummary = {
  id: string;
  status: string;
  startAt: string;
  endAt: string | null;
  ssid: string;
  message: string | null;
  adminNote: string | null;
  visitId: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function serializeManualVisitRequest(request: {
  id: string;
  status: string;
  startAt: Date;
  endAt: Date | null;
  ssid: string;
  message: string | null;
  adminNote: string | null;
  visitId: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}): ManualVisitRequestSummary {
  return {
    id: request.id,
    status: request.status,
    startAt: request.startAt.toISOString(),
    endAt: request.endAt?.toISOString() ?? null,
    ssid: request.ssid,
    message: request.message,
    adminNote: request.adminNote,
    visitId: request.visitId,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  };
}

export function validateManualVisitSubmission(params: {
  startAt: Date;
  endAt: Date | null;
  hasDuplicateOpen: boolean;
}): string | null {
  if (params.endAt && params.endAt <= params.startAt) {
    return "Check-out must be after check-in";
  }
  const timestampError = validateVisitTimestamps(params.startAt, params.endAt);
  if (timestampError) {
    return timestampError;
  }
  if (params.hasDuplicateOpen) {
    return "You already have a pending manual visit request for this check-in time";
  }
  return null;
}

export async function getUserManualVisitRequestState(userId: string) {
  const [openRequests, latestRequest] = await Promise.all([
    prisma.manualVisitRequest.findMany({
      where: { userId, status: "open" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.manualVisitRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    openRequests: openRequests.map(serializeManualVisitRequest),
    latestRequest:
      latestRequest && latestRequest.status !== "open"
        ? serializeManualVisitRequest(latestRequest)
        : null,
  };
}

export async function createManualVisitRequest(params: {
  userId: string;
  startAt: Date;
  endAt?: Date | null;
  ssid?: string | null;
  message?: string | null;
}) {
  const endAt = params.endAt ?? null;
  const ssid = typeof params.ssid === "string" && params.ssid.trim() ? params.ssid.trim() : "manual";

  const duplicate = await prisma.manualVisitRequest.findFirst({
    where: {
      userId: params.userId,
      status: "open",
      startAt: params.startAt,
    },
    select: { id: true },
  });

  const validationError = validateManualVisitSubmission({
    startAt: params.startAt,
    endAt,
    hasDuplicateOpen: !!duplicate,
  });
  if (validationError) {
    const status = duplicate ? 409 : 400;
    return { error: validationError, status } as const;
  }

  const message = params.message?.trim().slice(0, 500) || null;

  const request = await prisma.manualVisitRequest.create({
    data: {
      userId: params.userId,
      startAt: params.startAt,
      endAt,
      ssid,
      message,
    },
  });

  await logAuditEvent({
    actorId: params.userId,
    action: "manual_visit_request",
    targetUserId: params.userId,
    details: {
      requestId: request.id,
      startAt: request.startAt.toISOString(),
      endAt: request.endAt?.toISOString() ?? null,
      ssid,
    },
  });

  return { request: serializeManualVisitRequest(request) } as const;
}

export async function resolveManualVisitRequest(params: {
  adminId: string;
  requestId: string;
  status: "approved" | "rejected";
  adminNote?: string | null;
}) {
  const existing = await prisma.manualVisitRequest.findUnique({
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

  let visitId: string | null = null;
  if (params.status === "approved") {
    const visit = await createManualVisit({
      userId: existing.userId,
      startAt: existing.startAt,
      endAt: existing.endAt,
      ssid: existing.ssid,
    });
    visitId = visit.id;

    if (!existing.endAt) {
      await handleOfficePresenceDetected(
        existing.userId,
        existing.user.timezone,
        existing.startAt,
      );
    }
  }

  const updated = await prisma.manualVisitRequest.update({
    where: { id: existing.id },
    data: {
      status: params.status,
      adminNote,
      reviewedAt,
      reviewedById: params.adminId,
      visitId,
    },
  });

  await logAuditEvent({
    actorId: params.adminId,
    action: params.status === "approved" ? "manual_visit_approve" : "manual_visit_reject",
    targetUserId: existing.userId,
    details: {
      requestId: updated.id,
      visitId,
      startAt: existing.startAt.toISOString(),
      endAt: existing.endAt?.toISOString() ?? null,
      adminNote,
    },
  });

  return { request: serializeManualVisitRequest(updated), visitId } as const;
}
