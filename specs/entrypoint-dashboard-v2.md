# Entrypoint Dashboard V2

Spec for making `GET /` the primary high-signal overview page.

## Status

- This spec is additive to existing dashboard/detail-page specs.
- Existing routes (`/sessions`, `/projects`, `/models`, `/daily/:date`) stay.

## Goals

- Give useful overview in <10 seconds.
- Show change over time, not only cumulative totals.
- Surface cost drivers and anomalies immediately.
- Keep drill-down paths one click away.

## Non-goals

- No client-side SPA rewrite.
- No chart library required; SSR SVG is acceptable.
- No budget/policy engine in this phase.

## URL + controls

- Entrypoint remains `GET /`.
- Query params:
  - `range`: `7d | 30d | 90d` (default: `30d`)
  - `compare`: `0 | 1` (default: `1`)
- Invalid `range` falls back to `30d`.

## Entrypoint layout requirements

Top-to-bottom required order:

1. Hero KPI row (4 cards)
2. Trend row (2 charts)
3. Driver row (2 charts)
4. Attention row (alerts + expensive sessions)
5. Existing quick tables (secondary, below fold)

### 1) Hero KPI row

Required cards:

- Spend (`current range total_cost`)
- Sessions (`current range session_count`)
- Avg Cost / Session (`spend / max(sessions,1)`)
- Output/Input Ratio (`total_tokens_output / max(total_tokens_input,1)`)

When `compare=1`, each card MUST show delta vs previous equivalent period.

### 2) Trend row

Required charts:

- Cost trend line over selected range (daily points)
- Sessions/day bars over selected range

Optional overlay:

- 7-day moving average on cost line

### 3) Driver row

Required charts:

- Top projects by cost share (top 5 + Other)
- Top models by cost share (top 5 + Other)

Each item must show both absolute cost and share percent.

### 4) Attention row

Required modules:

- Anomalies list (spike days/model jumps)
- Most expensive sessions in selected range (limit 5)

Every item must include direct drill-down link.

### 5) Secondary tables

- Keep current quick sections (`Recent Sessions`, `Top Projects`, `Top Models`).
- Move below new sections.

## Drill-down behavior

- Click trend day -> `/daily/:date`
- Click project driver -> `/sessions?project=<projectId>`
- Click model driver -> `/models`
- Click expensive session -> `/sessions/:id`

## Data contract requirements

`StatsService` must provide range-aware aggregations.

Required shapes:

```ts
type Range = "7d" | "30d" | "90d";

interface KpiValue {
  value: number;
  deltaPct: number | null; // null when compare=0 or no baseline
}

interface KpiSummary {
  spend: KpiValue;
  sessions: KpiValue;
  avgCostPerSession: KpiValue;
  outputInputRatio: KpiValue;
}

interface TrendPoint {
  date: string; // YYYY-MM-DD
  cost: number;
  sessions: number;
  tokensInput: number;
  tokensOutput: number;
  tokensReasoning: number;
}

interface CostShareItem {
  label: string;
  key: string;
  cost: number;
  sharePct: number;
}

interface AnomalyItem {
  type: "cost_spike" | "model_spike";
  date: string;
  severity: "low" | "medium" | "high";
  message: string;
  href: string;
}
```

## API requirements

Add or extend stats endpoints:

- `GET /api/stats/kpis?range=<range>&compare=<0|1>`
- `GET /api/stats/trends?range=<range>`
- `GET /api/stats/cost-share/projects?range=<range>`
- `GET /api/stats/cost-share/models?range=<range>`
- `GET /api/stats/anomalies?range=<range>`

All responses follow current envelope style:

```json
{ "data": { } }
```

## Visual/UX requirements

- Preserve current site structure and nav.
- Increase hierarchy on `/` (hero > chart > detail).
- Use consistent semantic color mapping:
  - spend = warm
  - usage = cool
  - anomaly = alert/red
- Mobile <= 640px:
  - one chart per row
  - readable labels
  - no horizontal clipping of key stats

## Accessibility + performance

- Charts must include text fallbacks (values visible without hover).
- Color cannot be sole channel for alert state.
- No blocking client JS required for first meaningful render.

## Acceptance criteria

- [ ] `/` supports `range` and `compare` query params.
- [ ] Hero shows 4 KPIs with correct values for selected range.
- [ ] Deltas are computed against previous equivalent period when enabled.
- [ ] Cost trend + sessions/day render for selected range.
- [ ] Cost-share project/model charts render top 5 + Other.
- [ ] Attention row shows anomalies and top expensive sessions.
- [ ] All required drill-down links work.
- [ ] Existing quick tables remain visible below new overview sections.
- [ ] Desktop and mobile layouts are usable.

## Implementation checklist

- [ ] Extend `StatsService` with range-aware summary/trend/share/anomaly methods.
- [ ] Add API handlers/routes for new stats resources.
- [ ] Update `rootHandler` to load V2 datasets.
- [ ] Refactor `src/ui/templates/dashboard.ts` to V2 section order.
- [ ] Add chart + hierarchy styles in `src/ui/static/styles.css`.
- [ ] Add tests for service calculations, API validation, and dashboard rendering.
