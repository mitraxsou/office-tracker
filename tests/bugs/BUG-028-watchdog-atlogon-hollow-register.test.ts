import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const fixturePath = path.join(
  process.cwd(),
  "tests/bugs/fixtures/watchdog-atlogon-hollow-register.json",
);
const catalogPath = path.join(process.cwd(), "tests/bugs/catalog.json");
const installerPath = path.join(process.cwd(), "agent/watchdog/install-watchdog.ps1");
const setupPath = path.join(process.cwd(), "agent/setup.ps1");

describe("BUG-028 watchdog AtLogOn hollow register blocks soft update", () => {
  it("keeps catalog entry and fixture", () => {
    expect(existsSync(fixturePath)).toBe(true);
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      incident: string;
      fix: {
        atLogOnBindsUser: boolean;
        verifyTaskAfterRegister: boolean;
        setupCommitsVersionEvenIfWatchdogWarns: boolean;
      };
    };
    expect(fixture.incident).toBe("BUG-028");
    expect(fixture.fix.atLogOnBindsUser).toBe(true);
    expect(fixture.fix.verifyTaskAfterRegister).toBe(true);
    expect(fixture.fix.setupCommitsVersionEvenIfWatchdogWarns).toBe(true);

    const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
      cases: Array<{ id: string; status: string; area: string }>;
    };
    const entry = catalog.cases.find((c) => c.id === "BUG-028");
    expect(entry).toBeTruthy();
    expect(entry!.area).toBe("agent-update");
    expect(entry!.status).toBe("guarded");
  });

  it("binds AtLogOn -User, verifies the task exists, and does not freeze version commit", () => {
    const installer = readFileSync(installerPath, "utf8");
    expect(installer).toContain("New-ScheduledTaskTrigger -AtLogOn -User");
    expect(installer).not.toMatch(/New-ScheduledTaskTrigger -AtLogOn\s*$/m);
    expect(installer).toContain("Watchdog scheduled task was not registered");
    expect(installer).not.toMatch(/[\u2014\u2013\u2018\u2019\u201C\u201D]/);

    const setup = readFileSync(setupPath, "utf8");
    expect(setup).toContain("WARN continuing so agent version can commit");
    expect(setup).toContain("Committed agent version $newVersion after successful setup");
    const warnIdx = setup.lastIndexOf("WARN continuing so agent version can commit");
    const commitIdx = setup.lastIndexOf("Committed agent version $newVersion");
    expect(commitIdx).toBeGreaterThan(warnIdx);
  });
});
