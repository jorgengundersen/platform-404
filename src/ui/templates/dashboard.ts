import type { DashboardRangeQueryParam } from "@/primitives/schemas/api-params";
import type { SessionSummary } from "@/primitives/schemas/session-summary";
import type {
  AnomalyItem,
  CostShareItem,
  ExpensiveSessionItem,
  KpiSummary,
  ModelStat,
  Overview,
  ProjectStat,
  TrendPoint,
} from "@/services/stats";
import { escapeHtml } from "@/ui/templates/page";

interface DashboardV2Data {
  readonly range: DashboardRangeQueryParam;
  readonly compare: boolean;
  readonly kpis: KpiSummary | null;
  readonly trends: readonly TrendPoint[];
  readonly projectCostShare: readonly CostShareItem[];
  readonly modelCostShare: readonly CostShareItem[];
  readonly anomalies: readonly AnomalyItem[];
  readonly expensiveSessions: readonly ExpensiveSessionItem[];
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function formatDelta(deltaPct: number | null, compare: boolean): string {
  if (!compare) {
    return "";
  }
  if (deltaPct === null) {
    return '<p class="stat-card__delta">No baseline</p>';
  }
  const sign = deltaPct > 0 ? "+" : "";
  return `<p class="stat-card__delta">${sign}${deltaPct.toFixed(1)}% vs previous period</p>`;
}

function heroSection(v2Data: DashboardV2Data): string {
  const { kpis } = v2Data;
  const spend = kpis?.spend ?? { value: 0, deltaPct: null };
  const sessions = kpis?.sessions ?? { value: 0, deltaPct: null };
  const avgCostPerSession = kpis?.avgCostPerSession ?? {
    value: 0,
    deltaPct: null,
  };
  const outputInputRatio = kpis?.outputInputRatio ?? {
    value: 0,
    deltaPct: null,
  };

  return `<section class="overview-cards dashboard-hero" aria-label="Hero KPIs">
  <h2>Hero KPIs</h2>
  <a class="stat-card" href="/sessions">
    <h3 class="stat-card__label">Spend</h3>
    <p class="stat-card__value">${formatCost(spend.value)}</p>
    ${formatDelta(spend.deltaPct, v2Data.compare)}
  </a>
  <a class="stat-card" href="/sessions">
    <h3 class="stat-card__label">Sessions</h3>
    <p class="stat-card__value">${sessions.value.toLocaleString()}</p>
    ${formatDelta(sessions.deltaPct, v2Data.compare)}
  </a>
  <a class="stat-card" href="/sessions">
    <h3 class="stat-card__label">Avg Cost / Session</h3>
    <p class="stat-card__value">${formatCost(avgCostPerSession.value)}</p>
    ${formatDelta(avgCostPerSession.deltaPct, v2Data.compare)}
  </a>
  <a class="stat-card" href="/models">
    <h3 class="stat-card__label">Output/Input Ratio</h3>
    <p class="stat-card__value">${outputInputRatio.value.toFixed(2)}</p>
    ${formatDelta(outputInputRatio.deltaPct, v2Data.compare)}
  </a>
</section>`;
}

function trendsSection(v2Data: DashboardV2Data): string {
  const costItems = v2Data.trends
    .map(
      (point) => `<li>
    <a href="/daily/${escapeHtml(point.date)}">${escapeHtml(point.date)}</a>
    <span>${formatCost(point.cost)}</span>
  </li>`,
    )
    .join("\n");

  const sessionItems = v2Data.trends
    .map(
      (point) => `<li>
    <a href="/daily/${escapeHtml(point.date)}">${escapeHtml(point.date)}</a>
    <span>${point.sessions.toLocaleString()} sessions</span>
  </li>`,
    )
    .join("\n");

  return `<section class="dashboard-row dashboard-trends" aria-label="Trends">
  <h2>Trends</h2>
  <article class="quick-section">
    <div class="quick-section__header"><h3>Cost trend</h3></div>
    ${v2Data.trends.length === 0 ? '<p class="empty">No trend data.</p>' : `<ul class="table">${costItems}</ul>`}
  </article>
  <article class="quick-section">
    <div class="quick-section__header"><h3>Sessions/day</h3></div>
    ${v2Data.trends.length === 0 ? '<p class="empty">No trend data.</p>' : `<ul class="table">${sessionItems}</ul>`}
  </article>
</section>`;
}

function projectShareHref(item: CostShareItem): string {
  return `/sessions?project=${encodeURIComponent(item.key)}`;
}

function driversSection(v2Data: DashboardV2Data): string {
  const projectItems = v2Data.projectCostShare
    .map(
      (item) => `<li>
    <a href="${projectShareHref(item)}">${escapeHtml(item.label)}</a>
    <span>${formatCost(item.cost)} (${item.sharePct.toFixed(1)}%)</span>
  </li>`,
    )
    .join("\n");

  const modelItems = v2Data.modelCostShare
    .map(
      (item) => `<li>
    <a href="/models">${escapeHtml(item.label)}</a>
    <span>${formatCost(item.cost)} (${item.sharePct.toFixed(1)}%)</span>
  </li>`,
    )
    .join("\n");

  return `<section class="dashboard-row dashboard-drivers" aria-label="Cost Drivers">
  <h2>Cost Drivers</h2>
  <article class="quick-section">
    <div class="quick-section__header"><h3>Top projects</h3></div>
    ${v2Data.projectCostShare.length === 0 ? '<p class="empty">No project cost share data.</p>' : `<ul class="table">${projectItems}</ul>`}
  </article>
  <article class="quick-section">
    <div class="quick-section__header"><h3>Top models</h3></div>
    ${v2Data.modelCostShare.length === 0 ? '<p class="empty">No model cost share data.</p>' : `<ul class="table">${modelItems}</ul>`}
  </article>
</section>`;
}

function attentionSection(v2Data: DashboardV2Data): string {
  const anomalyItems = v2Data.anomalies
    .map(
      (item) => `<li>
    <a href="${escapeHtml(item.href)}">${escapeHtml(item.message)}</a>
    <span>${escapeHtml(item.severity.toUpperCase())} - ${escapeHtml(item.date)}</span>
  </li>`,
    )
    .join("\n");

  const expensiveItems = v2Data.expensiveSessions
    .map(
      (item) => `<li>
    <a href="${escapeHtml(item.href)}">${escapeHtml(item.title || item.sessionId)}</a>
    <span>${formatCost(item.totalCost)} - ${escapeHtml(item.date)}</span>
  </li>`,
    )
    .join("\n");

  return `<section class="dashboard-row dashboard-attention" aria-label="Needs Attention">
  <h2>Needs Attention</h2>
  <article class="quick-section">
    <div class="quick-section__header"><h3>Anomalies</h3></div>
    ${v2Data.anomalies.length === 0 ? '<p class="empty">No anomalies found.</p>' : `<ul class="table">${anomalyItems}</ul>`}
  </article>
  <article class="quick-section">
    <div class="quick-section__header"><h3>Most expensive sessions</h3></div>
    ${v2Data.expensiveSessions.length === 0 ? '<p class="empty">No expensive sessions found.</p>' : `<ul class="table">${expensiveItems}</ul>`}
  </article>
</section>`;
}

function v2Sections(v2Data: DashboardV2Data): string {
  return `${heroSection(v2Data)}
  ${trendsSection(v2Data)}
  ${driversSection(v2Data)}
  ${attentionSection(v2Data)}`;
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
    <td><a href="/daily/${escapeHtml(formatDate(s.timeUpdated))}">${escapeHtml(formatDate(s.timeUpdated))}</a></td>
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
    <td><a href="/sessions?project=${encodeURIComponent(p.projectId)}">${escapeHtml(p.projectName ?? p.projectId)}</a></td>
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
  v2Data?: DashboardV2Data,
): string {
  const v2Payload = v2Data
    ? `<script id="dashboard-v2-data" type="application/json">${escapeHtml(JSON.stringify(v2Data))}</script>`
    : "";
  const topSection = v2Data ? v2Sections(v2Data) : overviewCards(stats);

  return `<main class="dashboard">
  <header class="dashboard-header">
    <h1>platform-404</h1>
  </header>
  ${topSection}
  ${v2Payload}
  ${recentSessionsSection(sessions)}
  ${topProjectsSection(projects)}
  ${topModelsSection(models)}
</main>`;
}
