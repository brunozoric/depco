# Plan: Interrupted Job Status

Spec: `docs/superpowers/specs/2026-08-03-interrupted-job-status-design.md`

## Chunk 1 — Backend (2 files)

### 1.1 `src/api/services/JobWorker.ts` — `finishJob()` status union

Add `"interrupted"` to the status parameter type on `finishJob()` (line 298).

```typescript
status: "completed" | "failed" | "cancelled" | "interrupted",
```

### 1.2 `src/api/services/JobWorker.ts` — `recoverStaleJobs()`

Change status from `"failed"` to `"interrupted"` and add logs message (line 363-368).

```typescript
public async recoverStaleJobs(): Promise<void> {
    await this.databaseClient.db
        .update(upgradeJobs)
        .set({
            status: "interrupted",
            completedAt: Date.now(),
            logs: "Job interrupted by server restart"
        })
        .where(inArray(upgradeJobs.status, ["running", "pending"]))
        .run();
}
```

### Verify

Run `yarn test src/api/services/__tests__/JobWorker.test.ts` — fix any broken assertions.

## Chunk 2 — Frontend status types and color maps (4 files)

### 2.1 `src/ui/features/upgrades/abstractions/UpgradesGateway.ts` line 13

Add `"cancelled"` and `"interrupted"` to status union:

```typescript
status: "pending" | "running" | "completed" | "failed" | "cancelled" | "interrupted";
```

### 2.2 `src/ui/presentation/jobs/JobProgress/abstractions/JobProgressPresenter.ts` lines 6, 15

Add `"cancelled"` and `"interrupted"` to both status unions.

### 2.3 `src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx`

Add to `STATUS_COLORS`: `interrupted: "orange"`
Add to `STATUS_FILTER_OPTIONS`: `{ label: "Interrupted", value: "interrupted" }`

### 2.4 `src/ui/presentation/dashboard/Dashboard/components/RecentActivityWidget.tsx`

Add to `STATUS_COLOR`: `interrupted: "orange"`

### Verify

Run `yarn typecheck` — no type errors.

## Chunk 3 — Frontend completion/terminal checks (4 files)

### 3.1 `src/ui/presentation/projects/ProjectDetail/components/ChangelogModal.tsx` lines 126-128

Add `data.status === "interrupted"` to completion check.

### 3.2 `src/ui/presentation/projects/UpgradeWizard/components/ChangelogDrawer.tsx` lines 130-132

Add `data.status === "interrupted"` to completion check.

### 3.3 `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts` line 88

Add `data.status === "interrupted"` to error state handling alongside `"failed"` and `"cancelled"`.

### 3.4 `src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts` line 109

Add `"interrupted"` (and `"cancelled"` which is also missing) to the terminal status check.

### Verify

Run `yarn typecheck` and `yarn test` — all green.

## Chunk 4 — Tests

### 4.1 Update route test mocks

In `src/api/routes/__tests__/licenses.test.ts`, `autoFix.test.ts`, `changelogs.test.ts`, `packageManager.test.ts` — if any mock `recoverStaleJobs`, verify they don't assert on the "failed" status value.

### 4.2 Add `recoverStaleJobs` test in `JobWorker.test.ts`

Test that after inserting running/pending jobs, calling `recoverStaleJobs()` sets their status to `"interrupted"` with logs `"Job interrupted by server restart"`.

### Verify

Run full `yarn test` — all 1638+ tests pass.
