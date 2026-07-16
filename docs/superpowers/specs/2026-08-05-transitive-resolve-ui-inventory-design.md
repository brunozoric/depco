# Transitive Registry Resolve + UI Inventory — Design Spec

Two sub-projects shipped together: background job to resolve transitive dep registry data (sub-project 3), and API/UI changes to filter by dependency kind and show resolve status (sub-project 4).

## Sub-project 3: TransitiveResolveJobExecutor

### New job type: "transitive-resolve"

New executor following existing pattern (5-step process from JobExecutorRegistry exploration):

1. Create abstraction: `src/api/services/jobExecutors/abstractions/TransitiveResolveJobExecutor.ts`
2. Create implementation: `src/api/services/jobExecutors/TransitiveResolveJobExecutor.ts`
3. Register in DI: `src/api/feature.ts`
4. Add to JobExecutorRegistry constructor
5. Auto-enqueue from ScanJobExecutor after scan persist (only when unresolved transitive deps exist)

### Executor logic

```
1. Query scan_results WHERE registryResolved = 0 AND projectId = context.referenceId
2. If count = 0, return early (no work)
3. For each batch of LOOKUP_CONCURRENCY (10):
   a. Call registryCacheService.getPackageInfo() per package
   b. Compute latestVersion, latestInRange, upgradeType (same logic as ScanService)
   c. Update scan_results row: set latestVersion, latestInRange, upgradeType, registryResolved = 1
   d. context.setProgress({ percent: Math.round((processed / total) * 95), label: `Resolving transitive: ${processed}/${total}` })
4. context.setProgress({ percent: 100, label: "Resolution complete" })
```

### Dependencies

Needs: `RegistryCacheService` (for registry lookups), `DatabaseClient` (for queries/updates), `WebSocketBroadcaster` (for scan:complete-like notification after resolution).

### Job type registration

Add `"transitive-resolve"` to `ICreateJobInput.type` union in `src/api/services/abstractions/JobWorker.ts`. Without this, `jobWorker.enqueue({ type: "transitive-resolve", ... })` fails TypeScript validation.

### Enqueue from ScanJobExecutor

After DB persist in ScanJobExecutor (after scan_results insert), count unresolved transitive deps. If > 0, call `jobWorker.enqueue()` with type "transitive-resolve". ScanJobExecutor needs JobWorker injected — check if it already has it or needs to be added.

Alternative: enqueue from JobWorker's chain logic (like `chainScanAfterJobIfNeeded`). Add `chainTransitiveResolveAfterScanIfNeeded()` that checks for unresolved deps and enqueues.

**Preferred: chain from JobWorker** — keeps ScanJobExecutor focused on scanning, and follows the existing chaining pattern (chainScanAfterJobIfNeeded, chainRefreshTransientIfNeeded).

### Broadcast after resolution

After all transitive deps resolved, broadcast a WebSocket event so UI can refresh. Use existing `scan:complete` event (resolution is effectively a continuation of scan) or new `transitive-resolve:complete` event.

**Preferred: new event** — `transitive-resolve:complete: { projectId: string; resolved: number }`. Cleaner separation.

## Sub-project 4: API Routes + UI Inventory

### Modified routes

**`GET /api/projects/:projectId/dependencies`:**

- Add `dependencyKind` query param: `z.enum(["all", "dependency", "devDependency", "peerDependency", "optionalDependency", "transitive"]).optional()` — default "all"
- Add `registryResolved` query param: `z.enum(["all", "true", "false"]).optional()` — default "all"
- Response items include `dependencyKind` and `registryResolved` fields
- `latestVersion`, `upgradeType` nullable in response schema

**`GET /api/packages`:**

- Add `dependencyKind` query param (same enum as above)
- Response items include `dependencyKind` field

### New route

**`GET /api/projects/:projectId/transitive-resolve-status`:**

```typescript
response: {
  total: number; // all transitive deps for project
  resolved: number; // registryResolved = 1
  pending: number; // registryResolved = 0
}
```

### UI: Packages page

- Add `dependencyKind` filter dropdown to URL-synced filters via UrlFilterService
- Options: All / Direct / Dev / Peer / Optional / Transitive
- "Pending" badge on rows where `registryResolved === false`
- Header count: "1,247 packages (318 transitive pending)" when unresolved exist

### UI: Project detail dependency table

- Add `dependencyKind` filter dropdown
- New "Kind" column with colored badge per kind
- Nullable `latestVersion`/`upgradeType` show "Resolving..." for unresolved
- Upgrade button hidden when unresolved

### UI: Resolve progress indicator

- After scan completes, if transitive deps pending, show indicator
- Subscribe to `transitive-resolve:complete` event to auto-refresh
- Could reuse job progress bar (transitive-resolve is a job with setProgress)

## Files changed

### Sub-project 3

- New: `src/api/services/jobExecutors/abstractions/TransitiveResolveJobExecutor.ts`
- New: `src/api/services/jobExecutors/TransitiveResolveJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/JobExecutorRegistry.ts` — add 9th executor
- Modify: `src/api/feature.ts` — register new executor
- Modify: `src/api/services/abstractions/JobWorker.ts` — add "transitive-resolve" to ICreateJobInput.type union
- Modify: `src/api/services/JobWorker.ts` — add chainTransitiveResolveAfterScan
- Modify: `src/shared/websocket/types.ts` — add transitive-resolve:complete event
- Test: `src/api/services/jobExecutors/__tests__/TransitiveResolveJobExecutor.test.ts`

### Sub-project 4

- Modify: `src/shared/routes/projects.ts` — add dependencyKind/registryResolved params to dependencies route
- Modify: `src/shared/routes/packages.ts` — add dependencyKind param
- New: route definition for transitive-resolve-status
- Modify: `src/api/routes/projects.ts` — implement filters in handler
- Modify: `src/api/routes/packages.ts` — implement filter in handler
- New: transitive-resolve-status route handler
- Modify: `src/ui/features/packages/` — gateway fields
- Modify: `src/ui/presentation/packages/` — dependencyKind filter, pending badge
- Modify: `src/ui/presentation/projects/ProjectDetail/` — kind column, filter, resolving state

## Decomposition into tasks

### Sub-project 3 tasks

1. TransitiveResolveJobExecutor abstraction + implementation + tests
2. Register in DI + JobExecutorRegistry
3. Chain from JobWorker after scan (+ WebSocket event)

### Sub-project 4 tasks

4. API route changes (dependencyKind/registryResolved filters, transitive-resolve-status)
5. Packages page UI (dependencyKind filter, pending badge)
6. Project detail UI (kind column, filter, resolving state)
