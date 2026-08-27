function firstNonEmpty(...values: (string | undefined)[]): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/** Normalize Vercel Storage / legacy env vars before Prisma connects. */
export function resolvePostgresEnv(): { prismaUrl: string; directUrl: string } {
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

export function hasPostgresEnv(): boolean {
  return Boolean(
    firstNonEmpty(
      process.env.POSTGRES_PRISMA_URL,
      process.env.DATABASE_URL,
      process.env.DATABASE_URL_DATABASE_URL,
      process.env.DATABASE_URL_POSTGRES_URL,
    ),
  );
}
