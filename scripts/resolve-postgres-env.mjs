/**
 * Resolves Postgres connection env vars for Prisma.
 * Priority (pooled / Prisma Client):
 *   1. POSTGRES_PRISMA_URL  — standard Vercel Storage
 *   2. DATABASE_URL           — manual / legacy
 *   3. DATABASE_URL_DATABASE_URL — misconfigured Storage prefix
 *   4. DATABASE_URL_POSTGRES_URL — misconfigured Storage prefix
 *
 * Priority (direct / migrations):
 *   1. POSTGRES_URL_NON_POOLING
 *   2. DATABASE_URL_UNPOOLED
 *   3. DATABASE_URL_POSTGRES_URL_NON_POOLING
 *   4. pooled URL above
 */

function firstNonEmpty(...values) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function resolvePostgresEnv() {
  const prismaUrl = firstNonEmpty(
    process.env.POSTGRES_PRISMA_URL,
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_DATABASE_URL,
    process.env.DATABASE_URL_POSTGRES_URL,
  );

  const directUrl = firstNonEmpty(
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.DATABASE_URL_POSTGRES_URL_NON_POOLING,
    prismaUrl,
  );

  if (prismaUrl) process.env.POSTGRES_PRISMA_URL = prismaUrl;
  if (directUrl) process.env.POSTGRES_URL_NON_POOLING = directUrl;

  return { prismaUrl, directUrl };
}

export function hasPostgresEnv() {
  return Boolean(
    firstNonEmpty(
      process.env.POSTGRES_PRISMA_URL,
      process.env.DATABASE_URL,
      process.env.DATABASE_URL_DATABASE_URL,
      process.env.DATABASE_URL_POSTGRES_URL,
    ),
  );
}
