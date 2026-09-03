import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { issueAgentToken } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit-log";
import { buildInstallCommand, buildUpdateCommand } from "@/lib/agent-branding";
import { prisma } from "@/lib/db";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: { label?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const label = body.label?.trim() || `Laptop ${new Date().toLocaleDateString("en-IN")}`;
  const { plainToken } = await issueAgentToken(user.id, {
    label,
    issuedById: admin.id,
  });

  await logAuditEvent({
    actorId: admin.id,
    action: "agent_token_issue",
    targetUserId: user.id,
    details: { label },
  });

  const installCommand = buildInstallCommand(appUrl(), plainToken);
  const updateCommand = buildUpdateCommand(appUrl(), plainToken);

  return NextResponse.json({
    token: plainToken,
    installCommand,
    updateCommand,
    label,
  });
}
