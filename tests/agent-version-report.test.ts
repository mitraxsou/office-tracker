import { readFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findMany: vi.fn(),
  getAppConfig: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db", () => ({
  prisma: {
    agentDevice: { findMany: mocks.findMany },
  },
}));
vi.mock("@/lib/app-config", () => ({
  getAppConfig: mocks.getAppConfig,
}));

import { GET } from "@/app/api/admin/agent-version-report/route";
import { getAgentVersion } from "@/lib/agent-version";
import {
  buildAgentVersionAttentionReport,
  type AgentVersionReportConfig,
  type AgentVersionReportDeviceInput,
} from "@/lib/agent-version-report";

const allowlist = ["soumitra.m.mandal@pwc.com", "aleyaa.canary@pwc.com"];

const allowlistConfig: AgentVersionReportConfig = {
  agentRolloutMode: "allowlist",
  agentFleetStableVersion: "1.5.24",
  agentCanaryVersion: "1.5.25",
  agentRolloutAllowlistEmails: allowlist,
};

function device(
  overrides: Partial<AgentVersionReportDeviceInput> & {
    id: string;
    email: string;
    agentScriptVersion: string | null;
  },
): AgentVersionReportDeviceInput {
  return {
    id: overrides.id,
    serialNumber: overrides.serialNumber ?? `SN-${overrides.id}`,
    agentScriptVersion: overrides.agentScriptVersion,
    lastSeenAt:
      overrides.lastSeenAt === undefined
        ? new Date("2026-10-15T08:00:00.000Z")
        : overrides.lastSeenAt,
    user: overrides.user ?? {
      id: `user-${overrides.id}`,
      email: overrides.email,
      name: null,
    },
  };
}

function emailsIn(report: ReturnType<typeof buildAgentVersionAttentionReport>) {
  return report.users.flatMap((user) => user.devices.map((row) => user.email));
}

describe("buildAgentVersionAttentionReport", () => {
  it("compares allowlisted users to canary and everyone else to fleet-stable", () => {
    const report = buildAgentVersionAttentionReport({
      config: allowlistConfig,
      devices: [
        device({
          id: "soumitra",
          email: "soumitra.m.mandal@pwc.com",
          agentScriptVersion: "1.5.24",
        }),
        device({
          id: "aleyaa",
          email: "aleyaa.canary@pwc.com",
          agentScriptVersion: "1.5.25",
        }),
        device({
          id: "fleet-current",
          email: "new.user@pwc.com",
          agentScriptVersion: "1.5.24",
        }),
        device({
          id: "fleet-behind",
          email: "other.user@pwc.com",
          agentScriptVersion: "1.5.23",
        }),
        device({
          id: "fleet-on-canary",
          email: "ahead.user@pwc.com",
          agentScriptVersion: "1.5.25",
        }),
        device({
          id: "unknown",
          email: "quiet.user@pwc.com",
          agentScriptVersion: null,
          lastSeenAt: null,
        }),
      ],
    });

    expect(report.fleetStableVersion).toBe("1.5.24");
    expect(report.canaryVersion).toBe("1.5.25");
    expect(report.rolloutMode).toBe("allowlist");
    expect(report.allowlistCount).toBe(2);
    expect(report).not.toHaveProperty("expectedVersion");
    expect(emailsIn(report)).toEqual([
      "soumitra.m.mandal@pwc.com",
      "other.user@pwc.com",
      "ahead.user@pwc.com",
      "quiet.user@pwc.com",
    ]);

    const soumitra = report.users[0].devices[0];
    expect(soumitra.expectedVersion).toBe("1.5.25");
    expect(soumitra.status).toBe("needs_update");
    expect(soumitra).not.toHaveProperty("updateQueued");

    const behind = report.users.find((user) => user.email === "other.user@pwc.com")!;
    expect(behind.devices[0].expectedVersion).toBe("1.5.24");
    expect(behind.devices[0].status).toBe("needs_update");

    const onCanaryByMistake = report.users.find((user) => user.email === "ahead.user@pwc.com")!;
    expect(onCanaryByMistake.devices[0].expectedVersion).toBe("1.5.24");

    const unknown = report.users.find((user) => user.email === "quiet.user@pwc.com")!;
    expect(unknown.devices[0].status).toBe("unknown");
    expect(unknown.devices[0].expectedVersion).toBe("1.5.24");
    expect(unknown.devices[0].installedVersion).toBeNull();
    expect(unknown.devices[0].lastSeenAt).toBeNull();
  });

  it("is empty when every laptop matches its own target, even if canary is ahead", () => {
    const report = buildAgentVersionAttentionReport({
      config: allowlistConfig,
      devices: [
        device({
          id: "soumitra",
          email: "soumitra.m.mandal@pwc.com",
          agentScriptVersion: "1.5.25",
        }),
        device({
          id: "aleyaa",
          email: "Aleyaa.Canary@pwc.com",
          agentScriptVersion: "1.5.25",
        }),
        device({
          id: "fleet",
          email: "new.user@pwc.com",
          agentScriptVersion: "1.5.24",
        }),
      ],
    });

    expect(report.deviceCount).toBe(0);
    expect(report.userCount).toBe(0);
    expect(report.users).toEqual([]);
    expect(report.canaryVersion).not.toBe(report.fleetStableVersion);
  });

  it("does not treat the repo version as the fleet target when canary config is empty", () => {
    const repoVersion = getAgentVersion();
    const report = buildAgentVersionAttentionReport({
      config: {
        ...allowlistConfig,
        agentCanaryVersion: "",
      },
      devices: [
        device({
          id: "fleet",
          email: "new.user@pwc.com",
          agentScriptVersion: "1.5.24",
        }),
        device({
          id: "soumitra",
          email: "soumitra.m.mandal@pwc.com",
          agentScriptVersion: "1.5.24",
        }),
      ],
    });

    expect(report.fleetStableVersion).toBe("1.5.24");
    expect(report.canaryVersion).toBe(repoVersion);
    expect(emailsIn(report)).not.toContain("new.user@pwc.com");
    if (repoVersion === "1.5.24") {
      expect(report.deviceCount).toBe(0);
    } else {
      expect(emailsIn(report)).toEqual(["soumitra.m.mandal@pwc.com"]);
      expect(report.users[0].devices[0].expectedVersion).toBe(repoVersion);
    }
  });

  it("follows everyone mode only when rollout is actually everyone", () => {
    const report = buildAgentVersionAttentionReport({
      config: { ...allowlistConfig, agentRolloutMode: "everyone" },
      devices: [
        device({
          id: "fleet",
          email: "new.user@pwc.com",
          agentScriptVersion: "1.5.24",
        }),
      ],
    });

    expect(report.rolloutMode).toBe("everyone");
    expect(report.fleetStableVersion).toBe("1.5.24");
    expect(report.canaryVersion).toBe("1.5.25");
    expect(report.users[0].devices[0].expectedVersion).toBe("1.5.25");
  });
});

describe("GET /api/admin/agent-version-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.getAppConfig.mockResolvedValue(allowlistConfig);
    mocks.findMany.mockResolvedValue([
      {
        id: "dev-fleet",
        serialNumber: "SN-FLEET",
        agentScriptVersion: "1.5.24",
        lastSeenAt: new Date("2026-10-15T08:00:00.000Z"),
        user: { id: "user-fleet", email: "new.user@pwc.com", name: "New User" },
      },
      {
        id: "dev-canary",
        serialNumber: "SN-CANARY",
        agentScriptVersion: "1.5.24",
        lastSeenAt: new Date("2026-10-15T09:00:00.000Z"),
        user: {
          id: "user-soumitra",
          email: "soumitra.m.mandal@pwc.com",
          name: "Soumitra",
        },
      },
    ]);
  });

  it("forbids a non-admin", async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("returns per-user targets and omits a fleet-wide repo version", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.expectedVersion).toBeUndefined();
    expect(body.fleetStableVersion).toBe("1.5.24");
    expect(body.canaryVersion).toBe("1.5.25");
    expect(body.deviceCount).toBe(1);
    expect(body.users).toHaveLength(1);
    expect(body.users[0].email).toBe("soumitra.m.mandal@pwc.com");
    expect(body.users[0].devices[0].expectedVersion).toBe("1.5.25");
    expect(body.users[0].devices[0].updateQueued).toBeUndefined();
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { uninstalledAt: null },
      }),
    );
  });
});

describe("Agents not updated panel copy", () => {
  const component = readFileSync(
    path.join(process.cwd(), "src/components/AdminAgentVersionReport.tsx"),
    "utf8",
  );
  const route = readFileSync(
    path.join(process.cwd(), "src/app/api/admin/agent-version-report/route.ts"),
    "utf8",
  );

  it("does not present the repo version as the current agent for every laptop", () => {
    expect(component).toContain("Fleet-stable:");
    expect(component).toContain("Canary:");
    expect(component).toContain("Canary is not the fleet target.");
    expect(component).toContain("Every reporting laptop matches its own target.");
    expect(component).not.toContain("Current agent");
    expect(component).not.toContain("Push update");
    expect(component).not.toContain("queueUpdate");
    expect(component).not.toContain("agent-update");
    expect(component).not.toContain("forceAgentUpdate");
    expect(component).not.toMatch(/\u2014|\u2013/);
    expect(route).not.toContain("getAgentVersion");
    expect(route).toContain("buildAgentVersionAttentionReport");
    expect(route).not.toMatch(/\u2014|\u2013/);
  });
});
