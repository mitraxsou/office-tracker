import { getAgentVersion } from "./agent-version";
import type { AppConfigData } from "./app-config";

/**
 * Controlled agent rollout (canary / fleet-stable).
 *
 * Pragmatic dual serving for this repo:
 * - Deploy tree under agent/ is the canary artifact (repo version.txt).
 * - AppConfig.agentFleetStableVersion is what non-canary devices are told as
 *   agentScriptVersion, so soft-update and the independent watchdog skip until
 *   an admin promotes. File bodies still come from the deploy tree; isolation is
 *   the version gate (clients only pull when behind their resolved target).
 * - version.txt downloads for non-canaries are rewritten to the fleet-stable
 *   string so accidental pulls do not stamp a canary version locally.
 */

export type AgentRolloutMode = "allowlist" | "everyone";

export const DEFAULT_AGENT_ROLLOUT_MODE: AgentRolloutMode = "allowlist";
export const DEFAULT_AGENT_ROLLOUT_ALLOWLIST = ["soumitra.m.mandal@pwc.com"] as const;
/** Last fleet-wide known-good before the current canary soak bump. */
export const DEFAULT_AGENT_FLEET_STABLE_VERSION = "1.5.24";

export type AgentRolloutIdentity = {
  email?: string | null;
  id?: string | null;
};

export function normalizeAgentRolloutMode(raw: string | null | undefined): AgentRolloutMode {
  return raw === "everyone" ? "everyone" : "allowlist";
}

export function parseAgentRolloutAllowlist(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) {
    return [...DEFAULT_AGENT_ROLLOUT_ALLOWLIST];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_AGENT_ROLLOUT_ALLOWLIST];
    const emails = parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    return emails.length > 0 ? emails : [...DEFAULT_AGENT_ROLLOUT_ALLOWLIST];
  } catch {
    return [...DEFAULT_AGENT_ROLLOUT_ALLOWLIST];
  }
}

export function normalizeAgentRolloutAllowlist(emails: string[]): string[] {
  const normalized = emails
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes("@"));
  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique : [...DEFAULT_AGENT_ROLLOUT_ALLOWLIST];
}

export function isAgentRolloutAllowlisted(
  identity: AgentRolloutIdentity,
  allowlistEmails: string[],
): boolean {
  const email = identity.email?.trim().toLowerCase();
  if (!email) return false;
  return allowlistEmails.some((entry) => entry === email);
}

export type ResolveAgentTargetVersionInput = {
  mode: AgentRolloutMode;
  fleetStableVersion: string;
  canaryVersion: string;
  allowlistEmails: string[];
  /** Repo / deploy tree version (agent/version.txt). */
  repoVersion?: string;
  identity?: AgentRolloutIdentity | null;
};

/**
 * Resolve the agent script version this user/device should run.
 * Used by sync, /api/agent/config, files, zip, and the laptop watchdog.
 */
export function resolveAgentTargetVersion(input: ResolveAgentTargetVersionInput): string {
  const repoVersion = (input.repoVersion ?? getAgentVersion()).trim();
  const canary = (input.canaryVersion || repoVersion).trim() || repoVersion;
  const fleetStable =
    (input.fleetStableVersion || DEFAULT_AGENT_FLEET_STABLE_VERSION).trim() ||
    DEFAULT_AGENT_FLEET_STABLE_VERSION;

  if (input.mode === "everyone") {
    return canary;
  }

  if (input.identity && isAgentRolloutAllowlisted(input.identity, input.allowlistEmails)) {
    return canary;
  }

  return fleetStable;
}

export function resolveAgentTargetVersionFromConfig(
  config: Pick<
    AppConfigData,
    | "agentRolloutMode"
    | "agentFleetStableVersion"
    | "agentCanaryVersion"
    | "agentRolloutAllowlistEmails"
  >,
  identity?: AgentRolloutIdentity | null,
): string {
  return resolveAgentTargetVersion({
    mode: config.agentRolloutMode,
    fleetStableVersion: config.agentFleetStableVersion,
    canaryVersion: config.agentCanaryVersion,
    allowlistEmails: config.agentRolloutAllowlistEmails,
    identity,
  });
}

export function isValidAgentVersionString(version: string): boolean {
  return /^\d+(\.\d+){0,3}$/.test(version.trim());
}
