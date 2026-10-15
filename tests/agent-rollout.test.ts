import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_FLEET_STABLE_VERSION,
  DEFAULT_AGENT_ROLLOUT_ALLOWLIST,
  isAgentRolloutAllowlisted,
  normalizeAgentRolloutAllowlist,
  resolveAgentTargetVersion,
} from "@/lib/agent-rollout";

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
