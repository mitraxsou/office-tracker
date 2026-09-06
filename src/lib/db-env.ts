function isPostgresUrl(value: string | undefined): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && /^postgres(ql)?:\/\//i.test(trimmed));
}

/** Non-Postgres values (a leftover SQLite DATABASE_URL, for example) are ignored. */
function firstPostgresUrl(...values: (string | undefined)[]): string {
  for (const value of values) {
    if (isPostgresUrl(value)) return value!.trim();
  }
  return "";
}

/** Normalize Vercel Storage / legacy env vars before Prisma connects. */
export function resolvePostgresEnv(): { prismaUrl: string; directUrl: string } {
  const prismaUrl = firstPostgresUrl(
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_DATABASE_URL,
    process.env.DATABASE_URL_POSTGRES_URL,
  );

  const directUrl = firstPostgresUrl(
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
    firstPostgresUrl(
      process.env.POSTGRES_PRISMA_URL,
      process.env.POSTGRES_URL,
      process.env.DATABASE_URL,
      process.env.DATABASE_URL_DATABASE_URL,
      process.env.DATABASE_URL_POSTGRES_URL,
    ),
  );
}
