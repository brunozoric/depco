# Score Detail Modal

## Problem

Health score badge shows "98%" with no explanation. User cannot tell what's wrong or how to improve it. Score has no meaning without breakdown.

## Solution

Self-contained modal opened by clicking score badge in `ProjectHealthTable`. Shows score formula breakdown, outdated packages with per-package score impact, and active vulnerabilities with per-item penalty. User gets "why this score" and "what to fix" without leaving the dashboard.

## Score Formula (Reference)

```
baseScore = (upToDate / totalPackages) * 100
penalty = critical*10 + high*5 + moderate*2 + low*1
score = max(0, baseScore - penalty)
```

## Modal Content

### Section 1: Score Breakdown (instant from health data)

Visual formula decomposition showing each factor's contribution:

```
Base Score:             98.7%   148 of 150 up-to-date
Vulnerability Penalty:    -0    0 critical · 0 high · 0 moderate · 1 low
                        ─────
Final Score:             98%
```

Data source: `IHealthProject` fields (already loaded when table renders). Needs 4 new vulnerability count fields added to `IHealthProject`.

### Section 2: Outdated Packages (lazy-loaded)

Table columns: package name, current version, latest version, upgrade type badge (major/minor/patch), score impact.

- Score impact per package: `+(1/totalPackages * 100)%` — upgrading any single package gains this amount
- Sort: major first, then minor, then patch
- If >10 packages: show first 10 + "Show all (N)" expandable

### Section 3: Vulnerabilities (lazy-loaded, only if penalty > 0)

Table columns: package name, severity badge, title, fix version, penalty points.

- Penalty per row: `-10` (critical), `-5` (high), `-2` (moderate), `-1` (low) — from `VULNERABILITY_PENALTY` map
- Sorted by severity descending

### Footer

"View Project" button navigates to `/projects/{projectId}` for running actual upgrades.

## Data Changes

### Extend IHealthProject

Add 4 fields to `IHealthProject` interface, shared route schema, and SQL query:

```typescript
interface IHealthProject {
  // existing fields...
  vulnerabilityCritical: number;
  vulnerabilityHigh: number;
  vulnerabilityModerate: number;
  vulnerabilityLow: number;
}
```

These columns already exist in `health_snapshots` table — just not selected in the dashboard health query.

### New API Route: Score Detail

`GET /api/dashboard/health/:projectId/score-detail`

Returns outdated packages and active vulnerabilities for one project. Called lazily when modal opens.

Response shape:

```typescript
interface IScoreDetailResponse {
  outdatedPackages: Array<{
    name: string;
    currentVersion: string;
    latestVersion: string;
    upgradeType: "major" | "minor" | "patch";
  }>;
  vulnerabilities: Array<{
    packageName: string;
    severity: "critical" | "high" | "moderate" | "low";
    title: string;
    fixVersion: string | null;
    penalty: number;
  }>;
}
```

Outdated packages: query `scan_results` table for project where `upgrade_type != 'none'`. Table has `name`, `current_version`, `latest_version`, `upgrade_type` per project.

Vulnerabilities: query `vulnerabilities` table for project where not dismissed (or snooze expired), join penalty from `VULNERABILITY_PENALTY` map.

## Architecture

### Files to Modify

**Shared layer:**

- `src/shared/routes/dashboard.ts` — extend `healthProjectSchema` with 4 vulnerability count fields, add new `dashboardScoreDetailRoute` definition

**API layer:**

- `src/api/routes/dashboard.ts` — extend health SQL query to select vulnerability columns from `health_snapshots`, add score-detail route handler

**UI layer (Gateway → Presenter → React):**

- `src/ui/features/dashboard/abstractions/DashboardGateway.ts` — add `IHealthProject` vulnerability fields, add `getScoreDetail(projectId)` method and response types
- `src/ui/features/dashboard/DashboardGateway.ts` — implement `getScoreDetail`
- `src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts` — add score modal state to ViewModel, add `openScoreModal`/`closeScoreModal` methods
- `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts` — implement modal state management and lazy data loading
- `src/ui/presentation/dashboard/Dashboard/components/ScoreDetailModal.tsx` — new component
- `src/ui/presentation/dashboard/Dashboard/components/ProjectHealthTable.tsx` — make score Badge clickable
- `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx` — render ScoreDetailModal

### No New Files Needed For

- Repository: score detail data is transient (loaded on modal open, discarded on close). No need to persist in repository.
- UseCase: no business logic beyond fetching — presenter calls gateway directly for modal data.

## Interaction Flow

1. User sees `ProjectHealthTable` with score badges
2. Clicks score badge (cursor: pointer, subtle hover effect)
3. Modal opens — Section 1 (score breakdown) renders instantly from existing health data
4. Sections 2 and 3 show skeleton loaders
5. `getScoreDetail(projectId)` fires, loads outdated packages + vulnerabilities
6. Tables populate — user sees "lodash patch outdated, +0.67%" and "express critical vulnerability, -10 points"
7. User clicks "View Project" to run upgrades, or closes modal

## Out of Scope

- Score simulation ("what if I upgrade X") — showing impact per package is sufficient
- Historical score breakdown — current snapshot only
- Auto-fix from modal — "View Project" links to existing flows
- License impact on score — licenses don't affect score formula today
- Changes to ProjectDetailPage — modal is the score insight tool
