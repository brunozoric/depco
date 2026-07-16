# Error Logging System — Design Spec

Two-part feature: (A) surface existing job error details in the Jobs UI, (B) dedicated app_logs system with DB storage, filtering, and bulk deletion.

## Part A: Job Error Details in Jobs Page

### Problem

Jobs page shows "failed" badge but no error message or logs. Users must guess why a scan failed.

### Changes

**Backend — JobWorker types**: Add `warning` field to `IJob` in `src/api/services/abstractions/JobWorker.ts` (currently missing despite DB schema having the column). The `upgradeJobs` table already stores `logs` and `warning`; the list-jobs API route schema already returns them.

**UI — JobsGateway/Repository**: Add `logs: string | null` and `warning: string | null` to `IJob` in `src/ui/features/jobs/abstractions/JobsGateway.ts` and `JobsRepository` types. These fields are already in the API response but not mapped in the UI types.

**UI — JobManagerPresenter**: Add `logs: string | null` and `warning: string | null` to `IJobViewModel` in `src/ui/presentation/jobs/JobManager/abstractions/JobManagerPresenter.ts`. Add `expandedJobId: string | null` state with `toggleJobDetails(jobId: string)` action.

**UI — JobManagerPage**: Clicking a job row toggles an expandable detail section below it showing:

- Warning text (amber) if present
- Logs content in a `<Code>` block if present
- For failed jobs, the `ERROR: ...` line is visually highlighted

## Part B: App Logs System

### DB Schema

New `app_logs` table:

```sql
CREATE TABLE app_logs (
  id TEXT PRIMARY KEY NOT NULL,
  level TEXT NOT NULL,           -- 'error' | 'warn' | 'info'
  source TEXT NOT NULL,          -- 'scan' | 'upgrade' | 'install' | 'step-resolver' | 'git' | 'clone'
  project_id TEXT,               -- nullable FK to projects
  message TEXT NOT NULL,         -- human-readable summary
  details TEXT,                  -- nullable, longer context (stack trace, command output)
  created_at INTEGER NOT NULL    -- epoch ms
);
```

Drizzle schema added to `src/api/db/schema.ts`. Migration file `src/api/db/migrations/0009_app_logs.sql` (follows existing numbering after `0008_upgrade_sessions.sql`). SQL generated from Drizzle schema or hand-written to match.

### Configurable Log Level

New app setting key: `log_level`. Values: `error`, `warn`, `info`. Default: `warn`.

Level hierarchy: `error` > `warn` > `info`. If `log_level` is `warn`, then `error` and `warn` entries are written; `info` is skipped. If `error`, only errors are written.

Managed via the existing App Settings UI page (already built).

### AppLogService

New DI-wired singleton service.

```
Interface:
  log(level: 'error' | 'warn' | 'info', source: string, projectId: string | null, message: string, details?: string): Promise<void>
```

Behavior:

1. Read `log_level` from `app_settings` table (cache for 10 seconds to avoid per-call DB reads)
2. If entry level is below configured threshold, skip
3. Insert row into `app_logs`
4. Broadcast `log:created` WebSocket event

Dependencies: `DatabaseClient`, `WebSocketBroadcaster`.

### Integration Points

Where AppLogService.log() gets called:

| Location                                                  | Level | Source                             | What                             |
| --------------------------------------------------------- | ----- | ---------------------------------- | -------------------------------- |
| `JobWorker.executeJob()` catch                            | error | job type (`scan`, `install`, etc.) | `String(error)` with job context |
| `ScanJobExecutor` 0-dep warning                           | warn  | `scan`                             | Stale lockfile warning           |
| `UpgradeSessionService.executeStep()` (wrap in try/catch) | error | `step-resolver`                    | Step execution failure           |
| `CloneJobExecutor` failure                                | error | `clone`                            | Clone command failure            |

Future integration points can be added incrementally.

### Shared Route Definitions

```typescript
// src/shared/routes/logs.ts
// All querystring fields use z.string().optional() per existing pattern (see jobs.ts)

listLogsRoute: GET /api/logs
  querystring: { level?, source?, projectId?, from?, to?, limit?, offset? }
  response: { items: AppLog[], total: number }

deleteLogsRoute: DELETE /api/logs
  body: { level?, source?, projectId?, from?, to? }
  response: { deleted: number }
```

All filter params use `z.string().optional()`. No filter = all logs. `from` and `to` are epoch ms as strings (parsed to integers in route handler). Delete uses body (not querystring) to match REST conventions for parameterized deletes.

### API Routes

`src/api/routes/logs.ts` — Fastify plugin.

**GET /api/logs**: Query `app_logs` with optional filters. Supports `level`, `source`, `projectId`, `from` (created_at >=), `to` (created_at <=), `limit` (default 100), `offset` (default 0). Returns `{ items, total }`. Ordered by `created_at` DESC.

**DELETE /api/logs**: Bulk delete with same filter params (except limit/offset). Returns `{ deleted: number }`. No filter = delete all.

### WebSocket Event

New event type added to `WSEventMap`:

```typescript
interface WSLogCreated {
  id: string;
  level: string;
  source: string;
  projectId: string | null;
  message: string;
  createdAt: number;
}

// In WSEventMap:
"log:created": WSLogCreated;
```

### UI — Features Layer

**AppLogsGateway**: `list(filters)`, `deleteFiltered(filters)`
**AppLogsRepository**: Holds current log entries list and total count.

### UI — Presentation Layer

**UseCases**: `LoadAppLogsUseCase`, `DeleteAppLogsUseCase`

**AppLogsPresenter** state:

- `loading: boolean`
- `logs: LogViewModel[]` (id, level, source, projectName, message, details, createdAt)
- `total: number`
- Filter state: `levelFilter`, `sourceFilter`, `projectFilter`, `dateFrom`, `dateTo`
- Pagination: `page`, `pageSize` (default 50)
- `expandedLogId: string | null`

Actions:

- `load()` — fetch with current filters
- `setFilter(field, value)` — update filter, reset page, reload
- `clearFilters()` — reset all filters, reload
- `toggleDetails(id)` — expand/collapse log entry
- `deleteFiltered()` — delete logs matching current filters, reload
- WebSocket listener for `log:created` — prepend to list if matches current filters

**AppLogsPage** at `/logs`:

- Filter bar: level dropdown, source dropdown, project dropdown, date-from input, date-to input
- Table: timestamp, level badge (red/amber/blue), source, project name, message
- Expandable rows for details column
- Footer: pagination controls, "Delete filtered" button (with count), "Delete all" if no filters
- Real-time updates via WebSocket

Nav link "Logs" added to app header.

### Testing

- `AppLogService` unit tests: level gating, DB writes, WS broadcast
- `logs` route tests: list with filters, delete with filters, pagination
- `AppLogsPresenter` tests: filter state, load, delete, WS integration
- Existing tests unaffected (AppLogService injected alongside existing services)

### File Inventory

**Backend (new)**:

- `src/api/db/schema.ts` — add `appLogs` table
- `src/api/services/abstractions/AppLogService.ts`
- `src/api/services/AppLogService.ts`
- `src/shared/routes/logs.ts`
- `src/api/routes/logs.ts`
- `src/shared/websocket/types.ts` — add `WSLogCreated` + event map entry

**Backend (modified)**:

- `src/api/feature.ts` — `container.register(AppLogService).inSingletonScope()`
- `src/api/server.ts` — register logs routes
- `src/api/services/JobWorker.ts` — inject AppLogService, log on error
- `src/api/services/UpgradeSessionService.ts` — wrap `resolver.execute()` in try/catch, log step execution errors, re-throw
- `src/api/services/jobExecutors/ScanJobExecutor.ts` — log 0-dep warning

**UI (new)**:

- `src/ui/features/appLogs/` — Gateway, Repository, abstractions, feature
- `src/ui/presentation/logs/LogBrowser/` — Presenter, Provider, Page, feature (follows `jobs/JobManager/` convention)
- `src/ui/presentation/logs/useCases/` — LoadAppLogsUseCase, DeleteAppLogsUseCase, abstractions, feature

**UI (modified)**:

- `src/ui/App.tsx` — register features, add route + nav link
- `src/ui/features/jobs/` — add `logs` and `warning` to Job type (Part A)
- `src/ui/presentation/jobs/JobManager/` — expandable job details (Part A)
