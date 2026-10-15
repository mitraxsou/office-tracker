import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_FLEET_STABLE_VERSION,
  DEFAULT_AGENT_ROLLOUT_ALLOWLIST,
  resolveAgentTargetVersion,
} from "@/lib/agent-rollout";
import { getAgentVersion } from "@/lib/agent-version";

const fixturePath = path.join(
  process.cwd(),
  "tests/bugs/fixtures/agent-canary-rollout-watchdog.json",
);
const catalogPath = path.join(process.cwd(), "tests/bugs/catalog.json");
const setupPath = path.join(process.cwd(), "agent/setup.ps1");
const watchdogPs1 = path.join(process.cwd(), "agent/watchdog/watchdog.ps1");
const watchdogVbs = path.join(process.cwd(), "agent/watchdog/run-watchdog.vbs");
const skillPath = path.join(process.cwd(), ".cursor/skills/agent-auto-update/SKILL.md");

describe("BUG-023 agent canary rollout + independent watchdog", () => {
  it("keeps catalog entry and fixture defaults (allowlist, Soumitra, fleet-stable pin)", () => {
    expect(existsSync(fixturePath)).toBe(true);
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      incident: string;
      defaults: {
        agentRolloutMode: string;
        agentFleetStableVersion: string;
        allowlistEmails: string[];
      };
    };
    expect(fixture.incident).toBe("BUG-023");
    expect(fixture.defaults.agentRolloutMode).toBe("allowlist");
    expect(fixture.defaults.agentFleetStableVersion).toBe(
      DEFAULT_AGENT_FLEET_STABLE_VERSION,
    );
    expect(fixture.defaults.allowlistEmails).toContain(
      DEFAULT_AGENT_ROLLOUT_ALLOWLIST[0],
    );

    const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
      cases: Array<{ id: string; status: string; area: string }>;
    };
    const entry = catalog.cases.find((c) => c.id === "BUG-023");
    expect(entry).toBeTruthy();
    expect(entry!.area).toBe("agent-update");
    expect(entry!.status).toBe("guarded");
  });

  it("resolveAgentTargetVersion keeps non-canary on fleet-stable while canary gets repo", () => {
    const repo = getAgentVersion();
    expect(
      resolveAgentTargetVersion({
        mode: "allowlist",
        fleetStableVersion: DEFAULT_AGENT_FLEET_STABLE_VERSION,
        canaryVersion: "",
        allowlistEmails: [...DEFAULT_AGENT_ROLLOUT_ALLOWLIST],
        repoVersion: repo,
        identity: { email: "fleet.user@pwc.com" },
      }),
    ).toBe(DEFAULT_AGENT_FLEET_STABLE_VERSION);

    expect(
      resolveAgentTargetVersion({
        mode: "allowlist",
        fleetStableVersion: DEFAULT_AGENT_FLEET_STABLE_VERSION,
        canaryVersion: "",
        allowlistEmails: [...DEFAULT_AGENT_ROLLOUT_ALLOWLIST],
        repoVersion: repo,
        identity: { email: "soumitra.m.mandal@pwc.com" },
      }),
    ).toBe(repo);
  });

  it("setup registers PwCOfficePulseWatchdog and watchdog scripts exist (ASCII, no IEX heartbeat)", () => {
    expect(existsSync(setupPath)).toBe(true);
    expect(existsSync(watchdogPs1)).toBe(true);
    expect(existsSync(watchdogVbs)).toBe(true);

    const setup = readFileSync(setupPath, "utf8");
    expect(setup).toContain("PwCOfficePulseWatchdog");
    expect(setup).toContain("Register-WatchdogTask");

    const wd = readFileSync(watchdogPs1, "utf8");
    const wdCode = wd
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    expect(wdCode).not.toMatch(/Invoke-Expression/);
    expect(wdCode).not.toMatch(/office-heartbeat\.txt/);
    expect(wdCode).toMatch(/update\.ps1/);
    expect(wd).not.toMatch(/[\u2014\u2013\u2018\u2019\u201C\u201D]/);

    const vbs = readFileSync(watchdogVbs, "utf8");
    expect(vbs).toMatch(/-File/);
    expect(vbs).toContain("watchdog.ps1");
    const vbsCode = vbs
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("'"))
      .join("\n");
    expect(vbsCode).not.toMatch(/office-heartbeat/);
    expect(vbsCode).not.toMatch(/Invoke-Expression|IEX/i);
  });

  it("agent-auto-update skill documents server canary allowlist gate", () => {
    const skill = readFileSync(skillPath, "utf8");
    expect(skill).toContain("BUG-018");
    expect(skill).toMatch(/agentRolloutMode|canary|allowlist/i);
  });
});
