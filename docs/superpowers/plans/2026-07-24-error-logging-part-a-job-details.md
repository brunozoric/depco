# Part A: Job Error Details — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface job error messages and logs in the Jobs page via expandable rows.

**Architecture:** Add `warning` field to backend and UI `IJob` types (already in DB and API schema). Add expandable detail rows to `JobManagerPage` showing logs and warnings. No new API endpoints.

**Tech Stack:** TypeScript, Mantine UI, MobX

## Global Constraints

- oxfmt formatter, oxlint linter
- `yarn full` must pass (adio + lint:fix + format:fix + build + test)
- Follow existing MVP patterns (Gateway types flow through Repository to Presenter ViewModel)

---

### Task 1: Add `warning` to backend IJob type

**Files:**

- Modify: `src/api/services/abstractions/JobWorker.ts:31-40`

**Interfaces:**

- Consumes: nothing new
- Produces: `IJob.warning: string | null` field (used by API route responses)

- [ ] **Step 1: Add `warning` field to IJob interface**

In `src/api/services/abstractions/JobWorker.ts`, add `warning` after `completedAt`:

```typescript
export interface IJob {
  id: string;
  projectId: string;
  type: string;
  status: string;
  packages: string | null;
  logs: string | null;
  startedAt: number | null;
  completedAt: number | null;
  warning: string | null;
}
```

- [ ] **Step 2: Verify build passes**

Run: `yarn build`
Expected: Clean build (no errors)

- [ ] **Step 3: Run tests**

Run: `yarn test`
Expected: All tests pass (623+)

- [ ] **Step 4: Commit**

```bash
git add src/api/services/abstractions/JobWorker.ts
git commit -m "feat: add warning field to backend IJob type"
```

---

### Task 2: Add `warning` to UI Jobs types

**Files:**

- Modify: `src/ui/features/jobs/abstractions/JobsGateway.ts:3-12`

**Interfaces:**

- Consumes: API response already includes `warning` field
- Produces: `JobsGateway.Job` type now includes `warning: string | null`

- [ ] **Step 1: Add `warning` to IJob in JobsGateway abstractions**

In `src/ui/features/jobs/abstractions/JobsGateway.ts`, add after `completedAt`:

```typescript
export interface IJob {
  id: string;
  projectId: string;
  type: string;
  status: string;
  packages: string | null;
  logs: string | null;
  startedAt: number | null;
  completedAt: number | null;
  warning: string | null;
}
```

- [ ] **Step 2: Verify build passes**

Run: `yarn build`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add src/ui/features/jobs/abstractions/JobsGateway.ts
git commit -m "feat: add warning field to UI IJob type"
```

---

### Task 3: Expandable job details in JobManager

**Files:**

- Modify: `src/ui/presentation/jobs/JobManager/abstractions/JobManagerPresenter.ts:1-34`
- Modify: `src/ui/presentation/jobs/JobManager/JobManagerPresenter.ts:1-96`
- Modify: `src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx:1-168`

**Interfaces:**

- Consumes: `JobsGateway.Job` with `logs` and `warning` fields
- Produces: `IJobViewModel` with `logs`, `warning` fields; `IJobManagerPresenter.toggleJobDetails(jobId)`; `IJobManagerViewModel.expandedJobId`

- [ ] **Step 1: Update IJobViewModel and IJobManagerPresenter abstractions**

In `src/ui/presentation/jobs/JobManager/abstractions/JobManagerPresenter.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IJobViewModel {
  id: string;
  projectId: string;
  projectName: string;
  type: string;
  status: string;
  startedAt: number | null;
  completedAt: number | null;
  canCancel: boolean;
  logs: string | null;
  warning: string | null;
}

export interface IJobManagerViewModel {
  loading: boolean;
  statusFilter: string | null;
  jobs: IJobViewModel[];
  expandedJobId: string | null;
}

export interface IJobManagerPresenter {
  get vm(): IJobManagerViewModel;
  load: () => Promise<void>;
  setStatusFilter: (status: string | null) => Promise<void>;
  cancel: (jobId: string) => Promise<void>;
  toggleJobDetails: (jobId: string) => void;
}

export const JobManagerPresenter =
  createAbstraction<IJobManagerPresenter>("Ui/JobManagerPresenter");

export namespace JobManagerPresenter {
  export type Interface = IJobManagerPresenter;
  export type ViewModel = IJobManagerViewModel;
  export type JobViewModel = IJobViewModel;
}
```

- [ ] **Step 2: Update JobManagerPresenter implementation**

In `src/ui/presentation/jobs/JobManager/JobManagerPresenter.ts`, add `expandedJobId` state and `toggleJobDetails` action. Update `vm` getter to include `logs`, `warning`, `expandedJobId`:

```typescript
class JobManagerPresenterImpl implements Abstraction.Interface {
  private loading = false;
  private statusFilter: string | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private expandedJobId: string | null = null;

  // ... constructor unchanged ...

  public get vm(): Abstraction.ViewModel {
    const jobs: Abstraction.JobViewModel[] = this.jobsRepository.getJobs().map(job => ({
      id: job.id,
      projectId: job.projectId,
      projectName: this.projectsRepository.getProject(job.projectId)?.name ?? "Unknown",
      type: job.type,
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      canCancel: job.status === "pending" || job.status === "running",
      logs: job.logs,
      warning: job.warning ?? null
    }));

    return {
      loading: this.loading,
      statusFilter: this.statusFilter,
      jobs,
      expandedJobId: this.expandedJobId
    };
  }

  // ... load, setStatusFilter, cancel unchanged ...

  public toggleJobDetails = (jobId: string): void => {
    this.expandedJobId = this.expandedJobId === jobId ? null : jobId;
  };
}
```

- [ ] **Step 3: Update JobManagerPage with expandable rows**

In `src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx`, add click handler on rows and detail panel below expanded row. Add `Code` to Mantine imports:

```tsx
// Add to imports:
import { ..., Code } from "@mantine/core";

// In the table row mapping, make row clickable:
<Table.Tr
    key={job.id}
    onClick={() => presenter.toggleJobDetails(job.id)}
    style={{ cursor: "pointer" }}
>
    {/* ... existing cells unchanged ... */}
</Table.Tr>

// After each Table.Tr, add expandable detail row:
{vm.expandedJobId === job.id && (job.logs || job.warning) && (
    <Table.Tr>
        <Table.Td colSpan={6}>
            <Stack gap="xs" p="sm">
                {job.warning && (
                    <Alert color="orange" title="Warning">
                        {job.warning}
                    </Alert>
                )}
                {job.logs && (
                    <Code block style={{ maxHeight: 300, overflow: "auto" }}>
                        {job.logs}
                    </Code>
                )}
            </Stack>
        </Table.Td>
    </Table.Tr>
)}
```

Add `Alert` and `Stack` to Mantine imports if not already present.

- [ ] **Step 4: Verify build**

Run: `yarn build`
Expected: Clean build

- [ ] **Step 5: Run tests**

Run: `yarn test`
Expected: All tests pass

- [ ] **Step 6: Format and lint**

Run: `yarn format:fix && yarn lint`
Expected: No issues

- [ ] **Step 7: Commit**

```bash
git add src/ui/presentation/jobs/JobManager/
git commit -m "feat: expandable job details with logs and warnings in Jobs page"
```
