import { describe, expect, it } from "vitest";
import { selectHeartbeatAlertTypes } from "../src/lib/heartbeat-alerts";

describe("selectHeartbeatAlertTypes", () => {
  it("returns no types on a routine in-office beat after alerts were sent", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: true,
        oooCleared: false,
        metTarget: true,
        hoursStartedSent: true,
        hoursMetSent: true,
        monthlySnapshotSent: true,
      }),
    ).toEqual([]);
  });

  it("queues hours_started on an in-office beat before the alert is dispatched", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: true,
        oooCleared: false,
        metTarget: false,
        hoursStartedSent: false,
        hoursMetSent: false,
        monthlySnapshotSent: true,
      }),
    ).toEqual(["hours_started"]);
  });

  it("still queues hours_started when sync already opened today's visit", () => {
    // Events mode writes the visit before alerts run, so prior presence exists
    // on the very first office sync of the day.
    expect(
      selectHeartbeatAlertTypes({
        inOffice: true,
        oooCleared: false,
        metTarget: false,
        hoursStartedSent: false,
        hoursMetSent: true,
        monthlySnapshotSent: true,
      }),
    ).toEqual(["hours_started"]);
  });

  it("skips hours_started when the laptop is not on office Wi-Fi", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: false,
        oooCleared: false,
        metTarget: false,
        hoursStartedSent: false,
        hoursMetSent: false,
        monthlySnapshotSent: false,
      }),
    ).toEqual([]);
  });

  it("queues hours_met when the target is newly met", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: true,
        oooCleared: false,
        metTarget: true,
        hoursStartedSent: true,
        hoursMetSent: false,
        monthlySnapshotSent: true,
      }),
    ).toEqual(["hours_met"]);
  });

  it("queues ooo_cleared when office presence clears out of office", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: true,
        oooCleared: true,
        metTarget: false,
        hoursStartedSent: false,
        hoursMetSent: false,
        monthlySnapshotSent: true,
      }),
    ).toEqual(["ooo_cleared", "hours_started"]);
  });

  it("skips hours_met when already dispatched today", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: false,
        oooCleared: false,
        metTarget: true,
        hoursStartedSent: true,
        hoursMetSent: true,
        monthlySnapshotSent: true,
      }),
    ).toEqual([]);
  });

  it("queues the monthly snapshot once when office presence is detected", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: true,
        oooCleared: false,
        metTarget: false,
        hoursStartedSent: true,
        hoursMetSent: true,
        monthlySnapshotSent: false,
      }),
    ).toEqual(["monthly_snapshot"]);
  });
});
