import { describe, expect, test } from "bun:test";
import type { SessionSummary } from "@/primitives/schemas/session-summary";
import type { ModelStat, Overview, ProjectStat } from "@/services/stats";
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

describe("dashboard()", () => {
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
});
