import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { AGENT_PRODUCT_NAME } from "@/lib/agent-branding";

const AGENT_FILES = [
  "install.ps1",
  "office-heartbeat.ps1",
  "uninstall.ps1",
  "update.ps1",
];

export async function GET() {
  const agentDir = path.join(process.cwd(), "agent");
  const zip = new JSZip();

  for (const file of AGENT_FILES) {
    const content = await readFile(path.join(agentDir, file));
    zip.file(file, content);
  }

  zip.file(
    "README.txt",
    `${AGENT_PRODUCT_NAME} agent\n\n1. Extract this folder to e.g. %USERPROFILE%\\Downloads\\PwCOfficePulse\n2. Open Settings in the web app\n3. Click "Copy install command" and run in PowerShell\n`
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="PwCOfficePulse-agent.zip"',
    },
  });
}
