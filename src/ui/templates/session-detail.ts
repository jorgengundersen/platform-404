import { escapeHtml } from "@/ui/templates/page";

export interface SessionDetail {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly title: string;
  readonly messageCount: number;
  readonly totalCost: number;
  readonly totalTokensInput: number;
  readonly totalTokensOutput: number;
  readonly totalTokensReasoning: number;
  readonly totalCacheRead: number;
  readonly totalCacheWrite: number;
  readonly timeCreated: number;
  readonly timeUpdated: number;
}

export interface MessageSummary {
  readonly id: string;
  readonly sessionId: string;
  readonly role: string;
  readonly providerId: string | null;
  readonly modelId: string | null;
  readonly cost: number;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly tokensReasoning: number;
  readonly timeCreated: number;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatDate(ms: number): string {
  return ms === 0
    ? "—"
    : `${new Date(ms).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function messageRow(m: MessageSummary): string {
  const model = m.modelId
    ? `${escapeHtml(m.providerId ?? "")}/${escapeHtml(m.modelId)}`
    : "—";
  return `<tr class="message message--${escapeHtml(m.role)}">
    <td>${escapeHtml(m.role)}</td>
    <td>${model}</td>
    <td>${m.role === "assistant" ? formatCost(m.cost) : "—"}</td>
    <td>${m.role === "assistant" ? (m.tokensInput + m.tokensOutput).toLocaleString() : "—"}</td>
    <td>${escapeHtml(formatDate(m.timeCreated))}</td>
  </tr>`;
}

export function sessionDetail(
  session: SessionDetail,
  messages: readonly MessageSummary[],
): string {
  const msgRows =
    messages.length === 0
      ? `<tr><td colspan="5" class="empty">No messages.</td></tr>`
      : messages.map(messageRow).join("\n");

  return `<main class="session-detail">
  <header class="site-header">
    <a href="/" class="back-link">← Dashboard</a>
    <h1>${escapeHtml(session.title || session.id)}</h1>
  </header>
  <section class="session-meta">
    <dl class="meta-list">
      <dt>Project</dt><dd>${escapeHtml(session.projectName)}</dd>
      <dt>Created</dt><dd>${escapeHtml(formatDate(session.timeCreated))}</dd>
      <dt>Messages</dt><dd>${session.messageCount}</dd>
      <dt>Total Cost</dt><dd>${formatCost(session.totalCost)}</dd>
      <dt>Input Tokens</dt><dd>${session.totalTokensInput.toLocaleString()}</dd>
      <dt>Output Tokens</dt><dd>${session.totalTokensOutput.toLocaleString()}</dd>
    </dl>
  </section>
  <section class="messages-list">
    <h2>Messages</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Role</th><th>Model</th><th>Cost</th><th>Tokens</th><th>Time</th>
        </tr>
      </thead>
      <tbody>${msgRows}</tbody>
    </table>
  </section>
</main>`;
}
