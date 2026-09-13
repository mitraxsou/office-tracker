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

  it("records visit_end at office Wi-Fi disconnect time", () => {
    expect(heartbeat).toContain("End-LocalVisit -SyncState $SyncState -EndAt $disconnectAt -PreviousSsid $PreviousSsid");
    expect(heartbeat).toContain("Add-QueuedEvent -Type \"visit_end\" -Fields $fields -At $disconnectAt");
    expect(heartbeat).toContain("$transitionAt = Get-NowIso");
    expect(heartbeat).toContain("Add-WifiChangeEvents -PreviousSsid $fromSsid -CurrentSsid $ssid -At $transitionAt");
  });

  it("queues session_resume and activity_tick on resume runs", () => {
    expect(heartbeat).toContain('Add-QueuedEvent -Type "session_resume"');
    expect(heartbeat).toContain("if ($isResumeRun -or $activityDue)");
    expect(heartbeat).toContain('Add-QueuedEvent -Type "activity_tick"');
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

  it("does not block sync when force update leaves version unchanged", () => {
    expect(heartbeat).toContain("return (Compare-AgentVersion $after $before) -gt 0");
    expect(heartbeat).toContain("if ($serverVersion -and (Compare-AgentVersion $localVersion $serverVersion) -ge 0)");
    expect(heartbeat).toContain("Only exit for a re-run when scripts actually changed");
    expect(heartbeat).not.toContain("return $Force -or ((Compare-AgentVersion $after $before) -gt 0)");
  });

  it("polls agent config on an interval instead of every task run", () => {
    expect(heartbeat).toContain("$ConfigFetchIntervalRuns = 30");
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
});
