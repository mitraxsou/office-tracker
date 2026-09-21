import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { getAgentVersion } from "@/lib/agent-version";

describe("office-heartbeat wake and sync behavior", () => {
  const heartbeat = readFileSync(
    path.join(process.cwd(), "agent", "office-heartbeat.ps1"),
    "utf8",
  );

  it("bumps agent version to match version.txt", () => {
    const version = getAgentVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(heartbeat).toContain(`$AgentScriptVersion = "${version}"`);
  });

  it("records visit_end at last run when sleeping on office Wi-Fi", () => {
    expect(heartbeat).toContain("function Invoke-ResumeOfficeSleepCheckout");
    expect(heartbeat).toContain("Add-QueuedEvent -Type \"session_suspend\"");
    expect(heartbeat).toContain("End-LocalVisit -SyncState $SyncState -EndAt $suspendAtIso -PreviousSsid $LastKnownSsid");
    expect(heartbeat).toContain("$suspendAtTime = $last");
    expect(heartbeat).toContain("lastSsidBeforeGap = [string]$previousSsid");
    expect(heartbeat).toContain("$transitionAt = Get-NowIso");
    expect(heartbeat).toContain("Add-WifiChangeEvents -PreviousSsid $fromSsid -CurrentSsid $ssid -At $transitionAt");
  });

  it("queues session_resume and activity_tick on resume runs", () => {
    expect(heartbeat).toContain('Add-QueuedEvent -Type "session_resume"');
    expect(heartbeat).toContain("if ($isResumeRun -or $activityDue)");
    expect(heartbeat).toContain('Add-QueuedEvent -Type "activity_tick"');
    expect(heartbeat).toContain("laptopActiveMs");
    expect(heartbeat).toContain("$shouldSync = $isResumeRun -or $ssidChanged");
  });

  it("advances lastActivityTickAt only after successful sync", () => {
    const tickAdvanceIndex = heartbeat.indexOf("$syncState.lastActivityTickAt = Get-NowIso");
    const flushSyncIndex = heartbeat.indexOf("Invoke-FlushSync");
    expect(tickAdvanceIndex).toBeGreaterThan(flushSyncIndex);
    expect(heartbeat).toContain("if ($activityTickQueued)");
    expect(heartbeat).not.toMatch(
      /if \(\$activityDue\)[\s\S]*?\$syncState\.lastActivityTickAt = Get-NowIso/,
    );
  });

  it("queues visit_start on new calendar day when still on office Wi-Fi", () => {
    expect(heartbeat).toContain("$dayRolledOver");
    expect(heartbeat).toContain("NEW_DAY visit_start on office Wi-Fi");
    expect(heartbeat).toContain("Start-LocalVisit -SyncState $syncState -Ssid $ssid");
  });

  it("skips force reinstall when local version already matches server (C7)", () => {
    expect(heartbeat).toContain("function Test-ResponseForceAgentUpdate");
    expect(heartbeat).toContain(
      "When local already matches server, skip force reinstall so sync can clear",
    );
    expect(heartbeat).toContain(
      "if ($serverVersion -and (Compare-AgentVersion $localVersion $serverVersion) -ge 0) {",
    );
    expect(heartbeat).toContain("if (Test-ResponseForceAgentUpdate -Response $Response) { return $true }");
    expect(heartbeat).toContain("Refreshing setup scripts from server before");
    expect(heartbeat).toContain("OK admin push clean reinstall completed");
    expect(heartbeat).toContain("if ($Force) {");
    expect(heartbeat).toContain("if ($exitCode -eq 0) {");
    expect(heartbeat).toContain("Hourly update check (force=$force needsUpdate=$needsUpdate)");
  });

  it("sleep checkout uses UTC and skips end-before-start", () => {
    expect(heartbeat).toContain("$SuspendAt.ToUniversalTime().ToString(\"o\")");
    expect(heartbeat).toContain("SKIP sleep checkout: suspendAt before open visit start");
    expect(heartbeat).toContain("SKIP visit_end: end before start");
    expect(heartbeat).toContain("RESUME visit_start on office Wi-Fi after sleep checkout");
  });

  it("soft auto-update refreshes setup scripts before invoking setup", () => {
    expect(heartbeat).toContain("Refreshing setup scripts from server before $label");
    expect(heartbeat).toContain('soft auto-update');
    const selfUpdateIdx = heartbeat.indexOf("function Invoke-AgentSelfUpdate");
    const downloadIdx = heartbeat.indexOf(
      "Download-AgentUpdateScriptsFromServer -ApiUrl $ApiUrl -Token $Token",
      selfUpdateIdx,
    );
    const ensureIdx = heartbeat.indexOf("Ensure-AgentUpdateScripts", selfUpdateIdx);
    expect(downloadIdx).toBeGreaterThan(selfUpdateIdx);
    expect(ensureIdx).toBeGreaterThan(downloadIdx);
  });

  it("polls agent config on an interval instead of every task run", () => {
    expect(heartbeat).toContain("$ConfigFetchIntervalRuns = 60");
    expect(heartbeat).toContain("$ConfigCacheMaxAgeMinutes = 120");
    expect(heartbeat).toContain("function Test-ConfigCacheFresh");
    expect(heartbeat).toContain("-Force:$forceConfigFetch");
    expect(heartbeat).not.toContain("Get-FreshVersionCheckConfig");
  });

  it("syncs on home Wi-Fi via activity ticks without visit_start", () => {
    expect(heartbeat).toContain("$shouldSync = $isResumeRun -or $ssidChanged -or $activityDue");
    expect(heartbeat).toContain('Add-QueuedEvent -Type "activity_tick"');
    expect(heartbeat).not.toMatch(
      /if \(\$activityDue\)[\s\S]*?Start-LocalVisit/,
    );
  });

  it("honors OFFICETRACKER_INSTALL_DIR for isolated regression installs", () => {
    expect(heartbeat).toContain("$env:OFFICETRACKER_INSTALL_DIR");
  });

  it("sends syncTrigger on agent sync POST body", () => {
    expect(heartbeat).toContain('if ($SyncTrigger) { $body.syncTrigger = $SyncTrigger }');
    expect(heartbeat).toContain("function Get-SyncTrigger");
    expect(heartbeat).toContain('return "resume_wake"');
    expect(heartbeat).toContain('-SyncTrigger $syncTrigger');
  });

  it("queues hours_target_met when local office time reaches server hours target", () => {
    expect(heartbeat).toContain("function Maybe-EnqueueHoursTargetMet");
    expect(heartbeat).toContain('Add-QueuedEvent -Type "hours_target_met"');
    expect(heartbeat).toContain("hoursMetSentDayKey");
    expect(heartbeat).toContain('return "hours_target_met"');
    expect(heartbeat).toContain("function Get-CurrentDayOfficeMs");
    expect(heartbeat).toContain("function Show-OfficePulseToast");
    expect(heartbeat).toContain("You completed your");
    expect(heartbeat).toContain("Time monitoring is on");
  });
});
