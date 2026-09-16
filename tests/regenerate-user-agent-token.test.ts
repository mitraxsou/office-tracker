import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db", () => ({
  prisma: {
    agentToken: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("../src/lib/app-config", () => ({
  getAppConfig: vi.fn().mockResolvedValue({ pendingTokenTtlDays: 14 }),
}));

vi.mock("../src/lib/agent-deregister", () => ({
  clearAgentDeregistration: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../src/lib/db";
import { regenerateUserAgentToken } from "../src/lib/auth";

beforeEach(() => {
  process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
  vi.clearAllMocks();
  vi.mocked(prisma.agentToken.create).mockImplementation(async (args) => ({
    id: "new-token",
    ...args.data,
    createdAt: new Date(),
  }) as never);
});

describe("regenerateUserAgentToken", () => {
  it("revokes only the specified token and keeps label", async () => {
    vi.mocked(prisma.agentToken.findUnique).mockResolvedValue({
      id: "tok-1",
      userId: "user-1",
      revokedAt: null,
      label: "Work laptop",
    } as never);
    vi.mocked(prisma.agentToken.update).mockResolvedValue({} as never);

    const { plainToken, record } = await regenerateUserAgentToken("user-1", "tok-1");

    expect(plainToken).toHaveLength(64);
    expect(prisma.agentToken.update).toHaveBeenCalledWith({
      where: { id: "tok-1" },
      data: { revokedAt: expect.any(Date), pendingTokenEnc: null },
    });
    expect(prisma.agentToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          label: "Work laptop",
        }),
      }),
    );
    expect(record.id).toBe("new-token");
  });

  it("rejects token owned by another user", async () => {
    vi.mocked(prisma.agentToken.findUnique).mockResolvedValue({
      id: "tok-1",
      userId: "other-user",
      revokedAt: null,
      label: null,
    } as never);

    await expect(regenerateUserAgentToken("user-1", "tok-1")).rejects.toThrow("Token not found");
    expect(prisma.agentToken.update).not.toHaveBeenCalled();
  });

  it("requires tokenId when multiple active tokens exist", async () => {
    vi.mocked(prisma.agentToken.findMany).mockResolvedValue([
      { id: "a" },
      { id: "b" },
    ] as never);

    await expect(regenerateUserAgentToken("user-1")).rejects.toThrow(
      "Choose which laptop token to regenerate",
    );
  });

  it("regenerates the sole active token without tokenId", async () => {
    vi.mocked(prisma.agentToken.findMany).mockResolvedValue([
      { id: "only", label: "Home laptop" },
    ] as never);
    vi.mocked(prisma.agentToken.update).mockResolvedValue({} as never);

    await regenerateUserAgentToken("user-1");

    expect(prisma.agentToken.update).toHaveBeenCalledWith({
      where: { id: "only" },
      data: { revokedAt: expect.any(Date), pendingTokenEnc: null },
    });
  });
});
