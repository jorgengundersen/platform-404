import type { ProjectStat } from "@/services/stats";
import { escapeHtml } from "@/ui/templates/page";

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function projectRow(p: ProjectStat): string {
  return `<tr>
    <td><a href="/sessions?project=${encodeURIComponent(p.projectId)}">${escapeHtml(p.projectName ?? p.projectId)}</a></td>
    <td>${p.sessionCount.toLocaleString()}</td>
    <td>${formatCost(p.totalCost)}</td>
    <td>${p.totalTokensInput.toLocaleString()}</td>
    <td>${p.totalTokensOutput.toLocaleString()}</td>
  </tr>`;
}

export function projectsPage(projects: readonly ProjectStat[]): string {
  const totalProjects = projects.length;
  const totalCost = projects.reduce((sum, p) => sum + p.totalCost, 0);
  const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);

  const rows =
    projects.length === 0
      ? `<tr><td colspan="5" class="empty">No projects data.</td></tr>`
      : projects.map(projectRow).join("\n");

  return `<main class="projects-page">
  <header class="session-header">
    <a href="/" class="back-link">← Dashboard</a>
    <h1>Projects</h1>
  </header>
  <div class="overview-cards">
    <div class="stat-card">
      <h2 class="stat-card__label">Total Projects</h2>
      <p class="stat-card__value">${totalProjects}</p>
    </div>
    <div class="stat-card">
      <h2 class="stat-card__label">Total Cost</h2>
      <p class="stat-card__value">${formatCost(totalCost)}</p>
    </div>
    <div class="stat-card">
      <h2 class="stat-card__label">Total Sessions</h2>
      <p class="stat-card__value">${totalSessions.toLocaleString()}</p>
    </div>
  </div>
  <section class="projects-table">
    <table class="table">
      <thead>
        <tr>
          <th>Project Name</th>
          <th>Sessions</th>
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
