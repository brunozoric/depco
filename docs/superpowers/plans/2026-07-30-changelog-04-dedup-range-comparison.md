# Changelog Dedup Range Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared changelog dedup helper with range comparison, use it in both GET and POST handlers, add tests for POST range comparison.

**Architecture:** File-local helper `enqueueChangelogIfNeeded` in `src/api/routes/changelogs.ts` replaces inline dedup logic in both handlers. Helper queries for active jobs, compares version ranges, enqueues full or supplementary jobs as needed.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, Vitest

## Global Constraints

- All types must be named interfaces (no inline structural types).
- Use `yarn test` to run tests.
- Do not start dev server.
- Work directly on main, no feature branches.

---

### Task 1: Extract helper and refactor both handlers

**Files:**

- Modify: `src/api/routes/changelogs.ts`
- Test: `src/api/routes/__tests__/changelogs.test.ts` (existing tests validate refactor)

**Interfaces:**

- Consumes: `DatabaseClient.Interface["db"]`, `JobWorker.Interface`, `compareVersions` from `ChangelogService.ts`, `upgradeJobs` schema
- Produces: `enqueueChangelogIfNeeded(db, jobWorker, packageName, from, to): Promise<void>` (file-local, not exported)

- [ ] **Step 1: Define the helper interface and function**

Add above `changelogRoutes` in `src/api/routes/changelogs.ts`:

```typescript
interface EnqueueChangelogDeps {
  db: DatabaseClient.Interface["db"];
  jobWorker: JobWorker.Interface;
}

async function enqueueChangelogIfNeeded(
  deps: EnqueueChangelogDeps,
  packageName: string,
  from: string,
  to: string
): Promise<void> {
  const activeJob = await deps.db
    .select()
    .from(upgradeJobs)
    .where(
      and(
        eq(upgradeJobs.type, "changelog"),
        eq(upgradeJobs.referenceId, packageName),
        inArray(upgradeJobs.status, ["pending", "running"])
      )
    )
    .get();

  if (!activeJob) {
    await deps.jobWorker.enqueue({
      referenceId: packageName,
      referenceType: "package",
      type: "changelog",
      packages: JSON.stringify({ packageName, from, to })
    });
    return;
  }

  if (!activeJob.packages) {
    return;
  }

  try {
    const activePackages = JSON.parse(activeJob.packages) as { to?: string };
    if (activePackages.to && compareVersions(to, activePackages.to) > 0) {
      await deps.jobWorker.enqueue({
        referenceId: packageName,
        referenceType: "package",
        type: "changelog",
        packages: JSON.stringify({
          packageName,
          from: activePackages.to,
          to
        })
      });
    }
  } catch {
    await deps.jobWorker.enqueue({
      referenceId: packageName,
      referenceType: "package",
      type: "changelog",
      packages: JSON.stringify({ packageName, from, to })
    });
  }
}
```

- [ ] **Step 2: Refactor GET handler to use helper**

Replace the entire dedup block (lines 35-84: `let resolving = false` through end of `if (hasUnfetched)`) with:

```typescript
let resolving = false;
if (hasUnfetched) {
  await enqueueChangelogIfNeeded({ db: databaseClient.db, jobWorker }, packageName, from, to);
  resolving = true;
}
```

- [ ] **Step 3: Refactor POST handler to use helper**

Replace lines 100-119 (the activeJob query and `if (!activeJob)` block) with:

```typescript
await enqueueChangelogIfNeeded({ db: databaseClient.db, jobWorker }, packageName, from, to);
```

- [ ] **Step 4: Run existing tests to verify refactor is behavior-preserving**

Run: `yarn test src/api/routes/__tests__/changelogs.test.ts`

Expected: All 9 existing tests pass. No behavior change for GET handler. POST "does not enqueue when active job exists" test still passes because active job in that test has `to: "18.2.0"` and request has `to: "18.2.0"` — range is covered, so helper skips.

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/changelogs.ts
git commit -m "refactor: extract enqueueChangelogIfNeeded helper in changelog routes"
```

---

### Task 2: Add POST re-resolve range comparison tests

**Files:**

- Modify: `src/api/routes/__tests__/changelogs.test.ts`

**Interfaces:**

- Consumes: Existing test fixtures (`insertChangelogFixture`, `enqueuedJobs`, `db`, `app`)

- [ ] **Step 1: Write test — POST enqueues supplementary job when range extends beyond active job**

Add after line 443 (before the closing `});`):

```typescript
it("POST /api/changelogs/:packageName/re-resolve enqueues supplementary job when range extends beyond active job", async () => {
  await insertChangelogFixture(db, {
    packageName: "react",
    version: "18.1.0",
    repoUrl: "https://github.com/facebook/react",
    content: "",
    source: "none",
    fetchedAt: Date.now()
  });

  await db
    .insert(upgradeJobs)
    .values({
      id: generateId(),
      referenceId: "react",
      referenceType: "package",
      type: "changelog",
      status: "running",
      packages: JSON.stringify({ packageName: "react", from: "18.0.0", to: "18.2.0" })
    })
    .run();

  const response = await app.inject({
    method: "POST",
    url: "/api/changelogs/react/re-resolve",
    payload: { from: "18.0.0", to: "19.0.0" }
  });

  expect(response.statusCode).toBe(200);
  const json = response.json();
  expect(json.resolving).toBe(true);

  expect(enqueuedJobs).toHaveLength(1);
  const enqueued = JSON.parse(enqueuedJobs[0]?.packages as string);
  expect(enqueued.from).toBe("18.2.0");
  expect(enqueued.to).toBe("19.0.0");
});
```

- [ ] **Step 2: Write test — POST does not enqueue when active job covers requested range**

```typescript
it("POST /api/changelogs/:packageName/re-resolve does not enqueue when active job covers requested range", async () => {
  await insertChangelogFixture(db, {
    packageName: "react",
    version: "18.1.0",
    repoUrl: "https://github.com/facebook/react",
    content: "",
    source: "none",
    fetchedAt: Date.now()
  });

  await db
    .insert(upgradeJobs)
    .values({
      id: generateId(),
      referenceId: "react",
      referenceType: "package",
      type: "changelog",
      status: "pending",
      packages: JSON.stringify({ packageName: "react", from: "18.0.0", to: "19.0.0" })
    })
    .run();

  const response = await app.inject({
    method: "POST",
    url: "/api/changelogs/react/re-resolve",
    payload: { from: "18.0.0", to: "18.2.0" }
  });

  expect(response.statusCode).toBe(200);
  const json = response.json();
  expect(json.resolving).toBe(true);
  expect(enqueuedJobs).toHaveLength(0);
});
```

- [ ] **Step 3: Write test — POST enqueues fresh job when active job has malformed packages JSON**

```typescript
it("POST /api/changelogs/:packageName/re-resolve enqueues fresh job when active job has malformed packages", async () => {
  await insertChangelogFixture(db, {
    packageName: "react",
    version: "18.1.0",
    repoUrl: "https://github.com/facebook/react",
    content: "",
    source: "none",
    fetchedAt: Date.now()
  });

  await db
    .insert(upgradeJobs)
    .values({
      id: generateId(),
      referenceId: "react",
      referenceType: "package",
      type: "changelog",
      status: "running",
      packages: "not-valid-json"
    })
    .run();

  const response = await app.inject({
    method: "POST",
    url: "/api/changelogs/react/re-resolve",
    payload: { from: "18.0.0", to: "18.2.0" }
  });

  expect(response.statusCode).toBe(200);
  const json = response.json();
  expect(json.resolving).toBe(true);

  expect(enqueuedJobs).toHaveLength(1);
  const enqueued = JSON.parse(enqueuedJobs[0]?.packages as string);
  expect(enqueued.from).toBe("18.0.0");
  expect(enqueued.to).toBe("18.2.0");
});
```

- [ ] **Step 4: Run all changelog route tests**

Run: `yarn test src/api/routes/__tests__/changelogs.test.ts`

Expected: All 12 tests pass (9 existing + 3 new).

- [ ] **Step 5: Run full test suite**

Run: `yarn test`

Expected: All tests pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/__tests__/changelogs.test.ts
git commit -m "test: add POST re-resolve range comparison and malformed JSON tests"
```
