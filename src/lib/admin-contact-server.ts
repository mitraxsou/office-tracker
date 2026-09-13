import { prisma } from "./db";
import { logAuditEvent } from "./audit-log";
import { createInAppNotification } from "./in-app-notifications";
import {
  ADMIN_CONTACT_CATEGORY_LABELS,
  type AdminContactAuthorRole,
  type AdminContactCategory,
  normalizeAdminContactStatus,
  serializeAdminContactMessage,
  serializeAdminContactThreadDetail,
  serializeThreadSummary,
  validateAdminContactMessage,
  validateAdminContactStatusTransition,
  validateAdminContactSubmission,
} from "./admin-contact";

const MESSAGE_MAX_LENGTH = 2000;

const messageInclude = {
  author: { select: { email: true, name: true } },
} as const;

const threadListInclude = {
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: messageInclude,
  },
  _count: { select: { messages: true } },
} as const;

export async function listUserAdminContactThreads(userId: string, limit = 20) {
  const rows = await prisma.adminContactSubmission.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: threadListInclude,
  });
  return rows.map((row) =>
    serializeThreadSummary(
      { ...row, messages: row.messages },
      row._count.messages,
    ),
  );
}

export async function getUserAdminContactThread(userId: string, threadId: string) {
  const thread = await prisma.adminContactSubmission.findUnique({
    where: { id: threadId },
    include: {
      reviewedBy: { select: { email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: messageInclude,
      },
    },
  });
  if (!thread || thread.userId !== userId) {
    return { error: "Conversation not found", status: 404 } as const;
  }
  return { thread: serializeAdminContactThreadDetail(thread) } as const;
}

export async function createAdminContactThread(params: {
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

  const trimmed = params.message.trim().slice(0, MESSAGE_MAX_LENGTH);
  const thread = await prisma.$transaction(async (tx) => {
    const created = await tx.adminContactSubmission.create({
      data: {
        userId: params.userId,
        category: params.category,
        message: trimmed,
      },
    });
    await tx.adminContactMessage.create({
      data: {
        threadId: created.id,
        authorId: params.userId,
        authorRole: "user",
        body: trimmed,
      },
    });
    return created;
  });

  await logAuditEvent({
    actorId: params.userId,
    action: "admin_contact_submit",
    targetUserId: params.userId,
    details: {
      threadId: thread.id,
      category: thread.category,
    },
  });

  const detail = await getUserAdminContactThread(params.userId, thread.id);
  if ("error" in detail) {
    return { error: detail.error, status: detail.status } as const;
  }
  return { thread: detail.thread } as const;
}

export async function addAdminContactMessage(params: {
  threadId: string;
  authorId: string;
  authorRole: AdminContactAuthorRole;
  body: string;
  threadUserId?: string;
}) {
  const validationError = validateAdminContactMessage(params.body);
  if (validationError) {
    return { error: validationError, status: 400 } as const;
  }

  const existing = await prisma.adminContactSubmission.findUnique({
    where: { id: params.threadId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!existing) {
    return { error: "Conversation not found", status: 404 } as const;
  }
  if (params.threadUserId && existing.userId !== params.threadUserId) {
    return { error: "Conversation not found", status: 404 } as const;
  }
  if (normalizeAdminContactStatus(existing.status) !== "open") {
    return { error: "Conversation is closed", status: 400 } as const;
  }

  const trimmed = params.body.trim().slice(0, MESSAGE_MAX_LENGTH);
  const message = await prisma.adminContactMessage.create({
    data: {
      threadId: params.threadId,
      authorId: params.authorId,
      authorRole: params.authorRole,
      body: trimmed,
    },
    include: messageInclude,
  });

  await prisma.adminContactSubmission.update({
    where: { id: params.threadId },
    data: { updatedAt: new Date() },
  });

  await logAuditEvent({
    actorId: params.authorId,
    action: "admin_contact_message",
    targetUserId: existing.userId,
    details: {
      threadId: params.threadId,
      role: params.authorRole,
    },
  });

  const categoryLabel =
    ADMIN_CONTACT_CATEGORY_LABELS[existing.category as AdminContactCategory] ??
    existing.category;

  if (params.authorRole === "admin") {
    await createInAppNotification({
      userId: existing.userId,
      type: "admin_contact_message",
      dayKey: `${params.threadId}:${message.id}`,
      message: `Admin replied in your ${categoryLabel.toLowerCase()} conversation: ${trimmed.slice(0, 120)}`,
    }).catch(() => undefined);
  }

  return { message: serializeAdminContactMessage(message) } as const;
}

export async function closeAdminContactThread(params: {
  threadId: string;
  actorId: string;
  actorRole: AdminContactAuthorRole;
  threadUserId?: string;
}) {
  const existing = await prisma.adminContactSubmission.findUnique({
    where: { id: params.threadId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!existing) {
    return { error: "Conversation not found", status: 404 } as const;
  }
  if (params.threadUserId && existing.userId !== params.threadUserId) {
    return { error: "Conversation not found", status: 404 } as const;
  }

  const transitionError = validateAdminContactStatusTransition({
    currentStatus: existing.status,
    action: "close",
  });
  if (transitionError) {
    return { error: transitionError, status: 400 } as const;
  }

  const updated = await prisma.adminContactSubmission.update({
    where: { id: params.threadId },
    data: {
      status: "closed",
      reviewedAt: new Date(),
      reviewedById: params.actorId,
    },
    include: {
      reviewedBy: { select: { email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: messageInclude,
      },
    },
  });

  await logAuditEvent({
    actorId: params.actorId,
    action: "admin_contact_close",
    targetUserId: existing.userId,
    details: {
      threadId: params.threadId,
      role: params.actorRole,
    },
  });

  const categoryLabel =
    ADMIN_CONTACT_CATEGORY_LABELS[updated.category as AdminContactCategory] ??
    updated.category;

  if (params.actorRole === "admin") {
    await createInAppNotification({
      userId: existing.userId,
      type: "admin_contact_closed",
      dayKey: params.threadId,
      message: `Your ${categoryLabel.toLowerCase()} conversation was closed by admin.`,
    }).catch(() => undefined);
  }

  return { thread: serializeAdminContactThreadDetail(updated) } as const;
}

export async function reopenAdminContactThread(params: {
  threadId: string;
  actorId: string;
  actorRole: AdminContactAuthorRole;
  threadUserId?: string;
}) {
  const existing = await prisma.adminContactSubmission.findUnique({
    where: { id: params.threadId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!existing) {
    return { error: "Conversation not found", status: 404 } as const;
  }
  if (params.threadUserId && existing.userId !== params.threadUserId) {
    return { error: "Conversation not found", status: 404 } as const;
  }

  const transitionError = validateAdminContactStatusTransition({
    currentStatus: existing.status,
    action: "reopen",
  });
  if (transitionError) {
    return { error: transitionError, status: 400 } as const;
  }

  const updated = await prisma.adminContactSubmission.update({
    where: { id: params.threadId },
    data: {
      status: "open",
      reviewedAt: null,
      reviewedById: null,
    },
    include: {
      reviewedBy: { select: { email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: messageInclude,
      },
    },
  });

  await logAuditEvent({
    actorId: params.actorId,
    action: "admin_contact_reopen",
    targetUserId: existing.userId,
    details: {
      threadId: params.threadId,
      role: params.actorRole,
    },
  });

  const categoryLabel =
    ADMIN_CONTACT_CATEGORY_LABELS[updated.category as AdminContactCategory] ??
    updated.category;

  if (params.actorRole === "admin") {
    await createInAppNotification({
      userId: existing.userId,
      type: "admin_contact_reopened",
      dayKey: params.threadId,
      message: `Your ${categoryLabel.toLowerCase()} conversation was reopened by admin.`,
    }).catch(() => undefined);
  }

  return { thread: serializeAdminContactThreadDetail(updated) } as const;
}

export async function listAdminContactThreads(params: {
  status?: string;
  limit?: number;
}) {
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));
  const statusFilter = params.status ?? "open";

  const where =
    statusFilter === "all"
      ? undefined
      : statusFilter === "closed"
        ? { status: { in: ["closed", "resolved"] } }
        : { status: "open" };

  const rows = await prisma.adminContactSubmission.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, email: true, name: true } },
      reviewedBy: { select: { email: true } },
      ...threadListInclude,
    },
  });

  return rows.map((row) => ({
    ...serializeThreadSummary({ ...row, messages: row.messages }, row._count.messages),
    user: row.user,
    closedByEmail: row.reviewedBy?.email ?? null,
  }));
}

export async function getAdminContactThread(threadId: string) {
  const thread = await prisma.adminContactSubmission.findUnique({
    where: { id: threadId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      reviewedBy: { select: { email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: messageInclude,
      },
    },
  });
  if (!thread) {
    return { error: "Conversation not found", status: 404 } as const;
  }
  return {
    thread: {
      ...serializeAdminContactThreadDetail(thread),
      user: thread.user,
    },
  } as const;
}

/** Migrate legacy single-reply rows into threaded messages. Safe to run repeatedly. */
export async function migrateAdminContactThreads() {
  const legacyRows = await prisma.adminContactSubmission.findMany({
    where: { messages: { none: {} } },
    select: {
      id: true,
      userId: true,
      message: true,
      adminResponse: true,
      status: true,
      reviewedAt: true,
      reviewedById: true,
    },
  });

  for (const row of legacyRows) {
    await prisma.$transaction(async (tx) => {
      await tx.adminContactMessage.create({
        data: {
          threadId: row.id,
          authorId: row.userId,
          authorRole: "user",
          body: row.message,
        },
      });
      if (row.adminResponse?.trim()) {
        await tx.adminContactMessage.create({
          data: {
            threadId: row.id,
            authorId: row.reviewedById ?? row.userId,
            authorRole: "admin",
            body: row.adminResponse.trim(),
          },
        });
      }
      if (row.status === "resolved") {
        await tx.adminContactSubmission.update({
          where: { id: row.id },
          data: { status: "closed" },
        });
      }
    });
  }

  return legacyRows.length;
}

// Backward-compatible aliases used by older imports
export const listUserAdminContactSubmissions = listUserAdminContactThreads;
export const createAdminContactSubmission = createAdminContactThread;
