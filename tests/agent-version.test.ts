import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { compareAgentVersions, getAgentVersion } from "@/lib/agent-version";
import { isDeviceAgentVersionStale } from "@/lib/agent-update";
import {
  describeDeviceAgentVersion,
  summarizeDeviceAgentVersions,
} from "@/lib/agent-version-display";
import { buildInstallCommand, buildUpdateCommand } from "@/lib/agent-branding";

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
    expect(heartbeat).toContain("scriptVersion = $ScriptVersion");
    expect(heartbeat).toContain('$uri = "${uri}?serialNumber=$encoded"');
    expect(heartbeat).toContain("Get-HeartbeatIntervalMinutes");
    expect(heartbeat).toContain("/api/agent/sync");
    expect(heartbeat).toContain("Invoke-LegacyHeartbeat");
    expect(heartbeat).toContain("event-queue.json");
    expect(heartbeat).toContain("[Math]::Max(2, [Math]::Min(60, $interval))");
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

  it("builds an IEX-bypass install command for zip folder", () => {
    const command = buildInstallCommand("https://office.example", "token-123");
    expect(command).toContain("Invoke-Expression");
    expect(command).toContain("Publish-AgentScriptTxt");
    expect(command).not.toContain("-File");
  });

  it("builds an IEX-bypass update command for zip folder", () => {
    const command = buildUpdateCommand("https://office.example", "token-123");
    expect(command).toContain("Invoke-Expression");
    expect(command).not.toContain("-File");
  });

  it("uses IEX bypass for installed updater and zip wrappers", () => {
    const heartbeat = readFileSync(
      path.join(process.cwd(), "agent", "office-heartbeat.ps1"),
      "utf8",
    );
    const setup = readFileSync(path.join(process.cwd(), "agent", "setup.ps1"), "utf8");
    const updater = readFileSync(path.join(process.cwd(), "agent", "update.ps1"), "utf8");
    const installer = readFileSync(path.join(process.cwd(), "agent", "install.ps1"), "utf8");
    const download = readFileSync(
      path.join(process.cwd(), "agent", "lib", "agent-download.ps1"),
      "utf8",
    );

    expect(download).toContain("function Invoke-AgentScriptBypass");
    expect(heartbeat).toContain("Invoke-AgentScriptBypass");
    expect(heartbeat).toContain("Invoke-Expression");
    expect(heartbeat).not.toContain('-File ""$SetupScript""');

    expect(setup).toContain("Remove-MarkOfWeb -Path $destination");
    expect(setup).toContain("Publish-AgentScriptTxt");
    expect(setup).toContain("Invoke-Expression");

    expect(updater).toContain("Invoke-AgentScriptBypass");
    expect(installer).toContain("Invoke-AgentScriptBypass");
    expect(updater).not.toContain("& $setupPath");
    expect(installer).not.toContain("& $setupPath");
  });
});
