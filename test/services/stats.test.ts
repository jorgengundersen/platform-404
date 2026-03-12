import type { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import type { SessionSummary } from "@/primitives/schemas/session-summary";
import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { StatsService, StatsServiceLive } from "@/services/stats";

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function seedSessions(db: Database): void {
  db.exec(`
    INSERT INTO sessions (id, project_id, project_name, title, version,
      summary_additions, summary_deletions, summary_files,
      message_count, total_cost, total_tokens_input, total_tokens_output,
      total_tokens_reasoning, total_cache_read, total_cache_write,
      time_created, time_updated, time_ingested)
    VALUES
      ('s1', 'p1', 'ProjectA', 'Session 1', '1.0',
       10, 2, 3,
       4, 0.05, 1000, 500, 100, 200, 50,
       1700000000000, 1700000001000, 1700000002000),
      ('s2', 'p2', 'ProjectB', 'Session 2', '1.0',
       20, 4, 6,
       2, 0.10, 2000, 800, 200, 400, 100,
       1700086400000, 1700086401000, 1700086402000);
  `);
}

function seedMessages(db: Database): void {
  db.exec(`
    INSERT INTO messages (id, session_id, role, provider_id, model_id, agent,
      cost, tokens_input, tokens_output, tokens_reasoning, cache_read, cache_write,
      time_created, time_ingested)
    VALUES
      ('m1', 's1', 'assistant', 'anthropic', 'claude-3-5-sonnet', 'agent',
       0.02, 500, 200, 50, 100, 25,
       1700000000000, 1700000002000),
      ('m2', 's1', 'assistant', 'anthropic', 'claude-3-5-sonnet', 'agent',
       0.03, 500, 300, 50, 100, 25,
       1700000000500, 1700000002000),
      ('m3', 's2', 'assistant', 'openai', 'gpt-4o', 'agent',
       0.10, 2000, 800, 200, 400, 100,
       1700086400000, 1700086402000);
  `);
}

function seedDailyStats(db: Database): void {
  db.exec(`
    INSERT INTO daily_stats (date, session_count, message_count, total_cost,
      total_tokens_input, total_tokens_output, total_tokens_reasoning,
      total_cache_read, total_cache_write, time_updated)
    VALUES
      ('2023-11-14', 1, 2, 0.05, 1000, 500, 100, 200, 50, 1700000002000),
      ('2023-11-15', 1, 1, 0.10, 2000, 800, 200, 400, 100, 1700086402000);
  `);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StatsService.getOverview", () => {
  test("returns zero totals when no data", async () => {
    const program = Effect.gen(function* () {
      const stats = yield* StatsService;
      return yield* stats.getOverview();
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    expect(result.totalSessions).toBe(0);
    expect(result.totalMessages).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.totalTokensInput).toBe(0);
    expect(result.totalTokensOutput).toBe(0);
    expect(result.totalTokensReasoning).toBe(0);
    expect(result.totalCacheRead).toBe(0);
    expect(result.totalCacheWrite).toBe(0);
    expect(result.avgCostPerSession).toBe(0);
    expect(result.avgMessagesPerSession).toBe(0);
  });

  test("returns correct totals and averages with seeded data", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      seedSessions(sqlite);
      seedMessages(sqlite);
      const stats = yield* StatsService;
      return yield* stats.getOverview();
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    expect(result.totalSessions).toBe(2);
    expect(result.totalMessages).toBe(3);
    expect(result.totalCost).toBeCloseTo(0.15, 5);
    expect(result.totalTokensInput).toBe(3000);
    expect(result.totalTokensOutput).toBe(1300);
    expect(result.totalTokensReasoning).toBe(300);
    expect(result.totalCacheRead).toBe(600);
    expect(result.totalCacheWrite).toBe(150);
    expect(result.avgCostPerSession).toBeCloseTo(0.075, 5);
    expect(result.avgMessagesPerSession).toBeCloseTo(1.5, 5);
  });

  test("supports source filter while keeping aggregate behavior", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      sqlite.exec(`
        INSERT INTO sessions (id, source, project_id, project_name, title, version,
          summary_additions, summary_deletions, summary_files,
          message_count, total_cost, total_tokens_input, total_tokens_output,
          total_tokens_reasoning, total_cache_read, total_cache_write,
          time_created, time_updated, time_ingested)
        VALUES
          ('src-opencode', 'opencode', 'p1', 'ProjectA', 'OpenCode Session', '1.0',
           0, 0, 0,
           1, 10, 100, 200, 0, 0, 0,
           1700000000000, 1700000000000, 1700000000000),
          ('src-claude', 'claude-code', 'p1', 'ProjectA', 'Claude Session', '1.0',
           0, 0, 0,
           1, 5, 50, 100, 0, 0, 0,
           1700000000000, 1700000000000, 1700000000000);

        INSERT INTO daily_stats (date, source, session_count, message_count, total_cost,
          total_tokens_input, total_tokens_output, total_tokens_reasoning,
          total_cache_read, total_cache_write, time_updated)
        VALUES
          ('2023-11-14', 'opencode', 1, 1, 10, 100, 200, 0, 0, 0, 1700000000000),
          ('2023-11-14', 'claude-code', 1, 1, 5, 50, 100, 0, 0, 0, 1700000000000);
      `);

      const stats = yield* StatsService;
      const allOverview = yield* stats.getOverview();
      const opencodeOverview = yield* stats.getOverview("opencode");
      const allDaily = yield* stats.getDailyStats({
        start: "2023-11-14",
        end: "2023-11-14",
      });
      const opencodeDaily = yield* stats.getDailyStats(
        {
          start: "2023-11-14",
          end: "2023-11-14",
        },
        "opencode",
      );
      const opencodeSessions = yield* stats.getSessions({ source: "opencode" });

      return {
        allOverview,
        opencodeOverview,
        allDaily,
        opencodeDaily,
        opencodeSessions,
      };
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    expect(result.allOverview.totalSessions).toBe(2);
    expect(result.allOverview.totalCost).toBeCloseTo(15, 5);
    expect(result.opencodeOverview.totalSessions).toBe(1);
    expect(result.opencodeOverview.totalCost).toBeCloseTo(10, 5);

    expect(result.allDaily).toHaveLength(1);
    expect(result.allDaily[0]?.source).toBe("all");
    expect(result.allDaily[0]?.sessionCount).toBe(2);
    expect(result.allDaily[0]?.totalCost).toBeCloseTo(15, 5);

    expect(result.opencodeDaily).toHaveLength(1);
    expect(result.opencodeDaily[0]?.source).toBe("opencode");
    expect(result.opencodeDaily[0]?.sessionCount).toBe(1);
    expect(result.opencodeDaily[0]?.totalCost).toBeCloseTo(10, 5);

    expect(result.opencodeSessions).toHaveLength(1);
    expect(result.opencodeSessions[0]?.id).toBe("src-opencode");
    expect(result.opencodeSessions[0]?.source).toBe("opencode");
  });
});

describe("StatsService.getDailyStats", () => {
  test("returns empty array when no daily_stats", async () => {
    const program = Effect.gen(function* () {
      const stats = yield* StatsService;
      return yield* stats.getDailyStats({
        start: "2023-11-14",
        end: "2023-11-15",
      });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    expect(result).toEqual([]);
  });

  test("returns daily stats within date range", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      seedDailyStats(sqlite);
      const stats = yield* StatsService;
      return yield* stats.getDailyStats({
        start: "2023-11-14",
        end: "2023-11-15",
      });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.date).toBe("2023-11-14");
    expect(result[0]?.sessionCount).toBe(1);
    expect(result[0]?.totalCost).toBeCloseTo(0.05, 5);
    expect(result[1]?.date).toBe("2023-11-15");
    expect(result[1]?.sessionCount).toBe(1);
  });

  test("filters to requested date range only", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      seedDailyStats(sqlite);
      const stats = yield* StatsService;
      return yield* stats.getDailyStats({
        start: "2023-11-14",
        end: "2023-11-14",
      });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.date).toBe("2023-11-14");
  });
});

describe("StatsService.getModelBreakdown", () => {
  test("returns empty array when no messages", async () => {
    const program = Effect.gen(function* () {
      const stats = yield* StatsService;
      return yield* stats.getModelBreakdown();
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    expect(result).toEqual([]);
  });

  test("returns per-model breakdown with message counts and costs", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      seedMessages(sqlite);
      const stats = yield* StatsService;
      return yield* stats.getModelBreakdown();
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    // Sort for determinism
    const sorted = [...result].sort((a, b) =>
      a.modelId.localeCompare(b.modelId),
    );
    expect(sorted).toHaveLength(2);

    const sonnet = sorted.find((r) => r.modelId === "claude-3-5-sonnet");
    expect(sonnet).toBeDefined();
    expect(sonnet?.providerId).toBe("anthropic");
    expect(sonnet?.messageCount).toBe(2);
    expect(sonnet?.totalCost).toBeCloseTo(0.05, 5);

    const gpt4 = sorted.find((r) => r.modelId === "gpt-4o");
    expect(gpt4).toBeDefined();
    expect(gpt4?.providerId).toBe("openai");
    expect(gpt4?.messageCount).toBe(1);
    expect(gpt4?.totalCost).toBeCloseTo(0.1, 5);
  });
});

describe("StatsService.getProjectBreakdown", () => {
  test("returns empty array when no sessions", async () => {
    const program = Effect.gen(function* () {
      const stats = yield* StatsService;
      return yield* stats.getProjectBreakdown();
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    expect(result).toEqual([]);
  });

  test("returns per-project breakdown with session counts and costs", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      seedSessions(sqlite);
      const stats = yield* StatsService;
      return yield* stats.getProjectBreakdown();
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    const sorted = [...result].sort((a, b) =>
      a.projectId.localeCompare(b.projectId),
    );
    expect(sorted).toHaveLength(2);

    const p1 = sorted.find((r) => r.projectId === "p1");
    expect(p1).toBeDefined();
    expect(p1?.projectName).toBe("ProjectA");
    expect(p1?.sessionCount).toBe(1);
    expect(p1?.totalCost).toBeCloseTo(0.05, 5);

    const p2 = sorted.find((r) => r.projectId === "p2");
    expect(p2).toBeDefined();
    expect(p2?.projectName).toBe("ProjectB");
    expect(p2?.sessionCount).toBe(1);
    expect(p2?.totalCost).toBeCloseTo(0.1, 5);
  });
});

describe("StatsService.getSessionsForDate", () => {
  test("returns sessions for a given date", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      seedSessions(sqlite);
      const stats = yield* StatsService;
      return yield* stats.getSessionsForDate("2023-11-14");
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    expect(result).toHaveLength(1);
    const session = result[0] as SessionSummary;
    expect(session.id).toBe("s1");
    expect(session.projectId).toBe("p1");
    expect(session.projectName).toBe("ProjectA");
    expect(session.totalCost).toBeCloseTo(0.05, 5);
    expect(session.timeCreated).toBe(1700000000000);
  });

  test("returns session by time_updated date when time_created is on a different day", async () => {
    // Session created on 2023-11-14 but updated on 2023-11-15.
    // daily_stats buckets by time_updated, so getSessionsForDate('2023-11-15')
    // must return this session to stay consistent.
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      sqlite.exec(`
        INSERT INTO sessions (id, project_id, project_name, title, version,
          summary_additions, summary_deletions, summary_files,
          message_count, total_cost, total_tokens_input, total_tokens_output,
          total_tokens_reasoning, total_cache_read, total_cache_write,
          time_created, time_updated, time_ingested)
        VALUES
          ('s-cross-day', 'p1', 'ProjectA', 'Cross-day session', '1.0',
           0, 0, 0,
           1, 0.01, 100, 50, 0, 0, 0,
           1699956000000, 1700042400000, 1700042400000);
      `);
      const stats = yield* StatsService;
      return yield* stats.getSessionsForDate("2023-11-15");
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("s-cross-day");
  });
});

describe("StatsService.getSessions", () => {
  test("filters sessions by projectId when provided", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      seedSessions(sqlite);
      const stats = yield* StatsService;
      return yield* stats.getSessions({ projectId: "p1" });
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    expect(result).toHaveLength(1);
    const session = result[0] as SessionSummary;
    expect(session.id).toBe("s1");
    expect(session.projectId).toBe("p1");
  });
});

describe("StatsService.getKpiSummary", () => {
  test("returns range KPIs with previous-period deltas and nullable deltas when compare is off", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      sqlite.exec(`
        INSERT INTO sessions (id, project_id, project_name, title, version,
          summary_additions, summary_deletions, summary_files,
          message_count, total_cost, total_tokens_input, total_tokens_output,
          total_tokens_reasoning, total_cache_read, total_cache_write,
          time_created, time_updated, time_ingested)
        VALUES
          ('kpi-c1', 'p1', 'ProjectA', 'Current 1', '1.0',
           0, 0, 0,
           1, 10, 100, 300, 0, 0, 0,
           ${now - dayMs}, ${now - dayMs}, ${now - dayMs}),
          ('kpi-c2', 'p1', 'ProjectA', 'Current 2', '1.0',
           0, 0, 0,
           1, 20, 100, 200, 0, 0, 0,
           ${now - 2 * dayMs}, ${now - 2 * dayMs}, ${now - 2 * dayMs}),
          ('kpi-p1', 'p1', 'ProjectA', 'Prev 1', '1.0',
           0, 0, 0,
           1, 5, 50, 50, 0, 0, 0,
           ${now - 8 * dayMs}, ${now - 8 * dayMs}, ${now - 8 * dayMs}),
          ('kpi-p2', 'p1', 'ProjectA', 'Prev 2', '1.0',
           0, 0, 0,
           1, 15, 50, 50, 0, 0, 0,
           ${now - 10 * dayMs}, ${now - 10 * dayMs}, ${now - 10 * dayMs});
      `);

      const stats = yield* StatsService;
      const compareOn = yield* stats.getKpiSummary({
        range: "7d",
        compare: true,
      });
      const compareOff = yield* stats.getKpiSummary({
        range: "7d",
        compare: false,
      });

      return { compareOn, compareOff };
    });

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StatsServiceLive),
        Effect.provide(DashboardDbTest),
      ),
    );

    expect(result.compareOn.spend.value).toBeCloseTo(30, 5);
    expect(result.compareOn.spend.deltaPct).toBeCloseTo(0.5, 5);
    expect(result.compareOn.sessions.value).toBe(2);
    expect(result.compareOn.sessions.deltaPct).toBeCloseTo(0, 5);
    expect(result.compareOn.avgCostPerSession.value).toBeCloseTo(15, 5);
    expect(result.compareOn.avgCostPerSession.deltaPct).toBeCloseTo(0.5, 5);
    expect(result.compareOn.outputInputRatio.value).toBeCloseTo(2.5, 5);
    expect(result.compareOn.outputInputRatio.deltaPct).toBeCloseTo(1.5, 5);

    expect(result.compareOff.spend.deltaPct).toBeNull();
    expect(result.compareOff.sessions.deltaPct).toBeNull();
    expect(result.compareOff.avgCostPerSession.deltaPct).toBeNull();
    expect(result.compareOff.outputInputRatio.deltaPct).toBeNull();
  });
});

describe("StatsService.getTrendSeries", () => {
  test("returns complete ordered daily points for range with zero-filled gaps", async () => {
    const originalNow = Date.now;
    Date.now = () => Date.parse("2023-11-20T12:00:00.000Z");

    try {
      const program = Effect.gen(function* () {
        const { sqlite } = yield* DashboardDb;
        seedDailyStats(sqlite);

        const stats = yield* StatsService;
        return yield* stats.getTrendSeries({ range: "7d" });
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(StatsServiceLive),
          Effect.provide(DashboardDbTest),
        ),
      );

      expect(result).toHaveLength(7);
      expect(result[0]?.date).toBe("2023-11-14");
      expect(result[6]?.date).toBe("2023-11-20");

      expect(result[0]?.cost).toBeCloseTo(0.05, 5);
      expect(result[0]?.sessions).toBe(1);
      expect(result[2]?.date).toBe("2023-11-16");
      expect(result[2]?.cost).toBe(0);
      expect(result[2]?.sessions).toBe(0);
      expect(result[2]?.tokensInput).toBe(0);
      expect(result[2]?.tokensOutput).toBe(0);
      expect(result[2]?.tokensReasoning).toBe(0);
    } finally {
      Date.now = originalNow;
    }
  });
});

describe("StatsService attention feeds", () => {
  test("returns deterministic anomalies and top 5 expensive sessions for selected range", async () => {
    const originalNow = Date.now;
    Date.now = () => Date.parse("2023-11-20T12:00:00.000Z");

    try {
      const program = Effect.gen(function* () {
        const { sqlite } = yield* DashboardDb;

        sqlite.exec(`
          INSERT INTO daily_stats (date, session_count, message_count, total_cost,
            total_tokens_input, total_tokens_output, total_tokens_reasoning,
            total_cache_read, total_cache_write, time_updated)
          VALUES
            ('2023-11-17', 1, 1, 10, 100, 100, 0, 0, 0, 1700222400000),
            ('2023-11-18', 1, 1, 120, 100, 100, 0, 0, 0, 1700308800000);

          INSERT INTO messages (id, session_id, role, provider_id, model_id, agent,
            cost, tokens_input, tokens_output, tokens_reasoning, cache_read, cache_write,
            time_created, time_ingested)
          VALUES
            ('a1', 's1', 'assistant', 'anthropic', 'claude-3-5-sonnet', 'agent',
             2, 100, 100, 0, 0, 0, 1700222400000, 1700222400000),
            ('a2', 's2', 'assistant', 'anthropic', 'claude-3-5-sonnet', 'agent',
             10, 100, 100, 0, 0, 0, 1700308800000, 1700308800000);

          INSERT INTO sessions (id, project_id, project_name, title, version,
            summary_additions, summary_deletions, summary_files,
            message_count, total_cost, total_tokens_input, total_tokens_output,
            total_tokens_reasoning, total_cache_read, total_cache_write,
            time_created, time_updated, time_ingested)
          VALUES
            ('es1', 'p1', 'ProjectA', 'Expensive 1', '1.0', 0, 0, 0,
             1, 110, 0, 0, 0, 0, 0, 1700222400000, 1700222400000, 1700222400000),
            ('es2', 'p1', 'ProjectA', 'Expensive 2', '1.0', 0, 0, 0,
             1, 90, 0, 0, 0, 0, 0, 1700222400000, 1700222400000, 1700222400000),
            ('es3', 'p1', 'ProjectA', 'Expensive 3', '1.0', 0, 0, 0,
             1, 70, 0, 0, 0, 0, 0, 1700222400000, 1700222400000, 1700222400000),
            ('es4', 'p1', 'ProjectA', 'Expensive 4', '1.0', 0, 0, 0,
             1, 50, 0, 0, 0, 0, 0, 1700222400000, 1700222400000, 1700222400000),
            ('es5', 'p1', 'ProjectA', 'Expensive 5', '1.0', 0, 0, 0,
             1, 30, 0, 0, 0, 0, 0, 1700222400000, 1700222400000, 1700222400000),
            ('es6', 'p1', 'ProjectA', 'Expensive 6', '1.0', 0, 0, 0,
             1, 10, 0, 0, 0, 0, 0, 1700222400000, 1700222400000, 1700222400000);
        `);

        const stats = yield* StatsService;
        const anomalies = yield* stats.getAnomalies({ range: "7d" });
        const expensiveSessions = yield* stats.getExpensiveSessions({
          range: "7d",
        });

        return { anomalies, expensiveSessions };
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(StatsServiceLive),
          Effect.provide(DashboardDbTest),
        ),
      );

      expect(result.anomalies.some((a) => a.type === "cost_spike")).toBeTrue();
      expect(result.anomalies.some((a) => a.type === "model_spike")).toBeTrue();
      expect(result.anomalies[0]?.href.startsWith("/daily/")).toBeTrue();

      expect(result.expensiveSessions).toHaveLength(5);
      expect(result.expensiveSessions[0]?.sessionId).toBe("es1");
      expect(result.expensiveSessions[4]?.sessionId).toBe("es5");
      expect(result.expensiveSessions[0]?.href).toBe("/sessions/es1");
    } finally {
      Date.now = originalNow;
    }
  });
});

describe("StatsService cost share", () => {
  test("returns top 5 plus Other for projects and models with deterministic tie ordering", async () => {
    const originalNow = Date.now;
    Date.now = () => Date.parse("2023-11-20T12:00:00.000Z");

    try {
      const program = Effect.gen(function* () {
        const { sqlite } = yield* DashboardDb;

        sqlite.exec(`
          INSERT INTO sessions (id, project_id, project_name, title, version,
            summary_additions, summary_deletions, summary_files,
            message_count, total_cost, total_tokens_input, total_tokens_output,
            total_tokens_reasoning, total_cache_read, total_cache_write,
            time_created, time_updated, time_ingested)
          VALUES
            ('cs-p1', 'p1', 'Project 1', 'Session P1', '1.0', 0, 0, 0, 1, 50, 0, 0, 0, 0, 0, 1700395200000, 1700395200000, 1700395200000),
            ('cs-p2', 'p2', 'Project 2', 'Session P2', '1.0', 0, 0, 0, 1, 40, 0, 0, 0, 0, 0, 1700395200000, 1700395200000, 1700395200000),
            ('cs-p3', 'p3', 'Project 3', 'Session P3', '1.0', 0, 0, 0, 1, 30, 0, 0, 0, 0, 0, 1700395200000, 1700395200000, 1700395200000),
            ('cs-p4', 'p4', 'Project 4', 'Session P4', '1.0', 0, 0, 0, 1, 20, 0, 0, 0, 0, 0, 1700395200000, 1700395200000, 1700395200000),
            ('cs-p5', 'p5', 'Project 5', 'Session P5', '1.0', 0, 0, 0, 1, 20, 0, 0, 0, 0, 0, 1700395200000, 1700395200000, 1700395200000),
            ('cs-p6', 'p6', 'Project 6', 'Session P6', '1.0', 0, 0, 0, 1, 10, 0, 0, 0, 0, 0, 1700395200000, 1700395200000, 1700395200000);

          INSERT INTO messages (id, session_id, role, provider_id, model_id, agent,
            cost, tokens_input, tokens_output, tokens_reasoning, cache_read, cache_write,
            time_created, time_ingested)
          VALUES
            ('cs-m1', 'cs-p1', 'assistant', 'anthropic', 'm1', 'agent', 60, 0, 0, 0, 0, 0, 1700395200000, 1700395200000),
            ('cs-m2', 'cs-p2', 'assistant', 'anthropic', 'm2', 'agent', 40, 0, 0, 0, 0, 0, 1700395200000, 1700395200000),
            ('cs-m3', 'cs-p3', 'assistant', 'anthropic', 'm3', 'agent', 30, 0, 0, 0, 0, 0, 1700395200000, 1700395200000),
            ('cs-m4', 'cs-p4', 'assistant', 'anthropic', 'm4', 'agent', 20, 0, 0, 0, 0, 0, 1700395200000, 1700395200000),
            ('cs-m5', 'cs-p5', 'assistant', 'anthropic', 'm5', 'agent', 20, 0, 0, 0, 0, 0, 1700395200000, 1700395200000),
            ('cs-m6', 'cs-p6', 'assistant', 'anthropic', 'm6', 'agent', 10, 0, 0, 0, 0, 0, 1700395200000, 1700395200000);
        `);

        const stats = yield* StatsService;
        const projects = yield* stats.getProjectCostShare({ range: "7d" });
        const models = yield* stats.getModelCostShare({ range: "7d" });

        return { projects, models };
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(StatsServiceLive),
          Effect.provide(DashboardDbTest),
        ),
      );

      expect(result.projects.map((item) => item.key)).toEqual([
        "p1",
        "p2",
        "p3",
        "p4",
        "p5",
        "other",
      ]);
      expect(result.projects[5]?.cost).toBeCloseTo(10, 5);

      expect(result.models.map((item) => item.key)).toEqual([
        "anthropic:m1",
        "anthropic:m2",
        "anthropic:m3",
        "anthropic:m4",
        "anthropic:m5",
        "other",
      ]);
      expect(result.models[5]?.cost).toBeCloseTo(10, 5);

      const projectShareSum = result.projects.reduce(
        (sum, item) => sum + item.sharePct,
        0,
      );
      const modelShareSum = result.models.reduce(
        (sum, item) => sum + item.sharePct,
        0,
      );

      expect(projectShareSum).toBeCloseTo(100, 8);
      expect(modelShareSum).toBeCloseTo(100, 8);
    } finally {
      Date.now = originalNow;
    }
  });
});
