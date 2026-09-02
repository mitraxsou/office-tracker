import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { logAuditEvent } from "./audit-log";
import { isBreakglassEmail } from "./breakglass-shared";

export const PROFILE_CHANGE_STATUSES = ["open", "approved", "rejected"] as const;
export type ProfileChangeStatus = (typeof PROFILE_CHANGE_STATUSES)[number];

const MAX_NAME_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 500;

export function isValidProfileChangeStatus(value: string): value is ProfileChangeStatus {
  return (PROFILE_CHANGE_STATUSES as readonly string[]).includes(value);
}

export function normalizeProfileEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function isPwcEmail(email: string): boolean {
  const normalized = normalizeProfileEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return false;
  }
  const domain = normalized.split("@")[1]!;
  return domain === "pwc.com" || domain.endsWith(".pwc.com") || domain === "pwc.office";
}

export function getProfileChangeBlockReason(email: string): string | null {
  if (isBreakglassEmail(email)) {
    return "Breakglass account profile is managed via server environment";
  }
  return null;
}

function normalizeName(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

export function validateProfileChangeSubmission(params: {
  currentName: string | null;
  currentEmail: string;
  requestedName?: string | null;
  requestedEmail?: string | null;
  hasOpenRequest: boolean;
}): string | null {
  const requestedName = normalizeName(params.requestedName);
  const requestedEmail = params.requestedEmail
    ? normalizeProfileEmail(params.requestedEmail)
    : null;

  if (!requestedName && !requestedEmail) {
    return "Provide a new display name and/or email";
  }

  if (requestedEmail && !isPwcEmail(requestedEmail)) {
    return "Email must be a PwC address (for example user@pwc.com or user@uk.pwc.com)";
  }

  const currentName = normalizeName(params.currentName);
  const currentEmail = normalizeProfileEmail(params.currentEmail);

  const nameUnchanged = requestedName === null || requestedName === currentName;
  const emailUnchanged = requestedEmail === null || requestedEmail === currentEmail;

  if (nameUnchanged && emailUnchanged) {
    return "Requested name and email match your current profile";
  }

  if (params.hasOpenRequest) {
    return "You already have a pending profile change request";
  }

  return null;
}

export type ProfileChangeRequestSummary = {
  id: string;
  status: string;
  currentName: string | null;
  currentEmail: string;
  requestedName: string | null;
  requestedEmail: string | null;
  message: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function serializeProfileChangeRequest(request: {
  id: string;
  status: string;
  currentName: string | null;
  currentEmail: string;
  requestedName: string | null;
  requestedEmail: string | null;
  message: string | null;
  adminNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}): ProfileChangeRequestSummary {
  return {
    id: request.id,
    status: request.status,
    currentName: request.currentName,
    currentEmail: request.currentEmail,
    requestedName: request.requestedName,
    requestedEmail: request.requestedEmail,
    message: request.message,
    adminNote: request.adminNote,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  };
}

export async function getUserProfileChangeRequestState(userId: string) {
  const [openRequest, requests] = await Promise.all([
    prisma.profileChangeRequest.findFirst({
      where: { userId, status: "open" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.profileChangeRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    openRequest: openRequest ? serializeProfileChangeRequest(openRequest) : null,
    requests: requests.map(serializeProfileChangeRequest),
  };
}

export async function createProfileChangeRequest(params: {
  userId: string;
  currentName: string | null;
  currentEmail: string;
  requestedName?: string | null;
  requestedEmail?: string | null;
  message?: string | null;
  actorId: string;
  auditAction?: "profile_change_request" | "profile_change_request_admin";
}) {
  const blockReason = getProfileChangeBlockReason(params.currentEmail);
  if (blockReason) {
    return { error: blockReason, status: 403 } as const;
  }

  const hasOpenRequest = !!(await prisma.profileChangeRequest.findFirst({
    where: { userId: params.userId, status: "open" },
    select: { id: true },
  }));

  const requestedName = normalizeName(params.requestedName);
  const requestedEmail = params.requestedEmail
    ? normalizeProfileEmail(params.requestedEmail)
    : null;

  const validationError = validateProfileChangeSubmission({
    currentName: params.currentName,
    currentEmail: params.currentEmail,
    requestedName,
    requestedEmail,
    hasOpenRequest,
  });
  if (validationError) {
    return { error: validationError, status: hasOpenRequest ? 409 : 400 } as const;
  }

  if (requestedEmail) {
    const existing = await prisma.user.findUnique({
      where: { email: requestedEmail },
      select: { id: true },
    });
    if (existing && existing.id !== params.userId) {
      return { error: "That email is already registered", status: 409 } as const;
    }
  }

  const message = params.message?.trim().slice(0, MAX_MESSAGE_LENGTH) || null;

  const request = await prisma.profileChangeRequest.create({
    data: {
      userId: params.userId,
      currentName: normalizeName(params.currentName),
      currentEmail: normalizeProfileEmail(params.currentEmail),
      requestedName,
      requestedEmail,
      message,
    },
  });

  await logAuditEvent({
    actorId: params.actorId,
    action: params.auditAction ?? "profile_change_request",
    targetUserId: params.userId,
    details: {
      requestId: request.id,
      requestedName,
      requestedEmail,
    },
  });

  return { request: serializeProfileChangeRequest(request) } as const;
}

export async function cancelProfileChangeRequest(userId: string, requestId: string) {
  const existing = await prisma.profileChangeRequest.findFirst({
    where: { id: requestId, userId },
  });
  if (!existing) {
    return { error: "Request not found", status: 404 } as const;
  }
  if (existing.status !== "open") {
    return { error: "Only open requests can be cancelled", status: 400 } as const;
  }

  await prisma.profileChangeRequest.delete({ where: { id: existing.id } });

  await logAuditEvent({
    actorId: userId,
    action: "profile_change_cancel",
    targetUserId: userId,
    details: {
      requestId: existing.id,
      requestedName: existing.requestedName,
      requestedEmail: existing.requestedEmail,
    },
  });

  return { ok: true } as const;
}

export async function resolveProfileChangeRequest(params: {
  adminId: string;
  requestId: string;
  status: "approved" | "rejected";
  adminNote?: string | null;
}) {
  const existing = await prisma.profileChangeRequest.findUnique({
    where: { id: params.requestId },
    include: { user: { select: { id: true, email: true, name: true } } },
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
    if (existing.requestedEmail) {
      const conflict = await prisma.user.findUnique({
        where: { email: existing.requestedEmail },
        select: { id: true },
      });
      if (conflict && conflict.id !== existing.userId) {
        return { error: "Requested email is already registered to another user", status: 409 } as const;
      }
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (existing.requestedName !== null) {
      updateData.name = existing.requestedName;
    }
    if (existing.requestedEmail) {
      updateData.email = existing.requestedEmail;
    }

    if (Object.keys(updateData).length > 0) {
      try {
        await prisma.user.update({
          where: { id: existing.userId },
          data: updateData,
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return { error: "Requested email is already registered to another user", status: 409 } as const;
        }
        throw err;
      }
    }
  }

  const updated = await prisma.profileChangeRequest.update({
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
    action: params.status === "approved" ? "profile_change_approve" : "profile_change_reject",
    targetUserId: existing.userId,
    details: {
      requestId: updated.id,
      requestedName: existing.requestedName,
      requestedEmail: existing.requestedEmail,
      adminNote,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: existing.userId },
    select: { email: true, name: true },
  });

  return {
    request: serializeProfileChangeRequest(updated),
    user,
  } as const;
}
