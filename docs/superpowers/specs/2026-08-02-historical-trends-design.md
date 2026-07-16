# Historical Trend Dashboard — Design Spec

## Overview

Extend the dashboard with historical trend analysis across 5 dimensions: dependency staleness, license compliance, auto-fix PR success rate, package count growth, and per-package dependency changes. Summary sparklines on the main dashboard link to a dedicated `/trends` page with full interactive charts.

## Data Layer

### New Table: `license_snapshots`

Records daily license compliance stats per project, upserted by `LicenseScanJobExecutor` after each scan.

```
license_snapshots
  id              TEXT PRIMARY KEY
  projectId       TEXT NOT NULL FK(projects.id)
  date            TEXT NOT NULL (YYYY-MM-DD)
  totalPackages   INTEGER NOT NULL
  compliantCount  INTEGER NOT NULL
  deniedCount     INTEGER NOT NULL
  warnedCount     INTEGER NOT NULL
  scannedAt       INTEGER NOT NULL
  UNIQUE(projectId, date)
```

`compliantPercent` is not stored — computed from counts at query time (`compliantCount * 100 / totalPackages`). Avoids stale derived data.

`LicenseScanJobExecutor` calls `LicensePolicyService.getComplianceStatus(projectId)` after persisting licenses and evaluating policies, then upserts into `license_snapshots` keyed on `(projectId, date)`.

Snapshots kept indefinitely (same as `health_snapshots`). No retention/purge logic — data volume is one row per project per day, negligible even over years.

### New Table: `dependency_changes`

Records per-package add/remove/version-change events detected during each scan.

```
dependency_changes
  id              TEXT PRIMARY KEY
  projectId       TEXT NOT NULL FK(projects.id, CASCADE)
  packageName     TEXT NOT NULL
  changeType      TEXT NOT NULL ('added' | 'removed' | 'version-changed')
  previousVersion TEXT (nullable — null for adds)
  newVersion      TEXT (nullable — null for removes)
  detectedAt      INTEGER NOT NULL
```

No unique constraint — same package can appear multiple times across scans.

### DependencyChangeService

DI-wired service. Called by `ScanJobExecutor` BEFORE overwriting `scanResults`.

```typescript
interface IDependencyChangeService {
  detectAndPersist(projectId: string, newScanResults: IScanResultInput[]): Promise<number>;
}
```

`detectAndPersist` flow:

1. Read current `scanResults` for the project from DB
2. Compare against `newScanResults`:
   - Package in new but not current → `added`
   - Package in current but not new → `removed`
   - Package in both but `currentVersion` differs → `version-changed` (stores old + new version)
3. Insert change records into `dependency_changes`
4. Returns count of changes detected

```typescript
interface IScanResultInput {
  name: string;
  currentVersion: string;
}
```

### Existing Data Reuse

- **Staleness trends**: `health_snapshots` already stores `patchOutdated`, `minorOutdated`, `majorOutdated`, `totalPackages` per project per day. No schema changes needed — just new query endpoints.
- **Vulnerability trends**: Already has `GET /api/dashboard/vulnerability-trend` endpoint and `VulnerabilityTrendChart`. No changes needed.
- **Auto-fix PR stats**: Derived from existing `auto_fix_pull_requests` table via `GROUP BY date(updatedAt/1000, 'unixepoch'), status`. No schema changes.

### Integration Points

- `ScanJobExecutor`: call `DependencyChangeService.detectAndPersist()` BEFORE upserting scan results (so it can compare old vs new). Wrap in try/catch — change detection failure should not fail the scan.
- `LicenseScanJobExecutor`: after evaluating policies (existing flow), call compliance status and upsert into `license_snapshots`. Wrap in try/catch — snapshot failure should not fail the license scan.

## API Endpoints

All added to existing `src/api/routes/dashboard.ts`. Route definitions in `src/shared/routes/dashboard.ts`.

### `GET /api/dashboard/staleness-trend?range=7d|30d|90d|all`

Queries `health_snapshots` aggregated (SUM) by date across all projects.

```typescript
interface IStalenessTrendPoint {
  date: string;
  patchOutdated: number;
  minorOutdated: number;
  majorOutdated: number;
  totalPackages: number;
}

interface IStalenessTrendResponse {
  points: IStalenessTrendPoint[];
}
```

Range filtering: `7d` = last 7 days, `30d` = last 30, `90d` = last 90, `all` = no date filter (returns all historical data). Ordered by date ascending. Same pattern as existing `GET /api/dashboard/vulnerability-trend`. Range param handled via a days-to-date-threshold map; `all` bypasses the date filter entirely (no WHERE clause on date).

### `GET /api/dashboard/license-trend?range=7d|30d|90d|all`

Queries `license_snapshots` aggregated (SUM) by date across all projects.

```typescript
interface ILicenseTrendPoint {
  date: string;
  compliantCount: number;
  deniedCount: number;
  warnedCount: number;
  totalPackages: number;
}

interface ILicenseTrendResponse {
  points: ILicenseTrendPoint[];
}
```

### `GET /api/dashboard/auto-fix-trend?range=7d|30d|90d|all`

Queries `auto_fix_pull_requests` grouped by `date(updatedAt/1000, 'unixepoch')` and pivoted by status. Counts all statuses the system currently produces: `pending`, `created`, `failed` (set by AutoFixPrJobExecutor), plus `merged` and `closed` (reserved for future external PR state sync or manual updates).

```typescript
interface IAutoFixTrendPoint {
  date: string;
  pending: number;
  created: number;
  merged: number;
  closed: number;
  failed: number;
}

interface IAutoFixTrendResponse {
  points: IAutoFixTrendPoint[];
}
```

### `GET /api/dashboard/dependency-changes?projectId=X&limit=50`

Queries `dependency_changes` table ordered by `detectedAt` DESC.

```typescript
interface IDependencyChangeItem {
  id: string;
  projectId: string;
  packageName: string;
  changeType: "added" | "removed" | "version-changed";
  previousVersion: string | null;
  newVersion: string | null;
  detectedAt: number;
}
```

Optional `projectId` filter, default `limit` 50. Response wrapped in `sendList` (`{ items, total }`).

## UI Layer

### A. Dashboard Sparkline Cards

Add 3 new sparkline summary cards to existing `DashboardPage`, below current widgets. Each card fetches 7-day trend data in parallel via `LoadDashboardUseCase`.

1. **StalenessSummaryCard** — mini `LineChart` (Recharts) showing `majorOutdated` count over last 7 days from staleness-trend endpoint. Title: "Dependency Staleness", subtitle: "major outdated (7d)". Click navigates to `/trends`.

2. **LicenseComplianceSummaryCard** — mini `LineChart` showing `compliantCount` over last 7 days from license-trend endpoint. Title: "License Compliance", subtitle: "compliant packages (7d)". Click navigates to `/trends`.

3. **AutoFixSummaryCard** — mini `LineChart` showing `created` count over last 7 days from auto-fix-trend endpoint. Title: "Auto-Fix PRs", subtitle: "PRs created (7d)". Click navigates to `/trends`.

Sparkline style: no axes, no tooltips, no grid, no legend — just the trend line in a small card. Uses Recharts `LineChart` with `width={120}` `height={40}` roughly. Mantine `Card` with `withBorder`, `onClick={() => navigate("/trends")}`, `style={{ cursor: "pointer" }}`.

Data fetched via extended `LoadDashboardUseCase` — add 3 more parallel `Promise.all` calls to the existing 5-endpoint parallel fetch. Stored in `DashboardRepository` via new getter/setter pairs.

### B. `/trends` Page — Full MVP Stack

New route `/trends` in navigation (after SBOM link).

**Gateway** (`src/ui/features/trends/`):

```typescript
interface ITrendsGateway {
  getStalenessTrend(range?: string): Promise<IStalenessTrendResponse>;
  getLicenseTrend(range?: string): Promise<ILicenseTrendResponse>;
  getAutoFixTrend(range?: string): Promise<IAutoFixTrendResponse>;
  getDependencyChanges(
    filters?: IDependencyChangesFilters
  ): Promise<{ items: IDependencyChangeItem[]; total: number }>;
}
```

```typescript
interface IDependencyChangesFilters {
  projectId?: string;
  limit?: number;
}
```

Gateway uses `HTTPClient.request()` with shared route definitions.

**Repository** (`src/ui/features/trends/`):

```typescript
interface ITrendsRepository {
  getStalenessTrend(): IStalenessTrendPoint[];
  setStalenessTrend(points: IStalenessTrendPoint[]): void;
  getLicenseTrend(): ILicenseTrendPoint[];
  setLicenseTrend(points: ILicenseTrendPoint[]): void;
  getAutoFixTrend(): IAutoFixTrendPoint[];
  setAutoFixTrend(points: IAutoFixTrendPoint[]): void;
  getDependencyChanges(): IDependencyChangeItem[];
  setDependencyChanges(items: IDependencyChangeItem[], total: number): void;
  getDependencyChangesTotal(): number;
}
```

**UseCase** (`src/ui/presentation/trends/useCases/`):

- `LoadTrendsUseCase` — fetches all 4 trend endpoints in parallel, stores in repository
- `LoadDependencyChangesUseCase` — fetches dependency changes with filters (separate from trends since it supports pagination/filtering)

**Presenter** (`src/ui/presentation/trends/TrendsPage/`):

Observables:

- `stalenessRange`, `licenseRange`, `autoFixRange` — independent per-chart range state (default `"30d"`)
- `dependencyChangesProjectFilter` — optional project filter
- `loading` — initial load state

VM:

```typescript
interface ITrendsViewModel {
  loading: boolean;
  error: string | null;
  stalenessPoints: IStalenessTrendPoint[];
  stalenessRange: string;
  licensePoints: ILicenseTrendPoint[];
  licenseRange: string;
  autoFixPoints: IAutoFixTrendPoint[];
  autoFixRange: string;
  packageCountPoints: Array<{ date: string; totalPackages: number }>;
  dependencyChanges: IDependencyChangeItem[];
  dependencyChangesTotal: number;
  dependencyChangesProjectFilter: string | null;
  availableProjects: Array<{ id: string; name: string }>;
}
```

Note: `packageCountPoints` derived from `stalenessPoints` (same health_snapshots query already returns `totalPackages`). No separate endpoint needed.

Methods: `load()`, `setStalenessRange(range)`, `setLicenseRange(range)`, `setAutoFixRange(range)`, `setDependencyChangesProjectFilter(projectId | null)`.

Each `set*Range` method triggers a re-fetch of that specific trend via the gateway and updates the repository.

**React components:**

- `TrendsPage.tsx` — page shell with 5 sections stacked vertically
- `StalenessTrendChart` — 3 stacked area lines (patch/minor/major) with SegmentedControl range toggle
- `LicenseComplianceTrendChart` — 3 lines (compliant/warned/denied) with range toggle
- `AutoFixTrendChart` — 4 lines (created/merged/closed/failed) with range toggle
- `PackageCountTrendChart` — single line (totalPackages) with range toggle (shares staleness range)
- `DependencyChangesTable` — Mantine Table with project Select filter, color-coded change type badges (green=added, red=removed, yellow=version-changed), shows previousVersion→newVersion for changes

All charts use Recharts `ResponsiveContainer`, `LineChart`/`AreaChart`, `Tooltip`, `Legend`, matching existing `HealthTrendChart` and `VulnerabilityTrendChart` patterns.

### C. App.tsx Integration

- Add `TrendsFeature`, `TrendsUseCasesFeature`, `TrendsPageFeature` to `ALL_FEATURES`
- Add route: `if (path === "/trends") { ... }` before the packages route
- Add nav link: `<Anchor component="button" onClick={() => navigate("/trends")}>Trends</Anchor>` after SBOM

## Testing

### API Tests

- **DependencyChangeService**: in-memory SQLite, seed scanResults, call `detectAndPersist` with modified scan data, verify correct adds/removes/version-changes persisted. Test no-op when scan unchanged. Test first scan (no previous data = all "added").
- **LicenseScanJobExecutor extension**: verify `license_snapshots` row upserted after scan completes
- **ScanJobExecutor extension**: verify `DependencyChangeService.detectAndPersist` called before scan result upsert
- **Dashboard route tests**: 4 new endpoints — seed snapshots/PRs/changes, verify response shapes, range filtering, dependency-changes limit and projectId filter

### UI Tests

- **TrendsPresenter**: mock HTTPClient, verify loading states, independent range selection per chart, project filter for dependency changes table, packageCountPoints derived from stalenessPoints
- **LoadTrendsUseCase**: mock gateway, verify parallel fetch of trend endpoints
- **DashboardPresenter extension**: verify sparkline data populated from new endpoints

## File Structure

```
src/
  api/
    db/schema.ts                     — add licenseSnapshots + dependencyChanges tables
    services/
      abstractions/DependencyChangeService.ts
      DependencyChangeService.ts
      __tests__/DependencyChangeService.test.ts
      jobExecutors/
        ScanJobExecutor.ts           — modify: call DependencyChangeService before upsert
        LicenseScanJobExecutor.ts    — modify: upsert license_snapshots after scan
    routes/
      dashboard.ts                   — add 4 new endpoints
      __tests__/dashboard.test.ts    — extend with new endpoint tests
    feature.ts                       — register DependencyChangeService
  shared/
    routes/dashboard.ts              — add 4 new route definitions
  ui/
    features/
      trends/
        abstractions/TrendsGateway.ts
        abstractions/TrendsRepository.ts
        TrendsGateway.ts
        TrendsRepository.ts
        feature.ts
      dashboard/
        DashboardGateway.ts          — add sparkline endpoint calls
        DashboardRepository.ts       — add sparkline data getters/setters
        abstractions/DashboardGateway.ts  — add sparkline response types
        abstractions/DashboardRepository.ts — add sparkline interface methods
    presentation/
      trends/
        TrendsPage/
          abstractions/TrendsPresenter.ts
          TrendsPresenter.ts
          TrendsProvider.tsx
          components/
            TrendsPage.tsx
            StalenessTrendChart.tsx
            LicenseComplianceTrendChart.tsx
            AutoFixTrendChart.tsx
            PackageCountTrendChart.tsx
            DependencyChangesTable.tsx
          feature.ts
        useCases/
          abstractions/LoadTrendsUseCase.ts
          abstractions/LoadDependencyChangesUseCase.ts
          LoadTrendsUseCase.ts
          LoadDependencyChangesUseCase.ts
          feature.ts
        __tests__/TrendsPresenter.test.ts
      dashboard/
        Dashboard/
          components/
            StalenessSummaryCard.tsx
            LicenseComplianceSummaryCard.tsx
            AutoFixSummaryCard.tsx
            DashboardPage.tsx         — add sparkline cards
        useCases/LoadDashboardUseCase.ts — extend with sparkline fetches
    App.tsx                           — add /trends route, nav link, features
  testing/
    helpers/createTestDb.ts           — add new tables to CREATE_TABLES
```
