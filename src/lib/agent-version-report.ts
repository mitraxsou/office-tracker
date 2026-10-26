import { isDeviceAgentVersionStale } from "@/lib/agent-update";
import {
  DEFAULT_AGENT_FLEET_STABLE_VERSION,
  DEFAULT_AGENT_ROLLOUT_ALLOWLIST,
  effectiveAgentCanaryVersion,
  isAgentRolloutAllowlisted,
  resolveAgentTargetVersionFromConfig,
  type AgentRolloutMode,
} from "@/lib/agent-rollout";

/**
 * Admin agent version reports.
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

export type AgentVersionFleetStatus = "current" | "needs_update" | "unknown";

export type AgentVersionFleetDevice = {
  deviceId: string;
  serialNumber: string;
  installedVersion: string | null;
  expectedVersion: string;
  lastSeenAt: string | null;
  status: AgentVersionFleetStatus;
  onAllowlist: boolean;
  userId: string;
  email: string;
  name: string | null;
};

export type AgentVersionFleetReport = {
  totalDevices: number;
  currentCount: number;
  needsUpdateCount: number;
  unknownCount: number;
  devices: AgentVersionFleetDevice[];
};

export type AgentVersionAdminReport = AgentVersionAttentionReport & {
  fleet: AgentVersionFleetReport;
};

function displayFleetStable(config: AgentVersionReportConfig): string {
  return config.agentFleetStableVersion.trim() || DEFAULT_AGENT_FLEET_STABLE_VERSION;
}

/** Version an allowlisted user is told to run. Not the fleet target. */
export function displayCanaryVersion(_config: AgentVersionReportConfig): string {
  return effectiveAgentCanaryVersion();
}

export function buildAgentVersionFleetReport(params: {
  config: AgentVersionReportConfig;
  devices: AgentVersionReportDeviceInput[];
}): AgentVersionFleetReport {
  const { config, devices } = params;
  const allowlist =
    config.agentRolloutAllowlistEmails.length > 0
      ? config.agentRolloutAllowlistEmails
      : [...DEFAULT_AGENT_ROLLOUT_ALLOWLIST];

  const rows: AgentVersionFleetDevice[] = devices.map((device) => {
    const identity = { id: device.user.id, email: device.user.email };
    const expectedVersion = resolveAgentTargetVersionFromConfig(config, identity);
    const stale = isDeviceAgentVersionStale(device.agentScriptVersion, expectedVersion);
    const status: AgentVersionFleetStatus = !device.agentScriptVersion
      ? "unknown"
      : stale
        ? "needs_update"
        : "current";
    return {
      deviceId: device.id,
      serialNumber: device.serialNumber,
      installedVersion: device.agentScriptVersion,
      expectedVersion,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      status,
      onAllowlist: isAgentRolloutAllowlisted(identity, allowlist),
      userId: device.user.id,
      email: device.user.email,
      name: device.user.name,
    };
  });

  return {
    totalDevices: rows.length,
    currentCount: rows.filter((row) => row.status === "current").length,
    needsUpdateCount: rows.filter((row) => row.status === "needs_update").length,
    unknownCount: rows.filter((row) => row.status === "unknown").length,
    devices: rows,
  };
}

export function buildAgentVersionAttentionReport(params: {
  config: AgentVersionReportConfig;
  devices: AgentVersionReportDeviceInput[];
}): AgentVersionAttentionReport {
  const fleet = buildAgentVersionFleetReport(params);
  const users = new Map<string, AgentVersionAttentionUser>();

  for (const device of fleet.devices) {
    if (device.status === "current") continue;

    const row = users.get(device.userId) ?? {
      userId: device.userId,
      email: device.email,
      name: device.name,
      devices: [],
    };
    row.devices.push({
      deviceId: device.deviceId,
      serialNumber: device.serialNumber,
      installedVersion: device.installedVersion,
      expectedVersion: device.expectedVersion,
      lastSeenAt: device.lastSeenAt,
      status: device.status === "unknown" ? "unknown" : "needs_update",
    });
    users.set(device.userId, row);
  }

  const rows = [...users.values()];
  return {
    fleetStableVersion: displayFleetStable(params.config),
    canaryVersion: displayCanaryVersion(params.config),
    rolloutMode: params.config.agentRolloutMode,
    allowlistCount: params.config.agentRolloutAllowlistEmails.length,
    deviceCount: rows.reduce((sum, user) => sum + user.devices.length, 0),
    userCount: rows.length,
    users: rows,
  };
}

/** Attention list plus full fleet rows for the admin Agents panel. */
export function buildAgentVersionAdminReport(params: {
  config: AgentVersionReportConfig;
  devices: AgentVersionReportDeviceInput[];
}): AgentVersionAdminReport {
  const attention = buildAgentVersionAttentionReport(params);
  return {
    ...attention,
    fleet: buildAgentVersionFleetReport(params),
  };
}
