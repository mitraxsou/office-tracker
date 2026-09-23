import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/force-update-self-kill.json"),
    "utf8",
  ),
) as {
  protectedMarkers: string[];
  killNeedles: string[];
  lockFile: string;
};

describe("BUG-002 force-update self-kill / setup.lock", () => {
  it("setup protects installer process tree and skips installer markers", () => {
    const setup = readFileSync(path.join(process.cwd(), "agent", "setup.ps1"), "utf8");
    expect(setup).toContain("function Get-AgentProtectedProcessIds");
    expect(setup).toContain("leaves .setup.lock behind");
    expect(setup).toContain("function Stop-RunningAgentProcesses");
    expect(setup).toContain(fixture.lockFile);

    for (const marker of fixture.protectedMarkers) {
      expect(setup).toContain(`"${marker}"`);
    }
    for (const needle of fixture.killNeedles) {
      expect(setup).toContain(`"${needle}"`);
    }

    const protectIdx = setup.indexOf("function Get-AgentProtectedProcessIds");
    const stopIdx = setup.indexOf("function Stop-RunningAgentProcesses");
    const markersIdx = setup.indexOf("$installerMarkers");
    expect(protectIdx).toBeGreaterThan(-1);
    expect(stopIdx).toBeGreaterThan(protectIdx);
    expect(markersIdx).toBeGreaterThan(stopIdx);
    expect(setup).toContain("if ($protected.ContainsKey([int]$_.Id)) { return }");
    expect(setup).toContain('if ($cmd -like "*$marker*") { return }');
  });
});
