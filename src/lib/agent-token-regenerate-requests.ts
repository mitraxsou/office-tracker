import { prisma } from "./db";
import { logAuditEvent } from "./audit-log";
import { regenerateAgentToken, regenerateUserAgentToken } from "./auth";

export const TOKEN_REGEN_REQUEST_STATUSES = ["open", "approved", "rejected"] as const;
export type TokenRegenRequestStatus = (typeof TOKEN_REGEN_REQUEST_STATUSES)[number];

export const TOKEN_REGEN_KINDS = ["regenerate", "refresh_install_commands"] as const;
export type TokenRegenKind = (typeof TOKEN_REGEN_KINDS)[number];

export const TOKEN_REGEN_NEEDS_APPROVAL =
  "Regenerating a token disconnects the laptop until you reinstall. Request approval from an admin first.";

export function isValidTokenRegenRequestStatus(value: string): value is TokenRegenRequestStatus {
  return (TOKEN_REGEN_REQUEST_STATUSES as readonly string[]).includes(value);
}

export function isValidTokenRegenKind(value: string): value is TokenRegenKind {
  return (TOKEN_REGEN_KINDS as readonly string[]).includes(value);
}

/** Settings never revokes a bound token on the spot, including for admin accounts. */
export function canImmediateAgentTokenReissue(_user?: { role: string }) {
  return false;
}

export function validateTokenRegenSubmission(params: {
  kind: string;
  tokenId?: string | null;
  hasOpenRequest: boolean;
}): string | null {
  if (!isValidTokenRegenKind(params.kind)) {
    return "Invalid request type";
  }
  if (params.kind === "regenerate" && params.tokenId !== undefined && params.tokenId !== null) {
    const id = params.tokenId.trim();
    if (!id) {
      return "tokenId required";
    }
  }
  if (params.hasOpenRequest) {
    return "You already have a pending token regenerate request";
  }
  return null;
}

export type TokenRegenRequestSummary = {
  id: string;
  status: string;
  kind: string;
  tokenId: string | null;
  tokenPrefix: string | null;
  tokenLabel: string | null;
  boundSerial: string | null;
  message: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function serializeTokenRegenRequest(request: {
  id: string;
  status: string;
  kind: string;
  tokenId: string | null;
  tokenPrefix: string | null;
  tokenLabel: string | null;
  boundSerial: string | null;
  message: string | null;
  adminNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}): TokenRegenRequestSummary {
  return {
    id: request.id,
    status: request.status,
    kind: request.kind,
    tokenId: request.tokenId,
    tokenPrefix: request.tokenPrefix,
    tokenLabel: request.tokenLabel,
    boundSerial: request.boundSerial,
    message: request.message,
    adminNote: request.adminNote,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  };
}

function requestSummaryLine(request: {
  kind: string;
  tokenPrefix: string | null;
  tokenLabel: string | null;
  boundSerial: string | null;
}) {
  if (request.kind === "refresh_install_commands") {
    return "Refresh install commands";
  }
  const parts = [
    request.tokenLabel ?? "Laptop token",
    request.tokenPrefix ? `prefix ${request.tokenPrefix}` : null,
    request.boundSerial ? `serial ${request.boundSerial}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function tokenRegenRequestSummary(request: {
  kind: string;
  tokenPrefix: string | null;
  tokenLabel: string | null;
  boundSerial: string | null;
}) {
  return requestSummaryLine(request);
}

export async function getUserTokenRegenRequestState(userId: string) {
  const [openRequest, latestRequest] = await Promise.all([
    prisma.agentTokenRegenerateRequest.findFirst({
      where: { userId, status: "open" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.agentTokenRegenerateRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    openRequest: openRequest ? serializeTokenRegenRequest(openRequest) : null,
    latestRequest:
      latestRequest && latestRequest.status !== "open"
        ? serializeTokenRegenRequest(latestRequest)
        : null,
  };
}

export async function createTokenRegenRequest(params: {
  userId: string;
  kind: string;
  tokenId?: string | null;
  message?: string | null;
}) {
  const hasOpenRequest = !!(await prisma.agentTokenRegenerateRequest.findFirst({
    where: { userId: params.userId, status: "open" },
    select: { id: true },
  }));

  const validationError = validateTokenRegenSubmission({
    kind: params.kind,
    tokenId: params.tokenId,
    hasOpenRequest,
  });
  if (validationError) {
    return { error: validationError, status: hasOpenRequest ? 409 : 400 } as const;
  }

  const kind = params.kind as TokenRegenKind;
  let tokenId: string | null = null;
  let tokenPrefix: string | null = null;
  let tokenLabel: string | null = null;
  let boundSerial: string | null = null;

  if (kind === "regenerate") {
    const requestedId = params.tokenId?.trim() || null;
    const token = requestedId
      ? await prisma.agentToken.findFirst({
          where: { id: requestedId, userId: params.userId, revokedAt: null },
        })
      : await prisma.agentToken.findFirst({
          where: { userId: params.userId, revokedAt: null },
          orderBy: { createdAt: "desc" },
        });
    if (!token) {
      return { error: "Token not found", status: 404 } as const;
    }
    tokenId = token.id;
    tokenPrefix = token.tokenPrefix;
    tokenLabel = token.label;
    boundSerial = token.boundSerialNumber;
  }

  const message = params.message?.trim().slice(0, 500) || null;

  const request = await prisma.agentTokenRegenerateRequest.create({
    data: {
      userId: params.userId,
      kind,
      tokenId,
      tokenPrefix,
      tokenLabel,
      boundSerial,
      message,
    },
  });

  await logAuditEvent({
    actorId: params.userId,
    action: "agent_token_regenerate_request",
    targetUserId: params.userId,
    details: {
      requestId: request.id,
      kind,
      tokenId,
      tokenPrefix,
    },
  });

  return { request: serializeTokenRegenRequest(request) } as const;
}

export async function cancelTokenRegenRequest(userId: string, requestId: string) {
  const existing = await prisma.agentTokenRegenerateRequest.findFirst({
    where: { id: requestId, userId },
  });
  if (!existing) {
    return { error: "Request not found", status: 404 } as const;
  }
  if (existing.status !== "open") {
    return { error: "Only open requests can be cancelled", status: 400 } as const;
  }

  await prisma.agentTokenRegenerateRequest.delete({ where: { id: existing.id } });

  await logAuditEvent({
    actorId: userId,
    action: "agent_token_regenerate_cancel",
    targetUserId: userId,
    details: {
      requestId: existing.id,
      kind: existing.kind,
      tokenId: existing.tokenId,
    },
  });

  return { ok: true } as const;
}

export async function resolveTokenRegenRequest(params: {
  adminId: string;
  requestId: string;
  status: "approved" | "rejected";
  adminNote?: string | null;
}) {
  const existing = await prisma.agentTokenRegenerateRequest.findUnique({
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

  if (params.status === "approved") {
    try {
      if (existing.kind === "refresh_install_commands") {
        await regenerateAgentToken(existing.userId);
      } else {
        await regenerateUserAgentToken(existing.userId, existing.tokenId ?? undefined);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not regenerate token";
      return { error: message, status: message === "Token not found" ? 404 : 400 } as const;
    }

    await logAuditEvent({
      actorId: params.adminId,
      action: "agent_token_reissue",
      targetUserId: existing.userId,
      details: {
        reason:
          existing.kind === "refresh_install_commands"
            ? "approved_refresh_install_commands"
            : "approved_regenerate",
        requestId: existing.id,
        selfService: false,
      },
    });
  }

  const updated = await prisma.agentTokenRegenerateRequest.update({
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
        ? "agent_token_regenerate_approve"
        : "agent_token_regenerate_reject",
    targetUserId: existing.userId,
    details: {
      requestId: updated.id,
      kind: existing.kind,
      tokenId: existing.tokenId,
      tokenPrefix: existing.tokenPrefix,
      adminNote,
    },
  });

  return { request: serializeTokenRegenRequest(updated) } as const;
}
