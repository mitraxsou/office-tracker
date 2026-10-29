import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const fixture = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      "tests/bugs/fixtures/home-wake-stale-office-ssid.json",
    ),
    "utf8",
  ),
) as {
  mustContain: string[];
  agentVersion: string;
};

describe("BUG-031 home wake must not open office from stale or VPN SSID", () => {
  const heartbeat = readFileSync(
    path.join(process.cwd(), "agent/office-heartbeat.ps1"),
    "utf8",
  );
  const heartbeatTxt = readFileSync(
    path.join(process.cwd(), "agent/office-heartbeat.txt"),
    "utf8",
  );
  const version = readFileSync(
    path.join(process.cwd(), "agent/version.txt"),
    "utf8",
  ).trim();

  it("gates Update-VisitBoundaries office enter with the long-gap allowOfficeEnter flag", () => {
    for (const needle of fixture.mustContain) {
      expect(heartbeat).toContain(needle);
    }
    expect(heartbeat).not.toMatch(/\u2014|\u2013/);
  });

  it("ships matching canary version and published txt", () => {
    expect(version).toBe(fixture.agentVersion);
    expect(heartbeat).toContain(`$AgentScriptVersion = "${fixture.agentVersion}"`);
    expect(heartbeatTxt).toContain(`$AgentScriptVersion = "${fixture.agentVersion}"`);
    expect(heartbeatTxt).toContain("AllowOfficeEnter:$allowOfficeEnter");
    expect(heartbeatTxt).toContain("function Test-IsVpnOrVirtualAdapter");
  });
});
