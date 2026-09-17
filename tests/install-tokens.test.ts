import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  backfillInstallTokenEncIfNeeded,
  dedupeInstallTokensByBoundSerial,
  revealStoredPendingToken,
  persistPendingTokenEnc,
} from "../src/lib/auth";
import type { InstallTokenForUser } from "../src/lib/install-token-types";
import { decryptPendingToken, encryptPendingToken } from "../src/lib/token-crypto";
import {
  buildBootstrapUninstallCommand,
  buildBootstrapUninstallCommandFromLocalConfig,
  buildInstallCommand,
  buildInstallCommandFromLocalConfig,
  buildSetupCommand,
  buildSetupCommandFromLocalConfig,
  buildZipReinstallCommand,
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

beforeEach(() => {
  process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
});

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

describe("backfillInstallTokenEncIfNeeded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists encrypted copy when legacy token has no pendingTokenEnc", async () => {
    const plain = `${"g".repeat(8)}${"h".repeat(56)}`;
    vi.mocked(prisma.agentToken.findFirst).mockResolvedValue({
      id: "tok-3",
      pendingTokenEnc: null,
      boundSerialNumber: "PG04YGZF",
      revokedAt: null,
      expiresAt: null,
    } as never);
    vi.mocked(prisma.agentToken.update).mockResolvedValue({} as never);

    await backfillInstallTokenEncIfNeeded("user-1", plain, {
      pendingTokenEnc: null,
      boundSerialNumber: "PG04YGZF",
      revokedAt: null,
      expiresAt: null,
    });

    expect(prisma.agentToken.update).toHaveBeenCalled();
  });

  it("skips backfill when encrypted copy already exists", async () => {
    const plain = `${"i".repeat(8)}${"j".repeat(56)}`;
    const enc = encryptPendingToken(plain);

    await backfillInstallTokenEncIfNeeded("user-1", plain, {
      pendingTokenEnc: enc,
      boundSerialNumber: "PG04YGZF",
      revokedAt: null,
      expiresAt: null,
    });

    expect(prisma.agentToken.update).not.toHaveBeenCalled();
  });
});

describe("post-backfill install commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enables plain-token install command after persistPendingTokenEnc", async () => {
    const plain = `${"k".repeat(8)}${"l".repeat(56)}`;
    vi.mocked(prisma.agentToken.findFirst).mockResolvedValue({
      id: "tok-4",
      pendingTokenEnc: null,
      boundSerialNumber: "PG04YGZF",
      revokedAt: null,
      expiresAt: null,
    } as never);
    vi.mocked(prisma.agentToken.update).mockResolvedValue({} as never);

    await persistPendingTokenEnc("user-1", plain);

    const enc = vi.mocked(prisma.agentToken.update).mock.calls[0]?.[0].data
      .pendingTokenEnc as string;
    const revealed = decryptPendingToken(enc);
    expect(revealed).toBe(plain);
    const command = buildInstallCommand("https://office.example", revealed!);
    expect(command).toContain(`$Token=''${plain}''`); // single-quoted -Command (safe paste in PowerShell)
    expect(command).not.toContain("config.json");
  });
});

describe("copy-paste agent commands", () => {
  it("primary setup command bootstraps from server with Force", () => {
    const command = buildSetupCommand("https://office.example", "tok");
    expect(command).toContain("-Command '& {");
    expect(command).toContain("/api/agent/files/setup.ps1");
    expect(command).toContain("Invoke-AgentScriptBypass");
    expect(command).toContain("Force=$true");
    expect(command).toContain("OFFICEPULSE_SETUP_API_URL");
    expect(command).toContain("$Token=''tok''");
    expect(command).toContain("$ApiUrl=''https://office.example''");
    expect(command).not.toContain("extracted zip");
    expect(command).not.toContain('/Command "& {');
  });

  it("buildZipReinstallCommand still supports zip-folder reinstall", () => {
    const command = buildZipReinstallCommand("https://office.example", "tok");
    expect(command).toContain("Join-Path $PWD");
    expect(command).toContain("Force = $true");
    expect(command).not.toContain("/api/agent/files/setup.ps1");
  });

  it("bootstrap install uses IEX bypass on setup.ps1", () => {
    const command = buildInstallCommand("https://office.example", "tok");
    expect(command).toContain("agent-download.ps1");
    expect(command).toContain("agent-storage.ps1");
    expect(command).toContain("Invoke-AgentScriptBypass");
    expect(command).toContain("/api/agent/files/setup.ps1");
    expect(command).toContain("BoundVars @{ ApiUrl=");
    expect(command).toContain("$Token=''tok''");
    expect(command).not.toMatch(/ -File /);
  });

  it("bootstrap update uses the same command as install", () => {
    const command = buildUpdateCommand("https://office.example", "tok");
    expect(command).toBe(buildInstallCommand("https://office.example", "tok"));
  });

  it("builds install command from local config.json for legacy bound tokens", () => {
    const command = buildInstallCommandFromLocalConfig("https://office.example");
    expect(command).toContain("config.json");
    expect(command).toContain("$cfg.token");
    expect(command).toContain("Invoke-AgentScriptBypass");
    expect(command).not.toMatch(/ -File /);
  });

  it("builds update command from local config.json for legacy bound tokens", () => {
    const command = buildUpdateCommandFromLocalConfig("https://office.example");
    expect(command).toContain("config.json");
    expect(command).toContain("$cfg.token");
    expect(command).not.toMatch(/ -File /);
  });

  it("builds setup command from local config.json for legacy bound tokens", () => {
    const command = buildSetupCommandFromLocalConfig("https://office.example");
    expect(command).toContain("config.json");
    expect(command).toContain("$cfg.token");
    expect(command).toContain("Invoke-AgentScriptBypass");
    expect(command).not.toMatch(/ -File /);
  });

  it("bootstrap uninstall downloads uninstall.ps1 without zip folder", () => {
    const command = buildBootstrapUninstallCommand("https://office.example", "tok");
    expect(command).toContain("/api/agent/files/uninstall.ps1");
    expect(command).toContain("Authorization=(''Bearer ''+$Token)");
    expect(command).toContain("$Token=''tok''");
    expect(command).toContain("Invoke-Expression");
    expect(command).not.toContain("Downloads");
    expect(command).not.toContain("setup.ps1");
  });

  it("bootstrap uninstall from local config reads token for download auth", () => {
    const command = buildBootstrapUninstallCommandFromLocalConfig("https://office.example");
    expect(command).toContain("config.json");
    expect(command).toContain("$cfg.token");
    expect(command).toContain("/api/agent/files/uninstall.ps1");
  });

  it("dedupes install tokens to one card per bound laptop serial", () => {
    const base: InstallTokenForUser = {
      id: "1",
      label: "Initial laptop",
      prefix: "aaaa",
      plainToken: "t1",
      setupCommand: "cmd1",
      bootstrapUninstallCommand: "u1",
      installCommand: "i1",
      updateCommand: "up1",
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "bound",
      boundSerialNumber: "PG04YGZF",
    };
    const newer: InstallTokenForUser = {
      ...base,
      id: "2",
      label: "Laptop 16/9/2026",
      prefix: "fbbb",
      plainToken: "t2",
      setupCommand: "cmd2",
      createdAt: "2026-09-16T00:00:00.000Z",
    };
    const result = dedupeInstallTokensByBoundSerial([base, newer]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("2");
    expect(result[0]?.prefix).toBe("fbbb");
  });
});
