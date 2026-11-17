import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/false-office-blip.json"),
    "utf8",
  ),
) as {
  mustContain: string[];
  agentVersion: string;
  callBeforeOfficeEnter: [string, string];
};

function assertHoldAndSingleVisit(source: string, label: string) {
  for (const needle of fixture.mustContain) {
    expect(source, `${label} missing ${needle}`).toContain(needle);
  }
  expect(source, label).not.toMatch(/\u2014|\u2013/);
  const holdAt = source.indexOf(fixture.callBeforeOfficeEnter[0]);
  const officeEnterAt = source.indexOf(fixture.callBeforeOfficeEnter[1]);
  expect(holdAt, label).toBeGreaterThan(0);
  expect(officeEnterAt, label).toBeGreaterThan(holdAt);
}

describe("BUG-032 one-tick NetConnectionProfileAny office name must not open a visit", () => {
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

  it("holds the first Any-profile office reading and confirms it only inside 10 minutes", () => {
    assertHoldAndSingleVisit(heartbeat, "office-heartbeat.ps1");
  });

  it("ships the same hold and single visit_start guard in the published txt", () => {
    assertHoldAndSingleVisit(heartbeatTxt, "office-heartbeat.txt");
    expect(version).toBe(fixture.agentVersion);
    expect(heartbeat).toContain(`$AgentScriptVersion = "${fixture.agentVersion}"`);
    expect(heartbeatTxt).toContain(`$AgentScriptVersion = "${fixture.agentVersion}"`);
  });
});
