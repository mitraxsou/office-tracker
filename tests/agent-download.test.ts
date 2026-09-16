import { readFile } from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import { AGENT_EXTRACT_FOLDER } from "@/lib/agent-branding";
import {
  AGENT_DOWNLOAD_FILES,
  agentScriptFilesBaseUrl,
  agentZipEntryPath,
  isAgentDownloadFileName,
} from "@/lib/agent-download";

describe("agent download helpers", () => {
  it("recognizes allowed agent file names", () => {
    expect(isAgentDownloadFileName("update.ps1")).toBe(true);
    expect(isAgentDownloadFileName("evil.exe")).toBe(false);
  });

  it("builds per-file base URL on the app host", () => {
    expect(agentScriptFilesBaseUrl("https://office-tracker-prod.vercel.app")).toBe(
      "https://office-tracker-prod.vercel.app/api/agent/files",
    );
  });

  it("places helper scripts under lib/ in the agent zip", () => {
    expect(agentZipEntryPath("setup.ps1")).toBe("setup.ps1");
    expect(agentZipEntryPath("agent-download.ps1")).toBe("lib/agent-download.ps1");
    expect(agentZipEntryPath("agent-storage.ps1")).toBe("lib/agent-storage.ps1");
  });

  it("agent repo files exist at zip entry paths (download route cannot ship a broken zip)", async () => {
    for (const file of AGENT_DOWNLOAD_FILES) {
      const entry = agentZipEntryPath(file);
      const diskPath = path.join(process.cwd(), "agent", entry);
      await expect(readFile(diskPath)).resolves.toBeDefined();
      expect(`${AGENT_EXTRACT_FOLDER}/${entry}`).toMatch(
        /PwCOfficePulse\/(lib\/)?(setup\.ps1|agent-download\.ps1|agent-storage\.ps1|[\w.-]+)$/,
      );
    }
  });
});
