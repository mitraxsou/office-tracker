import { describe, expect, it } from "vitest";
import { revealStoredPendingToken } from "../src/lib/auth";
import { encryptPendingToken } from "../src/lib/token-crypto";
import { buildInstallCommand, buildUpdateCommand } from "../src/lib/agent-branding";

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
});
