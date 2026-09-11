import { NextResponse } from "next/server";
import {
  getCurrentUser,
  getUserInstallTokenState,
  regenerateAgentToken,
} from "@/lib/auth";
import { buildInstallCommand, buildUpdateCommand } from "@/lib/agent-branding";
import { logAuditEvent } from "@/lib/audit-log";

/** Issue a fresh token with copy-paste install/update commands (full -Token in command). */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const before = await getUserInstallTokenState(user.id, appUrl);
  const needsRefresh =
    before.installTokens.some((t) => t.usesLocalConfig) || before.legacyBoundCount > 0;

  if (before.installTokens.length > 0 && !needsRefresh) {
    return NextResponse.json(
      { error: "Full install commands are already shown below." },
      { status: 400 },
    );
  }

  const { plainToken } = await regenerateAgentToken(user.id);

  await logAuditEvent({
    actorId: user.id,
    action: "agent_token_reissue",
    targetUserId: user.id,
    details: { reason: "refresh_install_commands", selfService: true },
  });

  const after = await getUserInstallTokenState(user.id, appUrl);

  return NextResponse.json({
    token: plainToken,
    installCommand: buildInstallCommand(appUrl, plainToken),
    updateCommand: buildUpdateCommand(appUrl, plainToken),
    installTokens: after.installTokens,
  });
}
