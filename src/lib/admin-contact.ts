import { prisma } from "./db";
import { logAuditEvent } from "./audit-log";
import { createInAppNotification } from "./in-app-notifications";

export const ADMIN_CONTACT_CATEGORIES = ["issue", "concern", "feedback"] as const;
export type AdminContactCategory = (typeof ADMIN_CONTACT_CATEGORIES)[number];

export const ADMIN_CONTACT_STATUSES = ["open", "resolved"] as const;
export type AdminContactStatus = (typeof ADMIN_CONTACT_STATUSES)[number];

export const ADMIN_CONTACT_CATEGORY_LABELS: Record<AdminContactCategory, string> = {
  issue: "Issue",
  concern: "Concern",
  feedback: "Feedback",
};

const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 2000;
const RESPONSE_MAX_LENGTH = 2000;

export function isValidAdminContactCategory(value: string): value is AdminContactCategory {
  return (ADMIN_CONTACT_CATEGORIES as readonly string[]).includes(value);
}

export function isValidAdminContactStatus(value: string): value is AdminContactStatus {
  return (ADMIN_CONTACT_STATUSES as readonly string[]).includes(value);
}

export function validateAdminContactSubmission(params: {
  category: string;
  message: string;
}): string | null {
  if (!isValidAdminContactCategory(params.category)) {
    return "Category must be issue, concern, or feedback";
  }
  const trimmed = params.message.trim();
  if (!trimmed) {
    return "Message is required";
  }
  if (trimmed.length < MESSAGE_MIN_LENGTH) {
    return `Message must be at least ${MESSAGE_MIN_LENGTH} characters`;
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return `Message must be at most ${MESSAGE_MAX_LENGTH} characters`;
  }
  return null;
}

export function validateAdminContactResolution(params: {
  status: string;
  adminResponse?: string | null;
}): string | null {
  if (!isValidAdminContactStatus(params.status)) {
    return "Status must be open or resolved";
  }
  if (params.status === "resolved") {
    const response = params.adminResponse?.trim() ?? "";
    if (!response) {
      return "Admin response is required when resolving";
    }
    if (response.length > RESPONSE_MAX_LENGTH) {
      return `Response must be at most ${RESPONSE_MAX_LENGTH} characters`;
    }
  }
  return null;
}

export type AdminContactSummary = {
  id: string;
  category: AdminContactCategory;
  message: string;
  status: AdminContactStatus;
  adminResponse: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function serializeAdminContactSubmission(submission: {
  id: string;
  category: string;
  message: string;
  status: string;
  adminResponse: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}): AdminContactSummary {
  return {
    id: submission.id,
    category: submission.category as AdminContactCategory,
    message: submission.message,
    status: submission.status as AdminContactStatus,
    adminResponse: submission.adminResponse,
    createdAt: submission.createdAt.toISOString(),
    reviewedAt: submission.reviewedAt?.toISOString() ?? null,
  };
}

export async function listUserAdminContactSubmissions(userId: string, limit = 20) {
  const rows = await prisma.adminContactSubmission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(serializeAdminContactSubmission);
}

export async function createAdminContactSubmission(params: {
  userId: string;
  category: string;
  message: string;
}) {
  const validationError = validateAdminContactSubmission({
    category: params.category,
    message: params.message,
  });
  if (validationError) {
    return { error: validationError, status: 400 } as const;
  }

  const submission = await prisma.adminContactSubmission.create({
    data: {
      userId: params.userId,
      category: params.category,
      message: params.message.trim().slice(0, MESSAGE_MAX_LENGTH),
    },
  });

  await logAuditEvent({
    actorId: params.userId,
    action: "admin_contact_submit",
    targetUserId: params.userId,
    details: {
      submissionId: submission.id,
      category: submission.category,
    },
  });

  return { submission: serializeAdminContactSubmission(submission) } as const;
}

export async function resolveAdminContactSubmission(params: {
  adminId: string;
  submissionId: string;
  status: AdminContactStatus;
  adminResponse?: string | null;
}) {
  const validationError = validateAdminContactResolution({
    status: params.status,
    adminResponse: params.adminResponse,
  });
  if (validationError) {
    return { error: validationError, status: 400 } as const;
  }

  const existing = await prisma.adminContactSubmission.findUnique({
    where: { id: params.submissionId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!existing) {
    return { error: "Submission not found", status: 404 } as const;
  }
  if (existing.status !== "open" && params.status === "resolved") {
    return { error: "Submission is already resolved", status: 400 } as const;
  }

  const adminResponse =
    params.adminResponse !== undefined && params.adminResponse !== null
      ? params.adminResponse.trim().slice(0, RESPONSE_MAX_LENGTH) || null
      : existing.adminResponse;

  const reviewedAt = params.status === "resolved" ? new Date() : existing.reviewedAt;

  const updated = await prisma.adminContactSubmission.update({
    where: { id: existing.id },
    data: {
      status: params.status,
      adminResponse,
      reviewedAt,
      reviewedById: params.status === "resolved" ? params.adminId : existing.reviewedById,
    },
  });

  await logAuditEvent({
    actorId: params.adminId,
    action: "admin_contact_resolve",
    targetUserId: existing.userId,
    details: {
      submissionId: updated.id,
      category: updated.category,
      status: updated.status,
    },
  });

  if (params.status === "resolved" && adminResponse) {
    const categoryLabel =
      ADMIN_CONTACT_CATEGORY_LABELS[updated.category as AdminContactCategory] ?? updated.category;
    await createInAppNotification({
      userId: existing.userId,
      type: "admin_contact_response",
      dayKey: updated.id,
      message: `Admin replied to your ${categoryLabel.toLowerCase()}: ${adminResponse}`,
    }).catch(() => undefined);
  }

  return { submission: serializeAdminContactSubmission(updated) } as const;
}
