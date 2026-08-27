/**
 * Maps Vercel Storage Postgres vars for Prisma.
 * - Vercel injects POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING when Storage is linked.
 * - Local dev can set those directly, or use legacy DATABASE_URL (copied to both).
 * - For prisma generate (build/postinstall), a placeholder URL is used when no DB is configured.
 */

const generateOnly =
  process.argv.includes("--generate-only") || process.env.PRISMA_GENERATE_ONLY === "1";

const legacyUrl = process.env.DATABASE_URL?.trim();
const prismaUrl = process.env.POSTGRES_PRISMA_URL?.trim();
const directUrl = process.env.POSTGRES_URL_NON_POOLING?.trim();

if (!prismaUrl) {
  process.env.POSTGRES_PRISMA_URL = legacyUrl || directUrl || "";
}

if (!directUrl) {
  process.env.POSTGRES_URL_NON_POOLING =
    legacyUrl || process.env.POSTGRES_PRISMA_URL || "";
}

if (generateOnly && !process.env.POSTGRES_PRISMA_URL) {
  const placeholder = "postgresql://build:build@localhost:5432/build?schema=public";
  process.env.POSTGRES_PRISMA_URL = placeholder;
  process.env.POSTGRES_URL_NON_POOLING = placeholder;
}
