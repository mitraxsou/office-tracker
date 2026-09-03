import { describe, expect, it } from "vitest";
import {
  detectDatabaseProvider,
  formatBytes,
  POSTGRES_SIZE_QUERY,
  POSTGRES_TABLE_SIZE_QUERY,
} from "../src/lib/db-stats";

describe("database stats", () => {
  it("detects Postgres and SQLite connections", () => {
    expect(detectDatabaseProvider("postgresql://example/db")).toBe("postgresql");
    expect(detectDatabaseProvider("file:./prisma/dev.db")).toBe("sqlite");
    expect(detectDatabaseProvider(undefined)).toBe("unknown");
  });

  it("uses Postgres size functions without relying on disk-free values", () => {
    expect(POSTGRES_SIZE_QUERY).toContain("pg_database_size");
    expect(POSTGRES_TABLE_SIZE_QUERY).toContain("pg_total_relation_size");
    expect(POSTGRES_SIZE_QUERY).not.toContain("disk");
  });

  it("formats nullable database sizes", () => {
    expect(formatBytes(null)).toBe("Unavailable");
    expect(formatBytes(1024 * 1024)).toBe("1.00 MB");
  });
});
