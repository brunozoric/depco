# Job Management 05 — UI UseCases, Presenter, Page + Routing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the presentation layer — use cases, presenter with MobX VM, React page at `/jobs`, header link.

**Architecture:** Follow existing MVP pattern. Two use cases (LoadAllJobs, CancelJob). Presenter subscribes to `job:status` WS events. Page uses Mantine SegmentedControl for status filter, Table for job list, ActionIcon for kill button.

**Tech Stack:** MobX, mobx-react-lite, Mantine UI, @webiny/di

## Global Constraints

- TypeScript 7 strict, ESM
- Presenter: `makeAutoObservable` with `{ vm: computed }`
- UI tests: mock `HTTPClient` and `WebSocketListener` at DI level
- React components are `observer()` wrapped, read `presenter.vm` only
- Run `yarn full` after last task

---

### Task 1: Use Cases + Presenter + Tests

**Files:**

- Create: `src/ui/presentation/jobs/JobManager/useCases/abstractions/LoadAllJobsUseCase.ts`
- Create: `src/ui/presentation/jobs/JobManager/useCases/LoadAllJobsUseCase.ts`
- Create: `src/ui/presentation/jobs/JobManager/useCases/abstractions/CancelJobUseCase.ts`
- Create: `src/ui/presentation/jobs/JobManager/useCases/CancelJobUseCase.ts`
- Create: `src/ui/presentation/jobs/JobManager/useCases/feature.ts`
- Create: `src/ui/presentation/jobs/JobManager/abstractions/JobManagerPresenter.ts`
- Create: `src/ui/presentation/jobs/JobManager/JobManagerPresenter.ts`
- Create: `src/ui/presentation/jobs/JobManager/feature.ts`
- Create: `src/ui/presentation/jobs/JobManager/JobManagerProvider.tsx`
- Test: `src/ui/presentation/jobs/JobManager/__tests__/JobManagerPresenter.test.ts`

**Interfaces:**

- Consumes: `JobsGateway`, `JobsRepository` from plan 04; `ProjectsRepository` (existing); `WebSocketListener` (existing)
- Produces:
  - `LoadAllJobsUseCase.execute(status?: string): Promise<void>`
  - `CancelJobUseCase.execute(jobId: string): Promise<void>`
  - `IJobManagerPresenter` with `vm`, `load()`, `setStatusFilter()`, `cancel()`
  - `IJobManagerViewModel` with `loading`, `statusFilter`, `jobs: IJobViewModel[]`
  - `IJobViewModel` with `id`, `projectId`, `projectName`, `type`, `status`, `startedAt`, `completedAt`, `canCancel`
  - `JobManagerPresentationFeature`, `JobManagerProvider`

- [ ] **Step 1: Create use case abstractions and implementations**

LoadAllJobsUseCase: fetches from gateway, stores in repository.
CancelJob: optimistically updates repository status to `"cancelled"`, then calls gateway.cancel.
Use cases feature depends on `JobsFeature`.

- [ ] **Step 2: Create presenter abstraction**

`IJobManagerPresenter` with `vm` getter, `load`, `setStatusFilter`, `cancel` methods.
VM: `loading`, `statusFilter: string | null`, `jobs: IJobViewModel[]`.
JobViewModel: `id`, `projectId`, `projectName` (from `ProjectsRepository.getProject`), `type`, `status`, `startedAt`, `completedAt`, `canCancel` (`status === "pending" || status === "running"`).

- [ ] **Step 3: Write failing presenter tests**

Test file at `src/ui/presentation/jobs/JobManager/__tests__/JobManagerPresenter.test.ts`. Mock `HTTPClient` and `WebSocketListener`. Tests:

- Default idle VM
- `load` fetches and resolves `projectName`
- Unknown project shows `"Unknown"`
- `setStatusFilter` triggers reload with filter
- `cancel` optimistically updates + calls gateway
- WS `job:status` event updates matching job
- `canCancel` true only for pending/running

- [ ] **Step 4: Implement presenter**

MobX `makeAutoObservable(this, { vm: computed })`. Constructor subscribes to `job:status` WS events. `setStatusFilter` is async — sets filter then calls `load`. `cancel` delegates to use case.

- [ ] **Step 5: Create feature + provider**

Feature depends on `JobManagerUseCasesFeature` + `WebSocketFeature`. Resolves presenter.
Provider uses `useFeature` + render-prop pattern.

- [ ] **Step 6: Run presenter tests**

Run: `yarn test src/ui/presentation/jobs/JobManager/__tests__/JobManagerPresenter.test.ts`
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/presentation/jobs/JobManager/
git commit -m "feat: add JobManager use cases, presenter, and tests"
```

---

### Task 2: Page Component + App Routing

**Files:**

- Create: `src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**

- Consumes: `JobManagerPresenter.ViewModel`, `JobManagerPresentationFeature`, `JobManagerProvider`
- Produces: `/jobs` route, "Jobs" header link

- [ ] **Step 1: Create JobManagerPage**

Mantine page with:

- Back arrow + "Jobs" title + refresh button
- `SegmentedControl` for status filter (All/Running/Pending/Completed/Failed/Cancelled)
- `Table` with columns: Project, Type, Status (color Badge), Started, Duration, Actions
- Duration: elapsed from `startedAt` to `completedAt` (or now if running)
- Red kill `ActionIcon` visible when `canCancel`
- Empty state: "No jobs found"
- Status colors: pending=gray, running=blue, completed=green, failed=red, cancelled=orange

- [ ] **Step 2: Wire into App.tsx**

Import `JobsFeature`, `JobManagerUseCasesFeature`, `JobManagerPresentationFeature`, `JobManagerProvider`, `JobManagerPage`.

Add features to `ALL_FEATURES` array.

Add `/jobs` route in `AppRoutes` (before `/settings` check).

Add "Jobs" link in header next to "Settings":

```tsx
<Group gap="md">
  <Anchor component="button" onClick={() => navigate("/jobs")}>
    Jobs
  </Anchor>
  <Anchor component="button" onClick={() => navigate("/settings")}>
    Settings
  </Anchor>
</Group>
```

- [ ] **Step 3: Run full pipeline**

Run: `yarn full`
Expected: adio PASS, lint PASS, format PASS, build PASS, all tests PASS

- [ ] **Step 4: Fix any issues**

Address lint, format, or test failures if any.

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx src/ui/App.tsx
git commit -m "feat: add /jobs page with routing and header link"
```
