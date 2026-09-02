import { describe, expect, it } from "vitest";
import { getImpersonationBlockReason } from "../src/lib/impersonation";

describe("getImpersonationBlockReason", () => {
  const admin = { id: "admin-1", role: "admin" };
  const user = { id: "user-1", email: "user@pwc.com" };

  it("blocks non-admins", () => {
    expect(
      getImpersonationBlockReason({
        admin: { id: "user-1", role: "user" },
        target: user,
      }),
    ).toBe("Forbidden");
  });

  it("blocks missing target", () => {
    expect(getImpersonationBlockReason({ admin, target: null })).toBe("User not found");
  });

  it("blocks self-impersonation", () => {
    expect(
      getImpersonationBlockReason({
        admin,
        target: { id: "admin-1", email: "admin@pwc.com" },
      }),
    ).toBe("Cannot impersonate yourself");
  });

  it("blocks breakglass target", () => {
    const originalBreakglassEmail = process.env.BREAKGLASS_EMAIL;
    process.env.BREAKGLASS_EMAIL = "breakglass@pwc.office";

    expect(
      getImpersonationBlockReason({
        admin,
        target: { id: "bg-1", email: "breakglass@pwc.office" },
      }),
    ).toBe("Cannot impersonate breakglass account");

    process.env.BREAKGLASS_EMAIL = originalBreakglassEmail;
  });

  it("allows valid admin impersonation", () => {
    expect(getImpersonationBlockReason({ admin, target: user })).toBeNull();
  });
});
