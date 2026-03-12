import { describe, expect, test } from "bun:test";

import { getConfig } from "@/config";

describe("getConfig", () => {
  test("adds opencode source when OPENCODE_DB_PATH is set", () => {
    const cfg = getConfig({
      OPENCODE_DB_PATH: "/tmp/oc.db",
      DASHBOARD_DB_PATH: "/tmp/dash.db",
    });

    expect(cfg.sources).toEqual([
      {
        type: "opencode",
        dbPath: "/tmp/oc.db",
      },
    ]);
  });

  test("supports zero sources when OPENCODE_DB_PATH missing", () => {
    const cfg = getConfig({
      DASHBOARD_DB_PATH: "/tmp/dash.db",
    });

    expect(cfg.sources).toEqual([]);
  });

  test("adds claude_code source when CLAUDE_CODE_OTEL=1", () => {
    const cfg = getConfig({
      DASHBOARD_DB_PATH: "/tmp/dash.db",
      CLAUDE_CODE_OTEL: "1",
    });

    expect(cfg.sources).toEqual([{ type: "claude_code" }]);
  });

  test("supports multiple sources", () => {
    const cfg = getConfig({
      OPENCODE_DB_PATH: "/tmp/oc.db",
      DASHBOARD_DB_PATH: "/tmp/dash.db",
      CLAUDE_CODE_OTEL: "1",
    });

    expect(cfg.sources).toEqual([
      {
        type: "opencode",
        dbPath: "/tmp/oc.db",
      },
      {
        type: "claude_code",
      },
    ]);
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
