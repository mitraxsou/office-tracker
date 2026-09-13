import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { shouldUsePgAdapter } from "../src/lib/db";

describe("shouldUsePgAdapter", () => {
  const saved = {
    vercel: process.env.VERCEL,
    vercelRegion: process.env.VERCEL_REGION,
    nodeEnv: process.env.NODE_ENV,
    relaxed: process.env.POSTGRES_SSL_RELAXED,
  };

  beforeEach(() => {
    delete process.env.VERCEL;
    delete process.env.VERCEL_REGION;
    delete process.env.POSTGRES_SSL_RELAXED;
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    if (saved.vercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = saved.vercel;
    if (saved.vercelRegion === undefined) delete process.env.VERCEL_REGION;
    else process.env.VERCEL_REGION = saved.vercelRegion;
    if (saved.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved.nodeEnv;
    if (saved.relaxed === undefined) delete process.env.POSTGRES_SSL_RELAXED;
    else process.env.POSTGRES_SSL_RELAXED = saved.relaxed;
  });

  it("uses the pg adapter for local development", () => {
    expect(shouldUsePgAdapter()).toBe(true);
  });

  it("does not use the pg adapter on Vercel", () => {
    process.env.VERCEL_REGION = "iad1";
    expect(shouldUsePgAdapter()).toBe(false);
  });

  it("still uses the pg adapter when VERCEL=1 is present in a pulled env file", () => {
    delete process.env.VERCEL_REGION;
    process.env.VERCEL = "1";
    expect(shouldUsePgAdapter()).toBe(true);
  });

  it("can be disabled explicitly", () => {
    process.env.POSTGRES_SSL_RELAXED = "0";
    expect(shouldUsePgAdapter()).toBe(false);
  });
});
