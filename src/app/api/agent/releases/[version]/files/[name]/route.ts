import { NextResponse } from "next/server";
import {
  agentFileContentType,
  resolveAgentDownloadCaller,
} from "@/lib/agent-download";
import {
  isAgentCoreFileName,
  readFleetStableAgentFile,
} from "@/lib/agent-release-artifacts";
import { getCachedAppConfig } from "@/lib/agent-config-cache";

type RouteContext = {
  params: Promise<{ version: string; name: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const caller = await resolveAgentDownloadCaller(request);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { version, name } = await context.params;
  const config = await getCachedAppConfig();
  if (version !== config.agentFleetStableVersion || !isAgentCoreFileName(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const artifact = await readFleetStableAgentFile(version, name);
  if (!artifact) {
    return NextResponse.json(
      { error: "Fleet-stable recovery artifact is not available" },
      { status: 503 },
    );
  }

  return new NextResponse(new Uint8Array(artifact.content), {
    headers: {
      "Content-Type": agentFileContentType(name),
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Agent-Version": version,
      "X-Agent-SHA256": artifact.sha256,
      "Cache-Control": "private, no-store",
    },
  });
}
