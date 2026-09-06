import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasPostgresEnv, resolvePostgresEnv } from "../src/lib/db-env";

const KEYS = [
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "DATABASE_URL_DATABASE_URL",
  "DATABASE_URL_POSTGRES_URL",
  "DATABASE_URL_POSTGRES_URL_NON_POOLING",
];

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("resolvePostgresEnv", () => {
  it("ignores a leftover SQLite DATABASE_URL from local .env files", () => {
    process.env.DATABASE_URL = "file:./prisma/dev.db";

    const { prismaUrl, directUrl } = resolvePostgresEnv();

    expect(prismaUrl).toBe("");
    expect(directUrl).toBe("");
    expect(hasPostgresEnv()).toBe(false);
    expect(process.env.POSTGRES_PRISMA_URL).toBeUndefined();
  });

  it("prefers the pooled Storage URL and falls back to it for the direct URL", () => {
    process.env.POSTGRES_PRISMA_URL = "postgresql://user:pw@pooler.example.com/neondb";
    process.env.DATABASE_URL = "file:./prisma/dev.db";

    const { prismaUrl, directUrl } = resolvePostgresEnv();

    expect(prismaUrl).toBe("postgresql://user:pw@pooler.example.com/neondb");
    expect(directUrl).toBe(prismaUrl);
    expect(hasPostgresEnv()).toBe(true);
  });

  it("uses the non-pooling URL as the direct URL when present", () => {
    process.env.POSTGRES_PRISMA_URL = "postgres://user:pw@pooler.example.com/neondb";
    process.env.POSTGRES_URL_NON_POOLING = "postgres://user:pw@direct.example.com/neondb";

    const { directUrl } = resolvePostgresEnv();

    expect(directUrl).toBe("postgres://user:pw@direct.example.com/neondb");
  });
});
