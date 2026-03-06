import { describe, expect, test } from "bun:test";

import { getConfig } from "@/config";

describe("getConfig", () => {
  test("throws when OPENCODE_DB_PATH missing", () => {
    expect(() =>
      getConfig({
        DASHBOARD_DB_PATH: "/tmp/dash.db",
      }),
    ).toThrow("Missing required env var: OPENCODE_DB_PATH");
  });

  test("throws when DASHBOARD_DB_PATH missing", () => {
    expect(() =>
      getConfig({
        OPENCODE_DB_PATH: "/tmp/oc.db",
      }),
    ).toThrow("Missing required env var: DASHBOARD_DB_PATH");
  });

  test("DASHBOARD_DB_PATH uses provided value", () => {
    const cfg = getConfig({
      OPENCODE_DB_PATH: "/tmp/oc.db",
      DASHBOARD_DB_PATH: "/tmp/dash.db",
    });
    expect(cfg.dashboardDbPath).toBe("/tmp/dash.db");
  });

  test("SYNC_INTERVAL_MS defaults to 30000", () => {
    const cfg = getConfig({
      OPENCODE_DB_PATH: "/tmp/oc.db",
      DASHBOARD_DB_PATH: "/tmp/dash.db",
    });
    expect(cfg.syncIntervalMs).toBe(30000);
  });

  test("SYNC_INTERVAL_MS uses provided valid positive integer", () => {
    const cfg = getConfig({
      OPENCODE_DB_PATH: "/tmp/oc.db",
      DASHBOARD_DB_PATH: "/tmp/dash.db",
      SYNC_INTERVAL_MS: "5000",
    });
    expect(cfg.syncIntervalMs).toBe(5000);
  });

  test("SYNC_INTERVAL_MS throws when not a valid positive integer", () => {
    expect(() =>
      getConfig({
        OPENCODE_DB_PATH: "/tmp/oc.db",
        DASHBOARD_DB_PATH: "/tmp/dash.db",
        SYNC_INTERVAL_MS: "abc",
      }),
    ).toThrow("SYNC_INTERVAL_MS");
  });

  test("SYNC_INTERVAL_MS throws when zero", () => {
    expect(() =>
      getConfig({
        OPENCODE_DB_PATH: "/tmp/oc.db",
        DASHBOARD_DB_PATH: "/tmp/dash.db",
        SYNC_INTERVAL_MS: "0",
      }),
    ).toThrow("SYNC_INTERVAL_MS");
  });

  test("SYNC_INTERVAL_MS throws when negative", () => {
    expect(() =>
      getConfig({
        OPENCODE_DB_PATH: "/tmp/oc.db",
        DASHBOARD_DB_PATH: "/tmp/dash.db",
        SYNC_INTERVAL_MS: "-1",
      }),
    ).toThrow("SYNC_INTERVAL_MS");
  });
});
