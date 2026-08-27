import { NextResponse } from "next/server";
import { getCurrentUser, ensureAgentToken } from "@/lib/auth";
import {
  AGENT_EXTRACT_FOLDER,
  AGENT_EXTRACT_PATH_PS,
  buildInstallCommand,
} from "@/lib/agent-branding";
import { peekInstallToken } from "@/lib/welcome-token";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const extractPath = process.env.AGENT_INSTALL_PATH || AGENT_EXTRACT_PATH_PS;

  const existing = await ensureAgentToken(user.id);
  const plainToken = existing.plainToken ?? (await peekInstallToken());

  if (!plainToken) {
    return NextResponse.json(
      {
        error:
          "Agent token is not available. Click Regenerate token above, then copy the install command.",
      },
      { status: 400 }
    );
  }

  const command = buildInstallCommand(appUrl, plainToken, extractPath);

  return NextResponse.json({
    command,
    token: plainToken,
    appUrl,
    agentFolder: AGENT_EXTRACT_FOLDER,
    extractPath,
  });
}
