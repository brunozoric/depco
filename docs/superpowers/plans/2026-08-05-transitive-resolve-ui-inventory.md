# Transitive Resolve + UI Inventory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Background job resolves transitive dep registry data. API filters by dependencyKind. UI shows dependency kind badges and pending indicators.

**Architecture:** New TransitiveResolveJobExecutor follows existing 5-step executor pattern. JobWorker chains it after scan when unresolved deps exist. API routes add dependencyKind/registryResolved query params. UI adds filter dropdown and status badges via existing UrlFilterService pattern.

**Tech Stack:** Fastify, Drizzle, MobX, Mantine, Vitest, WebSocket

## Global Constraints

- Use `yarn full` for all checks (lint, format, typecheck, build, tests)
- Named interfaces only — no inline structural types
- Object params with named keys when function has 2+ params
- Full words in identifiers
- Never import *Impl outside its own file — use abstractions + DI container

---

### Task 1: TransitiveResolveJobExecutor — abstraction + implementation

**Files:**

- Create: `src/api/services/jobExecutors/abstractions/TransitiveResolveJobExecutor.ts`
- Create: `src/api/services/jobExecutors/TransitiveResolveJobExecutor.ts`
- Test: `src/api/services/jobExecutors/__tests__/TransitiveResolveJobExecutor.test.ts`

**Interfaces:**

- Consumes: `RegistryCacheService.getPackageInfo()`, `DatabaseClient`, `scanResults` table with `registryResolved` column, `IJobExecutionContext.setProgress`
- Produces: `TransitiveResolveJobExecutor` with `type = "transitive-resolve"`, resolves transitive deps' registry data

- [ ] **Step 1: Create abstraction**

Create `src/api/services/jobExecutors/abstractions/TransitiveResolveJobExecutor.ts` following existing pattern (e.g. ScanJobExecutor abstraction):

```typescript
import { createAbstraction } from "#shared/index.js";
import type { IJobExecutor } from "./JobExecutor.js";

export interface ITransitiveResolveJobExecutor extends IJobExecutor {
  readonly type: "transitive-resolve";
}

export const TransitiveResolveJobExecutor = createAbstraction<ITransitiveResolveJobExecutor>(
  "Api/TransitiveResolveJobExecutor"
);

export namespace TransitiveResolveJobExecutor {
  export type Interface = ITransitiveResolveJobExecutor;
}
```

- [ ] **Step 2: Write failing tests**

Create `src/api/services/jobExecutors/__tests__/TransitiveResolveJobExecutor.test.ts`. Follow existing executor test patterns. Key tests:

```typescript
describe("TransitiveResolveJobExecutor", () => {
  it("resolves unresolved transitive deps with registry data", async () => {
    // Insert project + scan_results with registryResolved=0 for transitive deps
    // Mock RegistryCacheService.getPackageInfo to return version info
    // Execute
    // Assert: scan_results rows updated with latestVersion, upgradeType, registryResolved=1
  });

  it("skips when no unresolved transitive deps exist", async () => {
    // Insert project + scan_results with registryResolved=1
    // Execute
    // Assert: no DB updates, no errors
  });

  it("reports progress during resolution", async () => {
    // Insert 5 unresolved transitive deps
    // Execute
    // Assert: setProgress called with increasing percent values
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn full`

- [ ] **Step 4: Implement executor**

Create `src/api/services/jobExecutors/TransitiveResolveJobExecutor.ts`:

```typescript
import { eq, and } from "drizzle-orm";
import semver from "semver";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { TransitiveResolveJobExecutor as Abstraction } from "./abstractions/TransitiveResolveJobExecutor.js";
import { RegistryCacheService } from "../abstractions/RegistryCacheService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { scanResults } from "#api/db/schema.js";

const LOOKUP_CONCURRENCY = 10;

class TransitiveResolveJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "transitive-resolve" as const;

  public constructor(
    private readonly registryCacheService: RegistryCacheService.Interface,
    private readonly databaseClient: DatabaseClient.Interface
  ) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    const { db } = this.databaseClient;
    const unresolved = await db
      .select()
      .from(scanResults)
      .where(
        and(eq(scanResults.projectId, context.referenceId), eq(scanResults.registryResolved, 0))
      )
      .all();

    if (unresolved.length === 0) {
      context.appendLog("No unresolved transitive dependencies.");
      return;
    }

    context.appendLog(`Resolving ${unresolved.length} transitive dependencies...`);
    let processed = 0;
    const total = unresolved.length;

    for (let i = 0; i < unresolved.length; i += LOOKUP_CONCURRENCY) {
      const batch = unresolved.slice(i, i + LOOKUP_CONCURRENCY);
      const infos = await Promise.all(
        batch.map(async row => {
          const info = await this.registryCacheService.getPackageInfo(
            row.name,
            context.packageManager
          );
          processed++;
          context.setProgress({
            percent: Math.round((processed / total) * 95),
            label: `Resolving transitive: ${processed}/${total}`
          });
          return { row, info };
        })
      );

      for (const { row, info } of infos) {
        const latestVersion = info.latestVersion || row.currentVersion;
        const upgradeType = classifyUpgrade(row.currentVersion, latestVersion);

        await db
          .update(scanResults)
          .set({
            latestVersion,
            latestInRange: row.currentVersion,
            upgradeType,
            registryResolved: 1
          })
          .where(eq(scanResults.id, row.id))
          .run();
      }
    }

    context.setProgress({ percent: 100, label: "Resolution complete" });
    context.appendLog(`Resolved ${total} transitive dependencies.`);
  }
}
```

Note: `classifyUpgrade` is a private function in ScanService. Either extract to shared utility or duplicate logic. Check if it can be imported — if not, duplicate the small function.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn full`

- [ ] **Step 6: Commit**

```bash
git add src/api/services/jobExecutors/abstractions/TransitiveResolveJobExecutor.ts src/api/services/jobExecutors/TransitiveResolveJobExecutor.ts src/api/services/jobExecutors/__tests__/TransitiveResolveJobExecutor.test.ts
git commit -m "feat(jobs): add TransitiveResolveJobExecutor for background registry resolution"
```

---

### Task 2: Register executor + chain from JobWorker after scan

**Files:**

- Modify: `src/api/feature.ts` — register TransitiveResolveJobExecutor in DI
- Modify: `src/api/services/jobExecutors/JobExecutorRegistry.ts` — add 9th executor param
- Modify: `src/api/services/abstractions/JobWorker.ts` — add "transitive-resolve" to ICreateJobInput.type union
- Modify: `src/api/services/JobWorker.ts` — add chainTransitiveResolveAfterScanIfNeeded()
- Modify: `src/shared/websocket/types.ts` — add transitive-resolve:complete event
- Test: verify chain logic via integration test

**Interfaces:**

- Consumes: TransitiveResolveJobExecutor from Task 1
- Produces: "transitive-resolve" job auto-enqueued after scan when unresolved deps exist

- [ ] **Step 1: Add to ICreateJobInput type union**

In `src/api/services/abstractions/JobWorker.ts`, add `"transitive-resolve"` to the type field's union.

- [ ] **Step 2: Add to JobExecutorRegistry**

In `src/api/services/jobExecutors/JobExecutorRegistry.ts`, add `TransitiveResolveJobExecutor` as 9th constructor parameter and register in the executors array.

- [ ] **Step 3: Register in DI**

In `src/api/feature.ts`, import and register `TransitiveResolveJobExecutor` implementation. Add to the JobExecutorRegistry dependencies list.

- [ ] **Step 4: Add WebSocket event type**

In `src/shared/websocket/types.ts`:

```typescript
export interface WSTransitiveResolveComplete {
  projectId: string;
  resolved: number;
}
```

Add to WSEventMap: `"transitive-resolve:complete": WSTransitiveResolveComplete`

- [ ] **Step 5: Add chain method to JobWorker**

In `src/api/services/JobWorker.ts`, add after `chainScanAfterJobIfNeeded`:

```typescript
private async chainTransitiveResolveAfterScanIfNeeded(
    job: Abstraction.Job,
    appendLog: (line: string) => void
): Promise<void> {
    if (job.type !== "scan") {
        return;
    }

    const unresolvedCount = await this.databaseClient.db
        .select({ count: sql<number>`count(*)` })
        .from(scanResults)
        .where(
            and(
                eq(scanResults.projectId, job.referenceId),
                eq(scanResults.registryResolved, 0)
            )
        )
        .get();

    if (!unresolvedCount || unresolvedCount.count === 0) {
        return;
    }

    appendLog(`Enqueuing transitive registry resolution for ${unresolvedCount.count} packages...`);
    await this.enqueue({
        type: "transitive-resolve",
        referenceId: job.referenceId,
        referenceType: job.referenceType
    });
}
```

Call this method from `executeJob()` after the existing chain calls (after `chainScanAfterJobIfNeeded` at line ~194).

- [ ] **Step 6: Run full checks**

Run: `yarn full`

- [ ] **Step 7: Commit**

```bash
git add src/api/feature.ts src/api/services/jobExecutors/JobExecutorRegistry.ts src/api/services/abstractions/JobWorker.ts src/api/services/JobWorker.ts src/shared/websocket/types.ts
git commit -m "feat(jobs): register TransitiveResolveJobExecutor and chain after scan"
```

---

### Task 3: API route changes — dependencyKind and registryResolved filters

**Files:**

- Modify: `src/shared/routes/projects.ts` — add dependencyKind/registryResolved to dependencies route querystring + response schema
- Modify: `src/shared/routes/packages.ts` — add dependencyKind to packages route querystring
- Modify: `src/api/routes/projects.ts` — add filter logic to dependencies handler
- Modify: `src/api/routes/packages.ts` — add filter logic to packages handler
- New: transitive-resolve-status route (definition + handler)
- Test: `src/api/routes/__tests__/projects.test.ts` or `packages.test.ts`

**Interfaces:**

- Consumes: `scanResults` table with `dependencyKind`, `registryResolved` columns
- Produces: Filtered API responses with dependencyKind/registryResolved fields

- [ ] **Step 1: Update route definitions**

In `src/shared/routes/projects.ts`, add to `getProjectDependenciesRoute` querystring:

```typescript
dependencyKind: z.enum(["all", "dependency", "devDependency", "peerDependency", "optionalDependency", "transitive"]).optional(),
registryResolved: z.enum(["all", "true", "false"]).optional()
```

Add to `dependencySchema`:

```typescript
dependencyKind: z.string(),
registryResolved: z.boolean()
```

Make `latestVersion`, `latestInRange`, `upgradeType` nullable in `dependencySchema`.

In `src/shared/routes/packages.ts`, add `dependencyKind` to `listPackagesRoute` querystring.

- [ ] **Step 2: Create transitive-resolve-status route definition**

Add to `src/shared/routes/projects.ts` (or new file):

```typescript
export const getTransitiveResolveStatusRoute = defineRoute({
  method: "GET",
  path: "/api/projects/:id/transitive-resolve-status",
  description: "Get transitive dependency resolution status",
  params: z.object({ id: z.string() }),
  response: z.object({
    total: z.number(),
    resolved: z.number(),
    pending: z.number()
  })
});
```

- [ ] **Step 3: Implement filters in route handlers**

In `src/api/routes/projects.ts` dependencies handler, add WHERE conditions for dependencyKind and registryResolved. Include new columns in response.

In `src/api/routes/packages.ts` handler, add dependencyKind to WHERE conditions.

Implement transitive-resolve-status handler: count scan_results by registryResolved for the project.

- [ ] **Step 4: Write tests**

Test dependencyKind filter returns only matching kinds. Test registryResolved filter. Test transitive-resolve-status returns correct counts.

- [ ] **Step 5: Run full checks**

Run: `yarn full`

- [ ] **Step 6: Commit**

```bash
git add src/shared/routes/ src/api/routes/
git commit -m "feat(api): add dependencyKind and registryResolved filters to dependency routes"
```

---

### Task 4: Packages page UI — dependencyKind filter + pending badge

**Files:**

- Modify: `src/ui/features/packages/abstractions/PackagesGateway.ts` — add dependencyKind to filter interface + item interface
- Modify: `src/ui/features/packages/PackagesGateway.ts` — map dependencyKind in gateway
- Modify: `src/ui/presentation/packages/PackageList/PackagesPresenter.ts` — add dependencyKind to FILTER_SCHEMA + buildFilters
- Modify: `src/ui/presentation/packages/PackageList/components/PackagesPage.tsx` — add filter dropdown + pending badge

**Interfaces:**

- Consumes: Updated `listPackagesRoute` with `dependencyKind` param
- Produces: Packages page with dependencyKind filter dropdown and "Pending" badge on unresolved items

- [ ] **Step 1: Update gateway interfaces**

Add `dependencyKind?: string` to `IPackageListFilters`. Add `dependencyKind: string` and `registryResolved: boolean` to package item interface.

- [ ] **Step 2: Update presenter**

Add `dependencyKind` to FILTER_SCHEMA Zod object. Add `setDependencyKind` setter. Add to `buildFilters()`.

- [ ] **Step 3: Add filter dropdown to PackagesPage**

Add a Select component for dependency kind (All/Direct/Dev/Peer/Optional/Transitive). Follow existing filter patterns (e.g. upgradeType filter).

Add "Pending" Badge to package rows where `registryResolved === false`.

- [ ] **Step 4: Run full checks**

Run: `yarn full`

- [ ] **Step 5: Commit**

```bash
git add src/ui/features/packages/ src/ui/presentation/packages/
git commit -m "feat(ui): add dependencyKind filter and pending badge to packages page"
```

---

### Task 5: Project detail UI — kind column + filter + resolving state

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/components/DependencyTable.tsx` — add Kind column, pending indicator
- Modify: project detail presenter (if filters exist) or add new filter UI

**Interfaces:**

- Consumes: Updated dependencies route response with dependencyKind/registryResolved
- Produces: Dependency table with Kind badge column and "Resolving..." text for unresolved deps

- [ ] **Step 1: Update DependencyTable**

Add "Kind" column with colored Badge per kind. Show "Resolving..." for null latestVersion when registryResolved is false. Hide Upgrade button for unresolved deps.

- [ ] **Step 2: Add filter if needed**

If project detail has filter UI, add dependencyKind filter. Otherwise, show all kinds with the Kind column distinguishing them.

- [ ] **Step 3: Run full checks**

Run: `yarn full`

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/projects/ProjectDetail/
git commit -m "feat(ui): add dependency kind column and resolving state to project detail"
```

---

### Task 6: Subscribe to transitive-resolve:complete for auto-refresh

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts` — subscribe to transitive-resolve:complete, refresh dependencies
- Modify: `src/ui/presentation/packages/PackageList/PackagesPresenter.ts` — subscribe to transitive-resolve:complete, refresh packages

**Interfaces:**

- Consumes: `transitive-resolve:complete` WebSocket event
- Produces: Packages and dependencies auto-refresh when transitive resolution completes

- [ ] **Step 1: Add subscription to ProjectDetailPresenter**

Subscribe to `transitive-resolve:complete` event. On event, if projectId matches current project, reload dependencies.

- [ ] **Step 2: Add subscription to PackagesPresenter**

Subscribe to `transitive-resolve:complete` event. On event, reload packages list.

- [ ] **Step 3: Run full checks**

Run: `yarn full`

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/projects/ProjectDetail/ src/ui/presentation/packages/
git commit -m "feat(ui): auto-refresh on transitive-resolve:complete event"
```
