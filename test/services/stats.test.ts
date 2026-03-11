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
