import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../src/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("../src/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  return {
    ...actual,
    ensureAgentToken: vi.fn(),
  };
});

import {
  generateTempPassword,
  hashPassword,
  verifyPassword,
  changeUserPassword,
} from "../src/lib/auth";
import { ensureBreakglassAdmin, isBreakglassEmail, BREAKGLASS_PASSWORD_ENV_MESSAGE } from "../src/lib/breakglass";
import {
  ADMIN_SELF_RESET_MESSAGE,
  buildPasswordResetMailto,
  getAdminPasswordResetBlockReason,
  getSelfPasswordChangeBlockReason,
  validatePasswordStrength,
} from "../src/lib/password-policy";

const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

describe("generateTempPassword", () => {
  it("generates a 12 character readable password", () => {
    const password = generateTempPassword();
    expect(password.length).toBe(12);
    for (const char of password) {
      expect(TEMP_PASSWORD_CHARS.includes(char)).toBe(true);
    }
  });
});

describe("admin password reset hash", () => {
  it("stores bcrypt hash that verifies with the temp password", async () => {
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    expect(await verifyPassword(tempPassword, hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("login works with temp password after hash update", async () => {
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    expect(await verifyPassword(tempPassword, hash)).toBe(true);
  });
});

describe("validatePasswordStrength", () => {
  it("rejects passwords shorter than 8 characters", () => {
    expect(validatePasswordStrength("short")).toBe("Password must be at least 8 characters");
    expect(validatePasswordStrength("12345678")).toBeNull();
  });
});

describe("getAdminPasswordResetBlockReason", () => {
  const originalBreakglassEmail = process.env.BREAKGLASS_EMAIL;

  beforeEach(() => {
    process.env.BREAKGLASS_EMAIL = "breakglass@pwc.office";
  });

  afterEach(() => {
    process.env.BREAKGLASS_EMAIL = originalBreakglassEmail;
  });

  it("blocks admin from resetting their own password", () => {
    expect(
      getAdminPasswordResetBlockReason({
        adminId: "admin-1",
        targetId: "admin-1",
        targetEmail: "admin@pwc.office",
      }),
    ).toBe(ADMIN_SELF_RESET_MESSAGE);
  });

  it("blocks admin from resetting breakglass user", () => {
    expect(
      getAdminPasswordResetBlockReason({
        adminId: "admin-1",
        targetId: "bg-1",
        targetEmail: "breakglass@pwc.office",
      }),
    ).toBe(BREAKGLASS_PASSWORD_ENV_MESSAGE);
  });

  it("allows admin to reset another user", () => {
    expect(
      getAdminPasswordResetBlockReason({
        adminId: "admin-1",
        targetId: "user-1",
        targetEmail: "user@pwc.office",
      }),
    ).toBeNull();
  });
});

describe("getSelfPasswordChangeBlockReason", () => {
  const originalBreakglassEmail = process.env.BREAKGLASS_EMAIL;

  beforeEach(() => {
    process.env.BREAKGLASS_EMAIL = "breakglass@pwc.office";
  });

  afterEach(() => {
    process.env.BREAKGLASS_EMAIL = originalBreakglassEmail;
  });

  it("blocks breakglass self-service password change", () => {
    expect(getSelfPasswordChangeBlockReason("breakglass@pwc.office")).toBe(
      BREAKGLASS_PASSWORD_ENV_MESSAGE,
    );
  });

  it("allows regular users to change password", () => {
    expect(getSelfPasswordChangeBlockReason("user@pwc.office")).toBeNull();
  });
});

describe("isBreakglassEmail", () => {
  const originalBreakglassEmail = process.env.BREAKGLASS_EMAIL;

  beforeEach(() => {
    process.env.BREAKGLASS_EMAIL = "breakglass@pwc.office";
  });

  afterEach(() => {
    process.env.BREAKGLASS_EMAIL = originalBreakglassEmail;
  });

  it("matches breakglass email case-insensitively", () => {
    expect(isBreakglassEmail("Breakglass@pwc.office")).toBe(true);
    expect(isBreakglassEmail("other@pwc.office")).toBe(false);
  });
});

describe("ensureBreakglassAdmin", () => {
  const originalEnv = {
    email: process.env.BREAKGLASS_EMAIL,
    password: process.env.BREAKGLASS_PASSWORD,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BREAKGLASS_EMAIL = "breakglass@pwc.office";
    process.env.BREAKGLASS_PASSWORD = "env-password-123";
  });

  afterEach(() => {
    process.env.BREAKGLASS_EMAIL = originalEnv.email;
    process.env.BREAKGLASS_PASSWORD = originalEnv.password;
  });

  it("updates password hash for existing breakglass user on every ensure", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "bg-1",
      email: "breakglass@pwc.office",
      role: "admin",
      passwordHash: "old-hash",
    });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: "bg-1",
        email: "breakglass@pwc.office",
        role: "admin",
        passwordHash: "old-hash",
      })
      .mockResolvedValueOnce({
        id: "bg-1",
        email: "breakglass@pwc.office",
        role: "admin",
        passwordHash: "new-hash",
      });

    await ensureBreakglassAdmin();

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "bg-1" },
      data: expect.objectContaining({
        role: "admin",
        mustChangePassword: false,
        passwordHash: expect.any(String),
      }),
    });
    const updateData = prismaMock.user.update.mock.calls[0][0].data;
    expect(await verifyPassword("env-password-123", updateData.passwordHash)).toBe(true);
  });

  it("creates breakglass user when missing", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "bg-new",
      email: "breakglass@pwc.office",
    });

    await ensureBreakglassAdmin();

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "breakglass@pwc.office",
        role: "admin",
        mustChangePassword: false,
        passwordHash: expect.any(String),
      }),
    });
  });
});

describe("changeUserPassword", () => {
  const originalBreakglassEmail = process.env.BREAKGLASS_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BREAKGLASS_EMAIL = "breakglass@pwc.office";
  });

  afterEach(() => {
    process.env.BREAKGLASS_EMAIL = originalBreakglassEmail;
  });

  it("updates hash when current password is correct", async () => {
    const currentPassword = "current-pass";
    const newPassword = "new-password";
    const passwordHash = await hashPassword(currentPassword);

    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@pwc.office",
      passwordHash,
    });
    prismaMock.user.update.mockResolvedValue({});

    await changeUserPassword("user-1", currentPassword, newPassword);

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        mustChangePassword: false,
        passwordResetAt: null,
        passwordHash: expect.any(String),
      }),
    });
    const updateData = prismaMock.user.update.mock.calls[0][0].data;
    expect(await verifyPassword(newPassword, updateData.passwordHash)).toBe(true);
  });

  it("rejects incorrect current password", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@pwc.office",
      passwordHash: await hashPassword("correct-pass"),
    });

    await expect(
      changeUserPassword("user-1", "wrong-pass", "new-password"),
    ).rejects.toThrow("Current password is incorrect");
  });
});

describe("buildPasswordResetMailto", () => {
  it("builds mailto link with encoded subject and body", () => {
    const href = buildPasswordResetMailto({
      userEmail: "user@pwc.office",
      tempPassword: "TempPass123",
      loginUrl: "https://office.example.com/login",
    });

    expect(href.startsWith("mailto:user@pwc.office?")).toBe(true);
    expect(href).toContain("subject=");
    expect(href).toContain("body=");
    expect(decodeURIComponent(href)).toContain("TempPass123");
    expect(decodeURIComponent(href)).toContain("https://office.example.com/login");
  });
});
