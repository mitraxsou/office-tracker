/**
 * Wording for the agent version shown to admins. Kept free of node and prisma imports so
 * client components can use it.
 *
 * Agents started sending scriptVersion on every heartbeat in 1.2.6. A device that is still
 * pulsing but has never reported a version is running an older build, so "update needed"
 * on its own reads as a server problem. Say that a re-install is what makes it report.
 */
export type AgentVersionState = "current" | "outdated" | "unreported";

export type AgentVersionDisplay = {
  state: AgentVersionState;
  /** Version text for the chip, for example "1.2.7" or "not reported". */
  version: string;
  /** Short suffix explaining what the admin should do. */
  note: string;
};

export function describeDeviceAgentVersion(
  reportedVersion: string | null | undefined,
  isStale: boolean,
): AgentVersionDisplay {
  if (!reportedVersion) {
    return {
      state: "unreported",
      version: "not reported",
      note: "predates 1.2.6 reporting, auto-repair pending",
    };
  }

  if (isStale) {
    return { state: "outdated", version: reportedVersion, note: "update needed" };
  }

  return { state: "current", version: reportedVersion, note: "current" };
}

/** One-line rollup for the Agent KPI card, for example "2/3 current" or "1.2.7". */
export function summarizeDeviceAgentVersions(
  devices: Array<{ agentScriptVersion: string | null; agentVersionStale: boolean }>,
): string {
  if (devices.length === 0) return "no laptops";

  if (devices.length === 1) {
    return describeDeviceAgentVersion(
      devices[0].agentScriptVersion,
      devices[0].agentVersionStale,
    ).version;
  }

  const current = devices.filter(
    (device) => describeDeviceAgentVersion(device.agentScriptVersion, device.agentVersionStale).state === "current",
  ).length;
  return `${current}/${devices.length} current`;
}
