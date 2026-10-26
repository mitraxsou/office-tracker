import { NextResponse } from "next/server";
import JSZip from "jszip";
import {
  AGENT_EXTRACT_FOLDER,
  AGENT_PRODUCT_NAME,
  formatAgentZipDownloadFilename,
} from "@/lib/agent-branding";
import {
  AGENT_DOWNLOAD_FILES,
  agentZipEntryPath,
  readAgentFilePreferringArtifact,
  resolveAgentDownloadCaller,
  resolveRequestedAgentDownloadVersion,
} from "@/lib/agent-download";

export async function GET(request: Request) {
  const caller = await resolveAgentDownloadCaller(request);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = new URL(request.url).searchParams.get("version");
  const resolved = await resolveRequestedAgentDownloadVersion(caller, requested);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const version = resolved.version;
  const zip = new JSZip();

  for (const file of AGENT_DOWNLOAD_FILES) {
    const content = await readAgentFilePreferringArtifact(file, version);
    const entryPath = agentZipEntryPath(file);
    zip.file(`${AGENT_EXTRACT_FOLDER}/${entryPath}`, content);
  }

  zip.file(
    `${AGENT_EXTRACT_FOLDER}/README.txt`,
    `${AGENT_PRODUCT_NAME} agent (v${version})\n\n1. Extract this zip (Extract All may create a nested folder).\n2. Open PowerShell in the folder that contains setup.ps1 and a lib\\ folder (agent-download.ps1 inside lib).\n3. In Settings, copy the reinstall command and paste in that PowerShell window.\n\nOn PwC laptops Downloads is often OneDrive - PwC\\Downloads.\n`,
  );

  const zipFilename = formatAgentZipDownloadFilename(version);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
      "X-Agent-Version": version,
    },
  });
}
