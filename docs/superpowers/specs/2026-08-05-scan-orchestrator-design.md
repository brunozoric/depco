# Scan Orchestrator — Job Splitting Design

## Problem

ScanJobExecutor is a monolith: lockfile parse, registry lookups, vulnerability scan, license scan, changelog placeholders, graph refresh, health snapshot — all in one sequential job. No individual progress visibility, no individual retry, no parallelism between independent phases. If license scan is slow, vulnerability scan waits even though they're independent.

## Design

### New job types

Split the current scan into focused child jobs:

| Job type             | What it does                                                                                                                                                                                        | Dependencies                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `scan`               | **Orchestrator only** — checks lockfile, chains children, waits, broadcasts `scan:complete`                                                                                                         | None (entry point)                           |
| `package-scan`       | Lockfile parse + registry lookups + save scan_results + detect dependency changes + changelog placeholders + update project row (lastScannedAt, packageManager, pmVersion) + stale lockfile warning | First child, must complete before others     |
| `vulnerability-scan` | OSV vulnerability scan + health snapshot (needs both vuln counts and scan stats from DB)                                                                                                            | After package-scan                           |
| `license-scan`       | License detection + policy evaluation + license snapshot + broadcast `license-scan:complete` + emit `license-scan:completed`                                                                        | After package-scan                           |
| `graph-refresh`      | Lockfile parse into dependency_edges table                                                                                                                                                          | After package-scan                           |
| `transitive-resolve` | Already exists — resolve registry data for unresolved transitives                                                                                                                                   | After package-scan, only if unresolved exist |

### Execution flow

```
scan (orchestrator)
  │
  ├─ Check lockfile exists → fail with "Lockfile not found: {name}" if missing
  │
  ├─ Chain: package-scan (sequential, must complete first)
  │     └─ Receives: force flag from orchestrator's packagesJson
  │     └─ On completion: orchestrator reads package-scan job to check warning
  │
  ├─ Chain in parallel (all start after package-scan completes):
  │   ├─ vulnerability-scan (no packagesJson needed — reads scan_results from DB)
  │   ├─ license-scan (no packagesJson needed — uses project's packageManager)
  │   └─ graph-refresh (no packagesJson needed — reads lockfile directly)
  │
  ├─ Chain: transitive-resolve (after package-scan, if unresolved transitives exist)
  │     └─ Orchestrator queries scan_results for registryResolved=0 count
  │
  ├─ Wait for all children → collect results
  │
  └─ Broadcast scan:complete with { projectId, warning } (warning from package-scan job)
      Emit EventBus "scan:completed"
```

### Data flow between jobs

- **package-scan → orchestrator**: Orchestrator reads the package-scan job row after completion to get `warning` field (stale lockfile message). No direct data passing — package-scan writes to scan_results table, others read from it.
- **package-scan → vulnerability-scan**: VulnerabilityScanJobExecutor reads scan_results from DB. Also needs `installedVersions` for audit — reads via `ScanService.collectInstalledVersions()` (lockfile parse, already fast).
- **package-scan → health snapshot**: Health snapshot requires both scan statistics AND vulnerability counts. VulnerabilityScanJobExecutor computes both: reads scan_results for package stats (upToDate/patch/minor/major counts), runs vulnerability scan, then creates/upserts health_snapshots row.
- **scan:progress**: Package-scan broadcasts `scan:progress` WebSocket events during registry lookups (same as current code). Other children report via their own `job:progress` events.
- **scan:failed**: If orchestrator fails (lockfile missing or package-scan fails), orchestrator broadcasts `scan:failed`.

### Orchestrator pseudo-code

```typescript
async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    const childIds: string[] = [];

    try {
        // 0. Concurrent scan guard
        const runningScans = await this.jobWorker.getRunningJobsForReference(
            context.referenceId, "scan"
        );
        const otherRunning = runningScans.filter(j => j.id !== context.jobId);
        if (otherRunning.length > 0) {
            throw new Error("Scan already running for this project");
        }

        // 1. Check lockfile
        const driver = this.registry.getDriver(context.packageManager);
        const lockfilePath = join(context.projectPath, driver.lockfileName);
        if (!existsSync(lockfilePath)) {
            throw new Error(`Lockfile not found: ${driver.lockfileName}`);
        }
        context.appendLog("Lockfile found, starting scan pipeline");

        // 2. Chain package-scan and wait
        const packageScanId = await this.jobWorker.enqueue({
            referenceId: context.referenceId,
            referenceType: "project",
            type: "package-scan",
            packages: context.packagesJson,
            parentJobId: context.jobId
        });
        childIds.push(packageScanId);
        context.appendLog("Package scan started");
        const packageScanResult = await this.jobWorker.waitForJob(packageScanId, context.signal);

        if (packageScanResult.status === "failed") {
            throw new Error("Package scan failed");
        }

        // 3. Chain parallel jobs (no packagesJson — they read from DB)
        for (const type of ["vulnerability-scan", "license-scan", "graph-refresh"] as const) {
            childIds.push(await this.jobWorker.enqueue({
                referenceId: context.referenceId,
                referenceType: "project",
                type,
                parentJobId: context.jobId
            }));
        }
        context.appendLog("Parallel jobs started: vulnerability-scan, license-scan, graph-refresh");

        // 4. Conditionally chain transitive-resolve
        const unresolvedCount = await this.countUnresolvedTransitives(context.referenceId);
        if (unresolvedCount > 0) {
            await this.markStaleTransitiveDepsUnresolved(context);
            childIds.push(await this.jobWorker.enqueue({
                referenceId: context.referenceId,
                referenceType: "project",
                type: "transitive-resolve",
                parentJobId: context.jobId
            }));
            context.appendLog(`Transitive resolve started for ${unresolvedCount} packages`);
        }

        // 5. Wait for all parallel children
        const parallelIds = childIds.filter(id => id !== packageScanId);
        const results = await this.jobWorker.waitForJobs(parallelIds, context.signal);
        const failed = results.filter(r => r.status === "failed");
        if (failed.length > 0) {
            context.appendLog(
                `Warning: ${failed.length} child job(s) failed: ${failed.map(r => r.type).join(", ")}`
            );
        }

        // 6. Broadcast scan:complete
        const warning = failed.length > 0
            ? `${failed.map(r => r.type).join(", ")} failed`
            : packageScanResult.warning;
        this.webSocketBroadcaster.broadcast("scan:complete", {
            projectId: context.referenceId,
            warning
        });
        this.eventBus.emit("scan:completed", context.referenceId);
        context.appendLog("Scan pipeline complete");
    } catch (error) {
        // Cancel all pending/running children on orchestrator failure
        for (const childId of childIds) {
            try {
                await this.jobWorker.cancelJob(childId);
            } catch {
                // best-effort cancellation
            }
        }

        this.webSocketBroadcaster.broadcast("scan:failed", {
            projectId: context.referenceId,
            error: String(error)
        });
        throw error;
    }
}
```

### JobWorker new methods

Add to `IJobWorker` interface:

```typescript
waitForJob(jobId: string, signal?: AbortSignal): Promise<IJob>;
waitForJobs(jobIds: string[], signal?: AbortSignal): Promise<IJob[]>;
getRunningJobsForReference(referenceId: string, type: string): Promise<IJob[]>;
```

Implementation:

- `waitForJob`: Polls `getJob(jobId)` every 1 second. Returns when job reaches terminal state (`completed`, `failed`, `cancelled`, `interrupted`). Throws if signal is aborted.
- `waitForJobs`: Calls `waitForJob` for each ID concurrently via `Promise.all`. No timeout — orchestrator runs until children finish or is cancelled.
- `getRunningJobsForReference`: Queries upgradeJobs where `referenceId` and `type` match and `status` is `running`. Used by orchestrator's concurrent scan guard.

### Cancellation propagation

When orchestrator is cancelled (AbortSignal aborted):

- `waitForJob`/`waitForJobs` throws immediately
- Orchestrator's catch block in JobWorker cancels all child jobs that are still pending/running
- Add to orchestrator's error handling: iterate child IDs and call `jobWorker.cancelJob(childId)`

### Changes to existing chaining

- **Remove from JobWorker**: `chainTransitiveResolveAfterScanIfNeeded` — orchestrator handles transitive-resolve chaining
- **Keep in JobWorker**: `chainScanAfterJobIfNeeded` (install/dependency/transient → scan) — these are separate entry points that trigger a full scan
- **Keep in JobWorker**: `chainRefreshTransientIfNeeded` (dependency with refreshTransient flag → transient) — this is specific to dependency jobs, not scan
- **Remove from JobWorker.executeJob()**: Only the `chainTransitiveResolveAfterScanIfNeeded` call — the other two chain calls remain, guarded by job type
- **`markStaleTransitiveDepsUnresolved`**: Moves to ScanJobExecutor (orchestrator) since it's called before enqueueing transitive-resolve

### Orchestrator helper methods

Two private methods on the rewritten ScanJobExecutor (orchestrator):

- `countUnresolvedTransitives(referenceId: string)`: queries scan_results for `COUNT(*)` where `projectId = referenceId AND registryResolved = 0`. Returns number.
- `markStaleTransitiveDepsUnresolved(context)`: moved from JobWorker — reads `transitive-resolve-ttl` app setting (hours, default 24, 0 disables), flips stale transitive rows (registryResolved=1, scannedAt older than TTL) back to registryResolved=0.

Note: `WebSocketBroadcaster.broadcast()` is synchronous fire-and-forget — sends to all connected clients, never throws. No try/catch needed around broadcast calls.

### New executor details

**PackageScanJobExecutor** (extracted from current ScanJobExecutor):

- `resolveMinimalAgeSeconds()` — reads pmSecuritySettings for age gate
- `ScanService.scan()` — lockfile parse + registry lookups (broadcasts `scan:progress`)
- `DependencyChangeService.detectAndPersist()` — dependency change detection
- Delete + insert scan_results
- `insertChangelogPlaceholders()` — changelog placeholder rows
- Update project row: `lastScannedAt`, `packageManager`, `pmVersion`
- `hasPackageJsonDeps()` check + warning if 0 results despite deps in package.json
- Stores warning on job row if applicable
- Input: `{ force?: boolean }` from packagesJson

**VulnerabilityScanJobExecutor** (new):

- `VulnerabilityService.scan()` with installedVersions from lockfile
- Reads scan_results for resolved package counts (upToDate, patch, minor, major)
- Computes health score (base score from package stats - vulnerability penalty)
- Upserts health_snapshots row
- Input: none (reads from DB + lockfile)

**LicenseScanJobExecutor** (extracted from current ScanJobExecutor.runLicenseScan):

- `LicenseCheckerService.scan()` — detect licenses
- Upsert license rows, delete stale
- `LicensePolicyService.evaluate()` + `getComplianceStatus()`
- Upsert license_snapshots row
- Broadcast `license-scan:complete`, emit `license-scan:completed`
- Input: none (reads project's packageManager from DB)

**GraphRefreshJobExecutor** (new):

- `DependencyGraphService.refreshGraph()` — lockfile parse into dependency_edges
- Input: none (reads project path + packageManager from DB)

### Concurrent scan protection

Two scans for the same project must not run simultaneously — package-scan deletes and reinserts scan_results, which would race. The orchestrator should check for existing running scan jobs for the same referenceId before starting. If one exists, fail with a clear message.

### UI impact

- Jobs page shows all child jobs with parentJobId pointing to scan orchestrator
- Each child has its own progress, logs, status, duration
- Orchestrator job shows overall status
- Filter by type works for each new type (add package-scan, vulnerability-scan, license-scan, graph-refresh to TYPE_OPTIONS)
- No new UI components needed — existing Jobs page + progress bar handles it

### Failure handling

- **Lockfile missing** → orchestrator throws, status = "failed", broadcasts `scan:failed`
- **package-scan fails** → orchestrator throws, no parallel children spawned, broadcasts `scan:failed`
- **Any parallel child fails** → orchestrator logs which failed, other children continue, orchestrator completes with warning
- **transitive-resolve fails** → non-fatal, orchestrator completes with warning
- **Orchestrator cancelled** → all pending/running children cancelled
- **Concurrent scan detected** → orchestrator fails with "Scan already running for this project"

### Migration

- Existing "scan" jobs in DB are from the old monolith — no migration needed
- New scans produce the orchestrator + children pattern
- Old code paths that listen for `scan:complete` still work (orchestrator broadcasts it)
- `scan:progress` still broadcast by package-scan during registry lookups

### Job type union update

Add to `ICreateJobInput.type`:

```
"package-scan" | "vulnerability-scan" | "license-scan" | "graph-refresh"
```

### Input specification

| Job type           | packagesJson content  | Notes                                       |
| ------------------ | --------------------- | ------------------------------------------- |
| scan               | `{ force?: boolean }` | Passed through to package-scan              |
| package-scan       | `{ force?: boolean }` | Force bypasses registry cache               |
| vulnerability-scan | none                  | Reads scan_results + lockfile from disk     |
| license-scan       | none                  | Reads project packageManager from DB        |
| graph-refresh      | none                  | Reads project path + packageManager from DB |
| transitive-resolve | none                  | Already defined — reads scan_results        |

## Scope

~12 files changed:

- 4 new executor files (PackageScanJobExecutor, VulnerabilityScanJobExecutor, LicenseScanJobExecutor, GraphRefreshJobExecutor)
- ScanJobExecutor rewritten as orchestrator
- JobWorker: add waitForJob/waitForJobs + getRunningJobsForReference, remove chainTransitiveResolveAfterScanIfNeeded, keep chainScanAfterJobIfNeeded + chainRefreshTransientIfNeeded
- JobExecutorRegistry: register 4 new executors
- ICreateJobInput: add new job types to union
- IJobWorker: add waitForJob/waitForJobs methods
- JobManagerPage: add new job types to TYPE_OPTIONS
- Tests for each new executor + orchestrator
