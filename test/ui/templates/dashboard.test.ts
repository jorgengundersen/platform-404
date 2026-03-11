import { describe, expect, test } from "bun:test";
import type { SessionSummary } from "@/primitives/schemas/session-summary";
import type {
  AnomalyItem,
  CostShareItem,
  KpiSummary,
  ModelStat,
  Overview,
  ProjectStat,
  TrendPoint,
} from "@/services/stats";
import { dashboard } from "@/ui/templates/dashboard";

const overview: Overview = {
  totalSessions: 10,
  totalMessages: 50,
  totalCost: 1.5,
  totalTokensInput: 10000,
  totalTokensOutput: 5000,
  totalTokensReasoning: 200,
  totalCacheRead: 0,
  totalCacheWrite: 0,
  avgCostPerSession: 0.15,
  avgMessagesPerSession: 5,
};

const sessions: SessionSummary[] = [
  {
    id: "s1",
    projectId: "p1",
    projectName: "my-project",
    title: "Test Session",
    messageCount: 3,
    totalCost: 0.05,
    totalTokensInput: 100,
    totalTokensOutput: 200,
    totalTokensReasoning: 0,
    totalCacheRead: 0,
    totalCacheWrite: 0,
    timeCreated: 1000,
    timeUpdated: 2000,
  },
];

const projects: ProjectStat[] = [
  {
    projectId: "p1",
    projectName: "my-project",
    sessionCount: 5,
    totalCost: 0.5,
    totalTokensInput: 5000,
    totalTokensOutput: 2500,
  },
];

const models: ModelStat[] = [
  {
    providerId: "anthropic",
    modelId: "claude-3-5-sonnet",
    messageCount: 20,
    totalCost: 0.8,
    totalTokensInput: 8000,
    totalTokensOutput: 4000,
  },
];

const kpis: KpiSummary = {
  spend: { value: 1.2, deltaPct: 10 },
  sessions: { value: 6, deltaPct: 20 },
  avgCostPerSession: { value: 0.2, deltaPct: 5 },
  outputInputRatio: { value: 0.5, deltaPct: -10 },
};

const trends: TrendPoint[] = [
  {
    date: "2026-03-01",
    cost: 0.4,
    sessions: 2,
    tokensInput: 1000,
    tokensOutput: 500,
    tokensReasoning: 100,
  },
];

const projectCostShare: CostShareItem[] = [
  { label: "my-project", key: "p1", cost: 0.6, sharePct: 75 },
];

const modelCostShare: CostShareItem[] = [
  {
    label: "claude-3-5-sonnet",
    key: "claude-3-5-sonnet",
    cost: 0.5,
    sharePct: 62.5,
  },
];

const anomalies: AnomalyItem[] = [
  {
    type: "cost_spike",
    date: "2026-03-01",
    severity: "high",
    message: "Cost jumped 2x vs baseline",
    href: "/daily/2026-03-01",
  },
];

describe("dashboard()", () => {
  test("uses dashboard-header class, not session-header, for the page header", () => {
    const html = dashboard(overview, sessions, projects, models);
    expect(html).toContain('class="dashboard-header"');
    expect(html).not.toContain('class="session-header"');
  });

  test("renders linked stat cards wrapping Sessions, Messages, Total Cost, Avg Cost/Session in <a> to /sessions", () => {
    const html = dashboard(overview, sessions, projects, models);
    // Sessions card → /sessions
    expect(html).toContain(`<a class="stat-card" href="/sessions"`);
    expect(html).toContain("Sessions");
    expect(html).toContain("Messages");
    expect(html).toContain("Total Cost");
    expect(html).toContain("Avg Cost / Session");
  });

  test("renders linked stat cards for Input Tokens and Output Tokens linking to /models", () => {
    const html = dashboard(overview, sessions, projects, models);
    expect(html).toContain(`<a class="stat-card" href="/models"`);
    expect(html).toContain("Input Tokens");
    expect(html).toContain("Output Tokens");
  });

  test("renders two new overview cards: Avg Messages/Session and Reasoning Tokens", () => {
    const html = dashboard(overview, sessions, projects, models);
    expect(html).toContain("Avg Messages / Session");
    expect(html).toContain("Reasoning Tokens");
    expect(html).toContain("5"); // avgMessagesPerSession
    expect(html).toContain("200"); // totalTokensReasoning
  });

  test("does NOT render the old daily breakdown table", () => {
    const html = dashboard(overview, sessions, projects, models);
    expect(html).not.toContain("Daily Breakdown");
    expect(html).not.toContain("daily-list");
  });

  test("does NOT render the old sessions table section", () => {
    const html = dashboard(overview, sessions, projects, models);
    expect(html).not.toContain("sessions-table");
  });

  test("renders Recent Sessions quick-glance section with link to /sessions", () => {
    const html = dashboard(overview, sessions, projects, models);
    expect(html).toContain("quick-section");
    expect(html).toContain("Recent Sessions");
    expect(html).toContain(`href="/sessions"`);
    expect(html).toContain("View all");
    // session row data
    expect(html).toContain("my-project");
    expect(html).toContain("Test Session");
  });

  test("renders Top Projects quick-glance section with link to /projects", () => {
    const html = dashboard(overview, sessions, projects, models);
    expect(html).toContain("Top Projects");
    expect(html).toContain(`href="/projects"`);
  });

  test("renders Top Projects project names as links to /sessions?project=<id>", () => {
    const html = dashboard(overview, sessions, projects, models);
    expect(html).toContain(
      `href="/sessions?project=${encodeURIComponent("p1")}"`,
    );
  });

  test("renders Top Models quick-glance section with link to /models", () => {
    const html = dashboard(overview, sessions, projects, models);
    expect(html).toContain("Top Models");
    expect(html).toContain("claude-3-5-sonnet");
  });

  test("renders date cells in Recent Sessions table as links to /daily/:date", () => {
    const html = dashboard(overview, sessions, projects, models);
    const date = new Date(2000).toISOString().slice(0, 10); // "1970-01-01"
    expect(html).toContain(`<a href="/daily/${date}">${date}</a>`);
  });

  test("renders V2 sections in required order with drill-down links and text fallbacks", () => {
    const html = dashboard(overview, sessions, projects, models, {
      range: "7d",
      compare: true,
      kpis,
      trends,
      projectCostShare,
      modelCostShare,
      anomalies,
      expensiveSessions: [
        {
          sessionId: "s1",
          title: "Test Session",
          totalCost: 0.3,
          date: "2026-03-01",
          href: "/sessions/s1",
        },
      ],
    });

    const heroIndex = html.indexOf("Hero KPIs");
    const trendsIndex = html.indexOf("Trends");
    const driversIndex = html.indexOf("Cost Drivers");
    const attentionIndex = html.indexOf("Needs Attention");
    const quickIndex = html.indexOf("Recent Sessions");

    expect(heroIndex).toBeGreaterThan(-1);
    expect(trendsIndex).toBeGreaterThan(heroIndex);
    expect(driversIndex).toBeGreaterThan(trendsIndex);
    expect(attentionIndex).toBeGreaterThan(driversIndex);
    expect(quickIndex).toBeGreaterThan(attentionIndex);

    expect(html).toContain('href="/daily/2026-03-01"');
    expect(html).toContain('href="/sessions?project=p1"');
    expect(html).toContain('href="/models"');
    expect(html).toContain('href="/sessions/s1"');
    expect(html).toContain("$0.4000");
    expect(html).toContain("75.0%");
  });
});
