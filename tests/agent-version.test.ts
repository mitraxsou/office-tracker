import { describe, expect, it } from "vitest";
import { execSync } from "child_process";
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
    expect(heartbeat).toContain("$ConfigFetchIntervalRuns = 60");
    expect(heartbeat).toContain("$ConfigCacheMaxAgeMinutes = 120");
    expect(heartbeat).toContain("function Test-ConfigCacheFresh");
    expect(heartbeat).toContain("$forceConfigFetch = $isResumeRun -or $hourlyUpdateCheck");
    expect(heartbeat).not.toContain("Get-FreshVersionCheckConfig");
    expect(heartbeat).toContain("Ensure-AgentUpdateScripts");
    expect(heartbeat).toContain("Get-ServerAgentVersionFromResponse");
    expect(heartbeat).toContain("(Compare-AgentVersion $serverVersion $localVersion) -gt 0");
    expect(heartbeat).toContain("EXIT after self-update");
    expect(heartbeat).toContain("selfUpdated = Invoke-AgentSelfUpdate");
    expect(heartbeat).not.toContain("return $Force -or ((Compare-AgentVersion $after $before) -gt 0)");
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
    expect(command).toContain("Invoke-AgentScriptBypass");
    expect(command).toContain("Force = $true");
    expect(command).toContain("-Command '& {");
    expect(command).not.toMatch(/ -File /);
  });

  it("builds an IEX-bypass update command for zip folder", () => {
    const command = buildUpdateCommand("https://office.example", "token-123");
    expect(command).toContain("Invoke-AgentScriptBypass");
    expect(command).toContain("Force = $true");
    expect(command).not.toMatch(/ -File /);
  });

  it(
    "Compare-AgentVersion does not throw on corrupt version strings",
    () => {
      const script = path.join(process.cwd(), "tests/fixtures/compare-agent-version.ps1");
      const out = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}"`,
        { encoding: "utf8", timeout: 30_000 },
      );
      expect(out.trim()).toBe("OK");
    },
    35_000,
  );

  it(
    "zip reinstall smoke test runs bypass with Force from agent folder",
    () => {
      const script = path.join(process.cwd(), "tests/fixtures/run-zip-reinstall-smoke.ps1");
      const out = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}"`,
        { encoding: "utf8", timeout: 120_000 },
      );
      expect(out.trim()).toBe("OK");
    },
    125_000,
  );

  it(
    "setup.ps1 IEX preserves ApiUrl and Token in caller scope",
    () => {
      const script = path.join(process.cwd(), "tests/fixtures/setup-iex-credentials.ps1");
      const out = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}"`,
        { encoding: "utf8", timeout: 30_000 },
      );
      expect(out.trim()).toBe("OK");
    },
    35_000,
  );

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
    expect(download).toContain("function Remove-AgentScriptParamBlock");
    expect(download).toContain("function Test-AgentVersionFormat");
    expect(download).not.toContain("$_ -replace '\\D', '0'");
    expect(heartbeat).toContain("Invoke-AgentScriptBypass");
    expect(heartbeat).toContain("Invoke-Expression");
    expect(heartbeat).not.toContain('-File ""$SetupScript""');

    expect(setup).toContain("Remove-MarkOfWeb -Path $destination");
    expect(setup).toContain("Publish-AgentScriptTxt");
    expect(setup).toContain("Get-Command Publish-AgentScriptTxt");
    expect(setup).toContain("No script-level param()");
    expect(setup).not.toContain("[string]$ApiUrl,\r\n    [string]$Token");
    expect(setup).not.toContain("[string]$ApiUrl,\n    [string]$Token");
    expect(setup).toContain("OFFICEPULSE_SETUP_API_URL");
    expect(setup).toContain("Remove-LegacyUpdateTask");
    expect(setup).not.toContain("Register-HourlyUpdateTask");
    expect(setup).not.toContain('Register-ScheduledTask -TaskName $UpdateTaskName');

    expect(updater).toContain("Invoke-AgentScriptBypass");
    expect(installer).toContain("Invoke-AgentScriptBypass");
    expect(updater).not.toContain("& $setupPath");
    expect(installer).not.toContain("& $setupPath");
  });

  it("setup.ps1 refreshes config.json on reinstall when token, apiUrl, or Force changes", () => {
    const setup = readFileSync(path.join(process.cwd(), "agent", "setup.ps1"), "utf8");
    expect(setup).toContain("$shouldWriteAgentConfig");
    expect(setup).toContain("if ($Force -or $apiChanged -or $tokenChanged)");
    expect(setup).toContain("if ($shouldWriteAgentConfig)");
    expect(setup).toContain("Updated config.json early");
    expect(setup).not.toMatch(/if \(\$isFreshInstall\) \{\s*\r?\n\s*Write-AgentConfig/s);
  });
});
