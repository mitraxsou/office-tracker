import { isDeviceAgentVersionStale } from "@/lib/agent-update";
import {
  DEFAULT_AGENT_FLEET_STABLE_VERSION,
  DEFAULT_AGENT_ROLLOUT_ALLOWLIST,
  resolveAgentTargetVersion,
  resolveAgentTargetVersionFromConfig,
  type AgentRolloutMode,
} from "@/lib/agent-rollout";

/**
 * Admin "Agents not updated" attention list.
 *
 * Canary (repo / agentCanaryVersion) is not the fleet target. In allowlist mode
 * only allowlisted users are compared to the canary. Everyone else is compared
 * to agentFleetStableVersion. This report does not queue forceAgentUpdate:
 * a force reinstall pulls deploy-tree script bodies, which are the canary
 * artifact, so it must not be offered from a fleet attention list.
 */
export type AgentVersionReportConfig = {
  agentRolloutMode: AgentRolloutMode;
  agentFleetStableVersion: string;
  agentCanaryVersion: string;
  agentRolloutAllowlistEmails: string[];
};

export type AgentVersionReportDeviceInput = {
  id: string;
  serialNumber: string;
  agentScriptVersion: string | null;
  lastSeenAt: Date | null;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
};

export type AgentVersionAttentionDevice = {
  deviceId: string;
  serialNumber: string;
  installedVersion: string | null;
  expectedVersion: string;
  lastSeenAt: string | null;
  status: "unknown" | "needs_update";
};

export type AgentVersionAttentionUser = {
  userId: string;
  email: string;
  name: string | null;
  devices: AgentVersionAttentionDevice[];
};

export type AgentVersionAttentionReport = {
  fleetStableVersion: string;
  canaryVersion: string;
  rolloutMode: AgentRolloutMode;
  allowlistCount: number;
  deviceCount: number;
  userCount: number;
  users: AgentVersionAttentionUser[];
};

function displayFleetStable(config: AgentVersionReportConfig): string {
  return config.agentFleetStableVersion.trim() || DEFAULT_AGENT_FLEET_STABLE_VERSION;
}

/** Version an allowlisted user is told to run. Not the fleet target. */
export function displayCanaryVersion(config: AgentVersionReportConfig): string {
  const allowlist =
    config.agentRolloutAllowlistEmails.length > 0
      ? config.agentRolloutAllowlistEmails
      : [...DEFAULT_AGENT_ROLLOUT_ALLOWLIST];
  return resolveAgentTargetVersion({
    mode: "allowlist",
    fleetStableVersion: config.agentFleetStableVersion,
    canaryVersion: config.agentCanaryVersion,
    allowlistEmails: allowlist,
    identity: { email: allowlist[0] },
  });
}

export function buildAgentVersionAttentionReport(params: {
  config: AgentVersionReportConfig;
  devices: AgentVersionReportDeviceInput[];
}): AgentVersionAttentionReport {
  const { config, devices } = params;
  const users = new Map<string, AgentVersionAttentionUser>();

  for (const device of devices) {
    const expectedVersion = resolveAgentTargetVersionFromConfig(config, {
      id: device.user.id,
      email: device.user.email,
    });
    if (!isDeviceAgentVersionStale(device.agentScriptVersion, expectedVersion)) continue;

    const row = users.get(device.user.id) ?? {
      userId: device.user.id,
      email: device.user.email,
      name: device.user.name,
      devices: [],
    };
    row.devices.push({
      deviceId: device.id,
      serialNumber: device.serialNumber,
      installedVersion: device.agentScriptVersion,
      expectedVersion,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      status: device.agentScriptVersion ? "needs_update" : "unknown",
    });
    users.set(device.user.id, row);
  }

  const rows = [...users.values()];
  return {
    fleetStableVersion: displayFleetStable(config),
    canaryVersion: displayCanaryVersion(config),
    rolloutMode: config.agentRolloutMode,
    allowlistCount: config.agentRolloutAllowlistEmails.length,
    deviceCount: rows.reduce((sum, user) => sum + user.devices.length, 0),
    userCount: rows.length,
    users: rows,
  };
}
