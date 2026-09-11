import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_STALE_MINUTES,
  DEFAULT_HEARTBEAT_INTERVAL_MINUTES,
  resolveDefaultHeartbeatIntervalMinutes,
} from "@/lib/app-config";
import { HEARTBEAT_INTERVAL_MS, VISIT_GAP_MS } from "@/lib/constants";

describe("heartbeat interval defaults", () => {
  const original = process.env.DEFAULT_HEARTBEAT_INTERVAL_MINUTES;

  afterEach(() => {
    if (original === undefined) delete process.env.DEFAULT_HEARTBEAT_INTERVAL_MINUTES;
    else process.env.DEFAULT_HEARTBEAT_INTERVAL_MINUTES = original;
  });

  it("defaults to a 5-minute heartbeat and 15-minute visit gap", () => {
    delete process.env.DEFAULT_HEARTBEAT_INTERVAL_MINUTES;
    expect(DEFAULT_HEARTBEAT_INTERVAL_MINUTES).toBe(5);
    expect(resolveDefaultHeartbeatIntervalMinutes()).toBe(5);
    expect(HEARTBEAT_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(VISIT_GAP_MS).toBe(15 * 60 * 1000);
    expect(DEFAULT_AGENT_STALE_MINUTES).toBe(15);
  });

  it("accepts only integer env defaults from 2 to 60 minutes", () => {
    process.env.DEFAULT_HEARTBEAT_INTERVAL_MINUTES = "10";
    expect(resolveDefaultHeartbeatIntervalMinutes()).toBe(10);

    for (const invalid of ["1", "61", "5.5", "invalid"]) {
      process.env.DEFAULT_HEARTBEAT_INTERVAL_MINUTES = invalid;
      expect(resolveDefaultHeartbeatIntervalMinutes()).toBe(5);
    }
  });
});
