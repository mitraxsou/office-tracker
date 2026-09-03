import path from "node:path";
import { stat } from "node:fs/promises";

export const DB_STATS_TABLES = [
  "Heartbeat",
  "Visit",
  "AuditLog",
  "AgentLifecycleEvent",
  "VisitCorrectionRequest",
  "AgentDevice",
] as const;

export type DbStatsRow = {
  table: (typeof DB_STATS_TABLES)[number];
  rowCount: number;
  sizeBytes: number | null;
};

export type DbStats = {
  provider: "postgresql" | "sqlite" | "unknown";
  databaseBytes: number | null;
  rows: DbStatsRow[];
  sizeAvailable: boolean;
};

export const POSTGRES_SIZE_QUERY = `
  SELECT pg_database_size(current_database())::bigint AS "databaseBytes"
`;

export const POSTGRES_TABLE_SIZE_QUERY = `
  SELECT value AS "table", pg_total_relation_size(to_regclass('"' || value || '"'))::bigint AS "sizeBytes"
  FROM unnest(ARRAY['Heartbeat','Visit','AuditLog','AgentLifecycleEvent','VisitCorrectionRequest','AgentDevice']) AS value
`;

export function detectDatabaseProvider(databaseUrl?: string): DbStats["provider"] {
  if (databaseUrl?.startsWith("file:")) return "sqlite";
  if (databaseUrl?.startsWith("postgres://") || databaseUrl?.startsWith("postgresql://")) {
    return "postgresql";
  }
  return "unknown";
}

function numberFromDb(value: unknown): number | null {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

export async function getDatabaseStats(): Promise<DbStats> {
  const { prisma } = await import("./db");
  const databaseUrl =
    process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  const provider = detectDatabaseProvider(databaseUrl);

  const counts = await Promise.all([
    prisma.heartbeat.count(),
    prisma.visit.count(),
    prisma.auditLog.count(),
    prisma.agentLifecycleEvent.count(),
    prisma.visitCorrectionRequest.count(),
    prisma.agentDevice.count(),
  ]);

  let databaseBytes: number | null = null;
  const tableSizes = new Map<string, number>();

  if (provider === "postgresql") {
    try {
      const [databaseResult, tableResult] = await Promise.all([
        prisma.$queryRawUnsafe<Array<{ databaseBytes: bigint | number | string }>>(
          POSTGRES_SIZE_QUERY,
        ),
        prisma.$queryRawUnsafe<Array<{ table: string; sizeBytes: bigint | number | string }>>(
          POSTGRES_TABLE_SIZE_QUERY,
        ),
      ]);
      databaseBytes = numberFromDb(databaseResult[0]?.databaseBytes);
      for (const row of tableResult) {
        const size = numberFromDb(row.sizeBytes);
        if (size !== null) tableSizes.set(row.table, size);
      }
    } catch {
      // Some managed Postgres roles do not expose size functions. Counts still remain useful.
    }
  } else if (provider === "sqlite" && databaseUrl) {
    try {
      const filePath = databaseUrl.slice("file:".length);
      databaseBytes = (await stat(path.resolve(process.cwd(), filePath))).size;
    } catch {
      // A missing or remote SQLite file should not hide row counts.
    }
  }

  return {
    provider,
    databaseBytes,
    sizeAvailable: databaseBytes !== null || tableSizes.size > 0,
    rows: DB_STATS_TABLES.map((table, index) => ({
      table,
      rowCount: counts[index],
      sizeBytes: tableSizes.get(table) ?? null,
    })),
  };
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Unavailable";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}
