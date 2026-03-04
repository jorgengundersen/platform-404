# Dashboard Navigation

Spec for adding per-entity detail pages and improving the front page overview.

## Goal

Keep the front page as a quick overview, and let users click through to dedicated pages for deeper insight.

## New Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | Per-project breakdown |
| GET | `/models` | Per-model breakdown |
| GET | `/daily/:date` | Sessions for a specific day |
| GET | `/sessions` | Full paginated session list |

All existing routes remain unchanged.

---

## Front Page Enhancements (`GET /`)

### Overview cards

Expose data that already exists but is not rendered:

| Card | Current | Change |
|------|---------|--------|
| Sessions | shown | add link → `/sessions` |
| Messages | shown | no change |
| Total Cost | shown | no change |
| Avg Cost / Session | shown | no change |
| Input Tokens | shown | no change |
| Output Tokens | shown | no change |
| Avg Messages / Session | **missing** | add card |
| Reasoning Tokens | **missing** | add card |

### Stat card links

Cards that link to a detail page get a subtle arrow or underline cue. No JS required — wrap the `.stat-card` in an `<a>` tag.

```html
<a href="/sessions" class="stat-card stat-card--link">
  <h2 class="stat-card__label">Sessions</h2>
  <p class="stat-card__value">42</p>
</a>
```

Add `.stat-card--link` CSS rule: `text-decoration: none; cursor: pointer` with a hover border color lift using `--color-accent`.

### Daily breakdown table

- Each date in the **Date** column links to `/daily/:date`.
- Keep the table as-is otherwise; the detail page handles the drill-down.

### Sessions table

- Show only the **10 most recent** sessions on the front page (down from 50).
- Add a "View all →" link below the table pointing to `/sessions`.
- Add a **Project** column that links to `/projects` (anchor to that project row).

---

## `/projects` Page

### Purpose

Show cost and token totals grouped by project. Answer: "which project am I spending the most on?"

### Data source

`GET /api/stats/projects` → `ProjectStat[]`

```ts
interface ProjectStat {
  projectId: string
  projectName: string | null
  sessionCount: number
  totalCost: number
  totalTokensInput: number
  totalTokensOutput: number
}
```

No new API work required — data already exists.

### Layout

```
<main class="projects-page">
  <header class="session-header">
    <a href="/" class="back-link">← Dashboard</a>
    <h1>Projects</h1>
  </header>
  <section class="projects-table">
    <table class="table">
      <thead>
        <tr>
          <th>Project</th>
          <th>Sessions</th>
          <th>Cost</th>
          <th>Input Tokens</th>
          <th>Output Tokens</th>
        </tr>
      </thead>
      <tbody>
        <!-- one row per project, sorted by total_cost DESC -->
      </tbody>
    </table>
  </section>
</main>
```

Each row's **Project** cell links to a sessions list filtered by that project: `/sessions?project=<projectId>`.

### UI template

New file: `src/ui/templates/projects.ts`

Exported function signature:

```ts
export function projectsPage(projects: readonly ProjectStat[]): string
```

### Route handler

Add `projectsPageHandler` to `src/ui/routes.ts`. Registered in `src/api/router.ts` as `GET /projects`.

---

## `/models` Page

### Purpose

Show cost and token usage grouped by AI provider + model. Answer: "which model am I actually using and what does it cost?"

### Data source

`GET /api/stats/models` → `ModelStat[]`

```ts
interface ModelStat {
  providerId: string
  modelId: string
  messageCount: number
  totalCost: number
  totalTokensInput: number
  totalTokensOutput: number
}
```

No new API work required.

### Layout

```
<main class="models-page">
  <header class="session-header">
    <a href="/" class="back-link">← Dashboard</a>
    <h1>Models</h1>
  </header>
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
      <tbody>
        <!-- sorted by total_cost DESC -->
      </tbody>
    </table>
  </section>
</main>
```

### UI template

New file: `src/ui/templates/models.ts`

```ts
export function modelsPage(models: readonly ModelStat[]): string
```

### Route handler

Add `modelsPageHandler` to `src/ui/routes.ts`. Registered as `GET /models`.

---

## `/daily/:date` Page

### Purpose

Drill down from a day in the daily breakdown table. Shows all sessions that were active on that date.

### Data source

Query `sessions` table WHERE `DATE(time_created / 1000, 'unixepoch') = :date` OR `DATE(time_updated / 1000, 'unixepoch') = :date`, ordered by `time_created ASC`.

This requires a new DB query — no existing API endpoint covers it.

### New API endpoint

`GET /api/daily/:date` → `{ data: { date, sessions: SessionSummary[] } }`

- Validates `:date` against `/^\d{4}-\d{2}-\d{2}$/`
- Returns 400 for invalid date format
- Returns `{ data: { date, sessions: [] } }` (not 404) when no sessions match

Add handler to `src/api/sessions.ts` and register in `src/api/router.ts`.

### Layout

```
<main class="daily-detail-page">
  <header class="session-header">
    <a href="/" class="back-link">← Dashboard</a>
    <h1>YYYY-MM-DD</h1>
  </header>

  <!-- summary row for the day (from daily_stats) -->
  <section class="session-meta">
    <dl class="meta-list">
      <dt>Sessions</dt><dd>…</dd>
      <dt>Messages</dt><dd>…</dd>
      <dt>Cost</dt><dd>…</dd>
      <dt>Input Tokens</dt><dd>…</dd>
      <dt>Output Tokens</dt><dd>…</dd>
    </dl>
  </section>

  <!-- sessions table (same structure as dashboard sessions table) -->
  <section class="sessions-table">
    <h2>Sessions</h2>
    <table class="table">…</table>
  </section>
</main>
```

The day summary is fetched from `daily_stats WHERE date = :date`. If no `daily_stats` row exists for that date (data ingested but aggregate not yet computed, or date in future), omit the summary section.

### Data types

```ts
interface DailyDetailData {
  date: string                      // YYYY-MM-DD
  stat: DailyStat | null            // null if no aggregate row
  sessions: readonly SessionSummary[]
}
```

### UI template

New file: `src/ui/templates/daily-detail.ts`

```ts
export function dailyDetailPage(data: DailyDetailData): string
```

### Route handler

Add `dailyDetailPageHandler` to `src/ui/routes.ts`. Registered as `GET /daily/:date`.

Query both `daily_stats` and `sessions` in parallel (two separate DB calls, no join needed).

---

## `/sessions` Page

### Purpose

Full paginated session list. The front page shows only 10; this is the complete view.

### Data source

`GET /api/sessions?page=N&limit=N` — already exists, supports pagination.

### URL params

| Param | Default | Notes |
|-------|---------|-------|
| `page` | `1` | positive integer |
| `limit` | `50` | capped at 100 |
| `project` | — | optional; filter to a single `projectId` |

The `project` filter requires a new query variant in `DashboardDb` — add a `WHERE project_id = ?` branch to the existing sessions list query.

### Layout

```
<main class="sessions-page">
  <header class="session-header">
    <a href="/" class="back-link">← Dashboard</a>
    <h1>Sessions</h1>
  </header>

  <!-- sessions table -->
  <section class="sessions-table">
    <table class="table">
      <thead>
        <tr>
          <th>Project</th>
          <th>Title</th>
          <th>Messages</th>
          <th>Cost</th>
          <th>Tokens</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>…</tbody>
    </table>
  </section>

  <!-- pagination -->
  <nav class="pagination">
    <a href="?page=N-1">← Prev</a>
    <span>Page N of M</span>
    <a href="?page=N+1">Next →</a>
  </nav>
</main>
```

Differences from the front-page sessions table:
- Add **Messages** column (already in `SessionSummary.messageCount`)
- Pagination controls below the table
- "Prev" link hidden on page 1; "Next" link hidden on last page

### UI template

New file: `src/ui/templates/sessions.ts`

```ts
interface SessionsPageData {
  sessions: readonly SessionSummary[]
  page: number
  total: number
  limit: number
  projectFilter: string | null
}

export function sessionsPage(data: SessionsPageData): string
```

### Route handler

Add `sessionsPageHandler` to `src/ui/routes.ts`. Registered as `GET /sessions`.

Reads `page`, `limit`, and `project` query params. Passes `project` filter through to DB query.

---

## CSS additions

All new pages reuse existing CSS classes. New rules needed:

```css
/* Stat card as a link */
a.stat-card--link {
  display: block;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease;
}
a.stat-card--link:hover {
  border-color: var(--color-accent);
}

/* Pagination nav */
.pagination {
  display: flex;
  gap: var(--gap);
  align-items: center;
  padding-block: var(--gap);
  font-size: 0.875rem;
  color: var(--color-muted);
}
.pagination a {
  color: var(--color-accent);
  text-decoration: none;
}
.pagination a:hover {
  text-decoration: underline;
}
```

No other structural CSS changes needed — new pages use `.session-header`, `.back-link`, `.table`, `.meta-list`, `.stat-card`, and `.sessions-table` which already exist.

---

## File changes summary

| File | Change |
|------|--------|
| `src/ui/templates/dashboard.ts` | Reduce sessions to 10, add "View all →" link, link date cells, add 2 new overview cards, wrap linkable cards in `<a>` |
| `src/ui/templates/projects.ts` | **new** — `projectsPage()` |
| `src/ui/templates/models.ts` | **new** — `modelsPage()` |
| `src/ui/templates/daily-detail.ts` | **new** — `dailyDetailPage()` |
| `src/ui/templates/sessions.ts` | **new** — `sessionsPage()` |
| `src/ui/routes.ts` | Add 4 new page handlers |
| `src/api/sessions.ts` | Add `/api/daily/:date` handler + `project` filter to sessions list |
| `src/api/router.ts` | Register 5 new routes (4 UI + 1 API) |
| `src/ui/static/styles.css` | Add `.stat-card--link` + `.pagination` rules |

No changes to `src/services/`, `src/primitives/`, or `src/main.ts`.

---

## Out of scope

- Charts / sparklines (CSS-only bar chart is a follow-up)
- Cost trend indicators (requires baseline comparison logic)
- Client-side filtering (no JS)
- Budget tracking
