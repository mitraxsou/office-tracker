import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { AGENT_EXTRACT_FOLDER, AGENT_PRODUCT_NAME } from "@/lib/agent-branding";
import { getAgentVersion } from "@/lib/agent-version";
import { getCurrentUser, getUserByAgentToken } from "@/lib/auth";
import { extractBearerToken } from "@/lib/security";

const AGENT_FILES = [
  "install.ps1",
  "office-heartbeat.ps1",
  "uninstall.ps1",
  "update.ps1",
  "version.txt",
];

async function authorizeAgentDownload(request: Request): Promise<boolean> {
  const sessionUser = await getCurrentUser();
  if (sessionUser) return true;

  const token = extractBearerToken(request);
  if (!token) return false;

  const agentUser = await getUserByAgentToken(token);
  return Boolean(agentUser);
}

export async function GET(request: Request) {
  if (!(await authorizeAgentDownload(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentDir = path.join(process.cwd(), "agent");
  const zip = new JSZip();

  for (const file of AGENT_FILES) {
    const content = await readFile(path.join(agentDir, file));
    zip.file(`${AGENT_EXTRACT_FOLDER}/${file}`, content);
  }

  zip.file(
    `${AGENT_EXTRACT_FOLDER}/README.txt`,
    `${AGENT_PRODUCT_NAME} agent (v${getAgentVersion()})\n\n1. Extract this zip to your Downloads folder (creates ${AGENT_EXTRACT_FOLDER}\\)\n2. Open Settings in the web app\n3. Click "Copy install command" and run in PowerShell\n\nRe-running the install command is safe: it refreshes an existing install.\n`
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="PwCOfficePulse-agent.zip"',
      "X-Agent-Version": getAgentVersion(),
    },
  });
}
