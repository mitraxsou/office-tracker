/**
 * Resolves Postgres connection env vars for Prisma.
 * Priority (pooled / Prisma Client):
 *   1. POSTGRES_PRISMA_URL  — standard Vercel Storage
 *   2. POSTGRES_URL         — general Vercel Storage (fallback)
 *   3. POSTGRES_URL_NO_SSL  — Vercel Storage variant
 *   4. DATABASE_URL           — manual / legacy
 *   5. DATABASE_URL_DATABASE_URL — misconfigured Storage prefix
 *   6. DATABASE_URL_POSTGRES_URL — misconfigured Storage prefix
 *
 * Priority (direct / migrations):
 *   1. POSTGRES_URL_NON_POOLING
 *   2. DATABASE_URL_UNPOOLED
 *   3. DATABASE_URL_POSTGRES_URL_NON_POOLING
 *   4. POSTGRES_URL / POSTGRES_URL_NO_SSL (Neon often works for db push)
 *   5. pooled URL above
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
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NO_SSL,
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_DATABASE_URL,
    process.env.DATABASE_URL_POSTGRES_URL,
  );

  const directUrl = firstNonEmpty(
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.DATABASE_URL_POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NO_SSL,
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
      process.env.POSTGRES_URL,
      process.env.POSTGRES_URL_NO_SSL,
      process.env.DATABASE_URL,
      process.env.DATABASE_URL_DATABASE_URL,
      process.env.DATABASE_URL_POSTGRES_URL,
    ),
  );
}
