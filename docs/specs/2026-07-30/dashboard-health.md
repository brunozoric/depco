# Dashboard & Health Tracking

## Problem

No cross-project overview exists. Users must visit each project individually to assess dependency health. No historical tracking to see if projects are improving or degrading over time.

## Solution

A dashboard as the app's home page (`/`) with six widgets: summary cards, health trend chart, project health table, recent activity, scan freshness, and security overview. Health scores are tracked over time via daily snapshots.

## Data Layer

### New table: `health_snapshots`

| Column        | Type    | Constraints                  |
| ------------- | ------- | ---------------------------- |
| id            | TEXT    | PK                           |
| projectId     | TEXT    | FK → projects.id, NOT NULL   |
| date          | TEXT    | NOT NULL (YYYY-MM-DD format) |
| score         | INTEGER | NOT NULL (0-100)             |
| totalPackages | INTEGER | NOT NULL                     |
| upToDate      | INTEGER | NOT NULL                     |
| patchOutdated | INTEGER | NOT NULL                     |
| minorOutdated | INTEGER | NOT NULL                     |
| majorOutdated | INTEGER | NOT NULL                     |
| scannedAt     | INTEGER | NOT NULL (epoch ms)          |

Unique constraint on `(projectId, date)`.

Table added to Drizzle schema (`src/api/db/schema.ts`). Migration handled the same way as existing tables.

### Score formula

```
score = round((upToDate / totalPackages) * 100)
```

When `totalPackages` is 0, score is 100 (nothing to upgrade). Projects with no scans yet have no snapshot rows — they appear in staleness widget but not in health data.

### Snapshot trigger

`ScanJobExecutor` — after persisting scan results, compute counts from `scanResults` where `projectId` matches, calculate score, upsert into `health_snapshots`. Upsert uses the unique `(projectId, date)` constraint — last scan of the day wins.

Date is derived from `new Date().toISOString().slice(0, 10)` at snapshot time.

## API Endpoints

### `GET /api/dashboard/health`

Returns current health snapshot per project (latest row per project) plus summary data.

Response:

```json
{
  "summary": {
    "totalProjects": 8,
    "averageScore": 72,
    "worstProject": { "id": "...", "name": "...", "score": 45 }
  },
  "projects": [
    {
      "projectId": "...",
      "projectName": "...",
      "score": 45,
      "scoreDelta": -5,
      "totalPackages": 40,
      "upToDate": 18,
      "patchOutdated": 10,
      "minorOutdated": 8,
      "majorOutdated": 4,
      "lastScannedAt": 1722345600000
    }
  ]
}
```

Sorted by score ascending (worst first). `scoreDelta` is computed as `currentScore - scoreFrom7DaysAgo`. The 7-day-ago score is the snapshot row with the closest date on or before `today - 7 days` for that project. If no snapshot exists that far back, `scoreDelta` is null.

### `GET /api/dashboard/health/trend?range=30d`

Returns historical snapshots for the trend chart.

Query params:

- `range`: `7d` | `30d` | `90d` | `all` (default: `30d`)

Response:

```json
{
  "items": [
    {
      "projectId": "...",
      "projectName": "...",
      "snapshots": [
        { "date": "2026-07-25", "score": 80 },
        { "date": "2026-07-30", "score": 85 }
      ]
    }
  ]
}
```

Projects ordered alphabetically by name. Chart rendering handles visual differentiation — API order is stable, not ranked.

### `GET /api/dashboard/activity`

Returns recent jobs across all projects.

Response:

```json
{
  "items": [
    {
      "id": "...",
      "type": "scan",
      "referenceId": "...",
      "referenceType": "project",
      "status": "completed",
      "startedAt": 1722345600000,
      "completedAt": 1722345660000
    }
  ]
}
```

Limited to 20 most recent jobs, sorted by `startedAt` descending.

### `GET /api/dashboard/staleness`

Returns projects sorted by `lastScannedAt` ascending (stalest first).

Response:

```json
{
  "items": [
    {
      "projectId": "...",
      "projectName": "...",
      "lastScannedAt": 1722345600000
    }
  ]
}
```

Uses existing `projects.lastScannedAt` column. No new storage. Projects with `lastScannedAt: null` (never scanned) appear first in the list — sorted as oldest. Response includes null values.

### `GET /api/dashboard/security`

Returns aggregate security check pass/fail per project.

Response:

```json
{
  "items": [
    {
      "projectId": "...",
      "projectName": "...",
      "totalChecks": 6,
      "passingChecks": 5
    }
  ]
}
```

Reads from existing `securityChecks` table (latest check per project). Sorted by passing ratio ascending (worst first).

## Route definitions

All five endpoints get shared route definitions in `src/shared/routes/` following the existing `defineRoute` pattern with Zod schemas for query params and responses.

## UI Architecture

### Route change

- `/` renders `DashboardProvider` + `DashboardPage` (replaces ProjectListPage as default route)
- Project list renders at `/projects` (new explicit route match in `AppRoutes`)
- Nav header changes: add "Dashboard" as first link pointing to `/`, change existing "Projects" link from `/` to `/projects`

### Feature layer

- `src/ui/features/dashboard/DashboardGateway.ts` — 5 methods matching 5 API endpoints
- `src/ui/features/dashboard/DashboardRepository.ts` — holds health snapshots, trend data, activity, staleness, security results

### Presentation layer

- `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts` — MobX presenter, computed `vm` getter
- `src/ui/presentation/dashboard/Dashboard/DashboardProvider.tsx` — DI provider
- `src/ui/presentation/dashboard/Dashboard/feature.ts` — DI feature registration

### Components

- `DashboardPage.tsx` — page shell, grid layout
- `SummaryCards.tsx` — top row: total projects, average health, worst project
- `HealthTrendChart.tsx` — Recharts line chart, one line per project
- `ProjectHealthTable.tsx` — Mantine table, sorted worst-first
- `RecentActivityWidget.tsx` — compact job list with type/status badges
- `ScanFreshnessWidget.tsx` — stale projects with warning icons
- `SecurityOverviewWidget.tsx` — pass/fail progress bars

### Use case

- `LoadDashboardUseCase` — calls all 5 gateway methods via `Promise.all`, stores results in repository

### Chart library

Recharts (add as dependency). Required for multi-line trend chart with tooltips and time range switching.

## Page Layout

### Top row — Summary Cards (3 cards, horizontal)

- **Total Projects** — count, links to `/projects`
- **Average Health** — avg score, color-coded (green >80, yellow >50, red <=50)
- **Worst Project** — name + score, links to project detail

### Second row — Project Health Table (full width)

Mantine table sorted by score ascending (worst first). Columns: project name (links to project detail), current score, score delta (vs 7 days ago), major/minor/patch counts, last scanned date. Same data as the health endpoint's `projects` array.

### Third row — Trend Chart (full width)

- Line chart, one line per project, X=date, Y=health %
- Time range picker: 7d / 30d / 90d / all (Mantine SegmentedControl)
- Legend shows project names with color indicators
- Tooltip on hover shows date + score per project

### Bottom row — 3 widgets side by side (Mantine SimpleGrid cols={3})

- **Recent Activity** — last 20 jobs. Type badge, project name, status badge, relative timestamp. Click navigates to `/jobs`.
- **Scan Freshness** — projects sorted stalest first. Name + "last scanned X days ago". Warning icon if >7 days stale. Click navigates to project detail.
- **Security Overview** — per-project pass/fail. Name + "5/6 checks passing" with progress bar. Click navigates to project detail.

## Loading & Refresh

- Single `loading` state in presenter. All 5 gateway calls fire in parallel. Skeleton shown until all resolve.
- No polling. WS-driven refresh:
  - `scan:complete` — reloads health + staleness data
  - `job:status` — reloads activity data

## Testing

### API tests (`src/api/routes/__tests__/dashboard.test.ts`)

- Health endpoint: empty DB, single project score, multiple projects sorted worst-first, scoreDelta computation
- Trend endpoint: 7d/30d/90d/all filtering, upsert behavior (same day overwrites)
- Activity endpoint: returns recent jobs, respects 20 limit
- Staleness endpoint: sorted by oldest scan first
- Security endpoint: aggregates pass/fail correctly

### ScanJobExecutor integration

- Extend existing `ScanJobExecutor` tests: verify `health_snapshots` row created after scan, verify upsert on same-day rescan

### UI tests

- `DashboardGateway.test.ts` — all 5 methods call correct routes
- `DashboardRepository.test.ts` — stores/retrieves all data types
- `LoadDashboardUseCase.test.ts` — parallel gateway calls, stores in repository
- `DashboardPresenter.test.ts` — vm shape, loading lifecycle, time range switching, WS event handling, score delta computation

### Not unit-tested (manual verification)

React components: SummaryCards, HealthTrendChart, ProjectHealthTable, RecentActivityWidget, ScanFreshnessWidget, SecurityOverviewWidget — dumb display components.
