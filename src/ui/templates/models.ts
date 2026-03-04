import type { ModelStat } from "@/services/stats";
import { escapeHtml } from "@/ui/templates/page";

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function modelRow(m: ModelStat): string {
  return `<tr>
    <td>${escapeHtml(m.providerId)}</td>
    <td>${escapeHtml(m.modelId)}</td>
    <td>${m.messageCount.toLocaleString()}</td>
    <td>${formatCost(m.totalCost)}</td>
    <td>${m.totalTokensInput.toLocaleString()}</td>
    <td>${m.totalTokensOutput.toLocaleString()}</td>
  </tr>`;
}

export function modelsPage(models: readonly ModelStat[]): string {
  const totalModels = models.length;
  const totalCost = models.reduce((sum, m) => sum + m.totalCost, 0);
  const totalMessages = models.reduce((sum, m) => sum + m.messageCount, 0);

  const rows =
    models.length === 0
      ? `<tr><td colspan="6" class="empty">No models data.</td></tr>`
      : models.map(modelRow).join("\n");

  return `<main class="models-page">
  <header class="session-header">
    <a href="/" class="back-link">← Dashboard</a>
    <h1>Models</h1>
  </header>
  <div class="overview-cards">
    <div class="stat-card">
      <h2 class="stat-card__label">Total Models</h2>
      <p class="stat-card__value">${totalModels}</p>
    </div>
    <div class="stat-card">
      <h2 class="stat-card__label">Total Cost</h2>
      <p class="stat-card__value">${formatCost(totalCost)}</p>
    </div>
    <div class="stat-card">
      <h2 class="stat-card__label">Total Messages</h2>
      <p class="stat-card__value">${totalMessages.toLocaleString()}</p>
    </div>
  </div>
  <section class="models-table">
    <table class="table">
      <thead>
        <tr>
          <th>Provider</th>
          <th>Model</th>
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
