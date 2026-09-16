import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { AGENT_DOWNLOAD_FILES } from "@/lib/agent-download";
import { buildSetupCommand } from "@/lib/agent-branding";

describe("agent local storage maintenance", () => {
  const storage = readFileSync(
    path.join(process.cwd(), "agent", "lib", "agent-storage.ps1"),
    "utf8",
  );
  const heartbeat = readFileSync(
    path.join(process.cwd(), "agent", "office-heartbeat.ps1"),
    "utf8",
  );
  const setup = readFileSync(path.join(process.cwd(), "agent", "setup.ps1"), "utf8");
  const install = readFileSync(path.join(process.cwd(), "agent", "install.ps1"), "utf8");
  const updater = readFileSync(path.join(process.cwd(), "agent", "update.ps1"), "utf8");
  const download = readFileSync(
    path.join(process.cwd(), "agent", "lib", "agent-download.ps1"),
    "utf8",
  );

  it("ships agent-storage.ps1 in the download bundle", () => {
    expect(AGENT_DOWNLOAD_FILES).toContain("agent-storage.ps1");
    expect(download).toContain('"agent-storage.ps1"');
  });

  it("caps total log size at about 10 MB", () => {
    expect(storage).toContain("$script:AgentLogMaxTotalBytes = 10 * 1024 * 1024");
    expect(storage).toContain("function Invoke-AgentLogMaintenance");
    expect(storage).toContain("Invoke-TruncateLogFileTail");
  });

  it("never prunes visit sync events from the queue", () => {
    expect(storage).toContain('"visit_start", "visit_end", "daily_summary"');
    expect(storage).toContain("Test-AgentEventIsCritical");
    expect(storage).toContain("AgentExpendableEventTypes");
    expect(storage).toContain("$script:AgentStaleEventDays = 14");
    expect(storage).toContain("$script:AgentEventQueueMaxCount = 400");
  });

  it("runs maintenance on each heartbeat and setup", () => {
    expect(heartbeat).toContain("Invoke-LocalStorageMaintenance");
    expect(heartbeat).toContain("Invoke-AgentStorageMaintenance");
    expect(heartbeat).not.toContain("function Import-AgentStorageModule");
    expect(setup).toContain("Invoke-AgentLogMaintenance");
    expect(setup).not.toContain("function Import-AgentStorageModule");
    expect(setup).not.toContain("function Import-AgentDownloadModule");
  });

  it("dot-sources agent modules at script scope, not inside import helpers", () => {
    expect(heartbeat).toMatch(/if \(-not \(Get-Command Invoke-AgentStorageMaintenance[\s\S]*?\. \$modulePath/);
    expect(install).not.toContain("function Import-AgentDownloadModule");
    expect(updater).not.toContain("function Import-AgentDownloadModule");
  });

  it("honors OFFICETRACKER_INSTALL_DIR for regression installs", () => {
    expect(storage).toContain("$env:OFFICETRACKER_INSTALL_DIR");
  });

  it("reinstall command dot-sources lib agent-storage.ps1 before setup IEX", () => {
    const command = buildSetupCommand("https://office.example", "tok");
    expect(command).toContain("lib\\agent-storage.ps1");
    expect(command).toContain(". $libSt");
    expect(command.indexOf("agent-storage.ps1")).toBeLessThan(command.indexOf("Invoke-AgentScriptBypass"));
    expect(command).not.toContain("/api/agent/files/agent-storage.ps1");
  });
});
