import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_FLEET_STABLE_VERSION,
  DEFAULT_AGENT_ROLLOUT_ALLOWLIST,
  effectiveAgentCanaryVersion,
  isAgentRolloutAllowlisted,
  normalizeAgentRolloutAllowlist,
  resolveAgentTargetVersion,
} from "@/lib/agent-rollout";
import { getAgentVersion } from "@/lib/agent-version";

describe("resolveAgentTargetVersion", () => {
  const base = {
    fleetStableVersion: "1.5.24",
    canaryVersion: "1.5.25",
    allowlistEmails: [...DEFAULT_AGENT_ROLLOUT_ALLOWLIST],
    repoVersion: "1.5.25",
  };

  it("returns fleet-stable for non-allowlisted users in allowlist mode", () => {
    expect(
      resolveAgentTargetVersion({
        ...base,
        mode: "allowlist",
        identity: { email: "other.user@pwc.com" },
      }),
    ).toBe("1.5.24");
  });

  it("returns canary for Soumitra allowlist email in allowlist mode", () => {
    expect(
      resolveAgentTargetVersion({
        ...base,
        mode: "allowlist",
        identity: { email: "soumitra.m.mandal@pwc.com" },
      }),
    ).toBe("1.5.25");
  });

  it("returns canary for every allowlisted email, and fleet-stable for everyone else", () => {
    const allowlistEmails = ["soumitra.m.mandal@pwc.com", "aleyaa.canary@pwc.com"];
    expect(
      resolveAgentTargetVersion({
        ...base,
        mode: "allowlist",
        allowlistEmails,
        identity: { email: "aleyaa.canary@pwc.com" },
      }),
    ).toBe("1.5.25");
    expect(
      resolveAgentTargetVersion({
        ...base,
        mode: "allowlist",
        allowlistEmails,
        identity: { email: "new.user@pwc.com" },
      }),
    ).toBe("1.5.24");
  });

  it("is case-insensitive on allowlist emails", () => {
    expect(
      resolveAgentTargetVersion({
        ...base,
        mode: "allowlist",
        identity: { email: "Soumitra.M.Mandal@PwC.com" },
      }),
    ).toBe("1.5.25");
  });

  it("returns canary for everyone when mode is everyone", () => {
    expect(
      resolveAgentTargetVersion({
        ...base,
        mode: "everyone",
        identity: { email: "other.user@pwc.com" },
      }),
    ).toBe("1.5.25");
  });

  it("uses repo version when canaryVersion is empty", () => {
    expect(
      resolveAgentTargetVersion({
        ...base,
        canaryVersion: "",
        mode: "allowlist",
        identity: { email: "soumitra.m.mandal@pwc.com" },
      }),
    ).toBe("1.5.25");
  });

  it("ignores a stale stored canary string and always tracks repo for allowlisted users", () => {
    expect(
      resolveAgentTargetVersion({
        ...base,
        canaryVersion: "9.9.9",
        repoVersion: "1.5.35",
        mode: "allowlist",
        identity: { email: "soumitra.m.mandal@pwc.com" },
      }),
    ).toBe("1.5.35");
    expect(
      resolveAgentTargetVersion({
        ...base,
        canaryVersion: "9.9.9",
        repoVersion: "1.5.35",
        mode: "allowlist",
        identity: { email: "other.user@pwc.com" },
      }),
    ).toBe("1.5.24");
  });

  it("defaults fleet-stable when empty string", () => {
    expect(
      resolveAgentTargetVersion({
        ...base,
        fleetStableVersion: "",
        mode: "allowlist",
        identity: { email: "other.user@pwc.com" },
      }),
    ).toBe(DEFAULT_AGENT_FLEET_STABLE_VERSION);
  });

  it("treats missing identity as non-canary in allowlist mode", () => {
    expect(
      resolveAgentTargetVersion({
        ...base,
        mode: "allowlist",
        identity: null,
      }),
    ).toBe("1.5.24");
  });
});

describe("agent rollout allowlist helpers", () => {
  it("keeps Soumitra default when normalize gets empty list", () => {
    expect(normalizeAgentRolloutAllowlist([])).toEqual([
      ...DEFAULT_AGENT_ROLLOUT_ALLOWLIST,
    ]);
  });

  it("matches allowlisted emails", () => {
    expect(
      isAgentRolloutAllowlisted(
        { email: "soumitra.m.mandal@pwc.com" },
        [...DEFAULT_AGENT_ROLLOUT_ALLOWLIST],
      ),
    ).toBe(true);
    expect(
      isAgentRolloutAllowlisted(
        { email: "nobody@pwc.com" },
        [...DEFAULT_AGENT_ROLLOUT_ALLOWLIST],
      ),
    ).toBe(false);
  });
});

describe("canary auto-tracks deploy version", () => {
  it("effectiveAgentCanaryVersion always equals repo / given deploy version", () => {
    expect(effectiveAgentCanaryVersion("1.5.35")).toBe("1.5.35");
    expect(effectiveAgentCanaryVersion()).toBe(getAgentVersion());
  });

  it("Admin UI and PATCH do not accept a manual canary edit", () => {
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/AdminAgentRolloutPanel.tsx"),
      "utf8",
    );
    const route = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/agent-rollout/route.ts"),
      "utf8",
    );
    expect(panel).toContain("Always matches the repo / deploy agent version");
    expect(panel).not.toMatch(/setCanary\(/);
    expect(route).toContain("ignore manual agentCanaryVersion");
    expect(route).not.toMatch(/update\.agentCanaryVersion\s*=/);
  });
});
