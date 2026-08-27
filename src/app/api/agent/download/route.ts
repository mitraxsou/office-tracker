import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { AGENT_EXTRACT_FOLDER, AGENT_PRODUCT_NAME } from "@/lib/agent-branding";
import { getCurrentUser } from "@/lib/auth";

const AGENT_FILES = [
  "install.ps1",
  "office-heartbeat.ps1",
  "uninstall.ps1",
  "update.ps1",
];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
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
    `${AGENT_PRODUCT_NAME} agent\n\n1. Extract this zip to your Downloads folder (creates ${AGENT_EXTRACT_FOLDER}\\)\n2. Open Settings in the web app\n3. Click "Copy install command" and run in PowerShell\n`
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="PwCOfficePulse-agent.zip"',
    },
  });
}
