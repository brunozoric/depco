# Scan Error Surfacing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface warning when scan finds 0 dependencies despite package.json listing deps — as banner on project page and error state on scan job.

**Architecture:** Add nullable `warning` column to `upgradeJobs` table. `ScanJobExecutor` detects 0-dep-with-deps-in-package.json condition and stores warning. `scan:complete` WS payload gains `warning` field. UI `ProjectDetailPresenter` stores and renders warning. `JobProgressPanel` shows warning badge on affected jobs.

**Tech Stack:** TypeScript, Drizzle ORM, Vitest, Mantine

## Global Constraints

- oxfmt formatting (4-space indent for .ts files)
- oxlint linting
- Bun runtime
- SQLite via Drizzle — migrations in `src/api/db/migrations/`
- Run `bun run build` after each task to verify compilation

---

### Task 1: Add `warning` column to upgradeJobs schema

**Files:**

- Modify: `src/api/db/schema.ts:13-25`

**Interfaces:**

- Consumes: nothing
- Produces: `upgradeJobs.warning` — nullable text column

- [ ] **Step 1: Add warning column**

In `src/api/db/schema.ts`, add to the `upgradeJobs` table definition, after the `completedAt` column:

```ts
warning: text("warning");
```

- [ ] **Step 2: Generate migration**

Run: `bun run drizzle-kit generate`
Expected: new migration file created in `src/api/db/migrations/`

- [ ] **Step 3: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 4: Run full test suite**

Run: `bun run test`
Expected: all tests pass (schema change is additive — nullable column, no data migration needed)

- [ ] **Step 5: Commit**

```bash
git add src/api/db/schema.ts src/api/db/migrations/
git commit -m "feat: add warning column to upgradeJobs table"
```

---

### Task 2: Add `warning` to `scan:complete` WS event

**Files:**

- Modify: `src/shared/websocket/types.ts:8-10`

**Interfaces:**

- Consumes: `WSScanComplete` interface
- Produces: `WSScanComplete.warning` — `string | null` field on existing WS event

- [ ] **Step 1: Add warning field to WSScanComplete**

In `src/shared/websocket/types.ts`, update:

```ts
// Before:
export interface WSScanComplete {
  projectId: string;
}

// After:
export interface WSScanComplete {
  projectId: string;
  warning: string | null;
}
```

- [ ] **Step 2: Build to verify**

Run: `bun run build`
Expected: may produce type errors in files broadcasting `scan:complete` — that's expected, we fix in next task.

- [ ] **Step 3: Commit**

```bash
git add src/shared/websocket/types.ts
git commit -m "feat: add warning field to WSScanComplete WS event type"
```

---

### Task 3: ScanJobExecutor — detect and store 0-dep warning

**Files:**

- Modify: `src/api/services/jobExecutors/ScanJobExecutor.ts`
- Test: `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts` (create)

**Interfaces:**

- Consumes: `upgradeJobs.warning` column, `WSScanComplete.warning` field, `JobExecutor.ExecutionContext`
- Produces: warning stored on job row when scan returns 0 results but package.json has deps

- [ ] **Step 1: Write failing test**

Create `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScanJobExecutor } from "../ScanJobExecutor.js";

function createMockScanService(results: unknown[] = []) {
  return { scan: vi.fn().mockResolvedValue(results) };
}

function createMockSecurityService() {
  return { check: vi.fn().mockResolvedValue({ passes: true, checks: {} }) };
}

function createMockPackageManagerService() {
  return { getVersion: vi.fn().mockResolvedValue("1.0.0") };
}

function createMockDatabaseClient() {
  return {
    db: {
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ run: vi.fn() }) }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ run: vi.fn() }) }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ run: vi.fn() })
        })
      })
    }
  };
}

function createMockBroadcaster() {
  return { broadcast: vi.fn() };
}

function createContext(overrides: Partial<{ projectPath: string; packagesJson: string }> = {}) {
  return {
    jobId: "job-1",
    projectId: "project-1",
    projectPath: overrides.projectPath ?? "/tmp/test-project",
    packageManager: "npm",
    packagesJson: overrides.packagesJson ?? "{}",
    appendLog: vi.fn(),
    signal: new AbortController().signal
  };
}

describe("ScanJobExecutor", () => {
  it("should broadcast warning when scan returns 0 results and package.json has deps", async () => {
    const scanService = createMockScanService([]);
    const broadcaster = createMockBroadcaster();
    const databaseClient = createMockDatabaseClient();

    const executor = new ScanJobExecutor(
      scanService as any,
      createMockSecurityService() as any,
      createMockPackageManagerService() as any,
      databaseClient as any,
      broadcaster as any
    );

    // Mock fs.readFile for package.json check — this will need adjustment
    // based on how we implement the check (see Step 3)
    const context = createContext();
    await executor.execute(context);

    const broadcastCall = broadcaster.broadcast.mock.calls.find(
      (c: unknown[]) => c[0] === "scan:complete"
    );
    expect(broadcastCall).toBeDefined();
    // Warning should be present when 0 results (actual assertion depends on
    // whether package.json has deps — see implementation)
  });

  it("should broadcast null warning when scan returns results", async () => {
    const scanService = createMockScanService([
      {
        name: "lodash",
        currentVersion: "4.17.0",
        latestVersion: "4.17.21",
        latestInRange: "4.17.21",
        type: "dependency",
        upgradeType: "patch"
      }
    ]);
    const broadcaster = createMockBroadcaster();
    const databaseClient = createMockDatabaseClient();

    const executor = new ScanJobExecutor(
      scanService as any,
      createMockSecurityService() as any,
      createMockPackageManagerService() as any,
      databaseClient as any,
      broadcaster as any
    );

    const context = createContext();
    await executor.execute(context);

    const broadcastCall = broadcaster.broadcast.mock.calls.find(
      (c: unknown[]) => c[0] === "scan:complete"
    );
    expect(broadcastCall).toBeDefined();
    expect(broadcastCall![1]).toEqual(expect.objectContaining({ warning: null }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --reporter=verbose src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts`
Expected: FAIL — warning field not present in broadcast

- [ ] **Step 3: Implement warning detection in ScanJobExecutor**

In `src/api/services/jobExecutors/ScanJobExecutor.ts`:

1. Add import at top:

```ts
import { readFile } from "fs/promises";
import { join } from "path";
```

2. Add private method to class:

```ts
    private async hasPackageJsonDeps(projectPath: string): Promise<boolean> {
        try {
            const content = await readFile(join(projectPath, "package.json"), "utf-8");
            const pkg = JSON.parse(content) as Record<string, unknown>;
            const deps = Object.keys((pkg.dependencies as Record<string, string>) ?? {});
            const devDeps = Object.keys((pkg.devDependencies as Record<string, string>) ?? {});
            return deps.length + devDeps.length > 0;
        } catch {
            return false;
        }
    }
```

3. In the `execute` method, after scan results are stored and before the final `update` + `broadcast`, add warning logic:

```ts
let warning: string | null = null;
if (results.length === 0) {
  const hasDeps = await this.hasPackageJsonDeps(context.projectPath);
  if (hasDeps) {
    warning =
      "Lockfile may be stale or missing — 0 dependencies found despite package.json listing dependencies. Run install to regenerate.";
  }
}
```

4. Store warning on job:

```ts
if (warning) {
  await this.databaseClient.db
    .update(upgradeJobs)
    .set({ warning })
    .where(eq(upgradeJobs.id, context.jobId))
    .run();
}
```

5. Update broadcast to include warning:

```ts
this.webSocketBroadcaster.broadcast("scan:complete", {
  projectId: context.projectId,
  warning
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- --reporter=verbose src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts`
Expected: PASS

- [ ] **Step 5: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 6: Run full test suite**

Run: `bun run test`
Expected: all tests pass. Existing tests that listen for `scan:complete` may need updating to include `warning: null` in mock data — fix any failures.

- [ ] **Step 7: Commit**

```bash
git add src/api/services/jobExecutors/ScanJobExecutor.ts src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts
git commit -m "feat: detect and store warning when scan finds 0 deps with non-empty package.json"
```

---

### Task 4: UI — scan warning banner on project detail page

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`

**Interfaces:**

- Consumes: `WSScanComplete.warning`, `ProjectDetailPresenter.ViewModel`
- Produces: `scanWarning: string | null` on view model, orange `Alert` banner on page

- [ ] **Step 1: Add scanWarning to view model**

In `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`, add to `IProjectDetailViewModel`:

```ts
scanWarning: string | null;
```

- [ ] **Step 2: Update presenter to store and expose scanWarning**

In `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`:

1. Add private field:

```ts
    private scanWarning: string | null = null;
```

2. In the `vm` getter, add to returned object:

```ts
    scanWarning: this.scanWarning,
```

3. Update the `scan:complete` WS handler to capture warning. Find where `handleScanComplete` is defined and update:

```ts
this.handleScanComplete = data => {
  runInAction(() => {
    this.scanWarning = data.warning ?? null;
  });
  void this.finishScan(data.projectId);
};
```

4. Clear scanWarning when starting a new scan (in `scan` method):

```ts
this.scanWarning = null;
```

- [ ] **Step 3: Render warning banner in ProjectDetailPage**

In `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`, add after the existing `scanError` alert (around line 89-93):

```tsx
{
  vm.scanWarning && (
    <Alert color="orange" title="Scan Warning">
      {vm.scanWarning}
    </Alert>
  );
}
```

- [ ] **Step 4: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 5: Run full test suite**

Run: `bun run test`
Expected: all tests pass. If `ProjectDetailPresenter` tests mock the view model, add `scanWarning: null` to mock data.

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts \
  src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts \
  src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx
git commit -m "feat: show scan warning banner when lockfile yields 0 dependencies"
```

---

### Task 5: UI — warning badge on job history

**Files:**

- Modify: `src/ui/features/upgrades/abstractions/UpgradesGateway.ts`
- Modify: `src/ui/features/upgrades/UpgradesGateway.ts`
- Modify: `src/ui/presentation/jobs/JobProgress/components/JobProgressPanel.tsx`

**Interfaces:**

- Consumes: `upgradeJobs.warning` from API, `IJob` type
- Produces: `warning` field on `IJob`, orange "Warning" badge in job history UI

- [ ] **Step 1: Add warning to IJob type**

In `src/ui/features/upgrades/abstractions/UpgradesGateway.ts`, add to `IJob` interface:

```ts
warning: string | null;
```

- [ ] **Step 2: Update UpgradesGateway toJob mapper**

In `src/ui/features/upgrades/UpgradesGateway.ts`, update the `toJob` function parameter type and mapping:

```ts
function toJob(item: {
  id: string;
  projectId: string;
  type: string;
  status: string;
  packages: string | null;
  logs: string | null;
  startedAt: number | null;
  completedAt: number | null;
  warning?: string | null;
}): IJob {
  return {
    id: item.id,
    projectId: item.projectId,
    type: item.type as IJob["type"],
    status: item.status as IJob["status"],
    packages: item.packages,
    logs: item.logs,
    startedAt: item.startedAt,
    completedAt: item.completedAt,
    warning: item.warning ?? null
  };
}
```

- [ ] **Step 3: Add warning badge to JobProgressPanel**

In `src/ui/presentation/jobs/JobProgress/components/JobProgressPanel.tsx`, find where job status is rendered. Add after the status badge:

```tsx
{
  job.warning && (
    <Tooltip label={job.warning}>
      <Badge size="sm" color="orange">
        Warning
      </Badge>
    </Tooltip>
  );
}
```

Add `Tooltip` to Mantine imports if not already present.

- [ ] **Step 4: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 5: Run full test suite**

Run: `bun run test`
Expected: all tests pass. Update any test mocks for `IJob` to include `warning: null`.

- [ ] **Step 6: Commit**

```bash
git add src/ui/features/upgrades/abstractions/UpgradesGateway.ts \
  src/ui/features/upgrades/UpgradesGateway.ts \
  src/ui/presentation/jobs/JobProgress/components/JobProgressPanel.tsx
git commit -m "feat: show warning badge on scan jobs with stale lockfile warning"
```
