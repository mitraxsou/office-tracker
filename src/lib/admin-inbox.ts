import type { Prisma } from "@prisma/client";

export const ADMIN_INBOX_KINDS = [
  "visit_correction",
  "timezone_change",
  "profile_change",
  "compliance_exemption",
  "device_removal",
] as const;

export type AdminInboxKind = (typeof ADMIN_INBOX_KINDS)[number];

export type AdminInboxItem = {
  id: string;
  kind: AdminInboxKind;
  label: string;
  summary: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  createdAt: string;
  href: string;
};

export type AdminInboxCounts = Record<AdminInboxKind, number>;

export function totalAdminInboxCount(counts: AdminInboxCounts): number {
  return ADMIN_INBOX_KINDS.reduce((total, kind) => total + counts[kind], 0);
}

export async function getAdminInbox(): Promise<{
  counts: AdminInboxCounts;
  total: number;
  items: AdminInboxItem[];
}> {
  const { prisma } = await import("./db");
  const userSelect = { id: true, email: true, name: true } satisfies Prisma.UserSelect;
  const [corrections, timezones, profiles, exemptions, removals] = await Promise.all([
    prisma.visitCorrectionRequest.findMany({
      where: { status: "open" },
      select: { id: true, createdAt: true, message: true, user: { select: userSelect } },
    }),
    prisma.timezoneChangeRequest.findMany({
      where: { status: "open" },
      select: {
        id: true,
        createdAt: true,
        requestedTimezone: true,
        user: { select: userSelect },
      },
    }),
    prisma.profileChangeRequest.findMany({
      where: { status: "open" },
      select: {
        id: true,
        createdAt: true,
        requestedName: true,
        requestedEmail: true,
        user: { select: userSelect },
      },
    }),
    prisma.complianceExemptionRequest.findMany({
      where: { status: "open" },
      select: { id: true, createdAt: true, type: true, user: { select: userSelect } },
    }),
    prisma.deviceRemovalRequest.findMany({
      where: { status: "open" },
      select: {
        id: true,
        createdAt: true,
        device: { select: { serialNumber: true } },
        user: { select: userSelect },
      },
    }),
  ]);

  const href = "/admin/visit-reports";
  const item = (
    kind: AdminInboxKind,
    label: string,
    summary: string,
    row: { id: string; createdAt: Date; user: { id: string; email: string; name: string | null } },
  ): AdminInboxItem => ({
    id: row.id,
    kind,
    label,
    summary,
    userId: row.user.id,
    userName: row.user.name,
    userEmail: row.user.email,
    createdAt: row.createdAt.toISOString(),
    href: `${href}#${kind}`,
  });

  const items = [
    ...corrections.map((row) =>
      item("visit_correction", "Visit correction", row.message, row),
    ),
    ...timezones.map((row) =>
      item("timezone_change", "Timezone change", row.requestedTimezone, row),
    ),
    ...profiles.map((row) =>
      item(
        "profile_change",
        "Profile change",
        row.requestedEmail ?? row.requestedName ?? "Profile details",
        row,
      ),
    ),
    ...exemptions.map((row) =>
      item("compliance_exemption", "HR exemption", row.type, row),
    ),
    ...removals.map((row) =>
      item("device_removal", "Laptop removal", row.device.serialNumber, row),
    ),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const counts: AdminInboxCounts = {
    visit_correction: corrections.length,
    timezone_change: timezones.length,
    profile_change: profiles.length,
    compliance_exemption: exemptions.length,
    device_removal: removals.length,
  };

  return { counts, total: totalAdminInboxCount(counts), items };
}
