import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const agentFiles = [
  "office-heartbeat.ps1",
  "setup.ps1",
  "install.ps1",
  "update.ps1",
  "lib/agent-storage.ps1",
  "lib/agent-download.ps1",
];

function readAgent(relPath: string): string {
  return readFileSync(path.join(process.cwd(), "agent", relPath), "utf8");
}

describe("PowerShell 5.1 compatibility patterns", () => {
  for (const file of agentFiles) {
    it(`${file} does not wrap dot-source in Import-* helper functions`, () => {
      const content = readAgent(file);
      expect(content).not.toMatch(/function\s+Import-Agent\w+/);
    });
  }

  it("office-heartbeat dot-sources agent-storage at script scope", () => {
    const heartbeat = readAgent("office-heartbeat.ps1");
    expect(heartbeat).toMatch(/if \(-not \(Get-Command Invoke-AgentStorageMaintenance[\s\S]*?\. \$modulePath/);
    expect(heartbeat).not.toContain("function Import-AgentStorageModule");
  });

  it("office-heartbeat avoids pipeline assignment pollution in Remove-AckedEvents", () => {
    const heartbeat = readAgent("office-heartbeat.ps1");
    expect(heartbeat).toContain("return @($Queue | Where-Object");
    expect(heartbeat).not.toMatch(/return\s+\$Queue\s+\|\s+Where-Object/);
  });

  it("office-heartbeat uses PS 5.1-safe inline if for transition timestamps", () => {
    const heartbeat = readAgent("office-heartbeat.ps1");
    expect(heartbeat).toContain("$disconnectAt = if ($EndAt) { $EndAt } else { Get-NowIso }");
    expect(heartbeat).toContain("$transitionAt = if ($At) { $At } else { Get-NowIso }");
    expect(heartbeat).toContain(
      "$fromSsid = if ($syncState.pendingPreviousSsid) { [string]$syncState.pendingPreviousSsid } else { $previousSsid }",
    );
  });

  it("setup.ps1 never kills its own process tree during force reinstall", () => {
    const setup = readAgent("setup.ps1");
    expect(setup).toContain("function Get-AgentProtectedProcessIds");
    expect(setup).toContain("$protected = Get-AgentProtectedProcessIds");
    expect(setup).toContain("if ($protected.ContainsKey([int]$_.Id)) { return }");
    expect(setup).toContain("$installerMarkers");
  });

  it("agent-storage exposes maintenance without nested import helpers", () => {
    const storage = readAgent("lib/agent-storage.ps1");
    expect(storage).toContain("function Invoke-AgentStorageMaintenance");
    expect(storage).not.toMatch(/function\s+Import-/);
  });

  it("setup.ps1 dot-sources download and storage modules at top level", () => {
    const setup = readAgent("setup.ps1");
    expect(setup).toMatch(/foreach \(\$path in Get-AgentDownloadModuleCandidates\)[\s\S]*?\. \$path/);
    expect(setup).toMatch(/foreach \(\$path in Get-AgentStorageModuleCandidates\)[\s\S]*?\. \$path/);
    expect(setup).not.toContain("function Import-AgentDownloadModule");
    expect(setup).not.toContain("function Import-AgentStorageModule");
  });
});
