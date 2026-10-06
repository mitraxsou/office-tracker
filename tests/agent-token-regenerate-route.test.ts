import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

import { POST as regeneratePost } from "../src/app/api/settings/agent-token/regenerate/route";
import { POST as refreshPost } from "../src/app/api/settings/refresh-install-commands/route";
import { TOKEN_REGEN_NEEDS_APPROVAL } from "../src/lib/agent-token-regenerate-requests";

describe("POST /api/settings/agent-token/regenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "u@example.com",
      role: "admin",
    });
  });

  it("returns 401 when not signed in", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await regeneratePost();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a regular user so they must request admin approval", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", email: "u@example.com", role: "user" });
    const res = await regeneratePost();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("approval_required");
    expect(body.error).toBe(TOKEN_REGEN_NEEDS_APPROVAL);
  });

  it("returns 403 for an admin on their own Settings", async () => {
    const res = await regeneratePost();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("approval_required");
    expect(body.error).toBe(TOKEN_REGEN_NEEDS_APPROVAL);
  });
});

describe("POST /api/settings/refresh-install-commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "u@example.com",
      role: "admin",
    });
  });

  it("returns 403 for an admin so refresh also needs approval", async () => {
    const res = await refreshPost();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("approval_required");
  });
});
