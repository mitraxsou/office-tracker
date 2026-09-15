import { NextResponse } from "next/server";
import {
  getCurrentUser,
  getUserInstallTokenState,
  regenerateAgentToken,
} from "@/lib/auth";
import {
  buildBootstrapUninstallCommand,
  buildInstallCommand,
  buildSetupCommand,
  buildUpdateCommand,
} from "@/lib/agent-branding";
import { logAuditEvent } from "@/lib/audit-log";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const before = await getUserInstallTokenState(user.id, appUrl);
  if (before.installTokens.length > 0) {
    return NextResponse.json(
      { error: "Install commands are already available in Settings." },
      { status: 400 },
    );
  }

  const { plainToken } = await regenerateAgentToken(user.id);

  await logAuditEvent({
    actorId: user.id,
    action: "agent_token_reissue",
    targetUserId: user.id,
    details: { reason: "missing_install_commands", selfService: true },
  });

  return NextResponse.json({
    token: plainToken,
    setupCommand: buildSetupCommand(appUrl, plainToken),
    bootstrapUninstallCommand: buildBootstrapUninstallCommand(appUrl, plainToken),
    installCommand: buildInstallCommand(appUrl, plainToken),
    updateCommand: buildUpdateCommand(appUrl, plainToken),
  });
}
