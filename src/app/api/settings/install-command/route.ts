import { NextResponse } from "next/server";
import { getCurrentUser, ensureAgentToken, regenerateAgentToken } from "@/lib/auth";
import { AGENT_DOWNLOAD_FOLDER, buildInstallCommand } from "@/lib/agent-branding";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const extractPath =
    process.env.AGENT_INSTALL_PATH || `$env:USERPROFILE\\Downloads\\PwCOfficePulse`;

  const existing = await ensureAgentToken(user.id);
  let plainToken = existing.plainToken;

  if (!plainToken) {
    const regenerated = await regenerateAgentToken(user.id);
    plainToken = regenerated.plainToken;
  }

  const command = buildInstallCommand(appUrl, plainToken, extractPath);

  return NextResponse.json({
    command,
    token: plainToken,
    appUrl,
    agentFolder: AGENT_DOWNLOAD_FOLDER,
    extractPath,
  });
}
