# Job Progress Enhancement — Design Spec

Add percentage-based progress reporting to the job execution system. Available to all job executors, initially used by ScanJobExecutor. UI shows progress bar + label above logs.

## Backend

### IJobExecutionContext

Add method:

```typescript
setProgress: (input: { percent: number; label?: string }) => void;
```

All executors receive this. Executors that don't call it stay indeterminate (progress=null in DB).

### JobWorker implementation

In `executeJob()`, create a `setProgress` closure alongside existing `appendLog`:

- Every call immediately broadcasts `job:progress` WebSocket event
- DB writes throttled to max 1/sec (SQLite performance — avoid writing on every percentage tick)
- Internal state tracks last DB write timestamp; skips DB update if <1s since last, except when percent=100 (always write completion)
- On job completion in `finishJob()`: if progress was set during execution (not null), set progress=100 in the final DB update. If executor never called setProgress (progress is null), leave it null — job stays indeterminate.

### DB columns

Already exist from sub-project 1 Task 4:

- `progress` INTEGER nullable (null = indeterminate)
- `progress_label` TEXT nullable

No migration needed.

## WebSocket

New event in `WSEventMap`:

```typescript
"job:progress": {
    jobId: string;
    referenceId: string;
    progress: number;
    progressLabel: string | null;
}
```

Type definition added to `src/shared/websocket/types.ts`.

## UI

### ViewModel changes

`IJobProgressActiveJobViewModel` gets two new fields:

- `progress: number | null`
- `progressLabel: string | null`

### Presenter changes

`JobProgressPresenter.trackJob()` subscribes to `job:progress` event (in addition to existing `job:status` + `job:log`). On `job:progress` event, update the active job's `progress` and `progressLabel` fields directly on the observable state (no need for a new repository method — merge into existing active job object via `runInAction`).

`untrackJob()` unsubscribes from `job:progress`.

When loading active job from API (initial fetch), read `progress`/`progressLabel` from the job record.

### Panel changes

`JobProgressPanel` — when `activeJob.progress !== null` and `activeJob.status === "running"`:

- Render Mantine `Progress` component above the log section
- Show `progressLabel` as text below the progress bar
- Progress bar is determinate (value = progress percent)

When `activeJob.progress === null`:

- No progress bar shown (existing behavior, spinner/badge only)

### Jobs Gateway

`IJobsGateway` list/get responses need `progress` and `progressLabel` fields. API route for jobs needs to include these in response.

## ScanJobExecutor Integration

Add `context.setProgress()` calls at phase boundaries. ScanJobExecutor already receives context — just call the new method.

| Point                           | Percent | Label                                       |
| ------------------------------- | ------- | ------------------------------------------- |
| Start of execute()              | 0       | "Collecting installed packages..."          |
| After collectInstalledVersions  | 5       | "Classifying dependencies..."               |
| During registry lookup batches  | 10-60   | "Resolving dependencies: {current}/{total}" |
| After registry lookups complete | 60      | "Saving scan results..."                    |
| After DB persist                | 70      | "Scanning vulnerabilities..."               |
| After vulnerability scan        | 85      | "Scanning licenses..."                      |
| After license scan              | 95      | "Building dependency graph..."              |
| End of execute()                | 100     | "Scan complete"                             |

Progress during registry lookups: calculated as `10 + Math.round((current / total) * 50)` to map the 10-60% range.

Note: setProgress is called in ScanService's `onProgress` callback, which already fires per-package during registry lookups. ScanJobExecutor already has this callback wired (the `scan:progress` broadcast inside the onProgress closure). Just add a `context.setProgress()` call alongside the existing broadcast.

## Files changed

### Backend

- `src/api/services/jobExecutors/abstractions/JobExecutor.ts` — add `setProgress` to `IJobExecutionContext`
- `src/api/services/JobWorker.ts` — implement `setProgress` closure with DB throttle + WebSocket broadcast
- `src/api/services/jobExecutors/ScanJobExecutor.ts` — add setProgress calls at phase boundaries
- `src/shared/websocket/types.ts` — add `job:progress` event type

### UI

- `src/ui/presentation/jobs/JobProgress/abstractions/JobProgressPresenter.ts` — add progress/progressLabel to ViewModel
- `src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts` — subscribe to job:progress, update state
- `src/ui/presentation/jobs/JobProgress/components/JobProgressPanel.tsx` — render progress bar
- `src/ui/features/jobs/abstractions/JobsGateway.ts` — add progress fields to Job interface
- `src/ui/features/jobs/JobsGateway.ts` — map progress fields

### Routes + shared schemas

- `src/shared/routes/jobs.ts` — add `progress` and `progressLabel` to `jobSchema`
