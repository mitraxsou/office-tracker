import { describe, expect, it } from "vitest";
import { selectHeartbeatAlertTypes } from "../src/lib/heartbeat-alerts";

describe("selectHeartbeatAlertTypes", () => {
  it("returns no types on a routine in-office beat after alerts were sent", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: true,
        firstInOfficeToday: false,
        oooCleared: false,
        metTarget: true,
        hoursStartedSent: true,
        hoursMetSent: true,
      }),
    ).toEqual([]);
  });

  it("queues hours_started on the first in-office beat of the day", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: true,
        firstInOfficeToday: true,
        oooCleared: false,
        metTarget: false,
        hoursStartedSent: false,
        hoursMetSent: false,
      }),
    ).toEqual(["hours_started"]);
  });

  it("queues hours_met when the target is newly met", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: true,
        firstInOfficeToday: false,
        oooCleared: false,
        metTarget: true,
        hoursStartedSent: true,
        hoursMetSent: false,
      }),
    ).toEqual(["hours_met"]);
  });

  it("queues ooo_cleared when office presence clears out of office", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: true,
        firstInOfficeToday: true,
        oooCleared: true,
        metTarget: false,
        hoursStartedSent: false,
        hoursMetSent: false,
      }),
    ).toEqual(["ooo_cleared", "hours_started"]);
  });

  it("skips hours_met when already dispatched today", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: false,
        firstInOfficeToday: false,
        oooCleared: false,
        metTarget: true,
        hoursStartedSent: true,
        hoursMetSent: true,
      }),
    ).toEqual([]);
  });
});
