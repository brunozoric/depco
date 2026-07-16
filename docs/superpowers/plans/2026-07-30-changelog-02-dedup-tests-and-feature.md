# Changelog Route Dedup Tests and Re-resolve Dedup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `compareVersions` unit tests, version-range dedup route tests, and add dedup to the re-resolve endpoint.

**Architecture:** Unit tests for pure function. Integration tests for route dedup using existing Fastify inject pattern. Small route handler change for re-resolve dedup.

**Tech Stack:** Vitest, Fastify inject, in-memory SQLite (createTestDb)

## Global Constraints

- Test runner: Vitest (config in `testing/vitest.config.ts`)
- Run tests: `yarn test`
- Formatter: oxfmt (`yarn format:fix`)
- Linter: oxlint (`yarn lint`)
- Path aliases: `#api/*`, `#shared/*`, `#testing/*`

---

### Task 1: compareVersions unit tests

**Files:**

- Create: `src/api/services/__tests__/compareVersions.test.ts`
- Reference: `src/api/services/ChangelogService.ts:17-33`

**Interfaces:**

- Consumes: `compareVersions(a: string, b: string): number` exported from `ChangelogService.ts`
- Produces: Nothing — pure test file

- [ ] **Step 1: Write all compareVersions tests**

```typescript
import { describe, it, expect } from "vitest";
import { compareVersions } from "../ChangelogService.js";

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("returns positive when first has greater major", () => {
    expect(compareVersions("2.0.0", "1.0.0")).toBeGreaterThan(0);
  });

  it("returns positive when first has greater minor", () => {
    expect(compareVersions("1.2.0", "1.1.0")).toBeGreaterThan(0);
  });

  it("returns positive when first has greater patch", () => {
    expect(compareVersions("1.0.2", "1.0.1")).toBeGreaterThan(0);
  });

  it("returns negative when first is lesser", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
  });

  it("handles different length versions", () => {
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.1", "1.0")).toBeGreaterThan(0);
  });

  it("treats non-numeric parts as 0", () => {
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `yarn test src/api/services/__tests__/compareVersions.test.ts`
Expected: All 7 tests pass.

- [ ] **Step 3: Format, lint, commit**

```bash
yarn format:fix && yarn lint
git add src/api/services/__tests__/compareVersions.test.ts
git commit -m "test: add compareVersions unit tests"
```

---

### Task 2: Changelog route version-range dedup tests

**Files:**

- Modify: `src/api/routes/__tests__/changelogs.test.ts`
- Reference: `src/api/routes/changelogs.ts:56-72` (range comparison logic)

**Interfaces:**

- Consumes: Existing test infrastructure (`createTestDb`, `insertChangelogFixture`, Fastify inject, `enqueuedJobs` array, `upgradeJobs` table)
- Produces: Nothing — test additions

- [ ] **Step 1: Write test — active job with smaller range, enqueues supplementary**

Add after the existing "does not enqueue a duplicate job" test:

```typescript
it("GET /api/changelogs/:packageName enqueues supplementary job when requested range extends beyond active job", async () => {
  await insertChangelogFixture(db, {
    packageName: "react",
    version: "18.1.0",
    repoUrl: "https://github.com/facebook/react",
    content: null,
    source: null,
    fetchedAt: null
  });

  await insertChangelogFixture(db, {
    packageName: "react",
    version: "19.0.0",
    repoUrl: "https://github.com/facebook/react",
    content: null,
    source: null,
    fetchedAt: null
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
    method: "GET",
    url: "/api/changelogs/react?from=18.0.0&to=19.0.0"
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

- [ ] **Step 2: Write test — active job covers requested range, no enqueue**

```typescript
it("GET /api/changelogs/:packageName does not enqueue when active job covers requested range", async () => {
  await insertChangelogFixture(db, {
    packageName: "react",
    version: "18.1.0",
    repoUrl: "https://github.com/facebook/react",
    content: null,
    source: null,
    fetchedAt: null
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
    method: "GET",
    url: "/api/changelogs/react?from=18.0.0&to=18.2.0"
  });

  expect(response.statusCode).toBe(200);
  const json = response.json();
  expect(json.resolving).toBe(true);
  expect(enqueuedJobs).toHaveLength(0);
});
```

- [ ] **Step 3: Run tests**

Run: `yarn test src/api/routes/__tests__/changelogs.test.ts`
Expected: All 8 tests pass (6 existing + 2 new).

- [ ] **Step 4: Format, lint, commit**

```bash
yarn format:fix && yarn lint
git add src/api/routes/__tests__/changelogs.test.ts
git commit -m "test: add changelog route version-range dedup tests"
```

---

### Task 3: Re-resolve endpoint dedup

**Files:**

- Modify: `src/api/routes/changelogs.ts:89-109` (POST handler)
- Modify: `src/api/routes/__tests__/changelogs.test.ts` (new test)

**Interfaces:**

- Consumes: `databaseClient.db` (query `upgradeJobs`), `jobWorker.enqueue()`
- Produces: Same response shape `{ items, total, resolving }` — `resolving` is `true` when active job exists OR new job enqueued

- [ ] **Step 1: Write failing test — re-resolve skips enqueue when active job exists**

Add to `changelogs.test.ts`:

```typescript
it("POST /api/changelogs/:packageName/re-resolve does not enqueue when active job exists", async () => {
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
    payload: { from: "18.0.0", to: "18.2.0" }
  });

  expect(response.statusCode).toBe(200);
  const json = response.json();
  expect(json.resolving).toBe(true);
  expect(enqueuedJobs).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/api/routes/__tests__/changelogs.test.ts`
Expected: New test FAILS — `enqueuedJobs` has length 1 (no dedup yet).

- [ ] **Step 3: Implement dedup in POST handler**

In `src/api/routes/changelogs.ts`, replace the POST handler body (lines 98-105) with:

```typescript
registerRoute(app, reResolveChangelogsRoute, {}, async (request, reply) => {
  const { packageName } = request.params;
  const { from, to } = request.body;

  if (from === to) {
    reply.send({ items: [], total: 0, resolving: false });
    return;
  }

  await changelogService.resetFailed(packageName);

  const activeJob = await databaseClient.db
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
    await jobWorker.enqueue({
      referenceId: packageName,
      referenceType: "package",
      type: "changelog",
      packages: JSON.stringify({ packageName, from, to })
    });
  }

  const entries = await changelogService.getChangelogs(packageName, from, to);
  reply.send({ items: entries, total: entries.length, resolving: true });
});
```

Note: `and`, `eq`, `inArray` already imported at top of file. `upgradeJobs` already imported. No new imports needed.

- [ ] **Step 4: Run tests**

Run: `yarn test src/api/routes/__tests__/changelogs.test.ts`
Expected: All 9 tests pass (6 existing + 3 new).

- [ ] **Step 5: Run full check**

Run: `yarn lint && yarn format:check && yarn test`

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/changelogs.ts src/api/routes/__tests__/changelogs.test.ts
git commit -m "feat: add dedup to changelog re-resolve endpoint"
```
