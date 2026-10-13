import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * BUG-018: No production / fleet agent publish until Soumitra laptop soak
 * confirms autoupdate still works. Complements BUG-017 (IEX parse safety).
 *
 * Does not block local agent/ edits. Enforces that the Cursor skill still
 * documents the gate. Laptop soak steps stay skipped (need a live install).
 */
const fixturePath = path.join(
  process.cwd(),
  "tests/bugs/fixtures/soumitra-only-agent-soak.json",
);
const skillPath = path.join(
  process.cwd(),
  ".cursor/skills/agent-auto-update/SKILL.md",
);
const catalogPath = path.join(process.cwd(), "tests/bugs/catalog.json");

describe("BUG-018 Soumitra-only agent soak (no fleet publish)", () => {
  it("keeps the soak policy fixture and catalog entry", () => {
    expect(existsSync(fixturePath)).toBe(true);
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      incident: string;
      policy: string;
      soakOwner: { email: string };
      rollout: string;
    };
    expect(fixture.incident).toBe("BUG-018");
    expect(fixture.policy).toBe("no-fleet-agent-publish-until-soak");
    expect(fixture.soakOwner.email).toBe("soumitra.m.mandal@pwc.com");
    expect(fixture.rollout.toLowerCase()).toContain("opt-in");

    const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
      cases: Array<{ id: string; status: string; area: string }>;
    };
    const entry = catalog.cases.find((c) => c.id === "BUG-018");
    expect(entry).toBeTruthy();
    expect(entry!.area).toBe("agent-update");
    expect(["open", "manual"]).toContain(entry!.status);
  });

  it("agent-auto-update skill still hard-gates fleet publish (BUG-018)", () => {
    expect(existsSync(skillPath)).toBe(true);
    const skill = readFileSync(skillPath, "utf8");
    expect(skill).toContain("BUG-018");
    expect(skill).toMatch(/Soumitra/i);
    expect(skill).toMatch(/NEVER do|no production\s*\/\s*fleet agent publish/i);
    expect(skill).toMatch(/explicit user approval|opt-in/i);
    expect(skill).toContain("BUG-017");
  });

  it.skip(
    "Soumitra laptop soak: task + heartbeat + soft auto-update still work after local change",
    () => {
      // Run on Soumitra's PwC laptop only (%LOCALAPPDATA%\\OfficeTracker → theta).
      // 1) npm test -- tests/bugs/BUG-017-agent-iex-txt-must-parse.test.ts
      // 2) Task PwCOfficePulse still registered and firing
      // 3) logs\\heartbeat.log fresh START v… within ~3 minutes
      // 4) office-heartbeat.txt parses (IEX path alive)
      // 5) Soft update log lines when a newer server version is intentional
      // Only after soak + explicit user approval: consider fleet rollout.
    },
  );
});
