import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const fixture = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      "tests/bugs/fixtures/resume-sleep-checkout-before-new-day.json",
    ),
    "utf8",
  ),
) as {
  mustContainInOrder: string[];
  mustContain: string[];
  agentVersion: string;
};

describe("BUG-030 resume sleep checkout before NEW_DAY leftover close", () => {
  const heartbeat = readFileSync(
    path.join(process.cwd(), "agent/office-heartbeat.ps1"),
    "utf8",
  );
  const version = readFileSync(
    path.join(process.cwd(), "agent/version.txt"),
    "utf8",
  ).trim();

  it("runs sleep checkout before Maybe-EnqueueDailySummary so visit_end keeps suspendAt", () => {
    for (const needle of fixture.mustContain) {
      expect(heartbeat).toContain(needle);
    }
    const [sleepCall, dayCall] = fixture.mustContainInOrder;
    const sleepIdx = heartbeat.indexOf(sleepCall);
    const dayIdx = heartbeat.indexOf(dayCall);
    expect(sleepIdx).toBeGreaterThan(-1);
    expect(dayIdx).toBeGreaterThan(-1);
    expect(sleepIdx).toBeLessThan(dayIdx);
  });

  it("ships canary version with the ordering fix", () => {
    expect(version).toBe(fixture.agentVersion);
    expect(heartbeat).toContain(`$AgentScriptVersion = "${fixture.agentVersion}"`);
    expect(heartbeat).not.toMatch(/\u2014|\u2013/);
  });
});
