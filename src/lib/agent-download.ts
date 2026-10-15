import { readFile } from "fs/promises";
import path from "path";
import { getCurrentUser, getUserByAgentToken } from "@/lib/auth";
import { getCachedAppConfig } from "@/lib/agent-config-cache";
import { resolveAgentTargetVersionFromConfig } from "@/lib/agent-rollout";
import { getAgentVersion } from "@/lib/agent-version";
import { extractBearerToken } from "@/lib/security";

export const AGENT_CORE_DOWNLOAD_FILES = [
  "install.ps1",
  "office-heartbeat.ps1",
  "uninstall.ps1",
  "update.ps1",
  "setup.ps1",
  "agent-download.ps1",
  "agent-storage.ps1",
  "version.txt",
  "test-connection.ps1",
] as const;

export const WATCHDOG_DOWNLOAD_FILES = [
  "watchdog.ps1",
  "run-watchdog.vbs",
  "install-watchdog.ps1",
] as const;

export const AGENT_DOWNLOAD_FILES = [
  ...AGENT_CORE_DOWNLOAD_FILES,
  ...WATCHDOG_DOWNLOAD_FILES,
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
  "test-connection.ps1": "text/plain; charset=utf-8",
  "watchdog.ps1": "text/plain; charset=utf-8",
  "run-watchdog.vbs": "text/plain; charset=utf-8",
  "install-watchdog.ps1": "text/plain; charset=utf-8",
};

const FILE_PATHS: Partial<Record<AgentDownloadFileName, string>> = {
  "agent-download.ps1": "lib/agent-download.ps1",
  "agent-storage.ps1": "lib/agent-storage.ps1",
  "watchdog.ps1": "watchdog/watchdog.ps1",
  "run-watchdog.vbs": "watchdog/run-watchdog.vbs",
  "install-watchdog.ps1": "watchdog/install-watchdog.ps1",
};

export type AgentDownloadCaller = {
  email: string;
  id: string;
};

/** Path inside the agent zip (matches repo layout and reinstall command). */
export function agentZipEntryPath(name: AgentDownloadFileName): string {
  return FILE_PATHS[name] ?? name;
}

export function isAgentDownloadFileName(name: string): name is AgentDownloadFileName {
  return (AGENT_DOWNLOAD_FILES as readonly string[]).includes(name);
}

export async function resolveAgentDownloadCaller(
  request: Request,
): Promise<AgentDownloadCaller | null> {
  const sessionUser = await getCurrentUser();
  if (sessionUser) {
    return { id: sessionUser.id, email: sessionUser.email };
  }

  const token = extractBearerToken(request);
  if (!token) return null;

  const agentUser = await getUserByAgentToken(token);
  if (!agentUser) return null;
  return { id: agentUser.id, email: agentUser.email };
}

export async function authorizeAgentDownload(request: Request): Promise<boolean> {
  return Boolean(await resolveAgentDownloadCaller(request));
}

export async function resolveCallerAgentTargetVersion(
  caller: AgentDownloadCaller | null,
): Promise<string> {
  if (!caller) return getAgentVersion();
  const config = await getCachedAppConfig();
  return resolveAgentTargetVersionFromConfig(config, caller);
}

/**
 * Read an agent file from the deploy tree. For version.txt, rewrite content to the
 * caller's resolved target so non-canaries are not stamped with a canary version.
 */
export async function readAgentFile(
  name: AgentDownloadFileName,
  options?: { targetVersion?: string },
): Promise<Buffer> {
  if (name === "version.txt" && options?.targetVersion) {
    return Buffer.from(`${options.targetVersion.trim()}\n`, "utf8");
  }

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
