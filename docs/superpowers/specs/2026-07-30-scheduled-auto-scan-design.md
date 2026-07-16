# Scheduled Auto-Scan Design

## Overview

Add scheduled automatic dependency scanning per project. Uses bree (worker thread job scheduler) to trigger scans on configurable intervals. Global default interval with per-project overrides.

## Data Model

### New table: `scan_schedules`

```sql
scan_schedules (
  id           TEXT PK,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  interval     TEXT NOT NULL,  -- "6h" | "12h" | "24h" | "48h" | "weekly" | "disabled"
  last_run_at  INTEGER,        -- epoch ms, null if never run
  next_run_at  INTEGER,        -- epoch ms, computed on schedule/after run
  enabled      INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
)
```

Drizzle schema in `src/api/db/schema.ts` follows existing FK pattern (see `securityChecks`, `scanResults`). `ON DELETE CASCADE` ensures schedule rows are cleaned up when a project is removed.

### Global default

Stored in existing `app_settings` table as key `"scanScheduleDefault"` with value from preset list. Default value when unset: `"disabled"`.

### Preset intervals

`6h`, `12h`, `24h`, `48h`, `weekly`, `disabled`

### Resolution logic

Enforced in `ScanSchedulerService.resolveInterval(projectId)`:

1. If `scan_schedules` row exists for the project, use its `interval` value.
2. Else, read `app_settings` key `"scanScheduleDefault"`.
3. If neither exists, return `"disabled"`.

## API Layer

### New service: `ScanSchedulerService`

Abstraction in `src/api/services/abstractions/ScanSchedulerService.ts`, implementation in `src/api/services/ScanSchedulerService.ts`.

Dependencies: `DatabaseClient`, `JobWorker`, `ErrorReporter`.

**Responsibilities:**

- **Boot (`init()`):** Read all project schedules from DB (explicit + global default for remaining projects). Compute `next_run_at` for each. Register bree jobs. Stagger past-due scans (add random 0–60s delay per project) to avoid thundering herd on restart.
- **Schedule change:** Update DB row, restart bree job for affected project(s).
- **Global default change:** Recalculate and restart bree jobs for all projects using the default (no explicit override).
- **Scan complete hook:** Update `last_run_at`, recompute `next_run_at`.
- **Project deletion:** Listen for project removal (or hook into the delete route). Stop and remove the bree job for the deleted project. DB row is cleaned up by `ON DELETE CASCADE`.
- **Disabled interval:** When a project's resolved interval is `"disabled"`, do not register a bree job. If a bree job already exists for that project, remove it. `"disabled"` means "no scheduled scanning" — no job, no timer.
- **Shutdown (`stop()`):** Stop bree gracefully.

### Bree integration

- Single bree instance, created in `init()`.
- Each active project gets a bree job named `scan-{projectId}`. Project IDs are UUIDs from `generateId()` — safe as bree job names (alphanumeric + hyphens only).
- **Worker-to-main communication:** Worker script is a minimal JS file that imports `parentPort` from `worker_threads` and calls `parentPort.postMessage({ projectId })` on execution. `ScanSchedulerService` listens for `workerMessageHandler` events on the bree instance and calls `JobWorker.enqueue()` on the main thread. This keeps all DI services on the main thread.
- Bree's built-in overlap prevention ensures a project is not scanned concurrently by the scheduler.
- On server restart, timers are rebuilt from DB state. Past-due scans (`next_run_at` < now) are staggered with random delay to avoid enqueuing all at once.

### New routes

Defined in `src/shared/routes/scanSchedules.ts`, handlers in `src/api/routes/scanSchedules.ts`.

Global default routes use a distinct path prefix to avoid ambiguity with the `/:projectId` parameter route:

| Method | Path                                  | Purpose                                                              |
| ------ | ------------------------------------- | -------------------------------------------------------------------- |
| GET    | `/api/scan-schedules`                 | List all project schedules (including projects using global default) |
| PUT    | `/api/scan-schedules/:projectId`      | Set per-project schedule override                                    |
| DELETE | `/api/scan-schedules/:projectId`      | Remove override, revert to global default                            |
| GET    | `/api/settings/scan-schedule-default` | Get global default interval                                          |
| PUT    | `/api/settings/scan-schedule-default` | Set global default interval                                          |

Global default routes live under `/api/settings/` alongside existing app settings routes, avoiding the `/:projectId` collision.

### WebSocket

No new events. Scheduled scans enqueue through `JobWorker`, which executes via `ScanJobExecutor`. That executor already broadcasts `scan:progress` and `scan:complete`. No double-broadcast — same single code path regardless of manual vs scheduled trigger.

## UI Layer

Follows existing MVP pattern: Gateway, Repository, UseCase, Presenter, React.

### Feature layer

- `ScanSchedulesGateway` — abstraction in `src/ui/features/scanSchedules/abstractions/ScanSchedulesGateway.ts`, implementation in `src/ui/features/scanSchedules/ScanSchedulesGateway.ts`. HTTP calls to schedule routes.
- `ScanSchedulesRepository` — abstraction in `src/ui/features/scanSchedules/abstractions/ScanSchedulesRepository.ts`, implementation in `src/ui/features/scanSchedules/ScanSchedulesRepository.ts`. Holds per-project schedules and global default in memory.

### Presentation layer

- `LoadScanScheduleUseCase` — fetch schedule for a project (in `src/ui/presentation/scanSchedules/useCases/`)
- `UpdateScanScheduleUseCase` — set per-project override
- `ResetScanScheduleUseCase` — remove override (revert to default)
- `LoadScanScheduleDefaultUseCase` — fetch global default
- `UpdateScanScheduleDefaultUseCase` — set global default
- Presenters: extend `AppSettingsPresenter` for global default, extend `ProjectDetailPresenter` for per-project override

### App Settings page

Add "Scan Schedule" section to existing App Settings page. Single dropdown for global default interval. Preset choices: 6h, 12h, 24h, 48h, weekly, disabled.

### Project Detail page

Add schedule override section. Dropdown showing:

- "Default ({globalInterval})" — uses global setting
- Explicit overrides: 6h, 12h, 24h, 48h, weekly, disabled

Displays `last_run_at` and `next_run_at` timestamps when available.

### Dashboard

No changes needed. Scheduled scans trigger `scan:complete` WS event, which already refreshes dashboard widgets via `DashboardPresenter`.

## Migration

New migration file for `scan_schedules` table creation. Follow existing pattern in `src/api/db/migrations/`.

## Testing

- `ScanSchedulerService` unit tests: schedule creation, interval computation, restart on change, boot recovery, stagger logic
- Route integration tests: CRUD operations on schedules, global default routes
- UI presentation tests: presenter VM reflects schedule state, dropdown interactions
