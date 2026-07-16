# Schema Rename: projectId → referenceId

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `projectId` to `referenceId` and add `referenceType` column on `upgrade_jobs` table so the job system can reference both projects and packages.

**Architecture:** Mechanical rename across all layers (schema → abstractions → implementations → routes → WS → UI). Existing behavior unchanged — all existing jobs get `referenceType = "project"`.

**Tech Stack:** SQLite (ALTER TABLE), Drizzle ORM, TypeScript, Zod, Vitest

## Global Constraints

- All existing tests must pass after each task
- `referenceType` is `"project"` for all existing job types
- No new job types in this plan — that's plan 02
- Run `yarn full` after final task

---

### Task 1: Schema + Drizzle

**Files:**

- Modify: `src/api/db/schema.ts` — rename `projectId` column to `referenceId`, add `referenceType`
- Run: `ALTER TABLE` on `data/upgrader.db`

- [ ] **Step 1: Update Drizzle schema**

In `src/api/db/schema.ts`, find the `upgradeJobs` table definition. Rename the `projectId` column to `referenceId` and add `referenceType`:

```typescript
referenceId: text("referenceId").notNull(),
referenceType: text("referenceType").notNull().default("project"),
```

- [ ] **Step 2: Run ALTER TABLE on existing DB**

```bash
sqlite3 data/upgrader.db "ALTER TABLE upgrade_jobs RENAME COLUMN projectId TO referenceId;"
sqlite3 data/upgrader.db "ALTER TABLE upgrade_jobs ADD COLUMN referenceType TEXT NOT NULL DEFAULT 'project';"
```

- [ ] **Step 3: Verify schema**

```bash
sqlite3 data/upgrader.db "PRAGMA table_info(upgrade_jobs);"
```

Confirm `referenceId` and `referenceType` columns exist, `projectId` gone.

---

### Task 2: API Abstractions

**Files:**

- Modify: `src/api/services/abstractions/JobWorker.ts` — ICreateJobInput, IJob
- Modify: `src/api/services/jobExecutors/abstractions/JobExecutor.ts` — IJobExecutionContext
- Modify: `src/api/services/abstractions/ErrorReporter.ts` — all method signatures

**Interfaces:**

- Produces: `IJob.referenceId`, `IJob.referenceType`, `ICreateJobInput.referenceId`, `ICreateJobInput.referenceType`, `IJobExecutionContext.referenceId`

- [ ] **Step 1: Update ICreateJobInput and IJob in JobWorker.ts**

`src/api/services/abstractions/JobWorker.ts`:

```typescript
export interface ICreateJobInput {
  referenceId: string;
  referenceType: "project" | "package";
  type: "dependency" | "transient" | "packageManager" | "scan" | "clone" | "install";
  // "changelog" type added in Plan 02 when the executor is created
  packages?:
    | IDependencyUpgradePackage[]
    | IYarnUpgradePackage
    | IScanJobPackages
    | string
    | null
    | undefined;
  refreshTransient?: boolean | undefined;
}

export interface IJob {
  id: string;
  referenceId: string;
  referenceType: string;
  type: string;
  status: string;
  packages: string | null;
  logs: string | null;
  startedAt: number | null;
  completedAt: number | null;
  warning: string | null;
}
```

- [ ] **Step 2: Update IJobExecutionContext**

`src/api/services/jobExecutors/abstractions/JobExecutor.ts`:

Change `projectId: string` to `referenceId: string` in `IJobExecutionContext`.

```typescript
export interface IJobExecutionContext {
  jobId: string;
  referenceId: string;
  projectPath: string;
  packageManager: string;
  packagesJson: string | null;
  project: IJobExecutionProject | null;
  appendLog: (line: string) => void;
  signal: AbortSignal;
}
```

- [ ] **Step 3: Update ErrorReporter abstraction**

`src/api/services/abstractions/ErrorReporter.ts`:

Rename `projectId` parameter to `referenceId` in `reportJobFailure`, `reportJobWarning`, and `reportStepFailure`.

---

### Task 3: API Implementations

**Files:**

- Modify: `src/api/services/JobWorker.ts` — all projectId → referenceId
- Modify: `src/api/services/ErrorReporter.ts` — all projectId → referenceId
- Modify: `src/api/services/jobExecutors/DependencyJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/TransientJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/PackageManagerJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/ScanJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/CloneJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/InstallJobExecutor.ts`

- [ ] **Step 1: Update JobWorker.ts**

Replace all `projectId` references with `referenceId`. Key areas:

- `enqueue()`: `input.projectId` → `input.referenceId`, add `referenceType: input.referenceType` to insert values
- `executeJob()`: `job.projectId` → `job.referenceId` in all broadcast calls, project lookup, appendLog
- `finishJob()`: parameter rename, broadcast rename
- `chainRefreshTransientIfNeeded()`: enqueue call uses `referenceId: job.referenceId, referenceType: "project"`
- `chainScanAfterJobIfNeeded()`: same
- `cancelJob()`: broadcast rename
- `getJobsForProject()`: rename to `getJobsForReference()`, filter on `referenceId`

Also add `referenceType` to all `broadcast("job:status", ...)` calls.

- [ ] **Step 2: Update ErrorReporter.ts**

Replace `projectId` parameter with `referenceId` in all three methods. Update the log message formatting.

- [ ] **Step 3: Update all 6 executors**

In each executor, replace `context.projectId` with `context.referenceId`. Files:

- `DependencyJobExecutor.ts`
- `TransientJobExecutor.ts`
- `PackageManagerJobExecutor.ts`
- `ScanJobExecutor.ts` — multiple references in scan progress broadcast, security check, DB updates
- `CloneJobExecutor.ts`
- `InstallJobExecutor.ts`

- [ ] **Step 4: Build check**

```bash
yarn build 2>&1 | tail -20
```

Fix any remaining type errors.

---

### Task 4: WS Types + Shared Route Schemas

**Files:**

- Modify: `src/shared/websocket/types.ts` — WSJobStatus, WSJobLog: projectId → referenceId + referenceType
- Modify: `src/shared/routes/jobs.ts` — response/query schemas: projectId → referenceId + referenceType

- [ ] **Step 1: Update WS event types**

`src/shared/websocket/types.ts`:

```typescript
export interface WSJobStatus {
  jobId: string;
  referenceId: string;
  referenceType: string;
  type: string;
  status: string;
}

export interface WSJobLog {
  jobId: string;
  referenceId: string;
  line: string;
}
```

- [ ] **Step 2: Update shared job route schemas**

`src/shared/routes/jobs.ts`:

Rename `projectId` to `referenceId` in:

- Job response schema (add `referenceType: z.string()`)
- Query/filter schemas
- Bulk delete body schema

- [ ] **Step 3: Build check**

```bash
yarn build 2>&1 | tail -20
```

---

### Task 5: API Routes

**Files:**

- Modify: `src/api/routes/jobs.ts` — filters, response mapping
- Modify: `src/api/routes/projects.ts` — enqueue calls
- Modify: `src/api/routes/install.ts` — enqueue calls
- Modify: `src/api/routes/packageManager.ts` — enqueue calls

- [ ] **Step 1: Update jobs.ts route**

Replace all `projectId` references:

- `buildJobConditions()`: filter on `upgradeJobs.referenceId`
- Project-scoped job routes (`/api/projects/:id/jobs`): filter `referenceId === id`
- Global job list/delete: query param rename
- Response mapping: include `referenceType`

- [ ] **Step 2: Update project/install/packageManager routes**

In enqueue calls, change `projectId` to `referenceId` and add `referenceType: "project"`:

```typescript
await jobWorker.enqueue({
  referenceId: project.id,
  referenceType: "project",
  type: "scan"
});
```

Apply to all enqueue calls in:

- `src/api/routes/projects.ts`
- `src/api/routes/install.ts`
- `src/api/routes/packageManager.ts`

- [ ] **Step 3: Build check**

```bash
yarn build 2>&1 | tail -20
```

---

### Task 6: UI Layer

**Files:**

- Modify: `src/ui/features/jobs/abstractions/JobsGateway.ts` — IJob, IJobFilters
- Modify: `src/ui/features/jobs/JobsGateway.ts` — implementation
- Modify: `src/ui/shared/notifications/jobNotifications.ts` — referenceId + referenceType
- Modify: `src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts`
- Modify: `src/ui/presentation/jobs/JobManager/JobManagerPresenter.ts`
- Modify: `src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx`

- [ ] **Step 1: Update job gateway abstractions**

`src/ui/features/jobs/abstractions/JobsGateway.ts`:

```typescript
export interface IJob {
  // ... existing fields
  referenceId: string; // was projectId
  referenceType: string;
  // ...
}

export interface IJobFilters {
  // ...
  referenceId?: string; // was projectId
  // ...
}
```

- [ ] **Step 2: Update JobsGateway implementation**

Replace `projectId` with `referenceId` in mapping and filter building.

- [ ] **Step 3: Update job notification handler**

`src/ui/shared/notifications/jobNotifications.ts`:

```typescript
return (data: WSJobStatus): void => {
  // ...
  let suffix = "";
  if (data.referenceType === "project") {
    const projectName = projectsRepository.getProject(data.referenceId)?.name;
    suffix = projectName ? ` — ${projectName}` : "";
  } else {
    suffix = ` — ${data.referenceId}`;
  }
  // ...
};
```

- [ ] **Step 4: Update JobProgress and JobManager presenters**

Replace `projectId` with `referenceId` throughout. In the JobManager presenter abstraction, update the VM interface:

```typescript
export interface IJobViewModel {
  // ... existing fields
  referenceId: string; // was projectId
  referenceType: string; // new
  // projectName stays — computed from referenceId when referenceType === "project"
}
```

JobProgressPresenter: rename `currentProjectId` to `currentReferenceId`, update `trackJob` and `loadHistory` parameter names.

- [ ] **Step 5: Update JobManagerPage component**

Where project name is shown, branch on `referenceType`:

- `"project"`: lookup project name from repository
- `"package"`: show referenceId directly

- [ ] **Step 6: Build check**

```bash
yarn build 2>&1 | tail -20
```

---

### Task 7: Tests

**Files:**

- Modify: all test files that reference `projectId` in job-related contexts

- [ ] **Step 1: Find and update test files**

```bash
grep -rn "projectId" src/ --include="*.test.ts" | grep -i "job\|upgrade\|scan\|clone\|install" | head -40
```

Update all `projectId` references to `referenceId` + add `referenceType: "project"` where needed.

Key test files:

- `src/api/services/__tests__/JobWorker.test.ts`
- `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts`
- `src/api/services/jobExecutors/__tests__/CloneJobExecutor.test.ts`
- `src/api/services/jobExecutors/__tests__/InstallJobExecutor.test.ts`
- `src/api/routes/__tests__/jobs.test.ts`
- `src/api/routes/__tests__/projects.test.ts`
- `src/ui/presentation/jobs/JobProgress/__tests__/JobProgressPresenter.test.ts`

- [ ] **Step 2: Run full pipeline**

```bash
yarn full
```

All tests must pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: rename projectId to referenceId, add referenceType on upgrade_jobs"
```
