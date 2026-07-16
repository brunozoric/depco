# Job Progress Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add percentage-based progress reporting to job execution. Available to all executors, initially used by ScanJobExecutor. UI shows progress bar above logs.

**Architecture:** Add `setProgress` to `IJobExecutionContext`. JobWorker implements it with throttled DB writes + WebSocket broadcast. UI subscribes to `job:progress` event, renders Mantine Progress bar. ScanJobExecutor reports progress at phase boundaries.

**Tech Stack:** Fastify, MobX, Mantine, Vitest, WebSocket

## Global Constraints

- Use `yarn full` for all checks (lint, format, typecheck, build, tests)
- Named interfaces only — no inline structural types
- Object params with named keys when function has 2+ params
- Full words in identifiers
- Never import *Impl outside its own file — use abstractions + DI container

---

### Task 1: Backend — setProgress on IJobExecutionContext + JobWorker

**Files:**

- Modify: `src/api/services/jobExecutors/abstractions/JobExecutor.ts` — add `setProgress` to `IJobExecutionContext`
- Modify: `src/api/services/JobWorker.ts` — implement `setProgress` closure in `executeJob()`, set progress=100 in `finishJob()` conditionally
- Modify: `src/shared/websocket/types.ts` — add `job:progress` event type
- Test: `src/api/services/__tests__/JobWorker.test.ts` (if exists, else test via ScanJobExecutor integration)

**Interfaces:**

- Consumes: `upgradeJobs` table (already has `progress`, `progressLabel` columns from prior migration)
- Produces: `IJobExecutionContext.setProgress(input: { percent: number; label?: string }): void`. New WS event `"job:progress": { jobId: string; referenceId: string; progress: number; progressLabel: string | null }`

- [ ] **Step 1: Add setProgress to IJobExecutionContext**

In `src/api/services/jobExecutors/abstractions/JobExecutor.ts`:

```typescript
export interface IJobExecutionContext {
  jobId: string;
  referenceId: string;
  projectPath: string;
  packageManager: string;
  packagesJson: string | null;
  project: IJobExecutionProject | null;
  appendLog: (line: string) => void;
  setProgress: (input: { percent: number; label?: string }) => void;
  signal: AbortSignal;
}
```

- [ ] **Step 2: Add job:progress to WSEventMap**

In `src/shared/websocket/types.ts`, add the type and event:

```typescript
export interface WSJobProgress {
  jobId: string;
  referenceId: string;
  progress: number;
  progressLabel: string | null;
}
```

Add to `WSEventMap`:

```typescript
"job:progress": WSJobProgress;
```

- [ ] **Step 3: Implement setProgress in JobWorker.executeJob()**

In `src/api/services/JobWorker.ts`, inside `executeJob()`, alongside the existing `appendLog` closure (around line 122), add:

```typescript
let progressUsed = false;
let lastProgressDbWrite = 0;

const setProgress = (input: { percent: number; label?: string }): void => {
  progressUsed = true;
  const progressLabel = input.label ?? null;

  this.webSocketBroadcaster.broadcast("job:progress", {
    jobId: job.id,
    referenceId: job.referenceId,
    progress: input.percent,
    progressLabel
  });

  const now = Date.now();
  if (input.percent >= 100 || now - lastProgressDbWrite >= 1000) {
    lastProgressDbWrite = now;
    void this.databaseClient.db
      .update(upgradeJobs)
      .set({ progress: input.percent, progressLabel })
      .where(eq(upgradeJobs.id, job.id))
      .run();
  }
};
```

Pass `setProgress` into all `executor.execute()` context objects (both the clone/changelog path at line 141 and the project path at line 176).

- [ ] **Step 4: Set progress=100 in finishJob() conditionally**

In `finishJob()`, update the DB set clause to include progress=100 only if progress was used. This requires threading `progressUsed` to `finishJob`. Simplest approach: add an optional `progressUsed` parameter to `finishJob()`:

```typescript
private async finishJob(
    jobId: string,
    referenceId: string,
    referenceType: string,
    type: string,
    status: string,
    logs: string,
    progressUsed?: boolean
): Promise<void> {
    const updateFields: Record<string, unknown> = {
        status,
        logs,
        completedAt: Date.now()
    };
    if (progressUsed) {
        updateFields.progress = 100;
        updateFields.progressLabel = null;
    }
    await this.databaseClient.db
        .update(upgradeJobs)
        .set(updateFields)
        .where(eq(upgradeJobs.id, jobId))
        .run();
    // ... rest of finishJob (broadcast, etc.)
```

Thread `progressUsed` through from `executeJob()` to `finishJob()` calls.

- [ ] **Step 5: Run full checks**

Run: `yarn full`
Expected: all tests pass. Existing executors don't call setProgress, so behavior unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/api/services/jobExecutors/abstractions/JobExecutor.ts src/api/services/JobWorker.ts src/shared/websocket/types.ts
git commit -m "feat(jobs): add setProgress to IJobExecutionContext with throttled DB writes"
```

---

### Task 2: ScanJobExecutor — report progress at phase boundaries

**Files:**

- Modify: `src/api/services/jobExecutors/ScanJobExecutor.ts` — add setProgress calls
- Test: `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts` — verify progress reported

**Interfaces:**

- Consumes: `IJobExecutionContext.setProgress` from Task 1
- Produces: ScanJobExecutor reports progress at each scan phase

- [ ] **Step 1: Write failing test for scan progress**

In `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts`, add a test that verifies setProgress is called during scan. Check existing test patterns — the executor tests likely use mocked services.

```typescript
it("reports progress during scan execution", async () => {
  // Setup: mock services, create executor context with setProgress spy
  // Execute scan
  // Assert: setProgress called with { percent: 0, label: "Collecting installed packages..." }
  // Assert: setProgress called with percent >= 60 at some point (after registry lookups)
  // Assert: final setProgress has percent close to 95-100
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn full`
Expected: fails — setProgress not called yet

- [ ] **Step 3: Add setProgress calls to ScanJobExecutor.execute()**

In `src/api/services/jobExecutors/ScanJobExecutor.ts`, in the `execute()` method:

Before scan call (around line 233):

```typescript
context.setProgress({ percent: 0, label: "Collecting installed packages..." });
```

In the scan onProgress callback (around line 238-244), alongside the existing scan:progress broadcast:

```typescript
(packageName, current, total) => {
  this.webSocketBroadcaster.broadcast("scan:progress", {
    projectId: context.referenceId,
    packageName,
    current,
    total
  });
  context.setProgress({
    percent: 10 + Math.round((current / total) * 50),
    label: `Resolving dependencies: ${current}/${total}`
  });
};
```

After scan result received (around line 253):

```typescript
context.setProgress({ percent: 60, label: "Saving scan results..." });
```

After DB persist (after line 296):

```typescript
context.setProgress({ percent: 70, label: "Scanning vulnerabilities..." });
```

After vulnerability scan (after line ~325):

```typescript
context.setProgress({ percent: 85, label: "Scanning licenses..." });
```

After license scan (after line ~395):

```typescript
context.setProgress({ percent: 95, label: "Building dependency graph..." });
```

Note: exact line numbers may have shifted from prior tasks. Place calls at the logical phase boundaries.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn full`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/api/services/jobExecutors/ScanJobExecutor.ts src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts
git commit -m "feat(scan): report progress percentage at scan phase boundaries"
```

---

### Task 3: Shared route schema + UI gateway — add progress fields

**Files:**

- Modify: `src/shared/routes/jobs.ts` — add `progress` and `progressLabel` to `jobSchema`
- Modify: `src/ui/features/jobs/abstractions/JobsGateway.ts` — add progress fields to `IJob`
- Modify: `src/ui/features/upgrades/abstractions/UpgradesGateway.ts` — add progress fields to `IJob`
- Modify: `src/ui/presentation/jobs/JobProgress/abstractions/JobProgressPresenter.ts` — add progress/progressLabel to `IJobProgressActiveJobViewModel`

**Interfaces:**

- Consumes: DB `progress`/`progressLabel` columns (already exist)
- Produces: `jobSchema` includes `progress: z.number().nullable()` and `progressLabel: z.string().nullable()`. All UI job interfaces include these fields.

- [ ] **Step 1: Update jobSchema in shared routes**

In `src/shared/routes/jobs.ts`, add to `jobSchema`:

```typescript
const jobSchema = z.object({
  id: z.string(),
  referenceId: z.string(),
  referenceType: z.string(),
  type: z.string(),
  status: z.string(),
  packages: z.string().nullable(),
  logs: z.string().nullable(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
  warning: z.string().nullable().optional(),
  progress: z.number().nullable(),
  progressLabel: z.string().nullable()
});
```

- [ ] **Step 2: Update UI job interfaces**

In `src/ui/features/jobs/abstractions/JobsGateway.ts`, add to `IJob`:

```typescript
progress: number | null;
progressLabel: string | null;
```

In `src/ui/features/upgrades/abstractions/UpgradesGateway.ts`, add to `IJob`:

```typescript
progress: number | null;
progressLabel: string | null;
```

- [ ] **Step 3: Update IJobProgressActiveJobViewModel**

In `src/ui/presentation/jobs/JobProgress/abstractions/JobProgressPresenter.ts`:

```typescript
export interface IJobProgressActiveJobViewModel {
  id: string;
  type: "dependency" | "transient" | "yarn";
  status: "pending" | "running" | "completed" | "failed" | "cancelled" | "interrupted";
  logs: string;
  startedAt: number | null;
  completedAt: number | null;
  progress: number | null;
  progressLabel: string | null;
}
```

- [ ] **Step 4: Update JobProgressPresenter vm getter**

In `src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts`, add progress fields to the activeJob mapping in `get vm()` (around line 52-59):

```typescript
activeJob: activeJob
    ? {
          id: activeJob.id,
          type: activeJob.type,
          status: activeJob.status,
          logs: activeJob.logs ?? "",
          startedAt: activeJob.startedAt,
          completedAt: activeJob.completedAt,
          progress: activeJob.progress ?? null,
          progressLabel: activeJob.progressLabel ?? null
      }
    : null,
```

- [ ] **Step 5: Fix any TypeScript errors from new required fields**

Run `yarn full` — fix any test files or gateway implementations that create Job objects without progress/progressLabel. Add `progress: null, progressLabel: null` to existing test fixtures.

- [ ] **Step 6: Commit**

```bash
git add src/shared/routes/jobs.ts src/ui/features/jobs/abstractions/JobsGateway.ts src/ui/features/upgrades/abstractions/UpgradesGateway.ts src/ui/presentation/jobs/JobProgress/abstractions/JobProgressPresenter.ts src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts
git commit -m "feat(jobs): add progress fields to job schema and UI interfaces"
```

---

### Task 4: UI — job:progress subscription + progress bar

**Files:**

- Modify: `src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts` — subscribe to `job:progress` event
- Modify: `src/ui/presentation/jobs/JobProgress/components/JobProgressPanel.tsx` — render progress bar
- Test: `src/ui/presentation/jobs/JobProgress/__tests__/JobProgressPresenter.test.ts` (if exists)

**Interfaces:**

- Consumes: `job:progress` WebSocket event, `IJobProgressActiveJobViewModel.progress`/`progressLabel`
- Produces: progress bar in JobProgressPanel when progress is not null

- [ ] **Step 1: Add job:progress subscription to JobProgressPresenter**

In `src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts`:

Add a new handler field:

```typescript
private readonly handleJobProgress: WebSocketListener.Callback<"job:progress">;
```

In constructor, define handler:

```typescript
this.handleJobProgress = data => {
  if (data.jobId !== this.currentJobId || !this.currentReferenceId) {
    return;
  }
  runInAction(() => {
    const activeJob = this.upgradesRepository.getActiveJob(this.currentReferenceId!);
    if (activeJob) {
      activeJob.progress = data.progress;
      activeJob.progressLabel = data.progressLabel;
    }
  });
};
```

In `trackJob()`, add subscription:

```typescript
this.webSocketListener.on("job:progress", this.handleJobProgress);
```

In `untrackJob()`, add unsubscription:

```typescript
this.webSocketListener.off("job:progress", this.handleJobProgress);
```

- [ ] **Step 2: Add progress bar to JobProgressPanel**

In `src/ui/presentation/jobs/JobProgress/components/JobProgressPanel.tsx`:

Add `Progress` import from Mantine:

```typescript
import { Badge, Card, Group, Progress, Stack, Text, Title, Tooltip } from "@mantine/core";
```

After the Group with title/badge and before the JobLogViewer, add:

```typescript
{activeJob.progress !== null && activeJob.status === "running" && (
    <Stack gap={4}>
        <Progress value={activeJob.progress} size="lg" animated />
        {activeJob.progressLabel && (
            <Text size="xs" c="dimmed">{activeJob.progressLabel}</Text>
        )}
    </Stack>
)}
```

- [ ] **Step 3: Run full checks**

Run: `yarn full`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts src/ui/presentation/jobs/JobProgress/components/JobProgressPanel.tsx
git commit -m "feat(ui): show progress bar and label in job progress panel"
```
