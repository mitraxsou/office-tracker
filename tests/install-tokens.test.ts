import { beforeEach, describe, expect, it, vi } from "vitest";
import { revealStoredPendingToken, persistPendingTokenEnc } from "../src/lib/auth";
import { encryptPendingToken } from "../src/lib/token-crypto";
import {
  buildInstallCommand,
  buildInstallCommandFromLocalConfig,
  buildUpdateCommand,
  buildUpdateCommandFromLocalConfig,
} from "../src/lib/agent-branding";

vi.mock("../src/lib/db", () => ({
  prisma: {
    agentToken: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../src/lib/db";

describe("revealStoredPendingToken", () => {
  it("returns plain token for bound laptop when encrypted copy is kept", () => {
    const plain = "a".repeat(64);
    const enc = encryptPendingToken(plain);
    const result = revealStoredPendingToken({
      pendingTokenEnc: enc,
      boundSerialNumber: "PG04YGZF",
      revokedAt: null,
      expiresAt: null,
    });
    expect(result).toBe(plain);
  });

  it("returns null when encrypted copy was cleared", () => {
    const result = revealStoredPendingToken({
      pendingTokenEnc: null,
      boundSerialNumber: "PG04YGZF",
      revokedAt: null,
      expiresAt: null,
    });
    expect(result).toBeNull();
  });

  it("legacy bound tokens without encrypted copy cannot reveal install command", () => {
    const plain = "b".repeat(64);
    const enc = encryptPendingToken(plain);
    expect(
      revealStoredPendingToken({
        pendingTokenEnc: enc,
        boundSerialNumber: "ABC123",
        revokedAt: null,
        expiresAt: null,
      }),
    ).toBe(plain);
    expect(
      revealStoredPendingToken({
        pendingTokenEnc: null,
        boundSerialNumber: "ABC123",
        revokedAt: null,
        expiresAt: null,
      }),
    ).toBeNull();
  });
});

describe("persistPendingTokenEnc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores encrypted copy when legacy token has no pendingTokenEnc", async () => {
    const plain = `${"c".repeat(8)}${"d".repeat(56)}`;
    vi.mocked(prisma.agentToken.findFirst).mockResolvedValue({
      id: "tok-1",
      pendingTokenEnc: null,
      boundSerialNumber: "PG04YGZF",
      revokedAt: null,
      expiresAt: null,
    } as never);
    vi.mocked(prisma.agentToken.update).mockResolvedValue({} as never);

    const ok = await persistPendingTokenEnc("user-1", plain);

    expect(ok).toBe(true);
    expect(prisma.agentToken.update).toHaveBeenCalledWith({
      where: { id: "tok-1" },
      data: { pendingTokenEnc: expect.any(String) },
    });
  });

  it("skips update when encrypted copy already matches", async () => {
    const plain = `${"e".repeat(8)}${"f".repeat(56)}`;
    const enc = encryptPendingToken(plain);
    vi.mocked(prisma.agentToken.findFirst).mockResolvedValue({
      id: "tok-2",
      pendingTokenEnc: enc,
      boundSerialNumber: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    } as never);

    const ok = await persistPendingTokenEnc("user-1", plain);

    expect(ok).toBe(true);
    expect(prisma.agentToken.update).not.toHaveBeenCalled();
  });
});

describe("copy-paste agent commands", () => {
  const expectedInstall =
    'Unblock-File -LiteralPath ".\\install.ps1"; powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ".\\install.ps1" -ApiUrl "https://office.example" -Token "tok"';
  const expectedUpdate =
    'Unblock-File -LiteralPath ".\\update.ps1"; powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ".\\update.ps1" -ApiUrl "https://office.example" -Token "tok"';

  it("uses relative install.ps1 with ApiUrl and Token", () => {
    const command = buildInstallCommand("https://office.example", "tok");
    expect(command).toBe(expectedInstall);
    expect(command).not.toContain("USERPROFILE");
    expect(command).not.toContain("Downloads");
  });

  it("uses relative update.ps1 with the same ApiUrl and Token flags", () => {
    const command = buildUpdateCommand("https://office.example", "tok");
    expect(command).toBe(expectedUpdate);
    expect(command).toContain('-ApiUrl "https://office.example"');
    expect(command).toContain('-Token "tok"');
  });

  it("builds install command from local config.json for legacy bound tokens", () => {
    const command = buildInstallCommandFromLocalConfig("https://office.example");
    expect(command).toContain("config.json");
    expect(command).toContain('-ApiUrl "https://office.example"');
    expect(command).toContain("-Token $cfg.token");
    expect(command).toContain(".\\install.ps1");
  });

  it("builds update command from local config.json for legacy bound tokens", () => {
    const command = buildUpdateCommandFromLocalConfig("https://office.example");
    expect(command).toContain("config.json");
    expect(command).toContain('-ApiUrl "https://office.example"');
    expect(command).toContain("-Token $cfg.token");
    expect(command).toContain(".\\update.ps1");
  });
});
