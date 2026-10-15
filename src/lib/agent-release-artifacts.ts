import { createHash } from "crypto";
import { prisma } from "./db";
import {
  AGENT_CORE_DOWNLOAD_FILES,
  readAgentFile,
} from "./agent-download";
import { getAgentVersion } from "./agent-version";

export type AgentCoreFileName = (typeof AGENT_CORE_DOWNLOAD_FILES)[number];

export function isAgentCoreFileName(name: string): name is AgentCoreFileName {
  return (AGENT_CORE_DOWNLOAD_FILES as readonly string[]).includes(name);
}

export function fleetStableFilesBaseUrl(appUrl: string, version: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/agent/releases/${encodeURIComponent(version)}/files`;
}

export async function snapshotFleetStableAgentRelease(version: string): Promise<void> {
  const normalized = version.trim();
  const repoVersion = getAgentVersion();
  if (!normalized || normalized !== repoVersion) {
    throw new Error(
      `Cannot snapshot agent ${normalized || "(empty)"} from deploy tree ${repoVersion}`,
    );
  }

  const rows = await Promise.all(
    AGENT_CORE_DOWNLOAD_FILES.map(async (fileName) => {
      const content =
        fileName === "version.txt"
          ? Buffer.from(`${normalized}\n`, "utf8")
          : await readAgentFile(fileName);
      return {
        version: normalized,
        fileName,
        content: Uint8Array.from(content),
        sha256: createHash("sha256").update(content).digest("hex"),
      };
    }),
  );

  await prisma.$transaction([
    prisma.agentReleaseArtifact.deleteMany({ where: { version: normalized } }),
    prisma.agentReleaseArtifact.createMany({ data: rows }),
  ]);
}

export async function readFleetStableAgentFile(
  version: string,
  fileName: AgentCoreFileName,
): Promise<{ content: Buffer; sha256: string } | null> {
  const artifact = await prisma.agentReleaseArtifact.findUnique({
    where: {
      version_fileName: {
        version: version.trim(),
        fileName,
      },
    },
    select: { content: true, sha256: true },
  });
  if (!artifact) return null;
  return {
    content: Buffer.from(artifact.content),
    sha256: artifact.sha256,
  };
}
