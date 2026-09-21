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

import { getDeviceForceAgentUpdate } from "@/lib/agent-update";

describe("getDeviceForceAgentUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when serial is missing", async () => {
    await expect(getDeviceForceAgentUpdate("user-1", null)).resolves.toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns true for admin Push even when version is current", async () => {
    findUniqueMock.mockResolvedValue({
      forceAgentUpdate: true,
      agentScriptVersion: "1.5.12",
    });
    await expect(getDeviceForceAgentUpdate("user-1", "SERIAL-1")).resolves.toBe(true);
  });

  it("returns true when reported version is stale so old agents refresh setup.ps1", async () => {
    findUniqueMock.mockResolvedValue({
      forceAgentUpdate: false,
      agentScriptVersion: "1.5.7",
    });
    await expect(getDeviceForceAgentUpdate("user-1", "SERIAL-1")).resolves.toBe(true);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { userId_serialNumber: { userId: "user-1", serialNumber: "SERIAL-1" } },
      select: { forceAgentUpdate: true, agentScriptVersion: true },
    });
  });

  it("returns false when version is current and admin did not push", async () => {
    findUniqueMock.mockResolvedValue({
      forceAgentUpdate: false,
      agentScriptVersion: "1.5.12",
    });
    await expect(getDeviceForceAgentUpdate("user-1", "SERIAL-1")).resolves.toBe(false);
  });
});
