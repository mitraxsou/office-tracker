import { describe, expect, it } from "vitest";
import {
  ADMIN_SETTINGS_HASH,
  ADMIN_SETTINGS_HREF,
  hashOpensAdvancedAgentOptions,
} from "../src/lib/admin-settings-hash";

describe("admin settings hashes", () => {
  it("opens Advanced agent options for retention and advanced hashes", () => {
    expect(hashOpensAdvancedAgentOptions("#diagnostic-retention")).toBe(true);
    expect(hashOpensAdvancedAgentOptions("advanced-agent")).toBe(true);
    expect(hashOpensAdvancedAgentOptions("#agent-sync")).toBe(false);
    expect(hashOpensAdvancedAgentOptions("#cron-jobs")).toBe(false);
  });

  it("points user-report links at Global settings ids", () => {
    expect(ADMIN_SETTINGS_HREF.diagnosticRetention).toBe(
      `/admin/settings#${ADMIN_SETTINGS_HASH.diagnosticRetention}`,
    );
    expect(ADMIN_SETTINGS_HREF.agentSync).toBe(`/admin/settings#${ADMIN_SETTINGS_HASH.agentSync}`);
    expect(ADMIN_SETTINGS_HREF.cronJobs).toBe(`/admin/settings#${ADMIN_SETTINGS_HASH.cronJobs}`);
    expect(ADMIN_SETTINGS_HREF.dataMaintenance).toBe(
      `/admin/settings#${ADMIN_SETTINGS_HASH.dataMaintenance}`,
    );
  });
});
