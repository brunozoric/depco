# Async Changelog Fetching

## Problem

Changelog resolution blocks the API request. For monorepo packages with thousands of GitHub releases (e.g., vercel/ai), `resolve()` can take 2+ minutes. Additionally, `resolve()` processes ALL unfetched versions for a package when the user only needs versions in the upgrade range (typically 1-10).

## Design

### Schema Change

Rename `projectId` → `referenceId` and add `referenceType` on `upgrade_jobs` table. Direct ALTER TABLE on existing DB:

```sql
ALTER TABLE upgrade_jobs RENAME COLUMN projectId TO referenceId;
ALTER TABLE upgrade_jobs ADD COLUMN referenceType TEXT NOT NULL DEFAULT 'project';
```

Drizzle schema updated to match. Existing rows auto-get `referenceType = 'project'`.

Column semantics:

- `referenceId`: the entity that owns the job (projectId for project jobs, packageName for changelog jobs)
- `referenceType`: `"project"` or `"package"`

All code reading `job.projectId` changes to `job.referenceId`. WS event payloads (`job:status`, `job:log`) rename `projectId` → `referenceId` and add `referenceType`.

`ICreateJobInput.type` union adds `"changelog"`.

### ChangelogJobExecutor

New executor registered in `JobExecutorRegistry`. `type = "changelog"`.

**Input** (via `packages` JSON):

```json
{ "packageName": "@ai-sdk/anthropic", "from": "4.0.18", "to": "4.0.21" }
```

**Execution flow:**

1. Parse packages JSON for `packageName`, `from`, `to`
2. Query unfetched changelog rows (`content IS NULL`) filtered to versions in range (`from < version <= to`)
3. If none unfetched, complete immediately
4. Run resolver chain (GitHub releases → CHANGELOG.md → npm readme) for ONLY those versions
5. After each version resolves, write to DB and broadcast `changelog:resolved` WS event
6. Versions not found by any resolver get `content = ""`, `source = "none"`

Key difference from current `resolve()`: scoped to version range, streams per-version results instead of batch write at end.

**Execution context**: changelog jobs have no project. `IJobExecutionContext.project` is `null`, `referenceId` is the packageName. The executor ignores the project field and reads packageName from the packages JSON. JobWorker already handles `project = null` for clone jobs — same pattern applies here.

Dependencies: `DatabaseClient`, `CommandRunner`, `RegistryCacheService`, `WebSocketBroadcaster`.

### WS Event

New event type added to `WSEventMap`:

```typescript
"changelog:resolved": {
    packageName: string;
    version: string;
    content: string | null;
    source: string | null;
}
```

Broadcast per version as the executor resolves each one.

### API Changes

**GET `/api/changelogs/:packageName?from=X&to=Y`** — changed behavior:

- No longer calls `resolve()` — non-blocking
- Short-circuits with `{ items: [], total: 0, resolving: false }` if `from === to`
- Queries cached entries via `changelogService.getChangelogs()`
- Checks for unfetched versions in range (`content IS NULL` AND version in `from..to`)
- Checks for active job: query `upgrade_jobs` for `type = 'changelog'`, `referenceId = packageName`, `status IN ('pending', 'running')`
- If unfetched versions exist AND no active job: enqueue changelog job via `jobWorker.enqueue({ referenceId: packageName, type: 'changelog', packages: JSON.stringify({ packageName, from, to }) })`
- Sets `resolving = true` if active job exists OR one was just enqueued
- Response shape: `{ items, total, resolving }`

**POST `/api/changelogs/:packageName/re-resolve`** — changed behavior:

- Resets `source = 'none'` rows in the requested range via `changelogService.resetFailed()`
- Enqueues changelog job (regardless of existing job)
- Returns cached entries + `{ resolving: true }`

### UI Changes

**ChangelogModal / ChangelogDrawer:**

1. On open: GET returns cached entries + `resolving` flag
2. Show cached entries immediately. If `resolving = true`, show spinner indicator for unfetched versions
3. Subscribe to `changelog:resolved` WS events filtered by `packageName`
4. When WS event arrives, insert/update entry in local state — entry appears live in the accordion
5. When all versions in range have content (or job completes via `job:status`), hide spinner
6. Re-fetch button: calls POST re-resolve, resets entries with `source = 'none'`, subscribes for updates

**Job Manager page:**

- `referenceType = "project"` rows: show project name via ProjectsRepository lookup (current behavior)
- `referenceType = "package"` rows: show package name directly from `referenceId`
- Job type filter gets `"changelog"` option

**Job notification toasts:**

- `referenceType = "project"`: show project name suffix (current)
- `referenceType = "package"`: show package name suffix

### Files Affected

**Schema/migration:**

- `src/api/db/schema.ts` — rename column, add referenceType
- Direct ALTER TABLE on `data/upgrader.db`

**Job system (referenceId rename):**

- `src/api/services/abstractions/JobWorker.ts` — ICreateJobInput, IJob: projectId → referenceId, add referenceType
- `src/api/services/JobWorker.ts` — all projectId references
- `src/api/services/jobExecutors/abstractions/JobExecutor.ts` — IJobExecutionContext: projectId → referenceId
- All 6 existing executors — context.projectId → context.referenceId
- `src/api/services/abstractions/ErrorReporter.ts` — reportJobFailure, reportJobWarning: projectId → referenceId
- `src/api/services/ErrorReporter.ts` — implementation
- `src/api/routes/jobs.ts` — query filters, response mapping
- `src/api/routes/projects.ts` — job enqueue calls
- `src/api/routes/install.ts` — job enqueue calls
- `src/api/routes/packageManager.ts` — job enqueue calls
- `src/ui/features/jobs/abstractions/JobsGateway.ts` — IJob, IJobFilters: projectId → referenceId
- `src/ui/features/jobs/JobsGateway.ts` — implementation

**WS types:**

- `src/shared/websocket/types.ts` — WSJobStatus, WSJobLog: rename projectId → referenceId, add referenceType. Add `changelog:resolved` event type.
- `src/ui/shared/notifications/jobNotifications.ts` — adapt to referenceId, use referenceType for name lookup

**New executor:**

- `src/api/services/jobExecutors/ChangelogJobExecutor.ts` — new file
- `src/api/services/jobExecutors/JobExecutorRegistry.ts` — register it

**API routes:**

- `src/api/routes/changelogs.ts` — non-blocking GET, job enqueue
- `src/shared/routes/changelogs.ts` — response schema adds `resolving`

**UI gateways:**

- `src/ui/features/packages/PackagesGateway.ts`
- `src/ui/features/projects/ProjectsGateway.ts`

**UI components:**

- `src/ui/presentation/projects/ProjectDetail/components/ChangelogModal.tsx` — WS subscription, live updates
- `src/ui/presentation/projects/UpgradeWizard/components/ChangelogDrawer.tsx` — same
- `src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx` — referenceType display
- `src/ui/presentation/jobs/JobManager/JobManagerPresenter.ts` — adapt to referenceId

**Existing ChangelogService:**

- `resolve()` no longer called from routes — only from `ChangelogJobExecutor`
- `resetFailed()` stays, called from re-resolve route before enqueuing job
- `getChangelogs()` stays, called from GET route for cached results
