# Scan Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split monolithic ScanJobExecutor into an orchestrator that chains focused child jobs (package-scan, vulnerability-scan, license-scan, graph-refresh), enabling parallel execution, individual progress tracking, and independent retry.

**Architecture:** ScanJobExecutor becomes a thin orchestrator that checks the lockfile exists, chains a sequential `package-scan` job, then chains `vulnerability-scan`, `license-scan`, and `graph-refresh` in parallel, optionally followed by `transitive-resolve`. New `waitForJob`/`waitForJobs` methods on JobWorker enable the orchestrator to block until children complete. Each child is a focused executor with its own logs, progress, and status.

**Tech Stack:** TypeScript, Drizzle ORM, @webiny/di, Vitest, Fastify

## Global Constraints

- Use `createAbstraction` + `createImplementation` pattern for all new executors (same as existing executors)
- Object params with named keys for functions with 2+ parameters
- Named interfaces, never inline structural types
- Use `yarn full` to validate (lint, format, typecheck, build, test)
- Use `npx drizzle-kit generate` for any schema changes
- All new job types must be added to `ICreateJobInput.type` union in `src/api/services/abstractions/JobWorker.ts`

---

### Task 1: Add waitForJob / waitForJobs / getRunningJobsForReference to JobWorker

**Files:**

- Modify: `src/api/services/abstractions/JobWorker.ts` (IJobWorker interface, add 3 methods)
- Modify: `src/api/services/JobWorker.ts` (implement 3 methods)
- Test: `src/api/services/__tests__/JobWorker.test.ts`

**Interfaces:**

- Consumes: `getJob(jobId)` (existing), `upgradeJobs` schema
- Produces: `waitForJob(jobId: string, signal?: AbortSignal): Promise<IJob>`, `waitForJobs(jobIds: string[], signal?: AbortSignal): Promise<IJob[]>`, `getRunningJobsForReference(params: { referenceId: string; type: string }): Promise<IJob[]>`

- [ ] **Step 1: Write failing tests for waitForJob**

In `src/api/services/__tests__/JobWorker.test.ts`, add a new `describe("waitForJob")` block. The test creates a job, sets it to running, then completes it in a setTimeout, and verifies `waitForJob` resolves with the completed job.

```typescript
describe("waitForJob", () => {
  it("resolves when the job reaches a terminal state", async () => {
    // Create project + enqueue a scan job
    const projectId = "wait-project";
    const projectPath = join(tmpdir(), `wait-test-${Date.now()}`);
    await createProject(db, projectId, projectPath);
    const jobId = await worker.enqueue({
      referenceId: projectId,
      referenceType: "project",
      type: "scan"
    });

    // Complete the job after 50ms
    setTimeout(async () => {
      await db
        .update(upgradeJobs)
        .set({ status: "completed", completedAt: Date.now() })
        .where(eq(upgradeJobs.id, jobId))
        .run();
    }, 50);

    const result = await worker.waitForJob(jobId);

    expect(result.status).toBe("completed");
    expect(result.id).toBe(jobId);
  });

  it("throws when the signal is aborted", async () => {
    const projectId = "abort-project";
    const projectPath = join(tmpdir(), `abort-test-${Date.now()}`);
    await createProject(db, projectId, projectPath);
    const jobId = await worker.enqueue({
      referenceId: projectId,
      referenceType: "project",
      type: "scan"
    });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);

    await expect(worker.waitForJob(jobId, controller.signal)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/api/services/__tests__/JobWorker.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — `waitForJob` does not exist

- [ ] **Step 3: Add method signatures to IJobWorker**

In `src/api/services/abstractions/JobWorker.ts`, add to `IJobWorker`:

```typescript
waitForJob(jobId: string, signal?: AbortSignal): Promise<IJob>;
waitForJobs(jobIds: string[], signal?: AbortSignal): Promise<IJob[]>;
getRunningJobsForReference(params: { referenceId: string; type: string }): Promise<IJob[]>;
```

Add new job types to the `type` union in `ICreateJobInput`:

```typescript
type:
    | "dependency"
    | "transient"
    | "packageManager"
    | "scan"
    | "clone"
    | "install"
    | "changelog"
    | "auto-fix-pr"
    | "transitive-resolve"
    | "package-scan"
    | "vulnerability-scan"
    | "license-scan"
    | "graph-refresh";
```

- [ ] **Step 4: Implement waitForJob, waitForJobs, getRunningJobsForReference in JobWorker**

In `src/api/services/JobWorker.ts`, add these methods to `JobWorkerImpl`:

```typescript
public async waitForJob(jobId: string, signal?: AbortSignal): Promise<Abstraction.Job> {
    while (true) {
        if (signal?.aborted) {
            throw new Error("Job wait aborted");
        }

        const job = await this.getJob(jobId);
        if (!job) {
            throw new Error(`Job not found: ${jobId}`);
        }

        if (
            job.status === "completed" ||
            job.status === "failed" ||
            job.status === "cancelled" ||
            job.status === "interrupted"
        ) {
            return job;
        }

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 1000);
            if (signal) {
                const onAbort = (): void => {
                    clearTimeout(timer);
                    reject(new Error("Job wait aborted"));
                };
                signal.addEventListener("abort", onAbort, { once: true });
            }
        });
    }
}

public async waitForJobs(jobIds: string[], signal?: AbortSignal): Promise<Abstraction.Job[]> {
    return Promise.all(jobIds.map(id => this.waitForJob(id, signal)));
}

public async getRunningJobsForReference(params: {
    referenceId: string;
    type: string;
}): Promise<Abstraction.Job[]> {
    return this.databaseClient.db
        .select()
        .from(upgradeJobs)
        .where(
            and(
                eq(upgradeJobs.referenceId, params.referenceId),
                eq(upgradeJobs.type, params.type),
                eq(upgradeJobs.status, "running")
            )
        )
        .all();
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/api/services/__tests__/JobWorker.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 6: Run full check**

Run: `yarn full`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/api/services/abstractions/JobWorker.ts src/api/services/JobWorker.ts src/api/services/__tests__/JobWorker.test.ts
git commit -m "feat: add waitForJob, waitForJobs, getRunningJobsForReference to JobWorker"
```

---

### Task 2: Extract PackageScanJobExecutor

**Files:**

- Create: `src/api/services/jobExecutors/abstractions/PackageScanJobExecutor.ts`
- Create: `src/api/services/jobExecutors/PackageScanJobExecutor.ts`
- Create: `src/api/services/jobExecutors/__tests__/PackageScanJobExecutor.test.ts`

**Interfaces:**

- Consumes: `ScanService.scan()`, `DependencyChangeService.detectAndPersist()`, `PackageManagerService.getVersion()`, `DatabaseClient`, `WebSocketBroadcaster`, `ErrorReporter` (SecurityService stays in ScanService.scan() which already calls it internally)
- Produces: `type = "package-scan"` executor. Writes to `scan_results` table, updates `projects` row, stores `warning` on job row if 0 deps found.

- [ ] **Step 1: Create abstraction**

Create `src/api/services/jobExecutors/abstractions/PackageScanJobExecutor.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IPackageScanJobExecutor extends JobExecutor.Interface {}

export const PackageScanJobExecutor = createAbstraction<IPackageScanJobExecutor>(
  "Api/PackageScanJobExecutor"
);

export namespace PackageScanJobExecutor {
  export type Interface = IPackageScanJobExecutor;
}
```

- [ ] **Step 2: Create implementation**

Create `src/api/services/jobExecutors/PackageScanJobExecutor.ts` — extract from `ScanJobExecutor.ts`:

- `type = "package-scan"`
- Move: `hasPackageJsonDeps()`, `resolveMinimalAgeSeconds()`, `insertChangelogPlaceholders()` (private methods)
- Move: the `execute()` body that does: parse packagesJson for force flag, collect installed packages via `ScanService.scan()`, detect dependency changes, delete+insert scan_results, insert changelog placeholders, update project row (lastScannedAt, packageManager, pmVersion), check 0-dep warning, store warning on job row
- Do NOT include: vulnerability scan, license scan, graph refresh, health snapshot — those move to other executors
- Keep `scan:progress` WebSocket broadcast during registry lookups (inside `ScanService.scan()` callback)
- Dependencies: `ScanService`, `SecurityService`, `PackageManagerService`, `DatabaseClient`, `WebSocketBroadcaster`, `ErrorReporter`

The `execute()` method structure:

1. Parse force flag from `context.packagesJson`
2. Resolve minimal age seconds
3. Call `ScanService.scan()` with progress callback that broadcasts `scan:progress`
4. Detect dependency changes
5. Delete + insert scan_results
6. Insert changelog placeholders
7. Get PM version, update project row
8. Check `hasPackageJsonDeps()` — if 0 results but has deps, set warning on job row

- [ ] **Step 3: Write tests**

Create `src/api/services/jobExecutors/__tests__/PackageScanJobExecutor.test.ts` — adapt relevant tests from `ScanJobExecutor.test.ts`:

- Test that scan results are persisted to scan_results table with correct fields
- Test that force flag is passed through to ScanService (bypasses registry cache)
- Test that scan:progress WebSocket events are broadcast during registry lookups
- Test that dependency changes are detected and persisted
- Test that warning is set on job row when 0 deps found but package.json has deps
- Test that no warning when 0 deps and package.json is empty
- Test that changelog placeholders are inserted for upgradeable versions
- Test that project row is updated with lastScannedAt, packageManager, pmVersion

- [ ] **Step 4: Register in DI**

In `src/api/feature.ts`, add import and registration:

```typescript
import { PackageScanJobExecutor } from "./services/jobExecutors/PackageScanJobExecutor.js";
// ...
container.register(PackageScanJobExecutor);
```

In `src/api/services/jobExecutors/JobExecutorRegistry.ts`, add to constructor and dependencies:

```typescript
import { PackageScanJobExecutor } from "./abstractions/PackageScanJobExecutor.js";
// constructor parameter:
packageScanJobExecutor: PackageScanJobExecutor.Interface,
// in all array:
packageScanJobExecutor,
// in dependencies array:
PackageScanJobExecutor,
```

- [ ] **Step 5: Run full check**

Run: `yarn full`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/api/services/jobExecutors/abstractions/PackageScanJobExecutor.ts src/api/services/jobExecutors/PackageScanJobExecutor.ts src/api/services/jobExecutors/__tests__/PackageScanJobExecutor.test.ts src/api/services/jobExecutors/JobExecutorRegistry.ts src/api/feature.ts
git commit -m "feat: extract PackageScanJobExecutor from ScanJobExecutor"
```

---

### Task 3: Extract VulnerabilityScanJobExecutor

**Files:**

- Create: `src/api/services/jobExecutors/abstractions/VulnerabilityScanJobExecutor.ts`
- Create: `src/api/services/jobExecutors/VulnerabilityScanJobExecutor.ts`
- Create: `src/api/services/jobExecutors/__tests__/VulnerabilityScanJobExecutor.test.ts`

**Interfaces:**

- Consumes: `VulnerabilityService.scan()`, `ScanService.collectInstalledVersions()` (via LockfileParserService), `DatabaseClient` (scan_results for stats), `healthSnapshots` table
- Produces: `type = "vulnerability-scan"` executor. Runs vulnerability scan, computes health score from scan_results stats + vulnerability counts, upserts health_snapshots row.

- [ ] **Step 1: Create abstraction**

Same pattern as PackageScanJobExecutor — `createAbstraction<IVulnerabilityScanJobExecutor>("Api/VulnerabilityScanJobExecutor")`.

- [ ] **Step 2: Create implementation**

`type = "vulnerability-scan"`. The `execute()` method:

1. Read project from DB (need project path + packageManager for audit)
2. Collect installed versions from lockfile (via `LockfileParserService.parse()`)
3. Call `VulnerabilityService.scan({ projectId, projectPath, packageManager, allInstalledVersions })`
4. Query scan_results for resolved package stats: count upToDate/patch/minor/major
5. Compute health score: `baseScore = (upToDate / totalPackages) * 100 - vulnerabilityPenalty`
6. Upsert health_snapshots row with score + vulnerability counts
7. Log results via `context.appendLog()`

Dependencies: `VulnerabilityService`, `LockfileParserService`, `DatabaseClient`, `PackageManagerDriverRegistry`

- [ ] **Step 3: Write tests**

- Test that VulnerabilityService.scan() is called with project path, packageManager, and installed versions from lockfile
- Test that health snapshot is created with correct score (baseScore - vulnerabilityPenalty)
- Test that vulnerability counts (critical/high/moderate/low) are stored on snapshot
- Test that score is clamped at 0 when penalty exceeds base
- Test that score is 100 when no packages exist (0 resolved)
- Test that scan failure does not throw (non-fatal, executor catches internally)

- [ ] **Step 4: Register in DI** (same pattern as Task 2)

- [ ] **Step 5: Run full check and commit**

```bash
git commit -m "feat: extract VulnerabilityScanJobExecutor with health snapshot"
```

---

### Task 4: Extract LicenseScanJobExecutor

**Files:**

- Create: `src/api/services/jobExecutors/abstractions/LicenseScanJobExecutor.ts`
- Create: `src/api/services/jobExecutors/LicenseScanJobExecutor.ts`
- Create: `src/api/services/jobExecutors/__tests__/LicenseScanJobExecutor.test.ts`

**Interfaces:**

- Consumes: `LicenseCheckerService.scan()`, `LicensePolicyService.evaluate()`, `LicensePolicyService.getComplianceStatus()`, `DatabaseClient`
- Produces: `type = "license-scan"` executor. Detects licenses, evaluates policy, creates license snapshot, broadcasts `license-scan:complete`, emits `license-scan:completed`.

- [ ] **Step 1: Create abstraction**

Same pattern — `createAbstraction<ILicenseScanJobExecutor>("Api/LicenseScanJobExecutor")`.

- [ ] **Step 2: Create implementation**

Extract `runLicenseScan()` from current ScanJobExecutor into `execute()`. The method:

1. Read project from DB for packageManager
2. Call `LicenseCheckerService.scan({ projectId, packageManager })`
3. Upsert license rows, delete stale ones (scannedAt < current run)
4. Evaluate license policy
5. Get compliance status and upsert license_snapshots
6. Broadcast `license-scan:complete` WebSocket event
7. Emit `license-scan:completed` EventBus event

Dependencies: `LicenseCheckerService`, `LicensePolicyService`, `DatabaseClient`, `WebSocketBroadcaster`, `EventBus`

Note: The `declare module` for `license-scan:completed` EventBus event moves from ScanJobExecutor to this file.

- [ ] **Step 3: Write tests**

- Test that LicenseCheckerService.scan() is called with projectId and packageManager
- Test that license rows are upserted and stale licenses deleted
- Test that LicensePolicyService.evaluate() is called after scan
- Test that license snapshot is created with compliance counts
- Test that `license-scan:complete` WebSocket event is broadcast
- Test that `license-scan:completed` EventBus event is emitted

- [ ] **Step 4: Register in DI**

- [ ] **Step 5: Run full check and commit**

```bash
git commit -m "feat: extract LicenseScanJobExecutor from ScanJobExecutor"
```

---

### Task 5: Extract GraphRefreshJobExecutor

**Files:**

- Create: `src/api/services/jobExecutors/abstractions/GraphRefreshJobExecutor.ts`
- Create: `src/api/services/jobExecutors/GraphRefreshJobExecutor.ts`
- Create: `src/api/services/jobExecutors/__tests__/GraphRefreshJobExecutor.test.ts`

**Interfaces:**

- Consumes: `DependencyGraphService.refreshGraph()`
- Produces: `type = "graph-refresh"` executor. Parses lockfile into dependency_edges table.

- [ ] **Step 1: Create abstraction**

Same pattern — `createAbstraction<IGraphRefreshJobExecutor>("Api/GraphRefreshJobExecutor")`.

- [ ] **Step 2: Create implementation**

Simplest executor — `execute()`:

1. Read project from DB for path + packageManager
2. Call `DependencyGraphService.refreshGraph(referenceId, projectPath, packageManager)`
3. Log edge count via `context.appendLog()`

Dependencies: `DependencyGraphService`, `DatabaseClient`

- [ ] **Step 3: Write tests**

- Test that DependencyGraphService.refreshGraph() is called with projectId, projectPath, packageManager
- Test that edge count is logged via appendLog
- Test that missing project in DB throws (project not found)

- [ ] **Step 4: Register in DI**

- [ ] **Step 5: Run full check and commit**

```bash
git commit -m "feat: extract GraphRefreshJobExecutor from ScanJobExecutor"
```

---

### Task 6: Rewrite ScanJobExecutor as orchestrator

**Files:**

- Modify: `src/api/services/jobExecutors/ScanJobExecutor.ts` (complete rewrite)
- Modify: `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts` (complete rewrite)

**Interfaces:**

- Consumes: `JobWorker.enqueue()`, `JobWorker.waitForJob()`, `JobWorker.waitForJobs()`, `JobWorker.getRunningJobsForReference()`, `JobWorker.cancelJob()`, `PackageManagerDriverRegistry.getDriver()`, `WebSocketBroadcaster`, `EventBus`, `DatabaseClient`
- Produces: `type = "scan"` orchestrator. Checks lockfile, chains children, waits, broadcasts `scan:complete`.

- [ ] **Step 1: Rewrite ScanJobExecutor**

Replace the entire `ScanJobExecutorImpl` class. Remove all extracted methods (`hasPackageJsonDeps`, `resolveMinimalAgeSeconds`, `insertChangelogPlaceholders`, `runLicenseScan`, vulnerability scan logic, health snapshot logic). New implementation:

- Constructor dependencies: `JobWorker`, `PackageManagerDriverRegistry`, `WebSocketBroadcaster`, `EventBus`, `DatabaseClient`
- `type = "scan"`
- Import `existsSync` from `"fs"` and `join` from `"path"` for lockfile check
- Keep `declare module "../abstractions/EventBus.js"` for `scan:completed` event (license-scan:completed moves to LicenseScanJobExecutor)
- `execute()` implementation:
  1. Concurrent scan guard: `getRunningJobsForReference({ referenceId: context.referenceId, type: "scan" })`, filter out `context.jobId` to avoid self-match
  2. Check lockfile exists via `existsSync(join(context.projectPath, driver.lockfileName))`
  3. Enqueue `package-scan` with `context.packagesJson`, wait via `waitForJob`
  4. If package-scan failed, throw
  5. Enqueue `vulnerability-scan`, `license-scan`, `graph-refresh` (no packagesJson)
  6. Query `countUnresolvedTransitives()`, if > 0: call `markStaleTransitiveDepsUnresolved()` then enqueue `transitive-resolve`
  7. Wait for all parallel children via `waitForJobs`
  8. Compose warning: if any child failed, list failed types; else use package-scan's warning
  9. Broadcast `scan:complete`, emit `scan:completed`
  10. Catch block: cancel all children via `cancelJob()`, broadcast `scan:failed`, rethrow
- Private helpers: `countUnresolvedTransitives(referenceId)` (queries scan_results COUNT where registryResolved=0), `markStaleTransitiveDepsUnresolved(referenceId, appendLog)` (moved from JobWorker — reads transitive-resolve-ttl setting, flips stale rows)

Update `createImplementation` dependencies to: `JobWorker`, `PackageManagerDriverRegistry`, `WebSocketBroadcaster`, `EventBus`, `DatabaseClient`

- [ ] **Step 2: Rewrite tests**

Replace `ScanJobExecutor.test.ts` with tests for the orchestrator:

- Mock `JobWorker` with `enqueue`, `waitForJob`, `waitForJobs`, `getRunningJobsForReference`, `cancelJob`, `getJob`
- Test: lockfile missing → throws, broadcasts `scan:failed`, no children enqueued
- Test: concurrent scan detected → throws with "Scan already running"
- Test: happy path → package-scan enqueued first with correct packagesJson, waited, then 3 parallel children enqueued, all waited
- Test: package-scan fails → throws, no parallel children enqueued, broadcasts `scan:failed`
- Test: parallel child fails → orchestrator completes, warning lists failed child types
- Test: AbortSignal aborted → all children cancelled via `cancelJob()`
- Test: `scan:complete` broadcast includes warning from package-scan when no children fail
- Test: transitive-resolve only enqueued when unresolved count > 0
- Test: transitive-resolve NOT enqueued when all transitives resolved

- [ ] **Step 3: Run full check**

Run: `yarn full`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/api/services/jobExecutors/ScanJobExecutor.ts src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts
git commit -m "refactor: rewrite ScanJobExecutor as orchestrator"
```

---

### Task 7: Remove chainTransitiveResolveAfterScanIfNeeded from JobWorker + update UI

**Files:**

- Modify: `src/api/services/JobWorker.ts` (remove `chainTransitiveResolveAfterScanIfNeeded`, `markStaleTransitiveDepsUnresolved`, and their call from `executeJob`)
- Modify: `src/api/services/__tests__/JobWorker.test.ts` (remove/update affected tests)
- Modify: `src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx` (add new job types to TYPE_OPTIONS)

**Interfaces:**

- Consumes: none
- Produces: cleaner JobWorker, UI shows all job types

- [ ] **Step 1: Remove chaining methods from JobWorker**

In `src/api/services/JobWorker.ts`:

- Remove `chainTransitiveResolveAfterScanIfNeeded()` method
- Remove `markStaleTransitiveDepsUnresolved()` method
- In `executeJob()`, remove the call to `chainTransitiveResolveAfterScanIfNeeded`
- Keep `chainRefreshTransientIfNeeded` and `chainScanAfterJobIfNeeded`

- [ ] **Step 2: Update JobWorker tests**

Remove tests that verify `chainTransitiveResolveAfterScanIfNeeded` behavior. Keep tests for `chainScanAfterJobIfNeeded` and `chainRefreshTransientIfNeeded`.

- [ ] **Step 3: Add new job types to UI**

In `src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx`, update `TYPE_OPTIONS`:

```typescript
const TYPE_OPTIONS = [
  { label: "Scan", value: "scan" },
  { label: "Package Scan", value: "package-scan" },
  { label: "Dependency", value: "dependency" },
  { label: "Transient", value: "transient" },
  { label: "Transitive Resolve", value: "transitive-resolve" },
  { label: "Vulnerability Scan", value: "vulnerability-scan" },
  { label: "License Scan", value: "license-scan" },
  { label: "Graph Refresh", value: "graph-refresh" },
  { label: "Install", value: "install" },
  { label: "Clone", value: "clone" },
  { label: "Package Manager", value: "packageManager" },
  { label: "Changelog", value: "changelog" },
  { label: "Auto-Fix PR", value: "auto-fix-pr" }
];
```

- [ ] **Step 4: Run full check**

Run: `yarn full`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/api/services/JobWorker.ts src/api/services/__tests__/JobWorker.test.ts src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx
git commit -m "refactor: remove transitive-resolve chaining from JobWorker, add job types to UI"
```
