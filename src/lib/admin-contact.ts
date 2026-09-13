export const ADMIN_CONTACT_CATEGORIES = ["issue", "concern", "feedback"] as const;
export type AdminContactCategory = (typeof ADMIN_CONTACT_CATEGORIES)[number];

export const ADMIN_CONTACT_STATUSES = ["open", "closed"] as const;
export type AdminContactStatus = (typeof ADMIN_CONTACT_STATUSES)[number];

export const ADMIN_CONTACT_AUTHOR_ROLES = ["user", "admin"] as const;
export type AdminContactAuthorRole = (typeof ADMIN_CONTACT_AUTHOR_ROLES)[number];

export const ADMIN_CONTACT_CATEGORY_LABELS: Record<AdminContactCategory, string> = {
  issue: "Issue",
  concern: "Concern",
  feedback: "Feedback",
};

const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 2000;
const REPLY_MIN_LENGTH = 2;

export function isValidAdminContactCategory(value: string): value is AdminContactCategory {
  return (ADMIN_CONTACT_CATEGORIES as readonly string[]).includes(value);
}

export function isValidAdminContactStatus(value: string): value is AdminContactStatus {
  return (ADMIN_CONTACT_STATUSES as readonly string[]).includes(value);
}

export function normalizeAdminContactStatus(status: string): AdminContactStatus {
  if (status === "resolved") return "closed";
  return isValidAdminContactStatus(status) ? status : "open";
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

export function validateAdminContactMessage(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) {
    return "Message is required";
  }
  if (trimmed.length < REPLY_MIN_LENGTH) {
    return `Message must be at least ${REPLY_MIN_LENGTH} characters`;
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return `Message must be at most ${MESSAGE_MAX_LENGTH} characters`;
  }
  return null;
}

export function validateAdminContactStatusTransition(params: {
  currentStatus: string;
  action: "close" | "reopen";
}): string | null {
  const status = normalizeAdminContactStatus(params.currentStatus);
  if (params.action === "close" && status !== "open") {
    return "Conversation is already closed";
  }
  if (params.action === "reopen" && status !== "closed") {
    return "Conversation is already open";
  }
  return null;
}

export type AdminContactMessageView = {
  id: string;
  authorRole: AdminContactAuthorRole;
  body: string;
  createdAt: string;
  authorEmail: string;
  authorName: string | null;
};

export type AdminContactThreadSummary = {
  id: string;
  category: AdminContactCategory;
  message: string;
  status: AdminContactStatus;
  createdAt: string;
  closedAt: string | null;
  latestMessage: AdminContactMessageView | null;
  messageCount: number;
};

export type AdminContactThreadDetail = AdminContactThreadSummary & {
  messages: AdminContactMessageView[];
  closedByEmail: string | null;
};

export function serializeAdminContactMessage(msg: {
  id: string;
  authorRole: string;
  body: string;
  createdAt: Date;
  author: { email: string; name: string | null };
}): AdminContactMessageView {
  return {
    id: msg.id,
    authorRole: msg.authorRole as AdminContactAuthorRole,
    body: msg.body,
    createdAt: msg.createdAt.toISOString(),
    authorEmail: msg.author.email,
    authorName: msg.author.name,
  };
}

export function serializeThreadSummary(
  thread: {
    id: string;
    category: string;
    message: string;
    status: string;
    createdAt: Date;
    reviewedAt: Date | null;
    messages: Array<{
      id: string;
      authorRole: string;
      body: string;
      createdAt: Date;
      author: { email: string; name: string | null };
    }>;
  },
  messageCount: number,
): AdminContactThreadSummary {
  const latest = thread.messages[0] ?? null;
  return {
    id: thread.id,
    category: thread.category as AdminContactCategory,
    message: thread.message,
    status: normalizeAdminContactStatus(thread.status),
    createdAt: thread.createdAt.toISOString(),
    closedAt: thread.reviewedAt?.toISOString() ?? null,
    latestMessage: latest ? serializeAdminContactMessage(latest) : null,
    messageCount,
  };
}

export function serializeAdminContactThreadDetail(
  thread: {
    id: string;
    category: string;
    message: string;
    status: string;
    createdAt: Date;
    reviewedAt: Date | null;
    reviewedBy: { email: string } | null;
    messages: Array<{
      id: string;
      authorRole: string;
      body: string;
      createdAt: Date;
      author: { email: string; name: string | null };
    }>;
  },
): AdminContactThreadDetail {
  return {
    ...serializeThreadSummary(thread, thread.messages.length),
    messages: thread.messages.map(serializeAdminContactMessage),
    closedByEmail: thread.reviewedBy?.email ?? null,
  };
}

// Backward-compatible alias
export type AdminContactSummary = AdminContactThreadSummary;
