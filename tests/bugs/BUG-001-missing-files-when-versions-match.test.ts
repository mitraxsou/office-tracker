import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/agent-layout-required-files.json"),
    "utf8",
  ),
) as {
  localVersion: string;
  serverVersion: string;
  installDirFilesMissing: string[];
  expectedRepair: boolean;
};

function readSetup(): string {
  return readFileSync(path.join(process.cwd(), "agent", "setup.ps1"), "utf8");
}

describe("BUG-001 missing files when versions match", () => {
  it("fixture models matching versions with incomplete layout", () => {
    expect(fixture.localVersion).toBe(fixture.serverVersion);
    expect(fixture.installDirFilesMissing).toContain("test-connection.ps1");
    expect(fixture.expectedRepair).toBe(true);
  });

  it("setup repairs when Get-MissingAgentLayoutFiles is non-empty even if versions match", () => {
    const setup = readSetup();
    expect(setup).toContain("function Get-MissingAgentLayoutFiles");
    expect(setup).toContain("test-connection.ps1");
    expect(setup).toContain("$missingScripts = Get-MissingAgentLayoutFiles -InstallDir $installDir");
    expect(setup).toContain("($missingScripts.Count -gt 0)");
    expect(setup).toContain('repair missing');
    // Soft skip only when versions match AND nothing is missing.
    expect(setup).toMatch(
      /\$shouldInstallScripts = \$isFreshInstall -or \$Force -or \$pendingForceReset -or \(\(Compare-AgentVersion \$newVersion \$localVersion\) -ne 0\) -or \(\$missingScripts\.Count -gt 0\)/,
    );
  });

  it("auto-update always downloads test-connection.ps1 with setup scripts", () => {
    const heartbeat = readFileSync(
      path.join(process.cwd(), "agent", "office-heartbeat.ps1"),
      "utf8",
    );
    expect(heartbeat).toContain("$filesBase/test-connection.ps1");
    expect(heartbeat).toContain("Refreshing setup scripts from server before");
  });
});
