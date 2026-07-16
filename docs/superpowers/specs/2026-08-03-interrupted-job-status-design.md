# Interrupted Job Status Design

## Problem

When the server restarts, `recoverStaleJobs()` marks all running/pending jobs as "failed". Users cannot distinguish between jobs that failed due to actual errors and jobs that were interrupted by a server restart.

## Solution

Add a new `"interrupted"` status value. `recoverStaleJobs()` sets this instead of `"failed"`. UI displays it with an orange badge and includes it in filter options. All status union types and completion checks updated to include it.

## Changes

### Backend

**`src/api/services/JobWorker.ts`** — `recoverStaleJobs()`

- Set status to `"interrupted"` instead of `"failed"`
- Set logs to `"Job interrupted by server restart"`

**`src/api/services/JobWorker.ts`** — `finishJob()`

- Add `"interrupted"` to the status union type parameter

### Frontend — color maps and filters

**`src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx`**

- Add `interrupted: "orange"` to `STATUS_COLORS`
- Add `{ label: "Interrupted", value: "interrupted" }` to `STATUS_FILTER_OPTIONS`

**`src/ui/presentation/dashboard/Dashboard/components/RecentActivityWidget.tsx`**

- Add `interrupted: "orange"` to `STATUS_COLOR`

### Frontend — status union types

**`src/ui/features/upgrades/abstractions/UpgradesGateway.ts`**

- Add `"cancelled"` and `"interrupted"` to the status union type (line 13) — `"cancelled"` also missing

**`src/ui/presentation/jobs/JobProgress/abstractions/JobProgressPresenter.ts`**

- Add `"cancelled"` and `"interrupted"` to both status union types (lines 6 and 15) — `"cancelled"` also missing

### Frontend — completion/terminal checks

**`src/ui/presentation/projects/ProjectDetail/components/ChangelogModal.tsx`**

- Add `"interrupted"` to job completion check (lines 126-128)

**`src/ui/presentation/projects/UpgradeWizard/components/ChangelogDrawer.tsx`**

- Add `"interrupted"` to job completion check (lines 130-132)

**`src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`**

- Add `"interrupted"` to error state handling alongside `"failed"` and `"cancelled"` (line 88)

**`src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts`**

- Add `"interrupted"` and `"cancelled"` to job completion check (line 109) — `"cancelled"` also missing

### Tests

- Update `recoverStaleJobs` mock expectations in route tests that mock this method (licenses, autoFix, changelogs, packageManager test files)
- Add dedicated test for `recoverStaleJobs` in `JobWorker.test.ts` if not present

## Non-changes

- No DB migration needed — `status` is a text column
- No WebSocket broadcast shape changes
- No changes to delete/cancel/list logic
