export const ADMIN_SETTINGS_HASH = {
  agentSync: "agent-sync",
  advancedAgent: "advanced-agent",
  diagnosticRetention: "diagnostic-retention",
  cronJobs: "cron-jobs",
  dataMaintenance: "data-maintenance",
} as const;

export const ADMIN_SETTINGS_HREF = {
  agentSync: `/admin/settings#${ADMIN_SETTINGS_HASH.agentSync}`,
  advancedAgent: `/admin/settings#${ADMIN_SETTINGS_HASH.advancedAgent}`,
  diagnosticRetention: `/admin/settings#${ADMIN_SETTINGS_HASH.diagnosticRetention}`,
  cronJobs: `/admin/settings#${ADMIN_SETTINGS_HASH.cronJobs}`,
  dataMaintenance: `/admin/settings#${ADMIN_SETTINGS_HASH.dataMaintenance}`,
} as const;

export function hashOpensAdvancedAgentOptions(hash: string): boolean {
  const id = hash.replace(/^#/, "");
  return (
    id === ADMIN_SETTINGS_HASH.diagnosticRetention ||
    id === ADMIN_SETTINGS_HASH.advancedAgent
  );
}
