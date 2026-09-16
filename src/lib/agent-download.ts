import { readFile } from "fs/promises";
import path from "path";
import { getCurrentUser, getUserByAgentToken } from "@/lib/auth";
import { extractBearerToken } from "@/lib/security";

export const AGENT_DOWNLOAD_FILES = [
  "install.ps1",
  "office-heartbeat.ps1",
  "uninstall.ps1",
  "update.ps1",
  "setup.ps1",
  "agent-download.ps1",
  "agent-storage.ps1",
  "version.txt",
] as const;

export type AgentDownloadFileName = (typeof AGENT_DOWNLOAD_FILES)[number];

const CONTENT_TYPES: Record<AgentDownloadFileName, string> = {
  "install.ps1": "text/plain; charset=utf-8",
  "office-heartbeat.ps1": "text/plain; charset=utf-8",
  "uninstall.ps1": "text/plain; charset=utf-8",
  "update.ps1": "text/plain; charset=utf-8",
  "setup.ps1": "text/plain; charset=utf-8",
  "agent-download.ps1": "text/plain; charset=utf-8",
  "agent-storage.ps1": "text/plain; charset=utf-8",
  "version.txt": "text/plain; charset=utf-8",
};

const FILE_PATHS: Partial<Record<AgentDownloadFileName, string>> = {
  "agent-download.ps1": "lib/agent-download.ps1",
  "agent-storage.ps1": "lib/agent-storage.ps1",
};

/** Path inside the agent zip (matches repo layout and reinstall command). */
export function agentZipEntryPath(name: AgentDownloadFileName): string {
  return FILE_PATHS[name] ?? name;
}

export function isAgentDownloadFileName(name: string): name is AgentDownloadFileName {
  return (AGENT_DOWNLOAD_FILES as readonly string[]).includes(name);
}

export async function authorizeAgentDownload(request: Request): Promise<boolean> {
  const sessionUser = await getCurrentUser();
  if (sessionUser) return true;

  const token = extractBearerToken(request);
  if (!token) return false;

  const agentUser = await getUserByAgentToken(token);
  return Boolean(agentUser);
}

export async function readAgentFile(name: AgentDownloadFileName): Promise<Buffer> {
  const agentDir = path.join(process.cwd(), "agent");
  const relativePath = FILE_PATHS[name] ?? name;
  return readFile(path.join(agentDir, relativePath));
}

export function agentFileContentType(name: AgentDownloadFileName): string {
  return CONTENT_TYPES[name];
}

/** Base URL for per-file agent downloads (same app, not external GitHub). */
export function agentScriptFilesBaseUrl(appUrl: string): string {
  const override = process.env.AGENT_SCRIPT_FALLBACK_BASE?.replace(/\/$/, "");
  if (override) {
    return override.includes("/api/agent/files") ? override : `${override}/api/agent/files`;
  }
  return `${appUrl.replace(/\/$/, "")}/api/agent/files`;
}

/** Vercel Deployment Protection bypass for agent/cron automation (project setting). */
export function vercelProtectionBypassSecret(): string | null {
  const value =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ||
    process.env.VERCEL_PROTECTION_BYPASS_SECRET?.trim();
  return value || null;
}
