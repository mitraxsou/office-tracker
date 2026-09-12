import { NextResponse } from "next/server";
import {
  ensureUserInstallCommands,
  getCurrentUser,
} from "@/lib/auth";
import {
  AGENT_EXTRACT_FOLDER,
  AGENT_EXTRACT_PATH_PS,
} from "@/lib/agent-branding";
import { peekInstallToken } from "@/lib/welcome-token";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const extractPath = process.env.AGENT_INSTALL_PATH || AGENT_EXTRACT_PATH_PS;

  const sessionInstallToken = await peekInstallToken();
  const { installTokens: tokens } = await ensureUserInstallCommands(
    user.id,
    appUrl,
    sessionInstallToken,
  );
  const first = tokens[0];

  if (!first) {
    return NextResponse.json(
      {
        error:
          "No install token available. Ask your admin to issue a laptop token from Admin → Users & tokens.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    command: first.setupCommand,
    setupCommand: first.setupCommand,
    installCommand: first.installCommand,
    updateCommand: first.updateCommand,
    token: first.plainToken,
    appUrl,
    agentFolder: AGENT_EXTRACT_FOLDER,
    extractPath,
  });
}
