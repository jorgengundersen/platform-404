import type { SessionSummary } from "@/primitives/schemas/session-summary";
import type { ModelStat, Overview, ProjectStat } from "@/services/stats";
import { escapeHtml } from "@/ui/templates/page";

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function overviewCards(stats: Overview): string {
  return `<section class="overview-cards">
  <a class="stat-card" href="/sessions">
    <h2 class="stat-card__label">Sessions</h2>
    <p class="stat-card__value">${stats.totalSessions}</p>
  </a>
  <a class="stat-card" href="/sessions">
    <h2 class="stat-card__label">Messages</h2>
    <p class="stat-card__value">${stats.totalMessages}</p>
  </a>
  <a class="stat-card" href="/sessions">
    <h2 class="stat-card__label">Total Cost</h2>
    <p class="stat-card__value">${formatCost(stats.totalCost)}</p>
  </a>
  <a class="stat-card" href="/sessions">
    <h2 class="stat-card__label">Avg Cost / Session</h2>
    <p class="stat-card__value">${formatCost(stats.avgCostPerSession)}</p>
  </a>
  <a class="stat-card" href="/models">
    <h2 class="stat-card__label">Input Tokens</h2>
    <p class="stat-card__value">${stats.totalTokensInput.toLocaleString()}</p>
  </a>
  <a class="stat-card" href="/models">
    <h2 class="stat-card__label">Output Tokens</h2>
    <p class="stat-card__value">${stats.totalTokensOutput.toLocaleString()}</p>
  </a>
  <div class="stat-card">
    <h2 class="stat-card__label">Avg Messages / Session</h2>
    <p class="stat-card__value">${stats.avgMessagesPerSession.toFixed(1)}</p>
  </div>
  <div class="stat-card">
    <h2 class="stat-card__label">Reasoning Tokens</h2>
    <p class="stat-card__value">${stats.totalTokensReasoning.toLocaleString()}</p>
  </div>
</section>`;
}

function recentSessionsSection(sessions: readonly SessionSummary[]): string {
  const top5 = sessions.slice(0, 5);
  const rows =
    top5.length === 0
      ? `<tr><td colspan="4" class="empty">No sessions yet.</td></tr>`
      : top5
          .map(
            (s) =>
              `<tr>
    <td>${escapeHtml(s.projectName)}</td>
    <td><a href="/sessions/${escapeHtml(s.id)}">${escapeHtml(s.title || s.id)}</a></td>
    <td>${formatCost(s.totalCost)}</td>
    <td>${escapeHtml(formatDate(s.timeUpdated))}</td>
  </tr>`,
          )
          .join("\n");

  return `<section class="quick-section">
  <div class="quick-section__header">
    <h2>Recent Sessions</h2>
    <a href="/sessions">View all →</a>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th>Project</th><th>Title</th><th>Cost</th><th>Date</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

function topProjectsSection(projects: readonly ProjectStat[]): string {
  const top5 = projects.slice(0, 5);
  const rows =
    top5.length === 0
      ? `<tr><td colspan="3" class="empty">No projects yet.</td></tr>`
      : top5
          .map(
            (p) =>
              `<tr>
    <td>${escapeHtml(p.projectName ?? p.projectId)}</td>
    <td>${p.sessionCount.toLocaleString()}</td>
    <td>${formatCost(p.totalCost)}</td>
  </tr>`,
          )
          .join("\n");

  return `<section class="quick-section">
  <div class="quick-section__header">
    <h2>Top Projects</h2>
    <a href="/projects">View all →</a>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th>Project</th><th>Sessions</th><th>Cost</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

function topModelsSection(models: readonly ModelStat[]): string {
  const top5 = models.slice(0, 5);
  const rows =
    top5.length === 0
      ? `<tr><td colspan="3" class="empty">No models yet.</td></tr>`
      : top5
          .map(
            (m) =>
              `<tr>
    <td>${escapeHtml(m.modelId)}</td>
    <td>${m.messageCount.toLocaleString()}</td>
    <td>${formatCost(m.totalCost)}</td>
  </tr>`,
          )
          .join("\n");

  return `<section class="quick-section">
  <div class="quick-section__header">
    <h2>Top Models</h2>
    <a href="/models">View all →</a>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th>Model</th><th>Messages</th><th>Cost</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

export function dashboard(
  stats: Overview,
  sessions: readonly SessionSummary[],
  projects: readonly ProjectStat[],
  models: readonly ModelStat[],
): string {
  return `<main class="dashboard">
  <header class="session-header">
    <h1>platform-404</h1>
  </header>
  ${overviewCards(stats)}
  ${recentSessionsSection(sessions)}
  ${topProjectsSection(projects)}
  ${topModelsSection(models)}
</main>`;
}
