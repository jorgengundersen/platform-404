import type { SessionSummary } from "@/primitives/schemas/session-summary";
import { escapeHtml } from "@/ui/templates/page";

export interface SessionsPageData {
  readonly sessions: readonly SessionSummary[];
  readonly page: number;
  readonly total: number;
  readonly limit: number;
  readonly projectFilter: string | null;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatDate(ts: number): string {
  if (ts === 0) return "—";
  return new Date(ts).toISOString().slice(0, 10);
}

function sessionRow(s: SessionSummary): string {
  return `<tr>
    <td>${escapeHtml(s.projectName)}</td>
    <td><a href="/sessions/${escapeHtml(s.id)}">${escapeHtml(s.title || s.id)}</a></td>
    <td>${s.messageCount.toLocaleString()}</td>
    <td>${formatCost(s.totalCost)}</td>
    <td>${s.totalTokensInput.toLocaleString()}</td>
    <td>${s.totalTokensOutput.toLocaleString()}</td>
    <td>${formatDate(s.timeCreated)}</td>
  </tr>`;
}

function paginationControls(
  page: number,
  total: number,
  limit: number,
  projectFilter: string | null,
): string {
  const lastPage = Math.ceil(total / limit) || 1;
  const projectParam = projectFilter
    ? `&project=${encodeURIComponent(projectFilter)}`
    : "";
  const prev =
    page > 1
      ? `<a href="?page=${page - 1}&limit=${limit}${projectParam}">Prev</a>`
      : "";
  const next =
    page < lastPage
      ? `<a href="?page=${page + 1}&limit=${limit}${projectParam}">Next</a>`
      : "";
  const current = `<span class="current">${page} / ${lastPage}</span>`;
  return `<div class="pagination">${prev}${current}${next}</div>`;
}

export function sessionsPage(data: SessionsPageData): string {
  const { sessions, page, total, limit, projectFilter } = data;

  const totalCost = sessions.reduce((sum, s) => sum + s.totalCost, 0);
  const dates = sessions
    .map((s) => s.timeCreated)
    .filter((t) => t > 0)
    .sort((a, b) => a - b);
  const dateRange =
    dates.length >= 2
      ? `${formatDate(dates[0] as number)} → ${formatDate(dates[dates.length - 1] as number)}`
      : dates.length === 1
        ? formatDate(dates[0] as number)
        : "—";

  const rows =
    sessions.length === 0
      ? `<tr><td colspan="7" class="empty">No sessions.</td></tr>`
      : sessions.map(sessionRow).join("\n");

  const filterNote = projectFilter
    ? ` <span class="filter-note">(project: ${escapeHtml(projectFilter)})</span>`
    : "";

  return `<main class="sessions-list-page">
  <header class="session-header">
    <a href="/" class="back-link">← Dashboard</a>
    <h1>Sessions${filterNote}</h1>
  </header>
  <div class="overview-cards">
    <div class="stat-card">
      <h2 class="stat-card__label">Total Sessions</h2>
      <p class="stat-card__value">${total.toLocaleString()}</p>
    </div>
    <div class="stat-card">
      <h2 class="stat-card__label">Total Cost</h2>
      <p class="stat-card__value">${formatCost(totalCost)}</p>
    </div>
    <div class="stat-card">
      <h2 class="stat-card__label">Date Range</h2>
      <p class="stat-card__value">${escapeHtml(dateRange)}</p>
    </div>
  </div>
  <section class="sessions-table">
    <table class="table">
      <thead>
        <tr>
          <th>Project</th>
          <th>Title</th>
          <th>Messages</th>
          <th>Cost</th>
          <th>Input Tokens</th>
          <th>Output Tokens</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
  ${paginationControls(page, total, limit, projectFilter)}
</main>`;
}
