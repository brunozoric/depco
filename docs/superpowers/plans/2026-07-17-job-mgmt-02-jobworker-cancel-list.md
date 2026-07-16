# Job Management 02 — JobWorker cancelJob, listAllJobs, AbortController

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AbortController map to JobWorker, implement `cancelJob` and `listAllJobs`, thread signal into `executeJob`, update `finishJob` to accept `"cancelled"` status.

**Architecture:** JobWorker stores `Map<string, AbortController>`. On `executeJob`, create controller, store it, pass `signal` to service calls. `cancelJob` aborts running jobs or directly marks pending ones as cancelled. `listAllJobs` queries upgrade_jobs with optional status filter.

**Tech Stack:** AbortController (native), Drizzle ORM, Vitest

## Global Constraints

- TypeScript 7 strict, ESM
- DI via `@webiny/di`
- API tests: in-memory SQLite, real services, mock only `CommandRunner`
- `finishJob` must accept `"completed" | "failed" | "cancelled"`
- Existing callers unaffected

---

### Task 1: JobWorker — Controller Map, cancelJob, listAllJobs, Signal Threading

**Files:**

- Modify: `src/api/services/abstractions/JobWorker.ts:42-47` — add `cancelJob`, `listAllJobs` to `IJobWorker`
- Modify: `src/api/services/JobWorker.ts` — controller map, rewrite `executeJob`, add `cancelJob`, `listAllJobs`, update `finishJob` type, update `executeScan` to accept signal
- Test: `src/api/services/__tests__/JobWorker.test.ts`

**Interfaces:**

- Consumes: `signal` params on UpgradeService, PackageManagerService, ScanService (from plan 01)
- Produces:
  - `IJobWorker.cancelJob(jobId: string): Promise<void>`
  - `IJobWorker.listAllJobs(status?: string): Promise<IJob[]>`

- [ ] **Step 1: Write failing tests for cancelJob and listAllJobs**

Add to `src/api/services/__tests__/JobWorker.test.ts`:

```typescript
it("cancels a pending job without aborting a subprocess", async () => {
  const broadcastSpy = vi.spyOn(broadcaster, "broadcast");
  const jobId = await worker.enqueue({
    projectId: "p1",
    type: "dependency",
    packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
  });

  await worker.cancelJob(jobId);

  const job = await worker.getJob(jobId);
  expect(job!.status).toBe("cancelled");
  expect(job!.completedAt).not.toBeNull();
  expect(broadcastSpy).toHaveBeenCalledWith("job:status", {
    jobId,
    projectId: "p1",
    status: "cancelled"
  });
});

it("cancels a running job by aborting the subprocess", async () => {
  let resolveStreaming: (() => void) | undefined;
  commandRunner.runStreaming = vi.fn(
    () =>
      new Promise<CommandRunner.Result>(resolve => {
        resolveStreaming = () => resolve({ stdout: "", stderr: "", exitCode: 0 });
      })
  );

  const jobId = await worker.enqueue({
    projectId: "p1",
    type: "dependency",
    packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
  });

  await worker.processNextJob();
  expect((await worker.getJob(jobId))!.status).toBe("running");

  await worker.cancelJob(jobId);
  resolveStreaming!();
  await flushAsync();

  expect((await worker.getJob(jobId))!.status).toBe("cancelled");
});

it("is a no-op when cancelling a completed job", async () => {
  const jobId = await worker.enqueue({
    projectId: "p1",
    type: "dependency",
    packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
  });
  await worker.processNextJob();
  await flushAsync();

  expect((await worker.getJob(jobId))!.status).toBe("completed");
  await worker.cancelJob(jobId);
  expect((await worker.getJob(jobId))!.status).toBe("completed");
});

it("lists all jobs across all projects", async () => {
  await createProject(db, "p2", join(testDir, "p2"));
  await worker.enqueue({
    projectId: "p1",
    type: "dependency",
    packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
  });
  await worker.enqueue({ projectId: "p2", type: "transient" });

  const all = await worker.listAllJobs();
  expect(all).toHaveLength(2);
});

it("lists jobs filtered by status", async () => {
  await worker.enqueue({
    projectId: "p1",
    type: "dependency",
    packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
  });
  await worker.processNextJob();
  await flushAsync();

  await worker.enqueue({ projectId: "p1", type: "transient" });

  const completed = await worker.listAllJobs("completed");
  expect(completed).toHaveLength(1);
  expect(completed[0]!.status).toBe("completed");

  const pending = await worker.listAllJobs("pending");
  expect(pending).toHaveLength(1);
  expect(pending[0]!.status).toBe("pending");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/api/services/__tests__/JobWorker.test.ts`
Expected: FAIL — `cancelJob` and `listAllJobs` not on interface

- [ ] **Step 3: Update IJobWorker abstraction**

In `src/api/services/abstractions/JobWorker.ts`, add to `IJobWorker`:

```typescript
cancelJob(jobId: string): Promise<void>;
listAllJobs(status?: string): Promise<IJob[]>;
```

- [ ] **Step 4: Implement changes in JobWorker**

In `src/api/services/JobWorker.ts`:

1. Add `readonly #controllers = new Map<string, AbortController>();` to class fields

2. Rewrite `executeJob` to create AbortController, store it in `#controllers`, pass `controller.signal` to each service call, check `controller.signal.aborted` in catch to use `"cancelled"` instead of `"failed"`, remove from `#controllers` in finally block

3. Update `executeScan` signature to accept `signal?: AbortSignal`, forward to `this.scanService.scan`

4. Update `finishJob` status type to `"completed" | "failed" | "cancelled"`

5. Add `cancelJob` — if pending: update DB status to `"cancelled"`, set `completedAt`, broadcast. If running: call `controller.abort()`. If completed/failed/cancelled: no-op.

6. Add `listAllJobs` — if status provided, `WHERE status = ?`, else no filter

- [ ] **Step 5: Run all JobWorker tests**

Run: `yarn test src/api/services/__tests__/JobWorker.test.ts`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/services/abstractions/JobWorker.ts src/api/services/JobWorker.ts src/api/services/__tests__/JobWorker.test.ts
git commit -m "feat: add cancelJob, listAllJobs, and AbortController to JobWorker"
```
