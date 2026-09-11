import { NextResponse } from "next/server";
import { getAgentVersion } from "@/lib/agent-version";
import {
  agentFileContentType,
  authorizeAgentDownload,
  isAgentDownloadFileName,
  readAgentFile,
} from "@/lib/agent-download";

type RouteContext = { params: Promise<{ name: string }> };

export async function GET(request: Request, context: RouteContext) {
  if (!(await authorizeAgentDownload(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await context.params;
  if (!isAgentDownloadFileName(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = await readAgentFile(name);
  return new NextResponse(new Uint8Array(content), {
    headers: {
      "Content-Type": agentFileContentType(name),
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Agent-Version": getAgentVersion(),
      "Cache-Control": "private, no-cache",
    },
  });
}
