import type { SessionSummary } from "@/primitives/schemas/session-summary";
import type { DailyStat } from "@/services/stats";
import { escapeHtml } from "@/ui/templates/page";

export interface DailyDetailData {
  readonly date: string;
  readonly stat: DailyStat | null;
  readonly sessions: readonly SessionSummary[];
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function sessionRow(s: SessionSummary): string {
  return `<tr>
    <td>${escapeHtml(s.projectName)}</td>
    <td><a href="/sessions/${escapeHtml(s.id)}">${escapeHtml(s.title || s.id)}</a></td>
    <td>${s.messageCount.toLocaleString()}</td>
    <td>${formatCost(s.totalCost)}</td>
    <td>${s.totalTokensInput.toLocaleString()}</td>
    <td>${s.totalTokensOutput.toLocaleString()}</td>
  </tr>`;
}

function statCards(stat: DailyStat): string {
  return `<div class="overview-cards">
    <div class="stat-card">
      <h2 class="stat-card__label">Sessions</h2>
      <p class="stat-card__value">${stat.sessionCount}</p>
    </div>
    <div class="stat-card">
      <h2 class="stat-card__label">Messages</h2>
      <p class="stat-card__value">${stat.messageCount.toLocaleString()}</p>
    </div>
    <div class="stat-card">
      <h2 class="stat-card__label">Cost</h2>
      <p class="stat-card__value">${formatCost(stat.totalCost)}</p>
    </div>
    <div class="stat-card">
      <h2 class="stat-card__label">Total Tokens</h2>
      <p class="stat-card__value">${(stat.totalTokensInput + stat.totalTokensOutput).toLocaleString()}</p>
    </div>
  </div>`;
}

export function dailyDetailPage(data: DailyDetailData): string {
  const { date, stat, sessions } = data;

  const cards = stat !== null ? statCards(stat) : "";

  const rows =
    sessions.length === 0
      ? `<tr><td colspan="6" class="empty">No sessions on this date.</td></tr>`
      : sessions.map(sessionRow).join("\n");

  return `<main class="daily-detail-page">
  <header class="session-header">
    <a href="/" class="back-link">← Dashboard</a>
    <h1>${escapeHtml(date)}</h1>
  </header>
  ${cards}
  <section class="sessions-table">
    <h2>Sessions</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Project</th>
          <th>Title</th>
          <th>Messages</th>
          <th>Cost</th>
          <th>Input Tokens</th>
          <th>Output Tokens</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
</main>`;
}
