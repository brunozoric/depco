# Dashboard Schema & Snapshot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `health_snapshots` table and auto-capture health scores after each scan.

**Architecture:** New Drizzle table with `(projectId, date)` unique constraint. ScanJobExecutor upserts a snapshot row after persisting scan results. Score = `round((upToDate / total) * 100)`.

**Tech Stack:** Drizzle ORM, SQLite, Vitest

## Global Constraints

- Yarn 4, not npm
- oxlint for linting, oxfmt for formatting
- Named interfaces only, no inline structural types
- `@webiny/stdlib` `generateId()` for UUIDs
- API tests use in-memory SQLite, real services, mock only CommandRunner
- Path aliases: `#api/*`, `#shared/*`, `#testing/*`

---

### Task 1: Add `healthSnapshots` table to Drizzle schema

**Files:**

- Modify: `src/api/db/schema.ts` (add table after `projectStepHooks`)

**Interfaces:**

- Produces: `healthSnapshots` table export used by Task 2 and plan 02

- [ ] **Step 1: Add the table definition**

Add to the end of `src/api/db/schema.ts`, before the closing of the file:

```typescript
export const healthSnapshots = sqliteTable(
  "health_snapshots",
  {
    id: text("id").primaryKey().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    date: text("date").notNull(),
    score: integer("score").notNull(),
    totalPackages: integer("total_packages").notNull(),
    upToDate: integer("up_to_date").notNull(),
    patchOutdated: integer("patch_outdated").notNull(),
    minorOutdated: integer("minor_outdated").notNull(),
    majorOutdated: integer("major_outdated").notNull(),
    scannedAt: integer("scanned_at").notNull()
  },
  table => ({
    projectDateUnique: uniqueIndex("health_snapshots_project_date_unique").on(
      table.projectId,
      table.date
    )
  })
);
```

- [ ] **Step 2: Verify build passes**

Run: `yarn build`
Expected: PASS (no type errors)

- [ ] **Step 3: Commit**

```bash
git add src/api/db/schema.ts
git commit -m "feat: add healthSnapshots table to Drizzle schema"
```

---

### Task 2: Upsert health snapshot in ScanJobExecutor

**Files:**

- Modify: `src/api/services/jobExecutors/ScanJobExecutor.ts` (add snapshot upsert after scan results insert, around line 250)
- Test: `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts` (extend existing tests)

**Interfaces:**

- Consumes: `healthSnapshots` table from Task 1, `scanResults` table from schema
- Produces: Health snapshot rows in DB after every scan

- [ ] **Step 1: Write failing test — snapshot created after scan**

Add to existing `ScanJobExecutor.test.ts`:

```typescript
it("should create a health snapshot after scan", async () => {
  mockCommandRunner.run.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

  await scanAndSeed(context);

  const snapshots = await db.select().from(healthSnapshots).all();
  expect(snapshots).toHaveLength(1);
  expect(snapshots[0]!.projectId).toBe(project.id);
  expect(snapshots[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(snapshots[0]!.score).toBeGreaterThanOrEqual(0);
  expect(snapshots[0]!.score).toBeLessThanOrEqual(100);
  expect(snapshots[0]!.totalPackages).toBeGreaterThan(0);
});
```

Import `healthSnapshots` from `#api/db/schema.js` at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts`
Expected: FAIL (no snapshot rows created)

- [ ] **Step 3: Implement snapshot upsert in ScanJobExecutor**

In `ScanJobExecutor.ts`, add import at top:

```typescript
import { healthSnapshots } from "#api/db/schema.js";
```

After the scan results insert block (after line 250, after `.run()`), add:

```typescript
const today = new Date().toISOString().slice(0, 10);
const upToDate = results.filter(d => d.upgradeType === "none").length;
const patchOutdated = results.filter(d => d.upgradeType === "patch").length;
const minorOutdated = results.filter(d => d.upgradeType === "minor").length;
const majorOutdated = results.filter(d => d.upgradeType === "major").length;
const totalPackages = results.length;
const score = totalPackages === 0 ? 100 : Math.round((upToDate / totalPackages) * 100);

await this.databaseClient.db
  .insert(healthSnapshots)
  .values({
    id: generateId(),
    projectId: context.referenceId,
    date: today,
    score,
    totalPackages,
    upToDate,
    patchOutdated,
    minorOutdated,
    majorOutdated,
    scannedAt: Date.now()
  })
  .onConflictDoUpdate({
    target: [healthSnapshots.projectId, healthSnapshots.date], // Drizzle 0.45+ supports array target for composite unique
    set: {
      score,
      totalPackages,
      upToDate,
      patchOutdated,
      minorOutdated,
      majorOutdated,
      scannedAt: Date.now()
    }
  })
  .run();
```

Note: `generateId` is already imported in ScanJobExecutor.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts`
Expected: PASS

- [ ] **Step 5: Write test — snapshot upserts on same day**

```typescript
it("should upsert health snapshot on same-day rescan", async () => {
  mockCommandRunner.run.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

  await scanAndSeed(context);
  await scanAndSeed(context);

  const snapshots = await db.select().from(healthSnapshots).all();
  expect(snapshots).toHaveLength(1);
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `yarn test src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts`
Expected: PASS (upsert handles conflict)

- [ ] **Step 7: Write test — no snapshot when zero results**

```typescript
it("should create snapshot with score 100 when scan returns no results", async () => {
  mockCommandRunner.run.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockScanService.scan.mockResolvedValue({ dependencies: [], registryData: new Map() });

  await executor.execute(context);

  const snapshots = await db.select().from(healthSnapshots).all();
  expect(snapshots).toHaveLength(1);
  expect(snapshots[0]!.score).toBe(100);
  expect(snapshots[0]!.totalPackages).toBe(0);
});
```

- [ ] **Step 8: Run all tests**

Run: `yarn test`
Expected: All tests PASS

- [ ] **Step 9: Lint and format**

Run: `yarn lint:fix && yarn format:fix`

- [ ] **Step 10: Commit**

```bash
git add src/api/services/jobExecutors/ScanJobExecutor.ts src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts
git commit -m "feat: upsert health snapshot after scan in ScanJobExecutor"
```
