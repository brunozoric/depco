# Job Management — Global Jobs List + Cancel/Kill

Date: 2026-07-17

## Problem

No global visibility into running jobs. Jobs are only visible per-project via JobProgressPanel. No way to cancel or kill a hung job — once `executeJob` fires, the subprocess runs to completion or failure. Users can't tell if a job is genuinely hung or just slow.

## Design

### CommandRunner — AbortSignal support

`src/api/services/abstractions/CommandRunner.ts` — add optional `signal` to both option types:

```typescript
export interface ICommandRunnerRunOptions {
  cwd: string;
  signal?: AbortSignal;
}

export interface ICommandRunnerStreamOptions {
  cwd: string;
  onStdout: (line: string) => void;
  onStderr: (line: string) => void;
  signal?: AbortSignal;
}
```

`src/api/services/CommandRunner.ts` — pass `signal` to execa (both `run` and `runStreaming`):

```typescript
const subprocess = execa(command, args, {
  cwd: options.cwd,
  reject: false,
  signal: options.signal
});
```

Execa natively supports AbortSignal — kills the subprocess when aborted. Existing callers don't pass `signal` — no breaking change.

### Service signal threading

Services that call `CommandRunner` gain optional `signal?: AbortSignal` as last parameter on their public methods:

- `UpgradeService.upgradePackage(path, name, version, onLog, signal?)` — passes to `commandRunner.runStreaming`
- `UpgradeService.refreshTransient(path, onLog, signal?)` — passes to `commandRunner.runStreaming`
- `PackageManagerService.updateVersion(path, pm, version, onLog, signal?)` — passes to `commandRunner.runStreaming`
- `ScanService.scan(path, pm, force, onProgress, signal?)` — passes to `commandRunner.run` calls

Each service forwards `signal` to `CommandRunner` via the options object. No other logic changes.

### JobWorker — cancellation + global list

`src/api/services/JobWorker.ts`:

**In-memory controller map:**

```typescript
readonly #controllers = new Map<string, AbortController>();
```

**executeJob changes:**

- Create `AbortController` before executing, store in `#controllers` map keyed by `job.id`
- Pass `controller.signal` to each service call
- Remove from `#controllers` in `finishJob`
- Update `finishJob` signature to accept `"completed" | "failed" | "cancelled"` (currently only `"completed" | "failed"`)

**New method — `cancelJob(jobId: string): Promise<void>`:**

- Fetch job from DB
- If `"pending"`: update status to `"cancelled"`, set `completedAt: Date.now()`, broadcast `job:status` with status `"cancelled"`
- If `"running"`: call `controller.abort()` from `#controllers`. The aborted subprocess throws in `executeJob`'s try/catch. Override the job's final status to `"cancelled"` (not `"failed"`). To distinguish abort from real failure: check if the controller's signal was aborted in the catch block.
- If already `"completed"`, `"failed"`, or `"cancelled"`: no-op

**New method — `listAllJobs(status?: string): Promise<Job[]>`:**

- No filter: `SELECT * FROM upgrade_jobs ORDER BY started_at DESC NULLS LAST`
- With filter: add `WHERE status = ?`

**IJobWorker interface update** (`src/api/services/abstractions/JobWorker.ts`):

```typescript
cancelJob(jobId: string): Promise<void>;
listAllJobs(status?: string): Promise<IJob[]>;
```

**New status value `"cancelled"`** — distinct from `"failed"`. A cancelled job is intentional, not an error.

### API routes

New shared route definitions in `src/shared/routes/jobs.ts`:

```typescript
export const listAllJobsRoute = defineRoute({
  method: "GET",
  path: "/api/jobs",
  description: "List all jobs across all projects",
  params: z.object({}),
  querystring: z.object({ status: z.string().optional() }),
  response: z.object({ items: z.array(jobSchema), total: z.number() })
});

export const cancelJobRoute = defineRoute({
  method: "POST",
  path: "/api/jobs/:jobId/cancel",
  description: "Cancel or kill a job",
  params: z.object({ jobId: z.string() }),
  response: z.object({ success: z.boolean() })
});
```

Handlers in `src/api/routes/jobs.ts` (existing file):

- `GET /api/jobs`: calls `jobWorker.listAllJobs(query.status)`, returns `sendList`
- `POST /api/jobs/:jobId/cancel`: fetches job, 404 if not found, calls `jobWorker.cancelJob(jobId)`, returns `sendNone(reply, 200)`

### UI — /jobs page

Full MVP stack following existing patterns.

**Gateway** (`src/ui/features/jobs/`):

- `IJobsGateway.listAll(status?: string): Promise<IJob[]>`
- `IJobsGateway.cancel(jobId: string): Promise<void>`
- `IJob`: `{ id, projectId, type, status, packages, logs, startedAt, completedAt }` — same shape as existing `UpgradesGateway.Job`

**Repository** (`src/ui/features/jobs/`):

- `IJobsRepository.getJobs(): IJob[]`
- `IJobsRepository.setJobs(jobs: IJob[]): void`
- `IJobsRepository.updateJobStatus(id: string, status: string): void`

**Use cases** (`src/ui/presentation/jobs/JobManager/useCases/`):

- `LoadAllJobsUseCase.execute(status?: string): Promise<void>` — fetches all jobs, stores in repository
- `CancelJobUseCase.execute(jobId: string): Promise<void>` — calls gateway.cancel, updates job status to `"cancelled"` in repository (optimistic)

**Presenter** (`src/ui/presentation/jobs/JobManager/`):

- Private state: `loading`, `statusFilter: string | null`
- VM:
  ```typescript
  interface IJobManagerViewModel {
    loading: boolean;
    statusFilter: string | null;
    jobs: IJobViewModel[];
  }

  interface IJobViewModel {
    id: string;
    projectId: string;
    projectName: string;
    type: string;
    status: string;
    startedAt: number | null;
    completedAt: number | null;
    canCancel: boolean;
  }
  ```
- `projectName` resolved from `ProjectsRepository.getProject(projectId)?.name ?? "Unknown"`
- `canCancel`: `status === "pending" || status === "running"`
- Methods: `load()`, `setStatusFilter(status: string | null)`, `cancel(jobId: string)`
- Subscribes to WS `job:status` events — on event, update the matching job's status in repository. Reload if needed.
- `setStatusFilter` triggers a reload with the new filter

**Page** (`src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx`):

- Header: "Jobs" title with back arrow and refresh button
- Status filter: `SegmentedControl` with All / Running / Pending / Completed / Failed / Cancelled
- Table columns: Project, Type, Status (color-coded Badge), Started, Duration, Actions
- Duration: computed display — if running, show elapsed from `startedAt` to now; if completed/failed/cancelled, show `completedAt - startedAt`
- Actions: red "Kill" `ActionIcon` (X icon), visible when `canCancel`
- Empty state: "No jobs found" text

**Routing** — `/jobs` route in `src/ui/App.tsx`, "Jobs" link in header alongside Settings.

### Status colors

| Status    | Color  |
| --------- | ------ |
| pending   | gray   |
| running   | blue   |
| completed | green  |
| failed    | red    |
| cancelled | orange |

### Files touched

**API — CommandRunner + signal threading:**

1. `src/api/services/abstractions/CommandRunner.ts` — add `signal?` to option types
2. `src/api/services/CommandRunner.ts` — pass signal to execa
3. `src/api/services/abstractions/UpgradeService.ts` — add `signal?` param
4. `src/api/services/UpgradeService.ts` — forward signal to CommandRunner
5. `src/api/services/abstractions/PackageManagerService.ts` — add `signal?` param
6. `src/api/services/PackageManagerService.ts` — forward signal
7. `src/api/services/abstractions/ScanService.ts` — add `signal?` param
8. `src/api/services/ScanService.ts` — forward signal

**API — JobWorker + routes:** 9. `src/api/services/abstractions/JobWorker.ts` — add `cancelJob`, `listAllJobs` 10. `src/api/services/JobWorker.ts` — controller map, cancelJob, listAllJobs, signal threading in executeJob 11. `src/shared/routes/jobs.ts` — new route definitions 12. `src/api/routes/jobs.ts` — new handlers

**UI — jobs page:** 13. `src/ui/features/jobs/abstractions/JobsGateway.ts` — new 14. `src/ui/features/jobs/JobsGateway.ts` — new 15. `src/ui/features/jobs/abstractions/JobsRepository.ts` — new 16. `src/ui/features/jobs/JobsRepository.ts` — new 17. `src/ui/features/jobs/feature.ts` — new 18. `src/ui/presentation/jobs/JobManager/useCases/abstractions/LoadAllJobsUseCase.ts` — new 19. `src/ui/presentation/jobs/JobManager/useCases/LoadAllJobsUseCase.ts` — new 20. `src/ui/presentation/jobs/JobManager/useCases/abstractions/CancelJobUseCase.ts` — new 21. `src/ui/presentation/jobs/JobManager/useCases/CancelJobUseCase.ts` — new 22. `src/ui/presentation/jobs/JobManager/useCases/feature.ts` — new 23. `src/ui/presentation/jobs/JobManager/abstractions/JobManagerPresenter.ts` — new 24. `src/ui/presentation/jobs/JobManager/JobManagerPresenter.ts` — new 25. `src/ui/presentation/jobs/JobManager/feature.ts` — new 26. `src/ui/presentation/jobs/JobManager/JobManagerProvider.tsx` — new 27. `src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx` — new 28. `src/ui/App.tsx` — add /jobs route and header link

**Tests:** 29. `src/api/services/__tests__/CommandRunner.test.ts` — signal abort test 30. `src/api/services/__tests__/JobWorker.test.ts` — cancelJob, listAllJobs tests 31. `src/api/routes/__tests__/jobs.test.ts` — new route handler tests 32. `src/ui/presentation/jobs/JobManager/__tests__/JobManagerPresenter.test.ts` — new

### Testing strategy

- **CommandRunner**: test that abort signal kills subprocess (mock execa or use a long-running command)
- **JobWorker.cancelJob**: test pending cancellation (status update), running cancellation (controller abort), no-op for completed
- **JobWorker.listAllJobs**: test unfiltered and filtered queries
- **API routes**: `GET /api/jobs` returns all jobs; `POST /api/jobs/:jobId/cancel` cancels and returns 200; 404 for unknown jobId
- **JobManagerPresenter**: VM exposes jobs with projectName, canCancel logic, setStatusFilter triggers reload, cancel calls use case
