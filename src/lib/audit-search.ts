import type { Prisma } from "@prisma/client";

export const AUDIT_PAGE_SIZE = 25;

export type AuditSearchInput = {
  target?: string;
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: string | number;
};

function validDay(value?: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function normalizeAuditSearch(input: AuditSearchInput) {
  return {
    target: input.target?.trim().slice(0, 200) ?? "",
    actor: input.actor?.trim().slice(0, 200) ?? "",
    action: input.action?.trim().slice(0, 100) ?? "",
    from: validDay(input.from),
    to: validDay(input.to),
    page: Math.max(1, Number.parseInt(String(input.page ?? "1"), 10) || 1),
  };
}

export function buildAuditWhere(input: AuditSearchInput): Prisma.AuditLogWhereInput {
  const filters = normalizeAuditSearch(input);
  const personFilter = (term: string): Prisma.UserWhereInput => ({
    OR: [
      { id: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { name: { contains: term, mode: "insensitive" } },
    ],
  });

  const createdAt: Prisma.DateTimeFilter = {};
  if (filters.from) createdAt.gte = new Date(`${filters.from}T00:00:00.000Z`);
  if (filters.to) createdAt.lte = new Date(`${filters.to}T23:59:59.999Z`);

  return {
    ...(filters.target ? { targetUser: { is: personFilter(filters.target) } } : {}),
    ...(filters.actor ? { actor: { is: personFilter(filters.actor) } } : {}),
    ...(filters.action
      ? { action: { contains: filters.action, mode: "insensitive" } }
      : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };
}

export function summarizeAuditDetails(details: string | null): string {
  if (!details) return "No details";
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    return Object.entries(parsed)
      .slice(0, 4)
      .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
      .join(", ");
  } catch {
    return details.slice(0, 240);
  }
}

export async function searchAuditLogs(input: AuditSearchInput) {
  const { prisma } = await import("./db");
  const filters = normalizeAuditSearch(input);
  const where = buildAuditWhere(filters);
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: {
        actor: { select: { id: true, email: true, name: true } },
        targetUser: { select: { id: true, email: true, name: true } },
      },
    }),
  ]);

  return {
    filters,
    total,
    pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
    rows: rows.map((row) => ({
      id: row.id,
      timestamp: row.createdAt.toISOString(),
      action: row.action,
      actor: row.actor,
      targetUser: row.targetUser,
      detailsSummary: summarizeAuditDetails(row.details),
    })),
  };
}
