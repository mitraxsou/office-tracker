import { describe, expect, it } from "vitest";
import { normalizePreferredName } from "../src/lib/preferred-name";

describe("normalizePreferredName", () => {
  it("returns null for empty or whitespace", () => {
    expect(normalizePreferredName("")).toBeNull();
    expect(normalizePreferredName("   ")).toBeNull();
    expect(normalizePreferredName(null)).toBeNull();
    expect(normalizePreferredName(undefined)).toBeNull();
  });

  it("trims a valid display name", () => {
    expect(normalizePreferredName("  Sou  ")).toBe("Sou");
    expect(normalizePreferredName("Mary-Jane")).toBe("Mary-Jane");
    expect(normalizePreferredName("O'Brien")).toBe("O'Brien");
  });

  it("rejects non-strings and invalid characters", () => {
    expect(() => normalizePreferredName(12)).toThrow(/must be a string/);
    expect(() => normalizePreferredName("Sou123")).toThrow(/letters/);
    expect(() => normalizePreferredName("a".repeat(33))).toThrow(/32 characters/);
  });
});
