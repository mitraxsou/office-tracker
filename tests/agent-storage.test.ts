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
    expect(heartbeat).toContain("Import-AgentStorageModule");
    expect(setup).toContain("Invoke-AgentLogMaintenance");
    expect(setup).toContain("Import-AgentStorageModule");
  });

  it("bootstrap setup command downloads agent-storage.ps1 before IEX", () => {
    const command = buildSetupCommand("https://office.example", "tok");
    expect(command).toContain("/api/agent/files/agent-storage.ps1");
    expect(command).toContain("agent-storage.ps1");
    expect(command.indexOf("agent-storage.ps1")).toBeLessThan(command.indexOf("setup.ps1"));
  });
});
