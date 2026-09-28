import crypto from "node:crypto";
import { prisma } from "./db";
import { hashPassword, issueAgentToken } from "./auth";
import { logAuditEvent } from "./audit-log";
import { isPwcEmail, normalizeProfileEmail } from "./profile-change-requests";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_WORK_DAYS,
} from "./notification-prefs";

export const ACCOUNT_ACCESS_STATUSES = ["open", "approved", "rejected"] as const;
export type AccountAccessStatus = (typeof ACCOUNT_ACCESS_STATUSES)[number];

const MAX_NAME_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 500;

export function isValidAccountAccessStatus(value: string): value is AccountAccessStatus {
  return (ACCOUNT_ACCESS_STATUSES as readonly string[]).includes(value);
}

export function validateAccountAccessSubmission(params: {
  email: string;
  name?: string | null;
  message?: string | null;
}): string | null {
  const email = normalizeProfileEmail(params.email);
  if (!isPwcEmail(email)) {
    return "Use your PwC email address (for example user@pwc.com)";
  }
  const name = params.name?.trim() ?? "";
  if (name.length > MAX_NAME_LENGTH) {
    return `Name must be at most ${MAX_NAME_LENGTH} characters`;
  }
  const message = params.message?.trim() ?? "";
  if (message.length > MAX_MESSAGE_LENGTH) {
    return `Message must be at most ${MAX_MESSAGE_LENGTH} characters`;
  }
  return null;
}

export async function submitAccountAccessRequest(params: {
  email: string;
  name?: string | null;
  message?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const validationError = validateAccountAccessSubmission(params);
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }

  const email = normalizeProfileEmail(params.email);
  const name = params.name?.trim() ? params.name.trim().slice(0, MAX_NAME_LENGTH) : null;
  const message = params.message?.trim()
    ? params.message.trim().slice(0, MAX_MESSAGE_LENGTH)
    : null;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // Anti-enumeration: treat as success; they can sign in.
    return { ok: true };
  }

  const open = await prisma.accountAccessRequest.findFirst({
    where: { email, status: "open" },
    select: { id: true },
  });
  if (open) {
    await prisma.accountAccessRequest.update({
      where: { id: open.id },
      data: { name, message },
    });
    return { ok: true };
  }

  await prisma.accountAccessRequest.create({
    data: { email, name, message, status: "open" },
  });

  return { ok: true };
}

export async function listAccountAccessRequests(status: AccountAccessStatus | "all" = "open") {
  return prisma.accountAccessRequest.findMany({
    where: status === "all" ? undefined : { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reviewedBy: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function approveAccountAccessRequest(params: {
  id: string;
  adminId: string;
  adminNote?: string | null;
}) {
  const request = await prisma.accountAccessRequest.findUnique({ where: { id: params.id } });
  if (!request) {
    return { ok: false as const, error: "Request not found", status: 404 };
  }
  if (request.status !== "open") {
    return { ok: false as const, error: "Request is already reviewed", status: 400 };
  }

  const existing = await prisma.user.findUnique({ where: { email: request.email } });
  if (existing) {
    await prisma.accountAccessRequest.update({
      where: { id: request.id },
      data: {
        status: "approved",
        adminNote: params.adminNote?.trim() || null,
        reviewedAt: new Date(),
        reviewedById: params.adminId,
        createdUserId: existing.id,
      },
    });
    return { ok: true as const, userId: existing.id, alreadyExisted: true };
  }

  const passwordHash = await hashPassword(crypto.randomBytes(32).toString("hex"));
  const user = await prisma.user.create({
    data: {
      email: request.email,
      passwordHash,
      name: request.name,
      role: "user",
      registrationSource: "account_request",
    },
  });

  await prisma.userNotificationPrefs.create({
    data: {
      userId: user.id,
      workDays: JSON.stringify(DEFAULT_WORK_DAYS),
      alertIfNotInOffice: DEFAULT_NOTIFICATION_PREFS.alertIfNotInOffice,
      alertIfAgentStale: DEFAULT_NOTIFICATION_PREFS.alertIfAgentStale,
      alertIfBehindHours: DEFAULT_NOTIFICATION_PREFS.alertIfBehindHours,
      alertIfHoursStarted: DEFAULT_NOTIFICATION_PREFS.alertIfHoursStarted,
      alertIfHoursMet: DEFAULT_NOTIFICATION_PREFS.alertIfHoursMet,
      channelNotInOffice: DEFAULT_NOTIFICATION_PREFS.channelNotInOffice,
      channelAgentStale: DEFAULT_NOTIFICATION_PREFS.channelAgentStale,
      channelBehindHours: DEFAULT_NOTIFICATION_PREFS.channelBehindHours,
      channelHoursStarted: DEFAULT_NOTIFICATION_PREFS.channelHoursStarted,
      channelHoursMet: DEFAULT_NOTIFICATION_PREFS.channelHoursMet,
    },
  });

  await issueAgentToken(user.id, {
    label: "Initial laptop",
    issuedById: params.adminId,
  });

  await prisma.accountAccessRequest.update({
    where: { id: request.id },
    data: {
      status: "approved",
      adminNote: params.adminNote?.trim() || null,
      reviewedAt: new Date(),
      reviewedById: params.adminId,
      createdUserId: user.id,
    },
  });

  await logAuditEvent({
    actorId: params.adminId,
    action: "account_access.approved",
    targetUserId: user.id,
    details: { email: user.email, requestId: request.id },
  });

  return { ok: true as const, userId: user.id, alreadyExisted: false };
}

export async function rejectAccountAccessRequest(params: {
  id: string;
  adminId: string;
  adminNote?: string | null;
}) {
  const request = await prisma.accountAccessRequest.findUnique({ where: { id: params.id } });
  if (!request) {
    return { ok: false as const, error: "Request not found", status: 404 };
  }
  if (request.status !== "open") {
    return { ok: false as const, error: "Request is already reviewed", status: 400 };
  }

  await prisma.accountAccessRequest.update({
    where: { id: request.id },
    data: {
      status: "rejected",
      adminNote: params.adminNote?.trim() || null,
      reviewedAt: new Date(),
      reviewedById: params.adminId,
    },
  });

  await logAuditEvent({
    actorId: params.adminId,
    action: "account_access.rejected",
    details: { email: request.email, requestId: request.id },
  });

  return { ok: true as const };
}
