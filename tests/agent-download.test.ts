import { readFile } from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import { AGENT_EXTRACT_FOLDER } from "@/lib/agent-branding";
import {
  AGENT_CORE_DOWNLOAD_FILES,
  AGENT_DOWNLOAD_FILES,
  agentScriptFilesBaseUrl,
  agentZipEntryPath,
  buildAgentDownloadVersionOptions,
  isAgentDownloadFileName,
  isAllowedAgentDownloadVersion,
} from "@/lib/agent-download";
import { fleetStableFilesBaseUrl } from "@/lib/agent-release-artifacts";

describe("agent download helpers", () => {
  it("recognizes allowed agent file names", () => {
    expect(isAgentDownloadFileName("update.ps1")).toBe(true);
    expect(isAgentDownloadFileName("evil.exe")).toBe(false);
  });

  it("builds per-file base URL on the app host", () => {
    expect(agentScriptFilesBaseUrl("https://office-tracker-prod.vercel.app")).toBe(
      "https://office-tracker-prod.vercel.app/api/agent/files",
    );
    expect(fleetStableFilesBaseUrl("https://office-tracker-prod.vercel.app", "1.5.26")).toBe(
      "https://office-tracker-prod.vercel.app/api/agent/releases/1.5.26/files",
    );
    expect(AGENT_CORE_DOWNLOAD_FILES).not.toContain("watchdog.ps1");
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
        /PwCOfficePulse\/(lib\/|watchdog\/)?(setup\.ps1|agent-download\.ps1|agent-storage\.ps1|[\w.-]+)$/,
      );
    }
  });

  it("lists only known download versions and labels target / fleet / latest / archived", () => {
    const options = buildAgentDownloadVersionOptions({
      targetVersion: "1.5.24",
      repoVersion: "1.5.35",
      fleetStableVersion: "1.5.24",
      artifactVersions: ["1.5.24", "1.5.20"],
      includeRepoCanary: true,
    });
    expect(options.map((o) => o.version)).toEqual(["1.5.24", "1.5.35", "1.5.20"]);
    expect(options[0]).toMatchObject({
      version: "1.5.24",
      recommended: true,
      label: "Recommended (your target) - v1.5.24",
    });
    expect(options.find((o) => o.version === "1.5.35")?.label).toBe("Latest - v1.5.35");
    expect(options.find((o) => o.version === "1.5.20")?.label).toBe("Archived - v1.5.20");
    expect(isAllowedAgentDownloadVersion("1.5.24", options)).toBe(true);
    expect(isAllowedAgentDownloadVersion("1.5.20", options)).toBe(true);
    expect(isAllowedAgentDownloadVersion("9.9.9", options)).toBe(false);
  });

  it("omits deploy canary Latest for fleet users (includeRepoCanary false)", () => {
    const options = buildAgentDownloadVersionOptions({
      targetVersion: "1.5.24",
      repoVersion: "1.5.35",
      fleetStableVersion: "1.5.24",
      artifactVersions: ["1.5.20"],
      includeRepoCanary: false,
    });
    expect(options.map((o) => o.version)).toEqual(["1.5.24", "1.5.20"]);
    expect(isAllowedAgentDownloadVersion("1.5.35", options)).toBe(false);
    expect(isAllowedAgentDownloadVersion("1.5.24", options)).toBe(true);
  });

  it("still includes repo when it is the caller's resolved target (canary soak)", () => {
    const options = buildAgentDownloadVersionOptions({
      targetVersion: "1.5.35",
      repoVersion: "1.5.35",
      fleetStableVersion: "1.5.24",
      artifactVersions: [],
      includeRepoCanary: false,
    });
    expect(options.map((o) => o.version).sort()).toEqual(["1.5.24", "1.5.35"]);
    expect(options.find((o) => o.version === "1.5.35")?.recommended).toBe(true);
  });

  it("does not invent versions beyond target, repo, fleet-stable, and artifacts", () => {
    const options = buildAgentDownloadVersionOptions({
      targetVersion: "1.5.35",
      repoVersion: "1.5.35",
      fleetStableVersion: "1.5.24",
      artifactVersions: [],
      includeRepoCanary: true,
    });
    expect(options.map((o) => o.version).sort()).toEqual(["1.5.24", "1.5.35"]);
  });
});
