# Dashboard Features Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five features: engines maintenance toggle, changelog success rate, stale engine scan detection, bulk scan, and package detail page.

**Architecture:** Each feature follows existing MVP layers (Gateway/Repository/UseCase/Presenter/React). API changes use `defineRoute` + `registerRoute` + Fastify. UI uses MobX observer + Mantine components. All features are independent.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, MobX, React, Mantine v7, Vitest

## Global Constraints

- Use `yarn full` to verify (lint, format, typecheck, build, tests)
- Named interfaces only (no inline structural types)
- Object params with named keys for functions with 2+ params
- Never import *Impl outside its own file — use abstractions + DI
- Run `yarn format:fix && yarn lint:fix` before each commit
- Follow abstraction + createImplementation DI pattern for all new services/gateways/presenters
- This project uses `@webiny/di` for dependency injection via `createAbstraction` and `createImplementation`

---

### Task 1: Engines Maintenance Toggle (UI only)

**Files:**

- Modify: `src/ui/presentation/Dashboard/Dashboard/abstractions/DashboardPresenter.ts`
- Modify: `src/ui/presentation/Dashboard/Dashboard/DashboardPresenter.ts`
- Modify: `src/ui/presentation/Dashboard/Dashboard/components/EngineOverviewWidget.tsx`
- Modify: `src/ui/presentation/Projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`
- Modify: `src/ui/presentation/Projects/ProjectDetail/ProjectDetailPresenter.ts`
- Modify: `src/ui/presentation/Projects/ProjectDetail/components/EngineStatusSection.tsx`
- Test: `src/ui/presentation/Dashboard/Dashboard/__tests__/DashboardPresenter.test.ts`
- Test: `src/ui/presentation/Projects/ProjectDetail/__tests__/ProjectDetailPresenter.test.ts`

**Interfaces:**

- Consumes: Existing `IDashboardViewModel.engineSummary`, `IProjectDetailEngineDataViewModel`
- Produces: `IDashboardViewModel.showMaintenance: boolean`, `IDashboardPresenter.toggleMaintenance()`, `IProjectDetailViewModel.showMaintenance: boolean`, `IProjectDetailPresenter.toggleMaintenance()`

- [ ] **Step 1: Add showMaintenance to DashboardPresenter abstraction**

In `src/ui/presentation/Dashboard/Dashboard/abstractions/DashboardPresenter.ts`, add to `IDashboardViewModel`:

```typescript
showMaintenance: boolean;
```

Add to `IDashboardPresenter`:

```typescript
toggleMaintenance: () => void;
```

- [ ] **Step 2: Implement in DashboardPresenter**

In `src/ui/presentation/Dashboard/Dashboard/DashboardPresenter.ts`, add MobX observable `showMaintenance = true` and action `toggleMaintenance` that flips it. Wire into the view model getter.

- [ ] **Step 3: Add Switch to EngineOverviewWidget**

In `EngineOverviewWidget.tsx`, add a `Switch` from Mantine above the grid. Accept `showMaintenance: boolean` and `onToggleMaintenance: () => void` as props. When off, set `projectCounts.maintenance` to 0 in the display and subtract maintenance from counts.

- [ ] **Step 4: Wire DashboardPage to pass toggle props**

In `DashboardPage.tsx`, pass `showMaintenance={vm.showMaintenance}` and `onToggleMaintenance={presenter.toggleMaintenance}` to `EngineOverviewWidget`.

- [ ] **Step 5: Add showMaintenance to ProjectDetailPresenter abstraction**

In `src/ui/presentation/Projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`, add `showMaintenance: boolean` to `IProjectDetailViewModel` and `toggleMaintenance: () => void` to `IProjectDetailPresenter`.

- [ ] **Step 6: Implement in ProjectDetailPresenter**

Same pattern as Dashboard — MobX observable + action.

- [ ] **Step 7: Filter maintenance in EngineStatusSection**

In `EngineStatusSection.tsx`, accept `showMaintenance` prop from presenter. When off, filter findings where `status === "maintenance"` from the table. Add Switch above the table. Root status is never filtered.

- [ ] **Step 8: Test DashboardPresenter toggleMaintenance**

Add test in DashboardPresenter test file: verify `showMaintenance` defaults to `true`, calling `toggleMaintenance()` flips it to `false`.

- [ ] **Step 9: Test ProjectDetailPresenter toggleMaintenance**

Same pattern in ProjectDetailPresenter test file.

- [ ] **Step 10: Run yarn full and commit**

```bash
yarn format:fix && yarn lint:fix
yarn full
git add -A && git commit -m "feat: add engines maintenance visibility toggle to dashboard and project detail"
```

---

### Task 2: Changelog Stats API Endpoint

**Files:**

- Modify: `src/shared/routes/changelogs.ts`
- Modify: `src/api/routes/changelogs.ts`
- Modify: `src/api/services/Changelog/abstractions/ChangelogService.ts`
- Modify: `src/api/services/Changelog/ChangelogService.ts`
- Test: `src/api/services/Changelog/__tests__/ChangelogService.test.ts`
- Test: `src/api/routes/__tests__/changelogs.test.ts`

**Interfaces:**

- Consumes: `changelogs` table (content, source columns)
- Produces: `GET /api/changelogs/stats` returning `{ total, resolved, failed, pending, byResolver }`

- [ ] **Step 1: Add route definition**

In `src/shared/routes/changelogs.ts`, add:

```typescript
const changelogStatsSchema = z.object({
  total: z.number(),
  resolved: z.number(),
  failed: z.number(),
  pending: z.number(),
  byResolver: z.record(z.string(), z.number())
});

export const getChangelogStatsRoute = defineRoute({
  method: "GET",
  path: "/api/changelogs/stats",
  description: "Get changelog resolution statistics",
  params: z.object({}),
  response: changelogStatsSchema
});
```

- [ ] **Step 2: Add getStats to ChangelogService abstraction**

In `src/api/services/Changelog/abstractions/ChangelogService.ts`, add to `IChangelogService`:

```typescript
getStats(): Promise<IChangelogStats>;
```

Add interface:

```typescript
export interface IChangelogStats {
  total: number;
  resolved: number;
  failed: number;
  pending: number;
  byResolver: Record<string, number>;
}
```

Add to namespace: `export type Stats = IChangelogStats;`

- [ ] **Step 3: Implement getStats in ChangelogService**

In `src/api/services/Changelog/ChangelogService.ts`, add:

```typescript
public async getStats(): Promise<Abstraction.Stats> {
    const rows = await this.databaseClient.db
        .select({
            source: changelogs.source,
            content: changelogs.content
        })
        .from(changelogs)
        .all();

    let total = 0;
    let resolved = 0;
    let failed = 0;
    let pending = 0;
    const byResolver: Record<string, number> = {};

    for (const row of rows) {
        total++;
        if (row.content === null) {
            pending++;
        } else if (row.source === "none") {
            failed++;
        } else {
            resolved++;
            if (row.source) {
                byResolver[row.source] = (byResolver[row.source] ?? 0) + 1;
            }
        }
    }

    return { total, resolved, failed, pending, byResolver };
}
```

- [ ] **Step 4: Write ChangelogService.getStats test**

In `src/api/services/Changelog/__tests__/ChangelogService.test.ts`, add:

```typescript
it("getStats() returns correct counts and resolver breakdown", async () => {
  const { service, db } = createService();

  await insertChangelogRow(db, {
    packageName: "pkg-a",
    version: "1.0.0",
    content: "notes",
    source: "github-releases",
    fetchedAt: Date.now()
  });
  await insertChangelogRow(db, {
    packageName: "pkg-a",
    version: "2.0.0",
    content: "",
    source: "none",
    fetchedAt: Date.now()
  });
  await insertChangelogRow(db, {
    packageName: "pkg-b",
    version: "1.0.0",
    content: null,
    source: null,
    fetchedAt: null
  });

  const stats = await service.getStats();

  expect(stats.total).toBe(3);
  expect(stats.resolved).toBe(1);
  expect(stats.failed).toBe(1);
  expect(stats.pending).toBe(1);
  expect(stats.byResolver).toEqual({ "github-releases": 1 });
});
```

- [ ] **Step 5: Add route handler**

In `src/api/routes/changelogs.ts`, register the route BEFORE the parameterized routes (same as `reResolveAllChangelogsRoute`). The `changelogService` is already resolved from the container at the top of `changelogRoutes()` (line 84). Add import for `getChangelogStatsRoute` to the existing import block:

```typescript
registerRoute(app, getChangelogStatsRoute, {}, async (_request, reply) => {
  const stats = await changelogService.getStats();
  reply.send(stats);
});
```

- [ ] **Step 6: Write route handler test**

In `src/api/routes/__tests__/changelogs.test.ts`, add:

```typescript
it("GET /api/changelogs/stats returns correct resolution statistics", async () => {
  await insertChangelogFixture(db, {
    packageName: "react",
    version: "18.1.0",
    content: "notes",
    source: "github-releases",
    fetchedAt: Date.now()
  });
  await insertChangelogFixture(db, {
    packageName: "react",
    version: "18.2.0",
    content: "",
    source: "none",
    fetchedAt: Date.now()
  });

  const response = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    url: "/api/changelogs/stats"
  });

  expect(response.statusCode).toBe(200);
  const json = response.json();
  expect(json.total).toBe(2);
  expect(json.resolved).toBe(1);
  expect(json.failed).toBe(1);
  expect(json.pending).toBe(0);
  expect(json.byResolver["github-releases"]).toBe(1);
});
```

- [ ] **Step 7: Run yarn full and commit**

```bash
yarn format:fix && yarn lint:fix
yarn full
git add -A && git commit -m "feat: add changelog resolution stats API endpoint"
```

---

### Task 3: Changelog Stats UI Widgets

**Files:**

- Create: `src/ui/features/Changelogs/abstractions/ChangelogsGateway.ts`
- Create: `src/ui/features/Changelogs/ChangelogsGateway.ts`
- Create: `src/ui/features/Changelogs/feature.ts` (no Repository needed — stats are read-only, no client-side caching)
- Create: `src/ui/features/Changelogs/__tests__/ChangelogsGateway.test.ts`
- Create: `src/ui/presentation/Dashboard/Dashboard/components/ChangelogResolutionWidget.tsx`
- Create: `src/ui/presentation/Packages/PackageList/components/ChangelogStatsBar.tsx`
- Modify: `src/ui/presentation/Dashboard/Dashboard/abstractions/DashboardPresenter.ts`
- Modify: `src/ui/presentation/Dashboard/Dashboard/DashboardPresenter.ts`
- Modify: `src/ui/presentation/Dashboard/Dashboard/components/DashboardPage.tsx`
- Modify: `src/ui/presentation/Packages/PackageList/abstractions/PackagesPresenter.ts`
- Modify: `src/ui/presentation/Packages/PackageList/PackagesPresenter.ts`
- Modify: `src/ui/presentation/Packages/PackageList/components/PackagesPage.tsx`
- Modify: `src/ui/features/index.ts` (or wherever features are registered)

**Interfaces:**

- Consumes: `getChangelogStatsRoute` from Task 2, `reResolveAllChangelogsRoute` (already exists)
- Produces: `ChangelogsGateway.Interface` with `getStats()` and `reResolveAll()`, dashboard widget, packages stats bar

- [ ] **Step 1: Create ChangelogsGateway abstraction**

Create `src/ui/features/Changelogs/abstractions/ChangelogsGateway.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IChangelogStats {
  total: number;
  resolved: number;
  failed: number;
  pending: number;
  byResolver: Record<string, number>;
}

export interface IReResolveAllResult {
  packageCount: number;
}

export interface IChangelogsGateway {
  getStats(): Promise<IChangelogStats>;
  reResolveAll(): Promise<IReResolveAllResult>;
}

export const ChangelogsGateway = createAbstraction<IChangelogsGateway>("Ui/ChangelogsGateway");

export namespace ChangelogsGateway {
  export type Interface = IChangelogsGateway;
  export type Stats = IChangelogStats;
  export type ReResolveAllResult = IReResolveAllResult;
}
```

- [ ] **Step 2: Create ChangelogsGateway implementation**

Create `src/ui/features/Changelogs/ChangelogsGateway.ts`:

```typescript
import { ChangelogsGateway as Abstraction } from "./abstractions/ChangelogsGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { getChangelogStatsRoute, reResolveAllChangelogsRoute } from "#shared/routes/index.js";

class ChangelogsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async getStats(): Promise<Abstraction.Stats> {
    return this.httpClient.request(getChangelogStatsRoute, { params: {} });
  }

  public async reResolveAll(): Promise<Abstraction.ReResolveAllResult> {
    return this.httpClient.request(reResolveAllChangelogsRoute, { params: {} });
  }
}

export const ChangelogsGateway = Abstraction.createImplementation({
  implementation: ChangelogsGatewayImpl,
  dependencies: [HTTPClient]
});
```

- [ ] **Step 3: Create feature registration and gateway test**

Create `src/ui/features/Changelogs/feature.ts` following existing feature patterns. Register the gateway.

Write `src/ui/features/Changelogs/__tests__/ChangelogsGateway.test.ts` following the EnginesGateway test pattern — mock HTTPClient, verify route and params for `getStats()` and `reResolveAll()`.

- [ ] **Step 4: Add changelogStats to DashboardPresenter**

In `DashboardPresenter` abstraction, add to `IDashboardViewModel`:

```typescript
changelogStats: ChangelogsGateway.Stats | null;
reResolvingChangelogs: boolean;
```

Add to `IDashboardPresenter`:

```typescript
reResolveAllChangelogs: () => Promise<void>;
```

Implement in DashboardPresenter: initialize `changelogStats = null` and `reResolvingChangelogs = false`. In `load()`, call `changelogsGateway.getStats()` in parallel with existing loads and set the result. In `reResolveAllChangelogs()`, set `reResolvingChangelogs = true`, call `changelogsGateway.reResolveAll()`, then reload stats, then set `reResolvingChangelogs = false`.

- [ ] **Step 5: Create ChangelogResolutionWidget**

Create `src/ui/presentation/Dashboard/Dashboard/components/ChangelogResolutionWidget.tsx`:

- Card with title "Changelog Resolution"
- Three Badge elements: resolved (green), failed (red), pending (yellow) showing counts
- Resolver breakdown as list of `Text` elements: `"{source}: {count}"` for each entry in `byResolver`
- Button "Re-resolve all failed" that calls `onReResolveAll`, disabled when `reResolving` is true or `failed === 0`

- [ ] **Step 6: Add ChangelogResolutionWidget to DashboardPage**

Wire in `DashboardPage.tsx` — add the widget to the dashboard grid alongside existing widgets.

- [ ] **Step 7: Add changelogStats to PackagesPresenter**

In `PackagesPresenter` abstraction, add to `IPackagesViewModel`:

```typescript
changelogStats: ChangelogsGateway.Stats | null;
```

Implement: load stats during `load()`.

- [ ] **Step 8: Create ChangelogStatsBar**

Create `src/ui/presentation/Packages/PackageList/components/ChangelogStatsBar.tsx`:

- Horizontal Group with three Badge elements showing resolved/failed/pending counts
- Compact single-line display above the packages table

- [ ] **Step 9: Add ChangelogStatsBar to PackagesPage**

Wire in `PackagesPage.tsx` — add the stats bar above the search/filter controls.

- [ ] **Step 10: Run yarn full and commit**

```bash
yarn format:fix && yarn lint:fix
yarn full
git add -A && git commit -m "feat: add changelog resolution stats to dashboard and packages page"
```

---

### Task 4: Stale Engine Scan Detection (API)

**Files:**

- Modify: `src/api/services/Engine/abstractions/EngineService.ts`
- Modify: `src/api/services/Engine/EngineService.ts`
- Modify: `src/shared/routes/engines.ts`
- Modify: `src/shared/engines/types.ts` (if needed for shared type)
- Modify: `src/ui/features/Engines/abstractions/EnginesGateway.ts`
- Test: `src/api/routes/__tests__/engines.test.ts`

**Interfaces:**

- Consumes: `engineChecks.scannedAt`, `NodeReleaseDataService.getSchedule()`
- Produces: Extended `IEngineSummary` with `staleProjectCount`, `stalenessThresholdMs`; extended `IProjectEngineSummary` with `lastScannedAt`, `engineScanStale`, `engineScanStaleReason`

- [ ] **Step 1: Add staleness types to EngineService abstraction**

In `src/api/services/Engine/abstractions/EngineService.ts`:

Add `engineScanStaleReason` type:

```typescript
export type EngineScanStaleReason = "time" | "release" | "both";
```

Extend `IProjectEngineSummary`:

```typescript
lastScannedAt: number | null;
engineScanStale: boolean;
engineScanStaleReason: EngineScanStaleReason | null;
```

Extend `IEngineSummary`:

```typescript
staleProjectCount: number;
stalenessThresholdMs: number;
```

Add to namespace: `export type StaleReason = EngineScanStaleReason;`

- [ ] **Step 2: Add staleness constant and computation to EngineService**

In `src/api/services/Engine/EngineService.ts`:

Add constant:

```typescript
const ENGINE_STALENESS_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
```

In `getSummary()`, after building `projectSummaries`, compute staleness for each:

- `nodeReleaseDataService` is already a constructor dependency of `EngineServiceImpl` — no new injection needed
- Call `this.nodeReleaseDataService.getSchedule()` once at the top of `getSummary()`
- Find `maxReleaseDate`: guard for empty schedule (`schedule.length === 0 ? 0 : Math.max(...schedule.map(r => r.releaseDate))`)
- For each project summary, find max `scannedAt` from that project's checks
- Compare against `Date.now() - threshold` (time) and `maxReleaseDate` (release)
- Set `engineScanStale`, `engineScanStaleReason`, `lastScannedAt`
- Count `staleProjectCount` and add `stalenessThresholdMs` to return value

- [ ] **Step 3: Update route response schema**

In `src/shared/routes/engines.ts`, extend `projectEngineSummarySchema` with:

```typescript
lastScannedAt: z.number().nullable(),
engineScanStale: z.boolean(),
engineScanStaleReason: z.enum(["time", "release", "both"]).nullable()
```

Extend `engineSummarySchema` with:

```typescript
staleProjectCount: z.number(),
stalenessThresholdMs: z.number()
```

- [ ] **Step 4: Update UI gateway types**

In `src/ui/features/Engines/abstractions/EnginesGateway.ts`, extend `IProjectEngineSummaryItem`:

```typescript
lastScannedAt: number | null;
engineScanStale: boolean;
engineScanStaleReason: "time" | "release" | "both" | null;
```

Extend `IEngineSummaryData`:

```typescript
staleProjectCount: number;
stalenessThresholdMs: number;
```

- [ ] **Step 5: Write API test for staleness**

In `src/api/routes/__tests__/engines.test.ts`, add test:

- Insert a project with old engine check data (scannedAt = 30 days ago)
- Call `GET /api/engines/summary`
- Assert `staleProjectCount >= 1` and `projectSummaries[0].engineScanStale === true`

- [ ] **Step 6: Run yarn full and commit**

```bash
yarn format:fix && yarn lint:fix
yarn full
git add -A && git commit -m "feat: add stale engine scan detection to engines summary API"
```

---

### Task 5: Stale Engine Scan Detection (UI)

**Files:**

- Modify: `src/ui/presentation/Dashboard/Dashboard/components/EngineOverviewWidget.tsx`
- Modify: `src/ui/presentation/Projects/ProjectDetail/components/EngineStatusSection.tsx`
- Modify: `src/ui/presentation/Projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`
- Modify: `src/ui/presentation/Projects/ProjectDetail/ProjectDetailPresenter.ts`

**Interfaces:**

- Consumes: Extended `EnginesGateway.SummaryData` from Task 4
- Produces: Stale badge on dashboard widget, "Last scanned X days ago" on project detail

- [ ] **Step 1: Add stale badge to EngineOverviewWidget**

In `EngineOverviewWidget.tsx`, after the SimpleGrid, add:

```tsx
{
  summary && summary.staleProjectCount > 0 && (
    <Badge color="orange" variant="light" mt="sm">
      {summary.staleProjectCount} project{summary.staleProjectCount !== 1 ? "s" : ""} stale
    </Badge>
  );
}
```

- [ ] **Step 2: Add lastScannedAt to ProjectDetail engine data**

In `ProjectDetailPresenter` abstraction, add to `IProjectDetailEngineDataViewModel`:

```typescript
lastScannedAt: number | null;
engineScanStale: boolean;
engineScanStaleReason: "time" | "release" | "both" | null;
```

In `ProjectDetailPresenter` implementation, populate these fields from the engines summary data for the current project.

- [ ] **Step 3: Show staleness in EngineStatusSection**

In `EngineStatusSection.tsx`, add below the root status line:

```tsx
{
  engineData.lastScannedAt !== null && (
    <Text size="sm" c={engineData.engineScanStale ? "orange" : "dimmed"}>
      Last scanned {formatRelativeTime(engineData.lastScannedAt)}
      {engineData.engineScanStale && engineData.engineScanStaleReason && (
        <> — {formatStaleReason(engineData.engineScanStaleReason)}</>
      )}
    </Text>
  );
}
```

Add helper functions:

```typescript
function formatRelativeTime(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatStaleReason(reason: "time" | "release" | "both"): string {
  if (reason === "time") return "Scan older than 7 days";
  if (reason === "release") return "New Node release since last scan";
  return "Scan older than 7 days + new Node release";
}
```

- [ ] **Step 4: Run yarn full and commit**

```bash
yarn format:fix && yarn lint:fix
yarn full
git add -A && git commit -m "feat: show stale engine scan indicators in dashboard and project detail"
```

---

### Task 6: Bulk Scan API Endpoint

**Files:**

- Modify: `src/shared/routes/projects.ts`
- Modify: `src/api/routes/projects/projectBulkRoutes.ts` (or create if pattern differs)
- Test: `src/api/routes/__tests__/projects.test.ts` (or the appropriate test file)

**Interfaces:**

- Consumes: `upgradeJobs` table, `JobWorker.enqueue()`
- Produces: `POST /api/projects/bulk-scan` accepting `{ projectIds, force? }` returning `{ enqueuedCount, skippedCount }`

- [ ] **Step 1: Add route definition**

In `src/shared/routes/projects.ts`, add:

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

- [ ] **Step 2: Add route handler**

Find the correct route file for project bulk operations (check `src/api/routes/projects/projectBulkRoutes.ts`). The route handler receives the container via plugin options (same as all other route files). Resolve dependencies from container at the top of the function, then register the route:

```typescript
const databaseClient = container.resolve(DatabaseClient);
const jobWorker = container.resolve(JobWorker);

registerRoute(app, bulkScanProjectsRoute, {}, async (request, reply) => {
  const { projectIds, force } = request.body;
  let enqueuedCount = 0;
  let skippedCount = 0;

  for (const projectId of projectIds) {
    const activeJob = await databaseClient.db
      .select()
      .from(upgradeJobs)
      .where(
        and(
          eq(upgradeJobs.referenceId, projectId),
          eq(upgradeJobs.type, "scan"),
          inArray(upgradeJobs.status, ["pending", "running"])
        )
      )
      .get();

    if (activeJob && !force) {
      skippedCount++;
      continue;
    }

    await jobWorker.enqueue({
      referenceId: projectId,
      referenceType: "project",
      type: "scan"
    });
    enqueuedCount++;
  }

  reply.send({ enqueuedCount, skippedCount });
});
```

- [ ] **Step 3: Write API test**

Test: insert 3 projects, one with an active scan job. Call bulk-scan with all 3 IDs. Assert `enqueuedCount === 2, skippedCount === 1`.

- [ ] **Step 4: Run yarn full and commit**

```bash
yarn format:fix && yarn lint:fix
yarn full
git add -A && git commit -m "feat: add bulk scan API endpoint for multiple projects"
```

---

### Task 7: Bulk Scan UI (Project List Selection)

**Files:**

- Modify: `src/ui/features/Projects/abstractions/ProjectsGateway.ts`
- Modify: `src/ui/features/Projects/ProjectsGateway.ts`
- Modify: `src/ui/presentation/Projects/ProjectList/abstractions/ProjectListPresenter.ts`
- Modify: `src/ui/presentation/Projects/ProjectList/ProjectListPresenter.ts`
- Modify: `src/ui/presentation/Projects/ProjectList/components/ProjectListPage.tsx`
- Test: `src/ui/features/Projects/__tests__/ProjectsGateway.test.ts`

**Interfaces:**

- Consumes: `bulkScanProjectsRoute` from Task 6
- Produces: Checkbox selection on project list with "Scan selected (N)" button

- [ ] **Step 1: Add bulkScan to ProjectsGateway**

In abstraction, add:

```typescript
export interface IBulkScanResult {
  enqueuedCount: number;
  skippedCount: number;
}
```

Add to `IProjectsGateway`:

```typescript
bulkScan(projectIds: string[], force?: boolean): Promise<IBulkScanResult>;
```

Add to namespace: `export type BulkScanResult = IBulkScanResult;`

Implement in `ProjectsGateway.ts`:

```typescript
public async bulkScan(projectIds: string[], force?: boolean): Promise<ProjectsGateway.BulkScanResult> {
    return this.httpClient.request(bulkScanProjectsRoute, {
        params: {},
        body: { projectIds, force }
    });
}
```

- [ ] **Step 2: Add selection state to ProjectListPresenter**

In abstraction, add to `IProjectListViewModel`:

```typescript
selectedProjectIds: string[];
```

Add to `IProjectListPresenter`:

```typescript
toggleProjectSelection: (id: string) => void;
selectAllProjects: () => void;
deselectAllProjects: () => void;
bulkScanSelected: () => Promise<void>;
```

Implement with MobX `observable` Set, actions for toggle/selectAll/deselectAll, and `bulkScanSelected()` that calls gateway then shows notification.

- [ ] **Step 3: Add checkboxes and bulk bar to ProjectListPage**

In `ProjectListPage.tsx`:

- Add `Checkbox` column to the projects table
- Add select-all checkbox in the table header
- Show a bulk action bar when `selectedProjectIds.length > 0` with a "Scan selected (N)" button
- Toast notification on completion showing enqueued/skipped counts

- [ ] **Step 4: Write ProjectsGateway.bulkScan test**

Follow EnginesGateway test pattern — verify correct route and body are passed.

- [ ] **Step 5: Run yarn full and commit**

```bash
yarn format:fix && yarn lint:fix
yarn full
git add -A && git commit -m "feat: add bulk scan with project selection to project list"
```

---

### Task 8: Package Detail API Endpoint

**Files:**

- Modify: `src/shared/routes/packages.ts`
- Modify: `src/api/routes/packages.ts`
- Test: `src/api/routes/__tests__/packages.test.ts`

**Interfaces:**

- Consumes: `scan_results`, `dependencies`, `dependency_versions` tables
- Produces: `GET /api/packages/:packageName` returning package detail with project list

- [ ] **Step 1: Add route definition**

In `src/shared/routes/packages.ts`, add:

```typescript
const packageDetailProjectSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  currentVersion: z.string(),
  latestVersion: z.string(),
  upgradeType: z.string(),
  dependencyKind: z.string()
});

const packageDetailSchema = z.object({
  name: z.string(),
  repoUrl: z.string().nullable(),
  projects: z.array(packageDetailProjectSchema),
  latestVersion: z.string().nullable(),
  lastPublishedAt: z.number().nullable(),
  registryResolved: z.boolean()
});

export const getPackageDetailRoute = defineRoute({
  method: "GET",
  path: "/api/packages/:packageName",
  description: "Get detail for a single package across all projects",
  params: z.object({ packageName: z.string() }),
  response: z.object({ item: packageDetailSchema })
});
```

- [ ] **Step 2: Add route handler**

In `src/api/routes/packages.ts`, register AFTER `listPackagesRoute` (static `/api/packages` takes priority over parameterized `/api/packages/:packageName`):

The route file already imports `sendOne`, `sendError` and resolves `databaseClient` from container at the top (see existing `listPackagesRoute` handler for pattern). Use `const db = databaseClient.db` for convenience:

```typescript
registerRoute(app, getPackageDetailRoute, {}, async (request, reply) => {
  const { packageName } = request.params;
  const db = databaseClient.db;

  const scanRows = await db.all(sql`
        SELECT sr.project_id AS projectId, p.name AS projectName,
               sr.current_version AS currentVersion, sr.latest_version AS latestVersion,
               sr.upgrade_type AS upgradeType, sr.dependency_kind AS dependencyKind
        FROM scan_results sr
        JOIN projects p ON sr.project_id = p.id
        WHERE sr.name = ${packageName}
    `);

  if (scanRows.length === 0) {
    sendError({ reply, statusCode: 404, message: "Package not found" });
    return;
  }

  const depRow = await db
    .select({ repoUrl: dependencies.repoUrl })
    .from(dependencies)
    .where(eq(dependencies.name, packageName))
    .get();

  const versionRow = await db.get(sql`
        SELECT dv.version AS latestVersion, dv.published_at AS lastPublishedAt
        FROM dependency_versions dv
        JOIN dependencies d ON dv.dependency_id = d.id
        WHERE d.name = ${packageName}
        ORDER BY dv.published_at DESC
        LIMIT 1
    `);

  sendOne({
    reply,
    data: {
      name: packageName,
      repoUrl: depRow?.repoUrl ?? null,
      projects: scanRows,
      latestVersion: versionRow?.latestVersion ?? scanRows[0]?.latestVersion ?? null,
      lastPublishedAt: versionRow?.lastPublishedAt ?? null,
      registryResolved: true
    }
  });
});
```

- [ ] **Step 3: Write API test**

Insert scan results for two projects using the same package. Call `GET /api/packages/react`. Assert the response includes both projects with correct versions and upgrade types.

- [ ] **Step 4: Run yarn full and commit**

```bash
yarn format:fix && yarn lint:fix
yarn full
git add -A && git commit -m "feat: add package detail API endpoint"
```

---

### Task 9: Package Detail Page (UI)

**Files:**

- Modify: `src/ui/features/Packages/abstractions/PackagesGateway.ts`
- Modify: `src/ui/features/Packages/PackagesGateway.ts`
- Create: `src/ui/presentation/Packages/PackageDetail/abstractions/PackageDetailPresenter.ts`
- Create: `src/ui/presentation/Packages/PackageDetail/PackageDetailPresenter.ts`
- Create: `src/ui/presentation/Packages/PackageDetail/components/PackageDetailPage.tsx`
- Create: `src/ui/presentation/Packages/PackageDetail/PackageDetailRoute.tsx`
- Create: `src/ui/presentation/Packages/PackageDetail/feature.ts`
- Test: `src/ui/features/Packages/__tests__/PackagesGateway.test.ts`

**Interfaces:**

- Consumes: `getPackageDetailRoute` from Task 8, existing changelog/vulnerability/license routes
- Produces: `/packages/:packageName` page with header, projects table, changelog section, vulnerability section, license section

- [ ] **Step 1: Add getPackageDetail to PackagesGateway**

In abstraction, add a separate interface for detail projects (existing `IPackageProject` lacks `dependencyKind` and is used by list — don't modify it):

```typescript
export interface IPackageDetailProject {
  projectId: string;
  projectName: string;
  currentVersion: string;
  latestVersion: string;
  upgradeType: string;
  dependencyKind: string;
}

export interface IPackageDetail {
  name: string;
  repoUrl: string | null;
  projects: IPackageDetailProject[];
  latestVersion: string | null;
  lastPublishedAt: number | null;
  registryResolved: boolean;
}
```

Add to namespace: `export type PackageDetail = IPackageDetail;` and `export type PackageDetailProject = IPackageDetailProject;`

Add to `IPackagesGateway`:

```typescript
getPackageDetail(packageName: string): Promise<IPackageDetail>;
```

Implement in `PackagesGateway.ts`.

- [ ] **Step 2: Create PackageDetailPresenter abstraction**

Create `src/ui/presentation/Packages/PackageDetail/abstractions/PackageDetailPresenter.ts`:

- View model with: `loading`, `packageDetail`, `changelogs`, `changelogsResolving`, `vulnerabilities`, `licenses`
- Methods: `load(packageName)`, `reResolveChangelogs()`, `dispose()`

- [ ] **Step 3: Create PackageDetailPresenter implementation**

Create `src/ui/presentation/Packages/PackageDetail/PackageDetailPresenter.ts`:

- Constructor dependencies (injected via DI): `PackagesGateway.Interface`, `VulnerabilitiesGateway.Interface`, `LicensesGateway.Interface`
- On `load(packageName)`: call `packagesGateway.getPackageDetail(packageName)`, then in parallel load changelogs (compute from/to from min currentVersion / latestVersion), vulnerabilities (from `vulnerabilitiesGateway.list({ packageName })`), licenses (from `licensesGateway.list({ packageName })`)
- MobX observables for all view model fields
- Register with `createImplementation({ implementation: ..., dependencies: [PackagesGateway, VulnerabilitiesGateway, LicensesGateway] })`

- [ ] **Step 4: Create PackageDetailPage component**

Create `src/ui/presentation/Packages/PackageDetail/components/PackageDetailPage.tsx`:

- Header: package name as title, repo link (Anchor), latest version badge, last published date, ActionIcon back button
- Projects table: Table with columns for project name (link to `/projects/:projectId`), current version, latest version, upgrade type badge, dependency kind
- Changelog section: Accordion with version entries showing markdown content. Re-resolve button.
- Vulnerabilities section: Accordion listing vulnerabilities with severity badges
- License section: Simple text display of license info

- [ ] **Step 5: Create PackageDetailRoute and feature registration**

Create `PackageDetailRoute.tsx` following the existing `PackagesRoute.tsx` pattern — a class with `path = "/packages/:packageName"` and a `component` method that renders `PackageDetailPage`. Create `feature.ts` that registers the presenter implementation with the DI container (same pattern as `src/ui/presentation/Packages/PackageList/feature.ts`). Add the route to the routes array — find where `PackagesRoute` is imported and registered in `src/ui/infrastructure/Router/` and add `PackageDetailRoute` immediately after it. The parameterized `/packages/:packageName` route must come AFTER the exact `/packages` route in the array.

- [ ] **Step 6: Write PackagesGateway.getPackageDetail test**

Follow existing pattern — verify correct route and params.

- [ ] **Step 7: Run yarn full and commit**

```bash
yarn format:fix && yarn lint:fix
yarn full
git add -A && git commit -m "feat: add package detail page with changelog, vulnerabilities, and license sections"
```

---

### Task 10: Package Detail Navigation Links

**Files:**

- Modify: `src/ui/presentation/Packages/PackageList/components/columns/PackageName.tsx`
- Modify: `src/ui/presentation/Projects/ProjectDetail/components/DependencyTable.tsx`

**Interfaces:**

- Consumes: Package detail route from Task 9
- Produces: Clickable package names linking to `/packages/:packageName`

- [ ] **Step 1: Make PackageName column a link**

In `PackageName.tsx`, wrap the package name text in a link/anchor that navigates to `/packages/${packageName}`. Use the `navigate()` helper from `#ui/infrastructure/Router/router.js`. Prevent event propagation so it doesn't trigger row expand.

- [ ] **Step 2: Make DependencyTable package names linkable**

In `DependencyTable.tsx`, find where the dependency name is rendered. Make it clickable, navigating to `/packages/${dependency.name}`.

- [ ] **Step 3: Run yarn full and commit**

```bash
yarn format:fix && yarn lint:fix
yarn full
git add -A && git commit -m "feat: add navigation links to package detail page from packages list and project detail"
```
