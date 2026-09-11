import { NextResponse } from "next/server";
import JSZip from "jszip";
import { AGENT_EXTRACT_FOLDER, AGENT_PRODUCT_NAME } from "@/lib/agent-branding";
import { getAgentVersion } from "@/lib/agent-version";
import {
  AGENT_DOWNLOAD_FILES,
  authorizeAgentDownload,
  readAgentFile,
} from "@/lib/agent-download";

export async function GET(request: Request) {
  if (!(await authorizeAgentDownload(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const zip = new JSZip();

  for (const file of AGENT_DOWNLOAD_FILES) {
    const content = await readAgentFile(file);
    zip.file(`${AGENT_EXTRACT_FOLDER}/${file}`, content);
  }

  zip.file(
    `${AGENT_EXTRACT_FOLDER}/README.txt`,
    `${AGENT_PRODUCT_NAME} agent (v${getAgentVersion()})\n\n1. Extract this zip (Extract All on PwCOfficePulse-agent.zip may create a nested folder).\n2. Open PowerShell in the folder that contains install.ps1 and update.ps1 (dir must list them). On PwC laptops Downloads is often OneDrive - PwC\\Downloads.\n3. In Settings, copy the install command (first setup) or update command (existing agent) and paste here.\n\nCommands use .\\install.ps1 and .\\update.ps1. They only work from this folder.\n`
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
