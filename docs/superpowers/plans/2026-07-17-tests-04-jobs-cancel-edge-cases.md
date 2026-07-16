# Tests 04 — Jobs Routes Cancel Edge Cases

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test cancel on already-completed jobs (no-op) and cancel on running jobs (AbortController path).

**Architecture:** Extend existing jobs route test. Uses Fastify inject + in-memory SQLite + mocked CommandRunner.

**Tech Stack:** Vitest, Fastify, in-memory SQLite (createTestDb)

## Global Constraints

- TypeScript 7 strict, ESM
- Follow existing jobs route test patterns exactly
- Run `yarn full` after last task

---

### Task 1: Cancel edge case tests

**Files:**

- Modify: `src/api/routes/__tests__/jobs.test.ts`

- [ ] **Step 1: Add cancel-on-completed test**

In the existing `POST /api/jobs/:jobId/cancel` describe block, add:

```typescript
it("is a no-op for an already-completed job (returns 200, status stays completed)", async () => {
  const jobId = await jobWorker.enqueue({
    projectId: "p1",
    type: "transient"
  });

  await jobWorker.processNextJob();
  await flushAsync();

  // Job should be completed now
  expect((await jobWorker.getJob(jobId))!.status).toBe("completed");

  const response = await app.inject({
    method: "POST",
    url: `/api/jobs/${jobId}/cancel`
  });

  expect(response.statusCode).toBe(200);
  expect((await jobWorker.getJob(jobId))!.status).toBe("completed");
});
```

- [ ] **Step 2: Add cancel-on-running test**

This tests the AbortController path. Need a CommandRunner mock that blocks long enough to cancel during execution:

```typescript
it("cancels a running job via AbortController", async () => {
    // Replace CommandRunner with a slow mock that respects abort
    // The existing mock resolves instantly, so the job completes before we can cancel.
    // We need a mock that hangs until aborted.
```

Implementation approach: use a `vi.fn()` that returns a promise which only resolves when the signal is aborted. This way `processNextJob` starts the job, we can cancel it, and the job catches the abort.

```typescript
it("cancels a running job via AbortController", async () => {
  // Need to rebuild container with a slow CommandRunner for this test.
  // The existing beforeEach mock resolves instantly.
  // For this test, override the mock to block until signal aborts.

  let resolveRun: (() => void) | null = null;
  const slowContainer = createContainer();
  const slowDb = await createTestDb();
  await seedYarnSecuritySettings(slowDb);
  await slowDb
    .insert(projects)
    .values({
      id: "p1",
      name: "test",
      path: testDir,
      packageManager: "yarn",
      addedAt: Date.now()
    })
    .run();

  slowContainer.registerInstance(DatabaseClient, { db: slowDb });
  slowContainer.registerInstance(CommandRunner, {
    run: vi.fn(async (_cmd, _args, options) => {
      return new Promise((resolve, reject) => {
        resolveRun = () => resolve({ stdout: "", stderr: "", exitCode: 0 });
        if (options?.signal) {
          options.signal.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }
      });
    }),
    runStreaming: vi.fn(async (_cmd, _args, options) => {
      return new Promise((resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }
      });
    })
  });
  slowContainer.register(SecurityServiceReg).inSingletonScope();
  slowContainer.register(UpgradeServiceReg).inSingletonScope();
  slowContainer.register(PackageManagerServiceReg).inSingletonScope();
  slowContainer.register(ScanServiceReg).inSingletonScope();
  slowContainer.register(RegistryCacheServiceReg).inSingletonScope();
  slowContainer.register(WebSocketBroadcasterReg).inSingletonScope();
  slowContainer.register(JobWorkerReg).inSingletonScope();

  const slowWorker = slowContainer.resolve(JobWorker);

  const slowApp = Fastify();
  await slowApp.register(jobRoutes, { container: slowContainer });
  await slowApp.ready();

  const jobId = await slowWorker.enqueue({
    projectId: "p1",
    type: "transient"
  });

  await slowWorker.processNextJob();
  // Wait for job to reach "running" and enter the blocking command
  await flushAsync();

  const response = await slowApp.inject({
    method: "POST",
    url: `/api/jobs/${jobId}/cancel`
  });

  expect(response.statusCode).toBe(200);

  // Give async catch path time to finalize
  await flushAsync();
  await flushAsync();

  const job = await slowWorker.getJob(jobId);
  expect(job!.status).toBe("cancelled");

  await slowApp.close();
});
```

Note: This is a complex test. If the AbortController wiring is difficult to test through the route layer, an alternative is to test it directly through `jobWorker.cancelJob()` in the JobWorker service test instead. The key is exercising the `controller.abort()` path at JobWorker.ts:306. The route test for cancel-completed (Step 1) is simpler and higher priority.

- [ ] **Step 3: Run full suite**

Run: `yarn full`
Expected: all PASS
