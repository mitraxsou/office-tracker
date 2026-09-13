import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { resolvePostgresEnv } from "./db-env";

resolvePostgresEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaPgPool: Pool | undefined;
};

function isVercelRuntime(): boolean {
  // Pulled .env.vercel.* files set VERCEL=1 locally; VERCEL_REGION is platform-only.
  return Boolean(process.env.VERCEL_REGION);
}

/** Local dev on PwC laptops often needs relaxed SSL for Neon behind TLS inspection. */
export function shouldUsePgAdapter(): boolean {
  if (isVercelRuntime()) return false;
  if (process.env.POSTGRES_SSL_RELAXED === "0") return false;
  if (process.env.POSTGRES_SSL_RELAXED === "1") return true;
  return process.env.NODE_ENV !== "production";
}

function createPrismaClient(): PrismaClient {
  const log = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

  if (shouldUsePgAdapter()) {
    const connectionString = process.env.POSTGRES_PRISMA_URL;
    if (!connectionString) {
      return new PrismaClient({ log });
    }

    const pool =
      globalForPrisma.prismaPgPool ??
      new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
      });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prismaPgPool = pool;
    }

    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter, log });
  }

  return new PrismaClient({ log });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
