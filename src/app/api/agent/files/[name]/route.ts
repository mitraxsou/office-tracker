import { NextResponse } from "next/server";
import {
  agentFileContentType,
  isAgentDownloadFileName,
  readAgentFilePreferringArtifact,
  resolveAgentDownloadCaller,
  resolveRequestedAgentDownloadVersion,
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

  const requested = new URL(request.url).searchParams.get("version");
  const resolved = await resolveRequestedAgentDownloadVersion(caller, requested);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const targetVersion = resolved.version;
  const content = await readAgentFilePreferringArtifact(name, targetVersion);
  return new NextResponse(new Uint8Array(content), {
    headers: {
      "Content-Type": agentFileContentType(name),
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Agent-Version": targetVersion,
      "Cache-Control": "private, no-cache",
    },
  });
}
