import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/app-config", () => ({
  getAppConfig: getAppConfigMock,
}));

import {
  AGENT_CONFIG_CACHE_CONTROL,
  getCachedAppConfig,
  invalidateAgentConfigCache,
} from "@/lib/agent-config-cache";

describe("agent config cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateAgentConfigCache();
    getAppConfigMock.mockResolvedValue({
      officeSsids: ["OfficeConnect"],
      heartbeatIntervalMinutes: 10,
      agentMode: "event",
    });
  });

  it("reuses cached AppConfig within the TTL", async () => {
    await getCachedAppConfig();
    await getCachedAppConfig();
    expect(getAppConfigMock).toHaveBeenCalledTimes(1);
  });

  it("refetches after cache invalidation", async () => {
    await getCachedAppConfig();
    invalidateAgentConfigCache();
    await getCachedAppConfig();
    expect(getAppConfigMock).toHaveBeenCalledTimes(2);
  });

  it("exposes agent Cache-Control max-age", () => {
    expect(AGENT_CONFIG_CACHE_CONTROL).toContain("max-age=7200");
  });
});
