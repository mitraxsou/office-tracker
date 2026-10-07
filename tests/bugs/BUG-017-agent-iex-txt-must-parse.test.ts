import { execFileSync } from "child_process";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const agentDir = path.join(process.cwd(), "agent");
const fixtureScript = path.join(
  process.cwd(),
  "tests/bugs/fixtures/publish-agent-txt-roundtrip.ps1",
);

function listAgentPs1Files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listAgentPs1Files(full));
      continue;
    }
    if (entry.name.endsWith(".ps1")) out.push(full);
  }
  return out;
}

describe("BUG-017 agent IEX .txt runner must keep parsing after every ship", () => {
  it("forbids em/en dashes in agent PowerShell (they mojibake into .txt under ANSI read)", () => {
    const files = listAgentPs1Files(agentDir);
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content, path.relative(process.cwd(), file)).not.toMatch(/\u2014|\u2013/);
    }
  });

  it("Publish-AgentScriptTxt reads .ps1 as UTF-8 before writing .txt", () => {
    const download = readFileSync(path.join(agentDir, "lib/agent-download.ps1"), "utf8");
    expect(download).toContain("function Publish-AgentScriptTxt");
    expect(download).toContain(
      "Get-Content -LiteralPath $Ps1Path -Raw -Encoding UTF8",
    );
    expect(download).toContain("Set-Content -LiteralPath $txtPath -Value $body -Encoding UTF8");
  });

  it("keeps the scheduled task on published .txt IEX (not -File .ps1)", () => {
    const setup = readFileSync(path.join(agentDir, "setup.ps1"), "utf8");
    expect(setup).toContain("function New-HiddenRunner");
    expect(setup).toContain("Publish-AgentScriptTxt -Ps1Path $ScriptPath");
    expect(setup).toMatch(/Get-Content -Raw '\$txtPath'; Invoke-Expression/);
    expect(setup).not.toMatch(/-File ['"]\$?heartbeatScript['"]/);
  });

  it("keeps agent/version.txt aligned with $AgentScriptVersion", () => {
    const version = readFileSync(path.join(agentDir, "version.txt"), "utf8").trim();
    const heartbeat = readFileSync(path.join(agentDir, "office-heartbeat.ps1"), "utf8");
    expect(heartbeat).toContain(`$AgentScriptVersion = "${version}"`);
  });

  it("Publish-AgentScriptTxt UTF-8 round-trip leaves shipping heartbeat .txt parseable", () => {
    const output = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", fixtureScript],
      { encoding: "utf8", timeout: 60_000 },
    );
    expect(output).toContain("BUG017_OK");
  });
});
