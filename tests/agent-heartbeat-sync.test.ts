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
});
