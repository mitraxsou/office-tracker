import { describe, expect, it } from "vitest";
import { compareAgentVersions, getAgentVersion } from "@/lib/agent-version";

describe("agent version", () => {
  it("reads version from agent/version.txt", () => {
    expect(getAgentVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("compares semantic versions", () => {
    expect(compareAgentVersions("1.1.0", "1.0.0")).toBe(1);
    expect(compareAgentVersions("1.0.0", "1.1.0")).toBe(-1);
    expect(compareAgentVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareAgentVersions("2.0.0", "1.9.9")).toBe(1);
  });
});
