export type AgentDeviceStatus = "healthy" | "stale" | "offline" | "never";

export function computeDeviceAgentStatus(
  lastSeenAt: Date | string | null | undefined,
  staleMinutes: number,
  now: Date = new Date(),
): AgentDeviceStatus {
  if (!lastSeenAt) return "never";
  const seen = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  const ms = now.getTime() - seen.getTime();
  const staleMs = staleMinutes * 60 * 1000;
  if (ms <= staleMs) return "healthy";
  if (ms <= 24 * 60 * 60 * 1000) return "stale";
  return "offline";
}

export function agentStatusLabel(status: AgentDeviceStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "stale":
      return "Stale";
    case "offline":
      return "Offline";
    case "never":
      return "Never connected";
  }
}

export function agentStatusClass(status: AgentDeviceStatus): string {
  switch (status) {
    case "healthy":
      return "text-green-400";
    case "stale":
      return "text-accent";
    case "offline":
      return "text-red-400";
    case "never":
      return "text-muted";
  }
}
