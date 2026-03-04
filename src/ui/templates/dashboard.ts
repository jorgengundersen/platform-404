import type { SessionSummary } from "@/primitives/schemas/session-summary";
import type { DailyStat, Overview } from "@/services/stats";
import { escapeHtml } from "@/ui/templates/page";

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function overviewCards(stats: Overview): string {
  return `<section class="overview-cards">
  <div class="card">
    <h2 class="card__label">Sessions</h2>
    <p class="card__value">${stats.totalSessions}</p>
  </div>
  <div class="card">
    <h2 class="card__label">Messages</h2>
    <p class="card__value">${stats.totalMessages}</p>
  </div>
  <div class="card">
    <h2 class="card__label">Total Cost</h2>
    <p class="card__value">${formatCost(stats.totalCost)}</p>
  </div>
  <div class="card">
    <h2 class="card__label">Avg Cost / Session</h2>
    <p class="card__value">${formatCost(stats.avgCostPerSession)}</p>
  </div>
  <div class="card">
    <h2 class="card__label">Input Tokens</h2>
    <p class="card__value">${stats.totalTokensInput.toLocaleString()}</p>
  </div>
  <div class="card">
    <h2 class="card__label">Output Tokens</h2>
    <p class="card__value">${stats.totalTokensOutput.toLocaleString()}</p>
  </div>
</section>`;
}

function dailyList(daily: readonly DailyStat[]): string {
  if (daily.length === 0) {
    return `<section class="daily-breakdown"><p class="empty">No data yet.</p></section>`;
  }
  const rows = [...daily]
    .reverse()
    .map(
      (d) =>
        `<tr>
      <td>${escapeHtml(d.date)}</td>
      <td>${d.sessionCount}</td>
      <td>${d.messageCount}</td>
      <td>${formatCost(d.totalCost)}</td>
      <td>${d.totalTokensInput.toLocaleString()}</td>
      <td>${d.totalTokensOutput.toLocaleString()}</td>
    </tr>`,
    )
    .join("\n");
  return `<section class="daily-breakdown">
  <h2>Daily Breakdown</h2>
  <table class="table">
    <thead>
      <tr>
        <th>Date</th><th>Sessions</th><th>Messages</th><th>Cost</th><th>Input Tokens</th><th>Output Tokens</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

function sessionsTable(sessions: readonly SessionSummary[]): string {
  if (sessions.length === 0) {
    return `<section class="sessions-list"><p class="empty">No sessions yet.</p></section>`;
  }
  const rows = sessions
    .map(
      (s) =>
        `<tr>
      <td>${escapeHtml(s.projectName)}</td>
      <td><a href="/sessions/${escapeHtml(s.id)}">${escapeHtml(s.title || s.id)}</a></td>
      <td>${formatCost(s.totalCost)}</td>
      <td>${(s.totalTokensInput + s.totalTokensOutput).toLocaleString()}</td>
      <td>${escapeHtml(formatDate(s.timeCreated))}</td>
    </tr>`,
    )
    .join("\n");
  return `<section class="sessions-list">
  <h2>Sessions</h2>
  <table class="table">
    <thead>
      <tr>
        <th>Project</th><th>Title</th><th>Cost</th><th>Tokens</th><th>Date</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

export function dashboard(
  stats: Overview,
  daily: readonly DailyStat[],
  sessions: readonly SessionSummary[],
): string {
  return `<main class="dashboard">
  <header class="site-header">
    <h1>platform-404</h1>
  </header>
  ${overviewCards(stats)}
  ${dailyList(daily)}
  ${sessionsTable(sessions)}
</main>`;
}
