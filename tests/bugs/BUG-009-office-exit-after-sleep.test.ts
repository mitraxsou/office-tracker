import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests", "bugs", "fixtures", "office-exit-after-sleep.json"),
    "utf8",
  ),
) as {
  lastOfficePulseAt: string;
  homeWifiObservedAt: string;
  expectedVisitEndAt: string;
};

describe("BUG-009 office exit after laptop sleep", () => {
  const heartbeat = readFileSync(
    path.join(process.cwd(), "agent", "office-heartbeat.ps1"),
    "utf8",
  );

  it("fixture expects checkout at the last confirmed office pulse", () => {
    expect(Date.parse(fixture.homeWifiObservedAt)).toBeGreaterThan(
      Date.parse(fixture.lastOfficePulseAt),
    );
    expect(fixture.expectedVisitEndAt).toBe(fixture.lastOfficePulseAt);
  });

  it("guards concurrent wake runs and delayed office-to-home transitions", () => {
    expect(heartbeat).toContain("Local\\PwCOfficePulseHeartbeat");
    expect(heartbeat).toContain("function Get-WifiTransitionAt");
    expect(heartbeat).toContain("return $lastTick.ToUniversalTime().ToString(\"o\")");
  });

  it("records local pulses frequently and uploads health hourly with EOD ticks", () => {
    expect(heartbeat).toContain("$LocalPulseIntervalMinutes = 2");
    expect(heartbeat).toContain("$HealthSyncIntervalMinutes = 60");
    expect(heartbeat).toContain("function Test-HasCriticalQueuedEvents");
    expect(heartbeat).toContain("function New-HealthSnapshotEvent");
    expect(heartbeat).toContain(
      "$shouldSync = $criticalSyncDue -or $healthSyncDue -or $endOfDaySyncDue",
    );
    expect(heartbeat).toContain('$EndOfDayEventTypes = @("daily_summary", "activity_tick")');
  });
});
