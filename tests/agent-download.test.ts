import { describe, expect, it } from "vitest";
import {
  agentScriptFilesBaseUrl,
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
});
