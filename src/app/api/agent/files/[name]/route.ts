import { NextResponse } from "next/server";
import {
  agentFileContentType,
  isAgentDownloadFileName,
  readAgentFile,
  resolveAgentDownloadCaller,
  resolveCallerAgentTargetVersion,
} from "@/lib/agent-download";

type RouteContext = { params: Promise<{ name: string }> };

export async function GET(request: Request, context: RouteContext) {
  const caller = await resolveAgentDownloadCaller(request);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await context.params;
  if (!isAgentDownloadFileName(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const targetVersion = await resolveCallerAgentTargetVersion(caller);
  const content = await readAgentFile(name, { targetVersion });
  return new NextResponse(new Uint8Array(content), {
    headers: {
      "Content-Type": agentFileContentType(name),
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Agent-Version": targetVersion,
      "Cache-Control": "private, no-cache",
    },
  });
}
