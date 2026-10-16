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
const watchdogInstaller = path.join(
  process.cwd(),
  "agent/watchdog/install-watchdog.ps1",
);
const agentConfigRoute = path.join(
  process.cwd(),
  "src/app/api/agent/config/route.ts",
);
const rolloutRoute = path.join(
  process.cwd(),
  "src/app/api/admin/agent-rollout/route.ts",
);
const releaseSchema = path.join(process.cwd(), "prisma/schema.prisma");
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

  it("keeps watchdog installation separate from routine agent setup", () => {
    expect(existsSync(setupPath)).toBe(true);
    expect(existsSync(watchdogPs1)).toBe(true);
    expect(existsSync(watchdogVbs)).toBe(true);
    expect(existsSync(watchdogInstaller)).toBe(true);

    const setup = readFileSync(setupPath, "utf8");
    expect(setup).toContain("Install-WatchdogBootstrap");
    expect(setup).toContain("SKIP independent watchdog already installed and left unchanged");
    expect(setup).not.toContain("function Register-WatchdogTask");
    expect(setup).not.toContain("$WatchdogTaskDescription");
    expect(setup).not.toMatch(/Join-Path \$PSScriptRoot "watchdog/);

    const installer = readFileSync(watchdogInstaller, "utf8");
    expect(installer).toContain("PwCOfficePulseWatchdog");
    expect(installer).toContain("Register-ScheduledTask");
    expect(installer).toContain("New-TimeSpan -Hours 1");
    expect(installer).toContain("SKIP existing watchdog left unchanged");
    expect(installer).toContain("ReplaceExisting");
    // BUG-028: AtLogOn must bind -User or IEX bypass registers a hollow task.
    expect(installer).toContain("New-ScheduledTaskTrigger -AtLogOn -User");
    expect(installer).toContain("Watchdog scheduled task was not registered");

    const wd = readFileSync(watchdogPs1, "utf8");
    const wdCode = wd
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    expect(wdCode).not.toMatch(/Invoke-Expression/);
    expect(wdCode).not.toMatch(/office-heartbeat\.txt/);
    expect(wdCode).toMatch(/update\.ps1/);
    expect(wd).toContain("watchdog will not downgrade");
    expect(wd).toContain("agentFleetStableVersion");
    expect(wd).toContain("agentFleetStableFilesBase");
    expect(wd).toContain("X-Agent-SHA256");
    expect(wd).toContain("-FilesBaseOverride");
    expect(wd).toContain("PwCOfficePulse-recovery-");
    expect(wd).not.toMatch(/name = "watchdog\.ps1"/);
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

    const configRoute = readFileSync(agentConfigRoute, "utf8");
    expect(configRoute).toContain(
      "agentFleetStableVersion: globalConfig.agentFleetStableVersion",
    );
    expect(configRoute).toContain("agentFleetStableFilesBase");

    const promote = readFileSync(rolloutRoute, "utf8");
    expect(promote).toContain("snapshotFleetStableAgentRelease(canary)");
    expect(promote.indexOf("snapshotFleetStableAgentRelease(canary)")).toBeLessThan(
      promote.indexOf("promoteAgentCanaryToEveryone()"),
    );
    expect(readFileSync(releaseSchema, "utf8")).toContain(
      "model AgentReleaseArtifact",
    );
  });

  it("agent-auto-update skill documents server canary allowlist gate", () => {
    const skill = readFileSync(skillPath, "utf8");
    expect(skill).toContain("BUG-018");
    expect(skill).toMatch(/agentRolloutMode|canary|allowlist/i);
  });
});
