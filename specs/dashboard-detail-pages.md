# Dashboard Detail Pages

Spec for front page enhancements and new detail pages: `/projects`, `/models`, `/daily/:date`, and `/sessions`.

## Goals

- Front page stays a fast, high-signal overview — no tables of raw data
- Every metric on the front page is a clickable entry point to a detail page
- All new pages follow existing patterns: server-rendered HTML, `.table`, `.stat-card`, CSS design tokens

---

## Front Page Changes (`GET /`)

### Remove from front page

| Section | Why |
|---|---|
| Daily breakdown table (30 rows) | Moved to `/daily` |
| Sessions table (50 rows) | Moved to `/sessions` |

### Keep on front page

- Overview cards grid (unchanged stat cards)
- Header

### Add to front page

#### Summary cards with links

Replace bare stat cards with linked cards where a drill-down page exists:

| Card | Links to |
|---|---|
| Sessions | `/sessions` |
| Messages | `/sessions` |
| Total Cost | `/sessions` |
| Avg Cost / Session | `/sessions` |
| Input Tokens | `/models` |
| Output Tokens | `/models` |

Cards gain `<a class="stat-card" href="…">` wrapper. Style: inherit current `.stat-card` look, add `cursor: pointer` and `:hover` highlight via `border-color: var(--color-accent)`.

#### New hidden stats now shown

Add two extra overview cards using data already in `Overview`:

| Card | Field |
|---|---|
| Avg Messages / Session | `avgMessagesPerSession` |
| Reasoning Tokens | `totalTokensReasoning` |

#### Quick-glance sections (replace removed tables)

Three compact sections below the cards, each capped at **5 rows** with a "View all →" link:

| Section | Links to | Columns |
|---|---|---|
| Recent Sessions | `/sessions` | Project · Title · Cost · Date |
| Top Projects | `/projects` | Project · Sessions · Cost |
| Top Models | `/models` | Model · Messages · Cost |

Data sources: existing `getOverview()`, top-5 of `getProjectStats()`, top-5 of `getModelStats()`, top-5 sessions by `time_updated DESC`.

---

## New Routes

### `GET /sessions`

Paginated full session list.

**UI elements:**

- Back link → `/`
- Page title: "Sessions"
- Overview mini-bar: total sessions, total cost, date range of data (oldest → newest session)
- Full sessions table (all columns from existing sessions table, paginated 50/page)
- Pagination controls: Prev / Next (plain `<a>` links with `?page=N`)

**Columns:** Project | Title | Messages | Cost | Input Tokens | Output Tokens | Date

**Data source:** existing `GET /api/sessions?page=N&limit=50` (already implemented).

**Template:** `src/ui/templates/sessions-list.ts`

---

### `GET /projects`

All-projects breakdown.

**UI elements:**

- Back link → `/`
- Page title: "Projects"
- Overview cards (3): Total Projects · Total Cost · Total Sessions
- Projects table sorted by `total_cost DESC`

**Columns:** Project Name · Sessions · Cost · Input Tokens · Output Tokens

**Data source:** `GET /api/stats/projects` → `ProjectStat[]` (already implemented, zero UI today).

**Template:** `src/ui/templates/projects.ts`

---

### `GET /models`

All-models breakdown.

**UI elements:**

- Back link → `/`
- Page title: "Models"
- Overview cards (3): Total Models · Total Cost · Total Messages
- Models table sorted by `total_cost DESC`

**Columns:** Provider · Model · Messages · Cost · Input Tokens · Output Tokens

**Data source:** `GET /api/stats/models` → `ModelStat[]` (already implemented, zero UI today).

**Template:** `src/ui/templates/models.ts`

---

### `GET /daily/:date`

Single-day drill-down. `:date` is `YYYY-MM-DD`.

**UI elements:**

- Back link → `/`
- Page title: date string (e.g. `2026-03-04`)
- Overview cards (4): Sessions · Messages · Cost · Total Tokens
- Sessions table — all sessions whose `time_created` falls on that UTC date, sorted by `time_created ASC`, linked to `/sessions/:id`

**Columns:** Project · Title · Messages · Cost · Input Tokens · Output Tokens

**Error state:** if `:date` fails `YYYY-MM-DD` regex → 400 with plain-text message. If date is valid but has no sessions → show "No sessions on this date." empty state.

**Data source:** New query on `DashboardDb`:
```sql
SELECT * FROM sessions
WHERE date(time_created / 1000, 'unixepoch') = ?
ORDER BY time_created ASC
```

**New API route:** `GET /api/daily/:date` → `{ data: { date, sessions: SessionSummary[] } }`  
**New UI route:** `GET /daily/:date` → HTML page

**Template:** `src/ui/templates/daily-detail.ts`

---

## Routing changes (`src/api/router.ts` + `src/ui/routes.ts`)

| Method | Path | Handler | New? |
|---|---|---|---|
| GET | `/` | `rootHandler` (updated) | — |
| GET | `/sessions` | `sessionsListPageHandler` | yes |
| GET | `/projects` | `projectsPageHandler` | yes |
| GET | `/models` | `modelsPageHandler` | yes |
| GET | `/daily/:date` | `dailyDetailPageHandler` | yes |
| GET | `/api/daily/:date` | `apiDailyDetailHandler` | yes |

---

## CSS additions (`src/ui/static/styles.css`)

| Selector | Purpose |
|---|---|
| `a.stat-card` | Linked card: inherit `.stat-card` + `cursor: pointer; text-decoration: none` |
| `a.stat-card:hover` | `border-color: var(--color-accent)` |
| `.quick-section` | Compact 5-row preview sections on front page |
| `.quick-section__header` | Flex row: section `<h2>` + "View all →" link right-aligned |
| `.pagination` | Flex row, centered, gap, prev/next links styled as buttons |
| `.pagination a` | `border: 1px solid var(--color-border); padding: 0.25rem 0.75rem; border-radius: var(--radius)` |
| `.pagination .current` | `color: var(--color-accent); border-color: var(--color-accent)` |

No new design tokens. All new UI reuses existing variables.

---

## Data layer additions

### New `StatsService` method (for `/daily/:date`)

```ts
getSessionsForDate(date: string): Effect<SessionSummary[]>
```

Queries `sessions` table filtered by `date(time_created / 1000, 'unixepoch') = date`.

### `rootHandler` update

Fetch in parallel on `GET /`:
- `getOverview()` (existing)
- `getDailyStats(today-30d, today)` (existing, kept for sparkline potential later)
- top-5 sessions by `time_updated DESC` (existing query, limit 5)
- `getProjectStats()` (existing, slice top 5 in template)
- `getModelStats()` (existing, slice top 5 in template)

---

## Implementation order

- [ ] CSS additions (linked cards, quick-section, pagination)
- [ ] `GET /sessions` page + `sessionsListPageHandler`
- [ ] `GET /projects` page + `projectsPageHandler`
- [ ] `GET /models` page + `modelsPageHandler`
- [ ] `getSessionsForDate` service method + `GET /api/daily/:date` + `GET /daily/:date` page
- [ ] Front page refactor: remove tables, add quick-glance sections, link stat cards
