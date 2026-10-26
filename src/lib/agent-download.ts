import { readFile } from "fs/promises";
import path from "path";
import { getCurrentUser, getUserByAgentToken } from "@/lib/auth";
import { getCachedAppConfig } from "@/lib/agent-config-cache";
import {
  DEFAULT_AGENT_FLEET_STABLE_VERSION,
  isAgentRolloutAllowlisted,
  resolveAgentTargetVersionFromConfig,
} from "@/lib/agent-rollout";
import { compareAgentVersions, getAgentVersion } from "@/lib/agent-version";
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

export type AgentDownloadVersionOption = {
  version: string;
  label: string;
  recommended: boolean;
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
 * Build the download picker list from known versions only (target, fleet-stable,
 * artifacts, and optionally deploy canary / Latest). Does not invent historical builds.
 *
 * Repo/canary "Latest" is only listed when includeRepoCanary is true (allowlisted
 * soak users or rollout mode everyone). Fleet users stay on target + fleet + artifacts.
 */
export function buildAgentDownloadVersionOptions(input: {
  targetVersion: string;
  repoVersion: string;
  fleetStableVersion: string;
  artifactVersions: string[];
  /** When false, omit deploy canary unless it is already the user's target or fleet pin. */
  includeRepoCanary?: boolean;
}): AgentDownloadVersionOption[] {
  const target = input.targetVersion.trim();
  const repo = input.repoVersion.trim();
  const fleet =
    input.fleetStableVersion.trim() || DEFAULT_AGENT_FLEET_STABLE_VERSION;
  const includeRepoCanary = input.includeRepoCanary === true;
  const versions = new Set<string>();
  const add = (raw: string) => {
    const version = raw.trim();
    if (version) versions.add(version);
  };
  add(target);
  add(fleet);
  for (const raw of input.artifactVersions) add(raw);
  if (includeRepoCanary || repo === target || repo === fleet) {
    add(repo);
  }

  const sorted = [...versions].sort((a, b) => {
    if (a === target) return -1;
    if (b === target) return 1;
    return compareAgentVersions(b, a);
  });

  return sorted.map((version) => {
    const recommended = version === target;
    let kind: string;
    if (recommended) {
      kind = "Recommended (your target)";
    } else if (version === fleet) {
      kind = "Fleet-stable";
    } else if (version === repo) {
      kind = "Latest";
    } else {
      kind = "Archived";
    }
    return {
      version,
      label: `${kind} - v${version}`,
      recommended,
    };
  });
}

export async function listAvailableAgentDownloadVersions(
  caller: AgentDownloadCaller,
): Promise<{ recommended: string; options: AgentDownloadVersionOption[] }> {
  const config = await getCachedAppConfig();
  const repoVersion = getAgentVersion();
  const fleetStableVersion =
    config.agentFleetStableVersion.trim() || DEFAULT_AGENT_FLEET_STABLE_VERSION;
  const targetVersion = resolveAgentTargetVersionFromConfig(config, caller);
  const includeRepoCanary =
    config.agentRolloutMode === "everyone" ||
    isAgentRolloutAllowlisted(caller, config.agentRolloutAllowlistEmails);
  // Dynamic import avoids a circular load with agent-release-artifacts.
  const { listAgentReleaseArtifactVersions } = await import(
    "./agent-release-artifacts"
  );
  const artifactVersions = await listAgentReleaseArtifactVersions();
  const options = buildAgentDownloadVersionOptions({
    targetVersion,
    repoVersion,
    fleetStableVersion,
    artifactVersions,
    includeRepoCanary,
  });
  return { recommended: targetVersion, options };
}

export function isAllowedAgentDownloadVersion(
  requested: string,
  options: AgentDownloadVersionOption[],
): boolean {
  const version = requested.trim();
  if (!version) return false;
  return options.some((option) => option.version === version);
}

/**
 * Resolve zip/file download version: default = caller's target; optional ?version=
 * must be in that caller's available list (target, fleet-stable, artifacts; deploy
 * canary / Latest only for soak allowlist or rollout mode everyone).
 */
export async function resolveRequestedAgentDownloadVersion(
  caller: AgentDownloadCaller,
  requested: string | null | undefined,
): Promise<{ ok: true; version: string } | { ok: false; status: 400; error: string }> {
  const { recommended, options } = await listAvailableAgentDownloadVersions(caller);
  if (requested == null || !requested.trim()) {
    return { ok: true, version: recommended };
  }
  const version = requested.trim();
  if (!isAllowedAgentDownloadVersion(version, options)) {
    return {
      ok: false,
      status: 400,
      error: "Unknown or unavailable agent version",
    };
  }
  return { ok: true, version };
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

/**
 * Prefer an AgentReleaseArtifact body when present for core files; otherwise
 * fall back to the deploy tree (with version.txt rewritten to the requested version).
 */
export async function readAgentFilePreferringArtifact(
  name: AgentDownloadFileName,
  version: string,
): Promise<Buffer> {
  const { isAgentCoreFileName, readFleetStableAgentFile } = await import(
    "./agent-release-artifacts"
  );
  if (isAgentCoreFileName(name)) {
    const artifact = await readFleetStableAgentFile(version, name);
    if (artifact) return artifact.content;
  }
  return readAgentFile(name, { targetVersion: version });
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
