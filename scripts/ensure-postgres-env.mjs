/**
 * Maps Vercel Storage Postgres vars for Prisma.
 * See scripts/resolve-postgres-env.mjs for resolution priority.
 */

import { hasPostgresEnv, resolvePostgresEnv } from "./resolve-postgres-env.mjs";

const generateOnly =
  process.argv.includes("--generate-only") || process.env.PRISMA_GENERATE_ONLY === "1";

resolvePostgresEnv();

if (generateOnly && !hasPostgresEnv()) {
  const placeholder = "postgresql://build:build@localhost:5432/build?schema=public";
  process.env.POSTGRES_PRISMA_URL = placeholder;
  process.env.POSTGRES_URL_NON_POOLING = placeholder;
}
