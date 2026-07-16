# Full Dependency Tree — Design Spec

Store all installed dependencies (direct, dev, peer, optional, transitive), track their registry data via background jobs, maintain an adjacency-list dependency graph, and add job progress reporting.

## Goals

1. Complete inventory of every installed package per project
2. Vulnerability coverage for transitive deps (not just direct)
3. Dependency tree visualization — "why do I have lodash?"
4. Job progress percentage for long-running scans

## Data Model

### scan_results changes (migration)

Add columns:

- `dependency_kind` TEXT NOT NULL DEFAULT 'dependency' — values: "dependency", "devDependency", "peerDependency", "optionalDependency", "transitive"
- `registry_resolved` INTEGER NOT NULL DEFAULT 1 — SQLite boolean. Existing rows are resolved. New transitive rows start with 0.

Make nullable:

- `latest_version` — NULL for unresolved transitive deps
- `latest_in_range` — NULL for unresolved transitive deps
- `upgrade_type` — NULL for unresolved transitive deps

Priority when a package appears multiple ways within one project (most direct wins):

1. dependency
2. devDependency
3. peerDependency
4. optionalDependency
5. transitive

Per-project scoping: `(projectId, name)` is the natural key. Same package in different projects = separate rows with potentially different `dependencyKind`.

### Existing table: dependency_edges (NO MIGRATION NEEDED)

Table already exists with a richer schema than originally proposed:

```
id               TEXT PRIMARY KEY
project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE
parent_package   TEXT (nullable — null for root deps)
parent_version   TEXT (nullable)
child_package    TEXT NOT NULL
child_version    TEXT NOT NULL
dependency_type  TEXT NOT NULL (dependency/devDependency/peerDependency/optionalDependency)
depth            INTEGER NOT NULL (0 = root/direct, 1+ = transitive depth)
scanned_at       INTEGER NOT NULL
```

**Already populated by `LockfileParserService`** which parses lockfiles (yarn.lock, package-lock.json, pnpm-lock.yaml) to build edge data. Currently triggered separately via `DependencyGraphGateway.refresh()`.

**Change needed:** integrate edge population into the scan flow so edges are always up-to-date after scan, rather than requiring a separate refresh action.

### Existing dependency graph infrastructure (REUSE)

Already built:

- `LockfileParserService` — parses lockfiles per PM (yarn.lock, package-lock.json, pnpm-lock.yaml, bun.lock) into `IDependencyEdge[]`
- `DependencyGraphGateway` — `getGraph()`, `findPaths()`, `getStats()`, `refresh()`
- `GraphPage` UI — presenter, provider, components for tree visualization
- API routes for graph/paths/stats already exist

**This means:** No new PM driver `parseInstalledTree()` method needed. No new dependency tree routes needed. No new tree view UI needed. LockfileParserService already does tree extraction from lockfiles, which is more accurate than parsing `npm ls` output.

**What's actually new:**

1. scan_results changes (dependencyKind, registryResolved, nullable columns)
2. ScanService persists ALL installed packages (not just direct)
3. ScanService calls LockfileParserService during scan (instead of requiring separate refresh)
4. Background job for transitive registry resolution
5. Job progress enhancement
6. UI filters for dependencyKind on packages/dependencies pages

### upgrade_jobs changes (migration)

Add columns:

- `progress` INTEGER — 0-100, nullable (null = indeterminate, spinner shown)
- `progress_label` TEXT — human-readable status like "Resolving 223/1000 dependencies", nullable

## PM Driver Changes

### No new tree parser needed

`LockfileParserService` already handles tree extraction from lockfiles for all four PMs. This is more accurate than parsing `npm ls` output because lockfiles represent the exact resolved tree.

### Existing `parseInstalledVersions()` stays as-is

Returns `Map<string, string>` (name to version) for ALL installed packages. This flat map is what we need to identify which packages are installed — combined with `collectDependencyTypes()` to classify each one.

### Note on yarn/pnpm/bun flat parsing

Current yarn/pnpm/bun parsers already capture all installed packages (including transitive) from their `--all` flag output — they just return a flat map without tree structure. The tree structure comes from `LockfileParserService` lockfile parsing instead. This is the correct split: flat map for inventory, lockfile for relationships.

## IPackageJson Update

```typescript
interface IPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}
```

`collectDependencyTypes()` expanded to return `Map<string, DependencyKind>` with all four package.json sections classified.

## ScanService Changes

### Two-phase scan flow

**Phase 1 (synchronous, existing scan job):**

1. `collectInstalledVersions()` — unchanged, flat map of ALL installed packages (direct + transitive)
2. `collectDependencyTypes()` — expanded: reads all four package.json dependency sections, returns `Map<string, DependencyKind>`
3. Classify every package in installedVersions: check package.json maps with priority (direct > dev > peer > optional), everything not in any package.json map = transitive
4. Registry lookups for direct/dev/peer/optional deps only (existing behavior)
5. Persist ALL packages to scan_results:
   - direct/dev/peer/optional: full registry data, `registryResolved=1`
   - transitive: `latestVersion=NULL`, `latestInRange=NULL`, `upgradeType=NULL`, `registryResolved=0`
6. Call `LockfileParserService.parse(projectPath, packageManager)` to rebuild `dependency_edges` — delete old edges for project, insert new from lockfile parse result
7. Stale-sweep: delete scan_results rows not in current installed set
8. Enqueue `transitive-registry-resolve` background job (added in sub-project 3; sub-project 1 stops at step 7)

**Phase 2 (background job: `transitive-registry-resolve`):**

1. Query scan_results where `registryResolved=0` AND `projectId=X`
2. Batch registry lookups using existing `LOOKUP_CONCURRENCY` and `RegistryCacheService` (30-min TTL cache)
3. Update each row: set latestVersion, latestInRange, upgradeType, `registryResolved=1`
4. Report progress via `context.setProgress({ percent, label })` — e.g. "Resolving transitive: 223/1000"
5. On completion, broadcast event so UI refreshes package list

### Rescan behavior

Each scan rebuilds the full picture:

- Transitive dep becomes direct? `dependencyKind` updated to "dependency"
- Package removed? Stale-sweep deletes the row
- Edges rebuilt from tree each scan
- No special migration logic — scans are authoritative snapshots

## Job Progress Enhancement

### JobExecutionContext

```typescript
interface IJobExecutionContext {
  appendLog(line: string): void;
  setProgress(input: { percent: number; label?: string }): void;
}
```

### JobWorker

- `setProgress()` updates `progress` and `progress_label` columns in DB
- Broadcasts new `job:progress` WebSocket event: `{ jobId, progress, progressLabel }`
- Throttle DB writes to at most once per second (progress updates can be frequent)

### WebSocket event

Add to `WSEventMap`:

```typescript
"job:progress": { jobId: string; progress: number; progressLabel: string | null }
```

### Progress ranges for scan job (final state after all sub-projects)

| Phase                                  | Range   | Label                                     |
| -------------------------------------- | ------- | ----------------------------------------- |
| Collect installed versions             | 0-5%    | "Collecting installed packages..."        |
| Classify dependency types              | 5-10%   | "Classifying dependencies..."             |
| Registry lookups (direct deps)         | 10-60%  | "Resolving direct deps: 42/87"            |
| Persist to DB + edges                  | 60-70%  | "Saving scan results..."                  |
| Vulnerability scan                     | 70-95%  | "Scanning vulnerabilities..."             |
| Enqueue transitive job (sub-project 3) | 95-100% | "Complete. Transitive resolution queued." |

Sub-project 1 ends at "Persist to DB + edges" (0-70%), then vulnerability scan (70-100%). Enqueue step added in sub-project 3.

### Progress for transitive resolve job

| Phase            | Range   | Label                            |
| ---------------- | ------- | -------------------------------- |
| Registry lookups | 0-95%   | "Resolving transitive: 223/1000" |
| Persist updates  | 95-100% | "Saving..."                      |

### Simple jobs

Jobs that don't call `setProgress()` stay indeterminate (`progress=NULL`). UI shows spinner as today.

## API Routes

### Modified routes

`GET /api/projects/:projectId/dependencies` — add:

- `dependencyKind` query param filter (all/dependency/devDependency/peerDependency/optionalDependency/transitive)
- `registryResolved` query param filter (all/true/false)
- Response includes `dependencyKind: string` and `registryResolved: boolean` per item
- `latestVersion`, `latestInRange`, `upgradeType` become nullable in response schema

`GET /api/packages` — add:

- `dependencyKind` query param filter
- Response items include `dependencyKind` field

### Existing routes (already built — dependency graph feature)

Dependency tree routes already exist via `DependencyGraphGateway`:

- `getGraph(projectId)` — returns edges, rootPackages, totalPackages, maxDepth, edgeCount
- `findPaths(projectId, packageName)` — returns paths from root to target package
- `getStats(projectId)` — returns totalPackages, maxDepth, rootCount, edgeCount
- `refresh(projectId)` — triggers lockfile re-parse

These routes serve the existing `GraphPage` UI. No new tree/path routes needed.

### New route

`GET /api/projects/:projectId/transitive-resolve-status`:

```typescript
response: {
  total: number;
  resolved: number;
  pending: number;
}
```

## UI Changes

### Phase 1: Inventory + kind filter (ship first)

**Packages page (`/packages`):**

- Add `dependencyKind` filter dropdown (All / Direct / Dev / Peer / Optional / Transitive)
- "Pending" badge on unresolved transitive deps (`registryResolved=false`)
- Header count shows filtered total, e.g. "1,247 packages (318 transitive pending)"

**Project detail dependency table:**

- Same `dependencyKind` filter dropdown
- New "Kind" column with badge (Direct / Dev / Peer / Optional / Transitive)
- Nullable latestVersion shows "Resolving..." for unresolved transitive deps
- Upgrade button hidden for unresolved deps

**Job progress bar:**

- Replace spinner with determinate `Progress` component (Mantine) when `progress !== null`
- Show `progressLabel` below bar
- Subscribe to `job:progress` WebSocket event
- Null progress = spinner as today (backwards compatible)

### Phase 2: Tree view enhancements (follow-up)

**GraphPage already exists** with dependency graph visualization. Enhancements:

- Add `dependencyKind` badges to graph nodes
- Add `registryResolved` indicator (pending/resolved) to graph nodes
- Ensure graph auto-refreshes after scan (currently requires manual refresh)
- Edges are already populated by LockfileParserService — integrated into scan flow means graph is always fresh

## Files Changed (estimated)

### Schema + migrations

- `src/api/db/schema.ts` — add columns to scanResults (`dependencyKind`, `registryResolved`, make latestVersion/latestInRange/upgradeType nullable), add columns to upgradeJobs (`progress`, `progressLabel`)
- New migration file via `drizzle-kit generate`
- dependency_edges table already exists — no migration needed for it

### Services

- `src/api/services/ScanService.ts` — expand `collectDependencyTypes` for peer/optional, persist ALL installed packages (not just direct), call `LockfileParserService.parse()` to rebuild edges (enqueue transitive resolve job added in sub-project 3)
- `src/api/services/jobExecutors/abstractions/JobExecutor.ts` — add `setProgress` to `IJobExecutionContext`
- `src/api/services/JobWorker.ts` — implement `setProgress`, broadcast `job:progress`, throttle DB writes
- New: `src/api/services/jobExecutors/TransitiveResolveJobExecutor.ts` — background registry resolution

### Routes

- `src/api/routes/projects.ts` — add dependencyKind/registryResolved filters to dependencies route
- `src/api/routes/packages.ts` — add dependencyKind filter
- New route definition for transitive-resolve-status

### Shared

- `src/shared/routes/` — new/modified route definitions for filters
- `src/shared/websocket/types.ts` — add `job:progress` event

### UI

- `src/ui/features/packages/` — gateway + repository changes for new fields
- `src/ui/presentation/packages/` — dependencyKind filter, pending badge
- `src/ui/presentation/projects/ProjectDetail/` — kind column, filter, resolving state
- `src/ui/presentation/jobs/JobProgress/` — progress bar component, subscribe to job:progress
- `src/ui/features/jobs/` — gateway/repository for progress field

## Decomposition

This is too large for one plan. Break into sub-projects:

1. **Schema + ScanService expansion** — migrations (add columns to scanResults + upgradeJobs), expand `collectDependencyTypes` for peer/optional, persist ALL installed packages to scan_results, integrate `LockfileParserService.parse()` into scan flow for auto-refreshing edges. No background job yet — transitive deps stored with `registryResolved=0` but no resolution job enqueued. Direct deps work exactly as before.

2. **Job progress enhancement** — add progress to job model, `setProgress` on context, `job:progress` WebSocket event, UI progress bar. Independent of dependency tree — useful for existing scan jobs too.

3. **Transitive registry resolve job** — new `TransitiveResolveJobExecutor`, enqueue from scan flow after persisting transitive deps. Depends on sub-projects 1 + 2 (needs schema + progress reporting).

4. **API routes + UI inventory** — modified routes with dependencyKind/registryResolved filters, packages page dependencyKind filter, kind column on dependency table, pending badges, resolve status route. Depends on sub-projects 1 + 3.

5. **Graph page enhancements** — add dependencyKind badges and registryResolved indicators to existing GraphPage, auto-refresh after scan. Depends on sub-project 4.

Each sub-project ships independently and produces working, testable software.
