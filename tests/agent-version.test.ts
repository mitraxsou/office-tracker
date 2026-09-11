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
    expect(heartbeat).toContain("scriptVersion  = $scriptVersion");
    expect(heartbeat).toContain('$uri = "${uri}?serialNumber=$encoded"');
    expect(heartbeat).toContain("Get-HeartbeatIntervalMinutes");
    expect(heartbeat).toContain("Test-HeartbeatDue");
    expect(heartbeat).toContain("Set-LastSuccessfulHeartbeatTime");
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

  it("builds a relative PowerShell install command", () => {
    expect(buildInstallCommand("https://office.example", "token-123")).toBe(
      'Unblock-File -LiteralPath ".\\install.ps1"; powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ".\\install.ps1" -ApiUrl "https://office.example" -Token "token-123"',
    );
  });

  it("builds a relative PowerShell update command", () => {
    expect(buildUpdateCommand("https://office.example", "token-123")).toBe(
      'Unblock-File -LiteralPath ".\\update.ps1"; powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ".\\update.ps1" -ApiUrl "https://office.example" -Token "token-123"',
    );
  });

  it("removes MOTW before hidden installed updater launches", () => {
    const heartbeat = readFileSync(
      path.join(process.cwd(), "agent", "office-heartbeat.ps1"),
      "utf8",
    );
    const updater = readFileSync(path.join(process.cwd(), "agent", "update.ps1"), "utf8");
    const installer = readFileSync(path.join(process.cwd(), "agent", "install.ps1"), "utf8");

    expect(heartbeat).toContain("Unblock-File -LiteralPath $UpdateScript");
    expect(heartbeat).toContain('Join-Path (Split-Path $UpdateScript) "run-update.vbs"');
    expect(heartbeat).toContain("-NoProfile -NonInteractive -ExecutionPolicy Bypass");
    expect(heartbeat).toContain('-File ""$UpdateScript"" -Silent');

    expect(updater).toContain("Remove-MarkOfWeb -Path $tempZip");
    expect(updater).toContain("Remove-MarkOfWebFromTree -Path $tempExtract");
    expect(updater).toContain("Remove-MarkOfWeb -Path $destination");
    expect(updater).toContain('-File ""$ScriptPath"" -Silent');

    expect(installer).toContain("Remove-MarkOfWeb -Path $src");
    expect(installer).toContain("Remove-MarkOfWeb -Path $destination");
    expect(installer).toContain('-File ""$ScriptPath"" -Silent');
  });
});
