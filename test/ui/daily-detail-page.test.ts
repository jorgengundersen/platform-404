import { describe, expect, test } from "bun:test";
import type { SessionSummary } from "@/primitives/schemas/session-summary";
import type { DailyStat } from "@/services/stats";
import { dailyDetailPage } from "@/ui/templates/daily-detail";

const makeStat = (): DailyStat => ({
  date: "2026-03-04",
  sessionCount: 2,
  messageCount: 10,
  totalCost: 0.05,
  totalTokensInput: 300,
  totalTokensOutput: 600,
  totalTokensReasoning: 0,
  totalCacheRead: 0,
  totalCacheWrite: 0,
});

const makeSession = (id: string): SessionSummary => ({
  id,
  projectId: "p1",
  projectName: "my-project",
  title: `Session ${id}`,
  messageCount: 5,
  totalCost: 0.025,
  totalTokensInput: 150,
  totalTokensOutput: 300,
  totalTokensReasoning: 0,
  totalCacheRead: 0,
  totalCacheWrite: 0,
  timeCreated: 1772582401000,
  timeUpdated: 1772582402000,
});

describe("dailyDetailPage", () => {
  test("renders date as h1, back link, and sessions table", () => {
    const html = dailyDetailPage({
      date: "2026-03-04",
      stat: makeStat(),
      sessions: [makeSession("s1"), makeSession("s2")],
    });

    expect(html).toContain("2026-03-04");
    expect(html).toContain("← Dashboard");
    expect(html).toContain("my-project");
    expect(html).toContain("Session s1");
    expect(html).toContain("Project");
    expect(html).toContain("Cost");
  });

  test("shows stat cards when stat is present", () => {
    const html = dailyDetailPage({
      date: "2026-03-04",
      stat: makeStat(),
      sessions: [],
    });

    expect(html).toContain("Sessions");
    expect(html).toContain("Messages");
    expect(html).toContain("No sessions on this date.");
  });

  test("omits stat cards when stat is null", () => {
    const html = dailyDetailPage({
      date: "2026-03-04",
      stat: null,
      sessions: [],
    });

    expect(html).not.toContain("stat-card");
    expect(html).toContain("No sessions on this date.");
  });
});
