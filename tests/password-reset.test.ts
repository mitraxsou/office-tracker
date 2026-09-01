import { describe, expect, it } from "vitest";
import {
  generateTempPassword,
  hashPassword,
  verifyPassword,
} from "../src/lib/auth";

const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

describe("generateTempPassword", () => {
  it("generates a 12 character readable password", () => {
    const password = generateTempPassword();
    expect(password.length).toBe(12);
    for (const char of password) {
      expect(TEMP_PASSWORD_CHARS.includes(char)).toBe(true);
    }
  });
});

describe("admin password reset hash", () => {
  it("stores bcrypt hash that verifies with the temp password", async () => {
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    expect(await verifyPassword(tempPassword, hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("login works with temp password after hash update", async () => {
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    expect(await verifyPassword(tempPassword, hash)).toBe(true);
  });
});
