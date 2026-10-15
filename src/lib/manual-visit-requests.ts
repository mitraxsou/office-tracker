import { prisma } from "./db";
import { logAuditEvent } from "./audit-log";
import { DEFAULT_HOURS_TARGET, DEFAULT_MANUAL_VISIT_DURATION_MINUTES } from "./constants";
import { createManualVisit } from "./heartbeat-service";
import { handleOfficePresenceDetected } from "./ooo-presence";
import { DEFAULT_NOTIFICATION_PREFS, parseTimeToMinutes } from "./notification-prefs";
import {
  dayBoundsFromKey,
  datetimeInTimezone,
  dayKeyInTimezone,
  isFutureDayKey,
} from "./timezone-dates";
import { validateVisitTimestamps } from "./visit-validation";

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Cap how many days one mark-days submission may create. */
export const MAX_MARK_DAYS_PER_SUBMISSION = 31;
export const DEFAULT_MARK_DAY_START_TIME = DEFAULT_NOTIFICATION_PREFS.officeStartTime;

export function isValidMarkDayKey(value: string): boolean {
  if (!DAY_KEY_RE.test(value)) return false;
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return date.toISOString().slice(0, 10) === value;
}

function resolveOfficeStartTime(officeStartTime?: string | null): string {
  if (officeStartTime && HH_MM_RE.test(officeStartTime)) return officeStartTime;
  return DEFAULT_MARK_DAY_START_TIME;
}

function resolveHoursTarget(hoursTarget?: number | null): number {
  if (typeof hoursTarget === "number" && Number.isFinite(hoursTarget) && hoursTarget > 0) {
    return hoursTarget;
  }
  return DEFAULT_HOURS_TARGET;
}

/**
 * Build a same-day visit window whose duration matches the user's daily hours target.
 * Starts at officeStartTime (default 09:30); if that would run past local midnight,
 * shifts the start earlier so the full target still fits within the day.
 */
export function buildMarkDayVisitedWindow(params: {
  dayKey: string;
  timezone: string;
  hoursTarget: number;
  officeStartTime?: string | null;
}): { dayKey: string; startAt: Date; endAt: Date; durationMs: number } {
  const hoursTarget = resolveHoursTarget(params.hoursTarget);
  const startTime = resolveOfficeStartTime(params.officeStartTime);
  const startMinutes = parseTimeToMinutes(startTime);
  const startHour = Math.floor(startMinutes / 60);
  const startMinute = startMinutes % 60;
  const durationMs = Math.round(hoursTarget * 60 * 60 * 1000);

  const { start: dayStart } = dayBoundsFromKey(params.dayKey, params.timezone);
  // Prefer 23:59 wall time over dayBounds end (23:59:59.999 can label as the next local day).
  const latestEnd = datetimeInTimezone(params.dayKey, 23, 59, params.timezone);
  let startAt = datetimeInTimezone(params.dayKey, startHour, startMinute, params.timezone);
  let endAt = new Date(startAt.getTime() + durationMs);

  if (
    endAt.getTime() > latestEnd.getTime() ||
    dayKeyInTimezone(endAt, params.timezone) !== params.dayKey
  ) {
    endAt = latestEnd;
    startAt = new Date(endAt.getTime() - durationMs);
    if (startAt.getTime() < dayStart.getTime()) {
      startAt = dayStart;
      endAt = new Date(Math.min(startAt.getTime() + durationMs, latestEnd.getTime()));
    }
  }

  return {
    dayKey: params.dayKey,
    startAt,
    endAt,
    durationMs: endAt.getTime() - startAt.getTime(),
  };
}

export type MarkDayVisitedPlan = {
  dayKey: string;
  startAt: Date;
  endAt: Date;
  durationMs: number;
};

/** Validate and expand selected calendar days into N mark-day visit windows. */
export function planMarkDaysVisitedRequests(params: {
  dayKeys: string[];
  timezone: string;
  hoursTarget: number;
  officeStartTime?: string | null;
  now?: Date;
}): { plans: MarkDayVisitedPlan[]; error?: string } {
  const unique = [...new Set(params.dayKeys.map((k) => k.trim()).filter(Boolean))].sort();
  if (unique.length === 0) {
    return { plans: [], error: "Select at least one day" };
  }
  if (unique.length > MAX_MARK_DAYS_PER_SUBMISSION) {
    return {
      plans: [],
      error: `You can mark at most ${MAX_MARK_DAYS_PER_SUBMISSION} days at once`,
    };
  }

  const now = params.now ?? new Date();
  const plans: MarkDayVisitedPlan[] = [];
  for (const dayKey of unique) {
    if (!isValidMarkDayKey(dayKey)) {
      return { plans: [], error: `Invalid day: ${dayKey}` };
    }
    if (isFutureDayKey(dayKey, params.timezone, now)) {
      return { plans: [], error: "Cannot mark future days as visited" };
    }
    plans.push(
      buildMarkDayVisitedWindow({
        dayKey,
        timezone: params.timezone,
        hoursTarget: params.hoursTarget,
        officeStartTime: params.officeStartTime,
      }),
    );
  }
  return { plans };
}

/** When the user omits check-out, close the visit this many minutes after check-in. */
export function defaultManualVisitEndAt(
  startAt: Date,
  minutes: number = DEFAULT_MANUAL_VISIT_DURATION_MINUTES,
): Date {
  const safeMinutes = minutes > 0 ? minutes : DEFAULT_MANUAL_VISIT_DURATION_MINUTES;
  return new Date(startAt.getTime() + safeMinutes * 60 * 1000);
}

/** Resolve end time: explicit check-out, or check-in + default duration. */
export function resolveManualVisitEndAt(
  startAt: Date,
  endAt: Date | null | undefined,
  minutes: number = DEFAULT_MANUAL_VISIT_DURATION_MINUTES,
): Date {
  if (endAt) return endAt;
  return defaultManualVisitEndAt(startAt, minutes);
}

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
  now?: Date;
}): string | null {
  const now = params.now ?? new Date();
  if (!params.endAt) {
    return "Check-out is required";
  }
  if (params.endAt <= params.startAt) {
    return "Check-out must be after check-in";
  }
  const startError = validateVisitTimestamps(params.startAt, null, now);
  if (startError) {
    return startError;
  }
  const durationMs = params.endAt.getTime() - params.startAt.getTime();
  const maxVisitMs = 16 * 60 * 60 * 1000;
  if (durationMs > maxVisitMs) {
    return "Check-out cannot be more than 16 hours after check-in";
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
  const endAt = resolveManualVisitEndAt(params.startAt, params.endAt ?? null);
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
      defaultedEndAt: !params.endAt,
    },
  });

  return { request: serializeManualVisitRequest(request) } as const;
}

/**
 * Create one pending ManualVisitRequest per selected day, each spanning the
 * user's daily hours target. Does not create Visit rows — admin approval required.
 */
export async function createMarkDaysVisitedRequests(params: {
  userId: string;
  dayKeys: string[];
  timezone: string;
  hoursTarget: number;
  officeStartTime?: string | null;
  message?: string | null;
}) {
  const planned = planMarkDaysVisitedRequests({
    dayKeys: params.dayKeys,
    timezone: params.timezone,
    hoursTarget: params.hoursTarget,
    officeStartTime: params.officeStartTime,
  });
  if (planned.error) {
    return { error: planned.error, status: 400 } as const;
  }

  const message =
    params.message?.trim().slice(0, 500) ||
    `Marked day visited (${resolveHoursTarget(params.hoursTarget)}h target)`;

  const requests: ManualVisitRequestSummary[] = [];
  const failures: Array<{ dayKey: string; error: string }> = [];

  for (const plan of planned.plans) {
    const result = await createManualVisitRequest({
      userId: params.userId,
      startAt: plan.startAt,
      endAt: plan.endAt,
      ssid: "manual",
      message,
    });
    if ("error" in result) {
      failures.push({
        dayKey: plan.dayKey,
        error: result.error ?? "Failed to create mark-day request",
      });
      continue;
    }
    requests.push(result.request);
  }

  if (requests.length === 0) {
    const first = failures[0]?.error ?? "Failed to create mark-day requests";
    const status = failures.some((f) => f.error.includes("pending")) ? 409 : 400;
    return { error: first, status, failures } as const;
  }

  return { requests, failures } as const;
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
