import { readFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    agentDevice: { findUnique: findUniqueMock },
  },
}));

vi.mock("@/lib/agent-version", () => ({
  getAgentVersion: () => "1.5.12",
  compareAgentVersions: (a: string, b: string) => {
    const parse = (v: string) => v.split(".").map((p) => parseInt(p, 10) || 0);
    const av = parse(a);
    const bv = parse(b);
    for (let i = 0; i < Math.max(av.length, bv.length); i++) {
      const diff = (av[i] ?? 0) - (bv[i] ?? 0);
      if (diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
  },
}));

import { getDeviceForceAgentUpdate, isDeviceAgentVersionStale } from "@/lib/agent-update";

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/bugs/fixtures/stale-soft-update.json"), "utf8"),
) as {
  userId: string;
  serialNumber: string;
  serverVersion: string;
  device: { forceAgentUpdate: boolean; agentScriptVersion: string };
  expectedForce: boolean;
};

describe("BUG-003 stale version stays soft update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks version stale without forcing wipe", async () => {
    expect(
      isDeviceAgentVersionStale(fixture.device.agentScriptVersion, fixture.serverVersion),
    ).toBe(true);

    findUniqueMock.mockResolvedValue(fixture.device);
    await expect(
      getDeviceForceAgentUpdate(fixture.userId, fixture.serialNumber),
    ).resolves.toBe(fixture.expectedForce);
  });

  it("documents that only admin Push sets force", async () => {
    findUniqueMock.mockResolvedValue({
      forceAgentUpdate: true,
      agentScriptVersion: fixture.serverVersion,
    });
    await expect(
      getDeviceForceAgentUpdate(fixture.userId, fixture.serialNumber),
    ).resolves.toBe(true);
  });
});
