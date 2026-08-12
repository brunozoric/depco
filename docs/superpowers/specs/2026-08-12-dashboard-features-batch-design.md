# Dashboard Features Batch Design

Five independent features sharing UI patterns and data infrastructure.

## Feature 1: Engines Maintenance Toggle

### Summary
Client-side Switch component on Dashboard EngineOverviewWidget and ProjectDetail EngineStatusSection that filters maintenance-status findings from the displayed data.

### Behavior
- Local UI state, defaults to `true` (show maintenance)
- When toggled off, maintenance-status findings are excluded from the rendered list and counts
- No API call — data is already returned with all statuses, filtered client-side
- No persistence — resets on page reload (consistent with other UI filters)
- Root package is never filtered (matches API-side `warnMaintenance` behavior)

### Changes
- **EngineOverviewWidget** — add Switch, filter `maintenance` from `counts` display when off
- **EngineStatusSection** (ProjectDetail) — add Switch, filter maintenance rows from findings table when off
- **DashboardPresenter** — add `showMaintenance` state + `toggleMaintenance()` method
- **ProjectDetailPresenter** — add `showMaintenance` state + `toggleMaintenance()` method

### Why client-side
The `warnMaintenance` querystring on `POST /api/engines/:projectId/scan` controls scan-time persistence (whether to store maintenance findings at all). The UI toggle is a view-time filter — different concern, no API change needed.

---

## Feature 2: Stale Engine Scan Detection

### Summary
Flag projects whose engine scan is outdated, using both time-based and release-based detection.

### Detection Logic
- **Time-based:** project's most recent `engineChecks.scannedAt` is older than threshold (default: 7 days)
- **Release-based:** a Node.js release in the cached schedule has `releaseDate` newer than the project's last engine scan
- Project is stale if either condition is true

### API Changes
Extend `GET /api/engines/summary` response. Each `projectSummary` gains:
```typescript
{
  // existing fields...
  lastScannedAt: number | null;
  engineScanStale: boolean;
  engineScanStaleReason: "time" | "release" | "both" | null;
}
```
Top-level summary gains:
```typescript
{
  // existing fields...
  staleProjectCount: number;
  stalenessThresholdMs: number;
}
```

### Staleness threshold
Default 7 days (hardcoded constant). Can be made configurable via app settings later if needed.

### UI Changes
- **EngineOverviewWidget** — show "N projects stale" badge with warning color when `staleProjectCount > 0`
- **EngineStatusSection** — show "Last scanned X days ago" text, warning color if stale, with reason tooltip ("New Node release since last scan" / "Scan older than 7 days")
- No new page or route

### Implementation
- `EngineService.getSummary()` already queries all engine checks and has access to `NodeReleaseDataService` — extend to compute staleness per project
- Staleness is computed server-side (not client-side) because it requires the release schedule
- Abstraction changes: extend `IEngineSummary` with `staleProjectCount` and `stalenessThresholdMs`; extend `IProjectEngineSummary` with `lastScannedAt`, `engineScanStale`, `engineScanStaleReason`
- UI gateway types (`IEngineSummaryData`, `IProjectEngineSummaryItem`) and shared route response schema must be updated to match

---

## Feature 3: Changelog Success Rate

### Summary
Dashboard widget and packages page header showing resolver breakdown and success rate for changelog resolution.

### API Changes
New endpoint: `GET /api/changelogs/stats`

Response:
```typescript
{
  total: number;
  resolved: number;
  failed: number;
  pending: number;
  byResolver: Record<string, number>;
}
```

Computed from changelogs table:
- `content IS NULL` = pending
- `source = 'none'` = failed
- Otherwise = resolved, grouped by `source` column

### Route Definition
```typescript
export const getChangelogStatsRoute = defineRoute({
  method: "GET",
  path: "/api/changelogs/stats",
  description: "Get changelog resolution statistics",
  params: z.object({}),
  response: changelogStatsSchema
});
```

### Dashboard Widget — ChangelogResolutionWidget
- Shows resolved/failed/pending as colored badges or stacked bar
- Resolver breakdown as compact list: "github-releases: 142, raw-github: 38, ..."
- "Re-resolve all failed" button (calls `POST /api/changelogs/re-resolve-all`)
- Refreshes after re-resolve completes

### Packages Page Header — ChangelogStatsBar
- Single-line stats bar above the packages table
- "312 resolved / 23 failed / 8 pending" with colored badges
- Clicking "failed" count could set a URL filter (future enhancement)

### Architecture
- **ChangelogsGateway** — new gateway (or extend existing if one exists) with `getStats()` method
- **DashboardPresenter** — load stats on mount, expose in view model
- **PackagesPresenter** — load stats on mount, expose in view model
- Shared `LoadChangelogStatsUseCase` for both presenters

---

## Feature 4: Bulk Scan (Selectable Projects)

### Summary
Checkbox selection on the projects list with a "Scan selected" bulk action bar.

### API Changes
New endpoint: `POST /api/projects/bulk-scan`

Body:
```typescript
{
  projectIds: string[];
  force?: boolean;
}
```

Response:
```typescript
{
  enqueuedCount: number;
  skippedCount: number;
}
```

Logic:
- For each projectId, check if a scan job is already pending/running
- If not, enqueue a `scan` job
- Return counts of enqueued vs skipped
- Reuses existing `ScanJobExecutor` — no new job type

### Route Definition
```typescript
export const bulkScanProjectsRoute = defineRoute({
  method: "POST",
  path: "/api/projects/bulk-scan",
  description: "Enqueue scan jobs for multiple projects",
  params: z.object({}),
  body: z.object({
    projectIds: z.array(z.string()).min(1),
    force: z.boolean().optional()
  }),
  response: z.object({
    enqueuedCount: z.number(),
    skippedCount: z.number()
  })
});
```

### UI Changes — Projects List Page
- **Checkbox column** in ProjectHealthTable (same pattern as DependencyTable/VulnerabilitiesPage)
- **Select-all checkbox** in header (page-level, not all-pages)
- **BulkActionBar** appears when items selected: "Scan selected (N)" button
- Toast on completion: "Enqueued 5 scans, 2 skipped (already scanning)"

### Architecture
- **ProjectListPresenter** — `selectedProjectIds: Set<string>`, `toggleProject()`, `selectAll()`, `deselectAll()`, `bulkScan()`
- **BulkScanProjectsUseCase** — calls gateway
- **ProjectsGateway** — `bulkScan(input: BulkScanInput): Promise<BulkScanResult>`
- Selection state lives in presenter, not persisted

---

## Feature 5: Package Detail Page

### Summary
New top-level route `/packages/:packageName` showing all data for a single package across projects.

### API Changes
New endpoint: `GET /api/packages/:packageName`

Response:
```typescript
{
  name: string;
  repoUrl: string | null;
  projects: Array<{
    projectId: string;
    projectName: string;
    currentVersion: string;
    latestVersion: string;
    upgradeType: string;
    dependencyKind: string;
  }>;
  latestVersion: string | null;
  lastPublishedAt: number | null;
  registryResolved: boolean;
}
```

### Page Layout (top to bottom)
1. **Header** — package name, repo link (if available), latest version, last published date, back button to packages list
2. **Projects table** — projects using this package with version, upgrade type, dependency kind columns. Project name links to `/projects/:projectId`.
3. **Changelog section** — version-by-version changelog entries. Reuses existing `GET /api/changelogs/:packageName` with appropriate from/to. Re-resolve button.
4. **Vulnerabilities section** — vulnerabilities affecting this package. Uses existing `GET /api/vulnerabilities` with `packageName` filter.
5. **License section** — license info. Uses existing `GET /api/licenses` with `packageName` filter.
6. **Engine status** — if this package appears in engine checks, show its status. Uses existing `GET /api/engines/:projectId` data (filtered client-side by packageName).

### Architecture (MVP layers)
- `PackageDetailRoute` — route at `/packages/:packageName`
- `PackageDetailPage` — React component with sections
- `IPackageDetailPresenter` / `PackageDetailPresenter` — abstraction + implementation
- `LoadPackageDetailUseCase` — orchestrates multiple gateway calls
- `PackagesGateway` — add `getPackageDetail(packageName: string)` method
- Reuse existing `ChangelogsGateway`, `VulnerabilitiesGateway`, `LicensesGateway` for section data

### Navigation
- Package name column in packages list table becomes a `<Link>` to `/packages/:packageName`
- Package names in project detail dependency table also link there
- Back button on detail page returns to packages list

### Route ordering
- API: `GET /api/packages` (list) coexists with `GET /api/packages/:packageName` (detail) — Fastify prioritizes static over parameterized. Same pattern as existing `/api/packages/:packageName/rescan`.
- UI: `/packages` (list) and `/packages/:packageName` (detail) — React Router exact matching handles this correctly.

### Changelog version range
For the changelog section, `from` is the minimum `currentVersion` across all projects using this package, `to` is the `latestVersion`. This gives the most useful range — everything between what any project currently has and what's available.

---

## Implementation Order

Recommended build sequence (dependencies flow downward):

1. **Engines maintenance toggle** — smallest, no API changes, pure UI
2. **Changelog success rate** — new API endpoint + two UI surfaces
3. **Stale engine scan detection** — extends existing API + UI
4. **Bulk scan** — new API endpoint + project list UI changes
5. **Package detail page** — largest, new route + page + presenter + gateway

Features 1-4 are independent and could be parallelized. Feature 5 is standalone but largest.

## Testing Strategy

Each feature follows existing patterns:
- API routes: integration tests with `createTestApiContainer` + Fastify inject
- Presenters: unit tests with stub gateways/repositories
- Gateways: unit tests with mock HTTPClient
- Use cases: unit tests with mock dependencies
