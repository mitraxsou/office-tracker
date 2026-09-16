import { NextResponse } from "next/server";
import {
  getCurrentUser,
  getUserInstallTokenState,
  regenerateUserAgentToken,
} from "@/lib/auth";
import {
  buildBootstrapUninstallCommand,
  buildInstallCommand,
  buildSetupCommand,
  buildUpdateCommand,
} from "@/lib/agent-branding";
import { logAuditEvent } from "@/lib/audit-log";
import { checkRateLimit } from "@/lib/security";

const REGENERATE_RATE_LIMIT_MS = 60_000;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(`settings-agent-token-regen:${user.id}`, REGENERATE_RATE_LIMIT_MS)) {
    return NextResponse.json(
      { error: "Please wait a minute before regenerating again." },
      { status: 429 },
    );
  }

  let tokenId: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.tokenId === "string" && body.tokenId.trim()) {
      tokenId = body.tokenId.trim();
    }
  } catch {
    /* empty body */
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const { plainToken, record } = await regenerateUserAgentToken(user.id, tokenId);

    await logAuditEvent({
      actorId: user.id,
      action: "agent_token_reissue",
      targetUserId: user.id,
      details: {
        reason: "self_regenerate",
        selfService: true,
        oldTokenId: tokenId ?? null,
        newTokenId: record.id,
        label: record.label,
      },
    });

    const after = await getUserInstallTokenState(user.id, appUrl);

    return NextResponse.json({
      token: plainToken,
      setupCommand: buildSetupCommand(appUrl, plainToken),
      bootstrapUninstallCommand: buildBootstrapUninstallCommand(appUrl, plainToken),
      installCommand: buildInstallCommand(appUrl, plainToken),
      updateCommand: buildUpdateCommand(appUrl, plainToken),
      installTokens: after.installTokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not regenerate token";
    const status = message === "Token not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
