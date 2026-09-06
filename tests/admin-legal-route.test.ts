import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../src/lib/legal-config", () => ({
  getAdminLegalDraft: vi.fn(),
  updateLegalDraft: vi.fn(),
  publishLegalConfig: vi.fn(),
  validateTermsSections: vi.fn((sections: unknown) => sections),
  validatePrivacySections: vi.fn((sections: unknown) => sections),
  formatLegalUpdatedLabel: vi.fn(() => "September 2026"),
}));

vi.mock("../src/lib/audit-log", () => ({
  logAuditEvent: vi.fn(),
}));

import { GET, PUT } from "../src/app/api/admin/legal/route";
import { POST as publishLegal } from "../src/app/api/admin/legal/publish/route";
import { requireAdmin } from "../src/lib/admin";
import {
  getAdminLegalDraft,
  publishLegalConfig,
  updateLegalDraft,
} from "../src/lib/legal-config";
import { logAuditEvent } from "../src/lib/audit-log";

describe("GET /api/admin/legal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-1" } as never);
    vi.mocked(getAdminLegalDraft).mockResolvedValue({
      legalVersion: 2,
      publishedTermsSections: [{ title: "A", body: "B" }],
      publishedPrivacySections: [{ title: "P", items: ["x"] }],
      publishedChangeSummary: "Updated retention",
      publishedAt: new Date("2026-09-01"),
      draftTermsSections: [{ title: "A", body: "B" }],
      draftPrivacySections: [{ title: "P", items: ["x"] }],
      draftChangeSummary: "Draft note",
    });
  });

  it("returns 403 for non-admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns draft and published legal config", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.legalVersion).toBe(2);
    expect(body.draft.termsSections).toHaveLength(1);
  });
});

describe("PUT /api/admin/legal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-1" } as never);
    vi.mocked(getAdminLegalDraft).mockResolvedValue({
      legalVersion: 2,
      publishedTermsSections: [],
      publishedPrivacySections: [],
      publishedChangeSummary: null,
      publishedAt: null,
      draftTermsSections: [{ title: "A", body: "B" }],
      draftPrivacySections: [{ title: "P", items: ["x"] }],
      draftChangeSummary: null,
    });
  });

  it("saves draft content", async () => {
    const res = await PUT(
      new Request("http://localhost/api/admin/legal", {
        method: "PUT",
        body: JSON.stringify({
          termsSections: [{ title: "A", body: "B" }],
          privacySections: [{ title: "P", items: ["x"] }],
          changeSummary: "New bullets",
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(updateLegalDraft).toHaveBeenCalled();
  });
});

describe("POST /api/admin/legal/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-1" } as never);
    vi.mocked(getAdminLegalDraft).mockResolvedValue({
      legalVersion: 2,
      publishedTermsSections: [],
      publishedPrivacySections: [],
      publishedChangeSummary: null,
      publishedAt: null,
      draftTermsSections: [],
      draftPrivacySections: [],
      draftChangeSummary: null,
    });
    vi.mocked(publishLegalConfig).mockResolvedValue({
      legalVersion: 3,
      changeSummary: "v3",
      publishedAt: new Date("2026-09-07"),
    } as never);
  });

  it("bumps version and logs audit event", async () => {
    const res = await publishLegal();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.legalVersion).toBe(3);
    expect(publishLegalConfig).toHaveBeenCalledWith("admin-1");
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "legal.publish" }),
    );
  });
});
