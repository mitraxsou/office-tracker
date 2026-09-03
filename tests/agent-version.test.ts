import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { compareAgentVersions, getAgentVersion } from "@/lib/agent-version";
import { isDeviceAgentVersionStale } from "@/lib/agent-update";
import {
  describeDeviceAgentVersion,
  summarizeDeviceAgentVersions,
} from "@/lib/agent-version-display";
import { buildInstallCommand } from "@/lib/agent-branding";

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

  it("keeps the heartbeat fallback and bundle version in sync", () => {
    const heartbeat = readFileSync(
      path.join(process.cwd(), "agent", "office-heartbeat.ps1"),
      "utf8",
    );
    expect(heartbeat).toContain(`$AgentScriptVersion = "${getAgentVersion()}"`);
    expect(heartbeat).toContain("scriptVersion  = $scriptVersion");
  });

  it("treats missing or different versions as needing update", () => {
    expect(isDeviceAgentVersionStale(null, "1.2.7")).toBe(true);
    expect(isDeviceAgentVersionStale("1.2.6", "1.2.7")).toBe(true);
    expect(isDeviceAgentVersionStale("1.2.8", "1.2.7")).toBe(true);
    expect(isDeviceAgentVersionStale("1.2.7", "1.2.7")).toBe(false);
  });

  it("uses accurate wording for agents that never reported", () => {
    expect(describeDeviceAgentVersion(null, true)).toEqual({
      state: "unreported",
      version: "not reported",
      note: "predates 1.2.6 reporting, auto-repair pending",
    });
    expect(
      summarizeDeviceAgentVersions([
        { agentScriptVersion: null, agentVersionStale: true },
      ]),
    ).toBe("not reported");
  });

  it("builds a full-path PowerShell reinstall command", () => {
    expect(buildInstallCommand("https://office.example", "token-123")).toBe(
      'powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\\Downloads\\PwCOfficePulse\\install.ps1" -ApiUrl "https://office.example" -Token "token-123"',
    );
  });
});
