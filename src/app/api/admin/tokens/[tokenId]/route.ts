import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  reissueAgentToken,
  revealStoredPendingToken,
  revokeAgentToken,
} from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit-log";
import { buildInstallCommand, buildUpdateCommand } from "@/lib/agent-branding";
import { prisma } from "@/lib/db";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tokenId } = await params;
  const token = await prisma.agentToken.findUnique({ where: { id: tokenId } });
  if (!token || token.revokedAt) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  await revokeAgentToken(tokenId);
  await logAuditEvent({
    actorId: admin.id,
    action: "agent_token_revoke",
    targetUserId: token.userId,
    details: { tokenId, label: token.label, prefix: token.tokenPrefix },
  });

  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tokenId } = await params;
  let action = "share";
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === "reissue") action = "reissue";
  } catch {
    /* default share */
  }

  const token = await prisma.agentToken.findUnique({ where: { id: tokenId } });
  if (!token || token.revokedAt) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  if (token.boundSerialNumber) {
    return NextResponse.json({ error: "Token is already bound to a laptop" }, { status: 400 });
  }

  let plainToken = revealStoredPendingToken(token);
  let reissued = false;

  if (!plainToken || action === "reissue") {
    const { plainToken: newPlain, record } = await reissueAgentToken(tokenId, {
      issuedById: admin.id,
    });
    plainToken = newPlain;
    reissued = true;
    await logAuditEvent({
      actorId: admin.id,
      action: "agent_token_reissue",
      targetUserId: record.userId,
      details: { oldTokenId: tokenId, label: record.label },
    });
  } else {
    await logAuditEvent({
      actorId: admin.id,
      action: "agent_token_share",
      targetUserId: token.userId,
      details: { tokenId, label: token.label },
    });
  }

  const installCommand = buildInstallCommand(appUrl(), plainToken);
  const updateCommand = buildUpdateCommand(appUrl(), plainToken);
  return NextResponse.json({ token: plainToken, installCommand, updateCommand, reissued });
}
