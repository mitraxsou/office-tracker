import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.hoisted(() => vi.fn());
const runCronJobMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/cron-jobs", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/cron-jobs")>();
  return { ...original, runCronJob: runCronJobMock };
});

import { POST as runManually } from "@/app/api/admin/cron/[job]/run/route";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { cronHealth } from "@/lib/cron-jobs";

describe("cron administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue(null);
    runCronJobMock.mockResolvedValue({ ok: true, checked: 2 });
  });

  it("forbids a non-admin manual run", async () => {
    const response = await runManually(new Request("https://office.example"), {
      params: Promise.resolve({ job: "agent-alerts" }),
    });

    expect(response.status).toBe(403);
    expect(runCronJobMock).not.toHaveBeenCalled();
  });

  it("allows an admin to invoke a job without CRON_SECRET", async () => {
    requireAdminMock.mockResolvedValue({ id: "admin-1", role: "admin" });

    const response = await runManually(new Request("https://office.example"), {
      params: Promise.resolve({ job: "agent-alerts" }),
    });

    expect(response.status).toBe(200);
    expect(runCronJobMock).toHaveBeenCalledWith("agent-alerts", "manual");
  });

  it("keeps bearer authentication for scheduled cron requests", () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "cron-test-secret";
    try {
      const result = authorizeCronRequest(
        new Request("https://office.example/api/cron/agent-alerts", {
          headers: { authorization: "Bearer cron-test-secret" },
        }),
      );
      expect(result).toEqual({ ok: true });
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous;
    }
  });
});

describe("cron health", () => {
  const now = new Date("2026-09-03T12:00:00.000Z");

  it("reports never, failed, working, and overdue states", () => {
    expect(cronHealth(null, 60_000, now)).toBe("never");
    expect(
      cronHealth({ status: "error", finishedAt: new Date("2026-09-03T11:59:30.000Z") }, 60_000, now),
    ).toBe("failed");
    expect(
      cronHealth({ status: "ok", finishedAt: new Date("2026-09-03T11:58:30.000Z") }, 60_000, now),
    ).toBe("working");
    expect(
      cronHealth({ status: "ok", finishedAt: new Date("2026-09-03T11:57:59.000Z") }, 60_000, now),
    ).toBe("overdue");
  });
});
