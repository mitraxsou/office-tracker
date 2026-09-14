import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getRealCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
  getRealCurrentUser: mocks.getRealCurrentUser,
}));

import { GET } from "../src/app/api/settings/agent-status/route";

describe("GET /api/settings/agent-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for regular users", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "u1", role: "user", timezone: "UTC" });
    mocks.getRealCurrentUser.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(403);
  });
});
