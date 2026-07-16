# Scheduled Auto-Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable scheduled auto-scan for dependency projects using bree job scheduler.

**Architecture:** Server-side `ScanSchedulerService` uses bree to manage per-project scan timers. Worker threads message the main thread via `parentPort`, where `JobWorker.enqueue()` is called. Global default stored in `app_settings`, per-project overrides in new `scan_schedules` table. UI extends existing App Settings and Project Detail pages.

**Tech Stack:** bree (job scheduler), drizzle-orm (schema), zod (route validation), MobX (presenter state), Mantine (UI components)

## Global Constraints

- Preset intervals only: `"6h"`, `"12h"`, `"24h"`, `"48h"`, `"weekly"`, `"disabled"`
- Per-project override takes priority over global default
- Global default when unset: `"disabled"`
- Project IDs are UUIDs from `generateId()` — safe as bree job names
- All DI services follow `createAbstraction` / `createImplementation` pattern
- Abstractions and implementations MUST be in separate files, in separate directories
- Use yarn, not npm
- No inline structural types — always use named interfaces
- Tests use vitest, test DB helper at `src/testing/helpers/createTestDb.ts`

---

### Task 1: Schema, Migration, Shared Types, and Route Definitions

**Files:**

- Modify: `src/api/db/schema.ts` (add `scanSchedules` table)
- Create: `src/api/db/migrations/0003_add_scan_schedules.sql`
- Modify: `src/testing/helpers/createTestDb.ts` (add DDL)
- Create: `src/shared/schedules/types.ts` (shared interval type)
- Create: `src/shared/routes/scanSchedules.ts` (route definitions)
- Modify: `src/shared/routes/index.ts` (barrel export)

**Interfaces:**

- Consumes: existing `projects` table from `src/api/db/schema.ts`
- Produces: `scanSchedules` drizzle table, `ScanInterval` type, route definitions (`listScanSchedulesRoute`, `upsertScanScheduleRoute`, `deleteScanScheduleRoute`, `getScanScheduleDefaultRoute`, `upsertScanScheduleDefaultRoute`)

- [ ] **Step 1: Add `scanSchedules` table to Drizzle schema**

In `src/api/db/schema.ts`, add after `healthSnapshots`:

```typescript
export const scanSchedules = sqliteTable("scan_schedules", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id")
    .notNull()
    .unique()
    .references(() => projects.id),
  interval: text("interval").notNull(),
  lastRunAt: integer("last_run_at"),
  nextRunAt: integer("next_run_at"),
  enabled: integer("enabled").notNull().default(1),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});
```

- [ ] **Step 2: Create migration file**

Create `src/api/db/migrations/0003_add_scan_schedules.sql`:

```sql
CREATE TABLE `scan_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL UNIQUE,
	`interval` text NOT NULL,
	`last_run_at` integer,
	`next_run_at` integer,
	`enabled` integer NOT NULL DEFAULT 1,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
```

- [ ] **Step 3: Update test helper DDL**

In `src/testing/helpers/createTestDb.ts`, add before the closing backtick of `CREATE_TABLES`:

```sql
    CREATE TABLE scan_schedules (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
        interval TEXT NOT NULL,
        last_run_at INTEGER,
        next_run_at INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
```

- [ ] **Step 4: Create shared interval type**

Create `src/shared/schedules/types.ts`:

```typescript
export const SCAN_INTERVALS = ["6h", "12h", "24h", "48h", "weekly", "disabled"] as const;

export type ScanInterval = (typeof SCAN_INTERVALS)[number];

export const INTERVAL_MS: Record<Exclude<ScanInterval, "disabled">, number> = {
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000
};
```

- [ ] **Step 5: Create shared route definitions**

Create `src/shared/routes/scanSchedules.ts`:

```typescript
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const scanScheduleSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  interval: z.string(),
  lastRunAt: z.number().nullable(),
  nextRunAt: z.number().nullable(),
  enabled: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number()
});

const resolvedScheduleSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  interval: z.string(),
  source: z.enum(["project", "default"]),
  lastRunAt: z.number().nullable(),
  nextRunAt: z.number().nullable()
});

export const listScanSchedulesRoute = defineRoute({
  method: "GET",
  path: "/api/scan-schedules",
  description: "List resolved scan schedules for all projects",
  params: z.object({}),
  response: z.object({
    items: z.array(resolvedScheduleSchema),
    globalDefault: z.string()
  })
});

export const upsertScanScheduleRoute = defineRoute({
  method: "PUT",
  path: "/api/scan-schedules/:projectId",
  description: "Set per-project scan schedule override",
  params: z.object({ projectId: z.string() }),
  body: z.object({ interval: z.string() }),
  response: z.object({ item: scanScheduleSchema })
});

export const deleteScanScheduleRoute = defineRoute({
  method: "DELETE",
  path: "/api/scan-schedules/:projectId",
  description: "Remove per-project schedule override, revert to default",
  params: z.object({ projectId: z.string() })
});

export const getScanScheduleDefaultRoute = defineRoute({
  method: "GET",
  path: "/api/settings/scan-schedule-default",
  description: "Get global default scan interval",
  params: z.object({}),
  response: z.object({ item: z.object({ interval: z.string() }) })
});

export const upsertScanScheduleDefaultRoute = defineRoute({
  method: "PUT",
  path: "/api/settings/scan-schedule-default",
  description: "Set global default scan interval",
  params: z.object({}),
  body: z.object({ interval: z.string() }),
  response: z.object({ item: z.object({ interval: z.string() }) })
});
```

- [ ] **Step 6: Add barrel exports**

In `src/shared/routes/index.ts`, add:

```typescript
export * from "./scanSchedules.js";
```

- [ ] **Step 7: Verify build**

Run: `yarn typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/api/db/schema.ts src/api/db/migrations/0003_add_scan_schedules.sql src/testing/helpers/createTestDb.ts src/shared/schedules/types.ts src/shared/routes/scanSchedules.ts src/shared/routes/index.ts
git commit -m "feat(scan-schedules): add schema, migration, shared types, and route definitions"
```

---

### Task 2: ScanSchedulerService (Abstraction + Implementation + Worker)

**Files:**

- Create: `src/api/services/abstractions/ScanSchedulerService.ts`
- Create: `src/api/services/ScanSchedulerService.ts`
- Create: `src/api/services/workers/scanWorker.js` (bree worker script)
- Modify: `src/api/feature.ts` (register service)
- Modify: `src/api/server.ts` (init on boot, stop on close)
- Modify: `package.json` (add bree dependency)
- Test: `src/api/services/__tests__/ScanSchedulerService.test.ts`

**Interfaces:**

- Consumes: `DatabaseClient`, `JobWorker`, `ErrorReporter`, `scanSchedules` table, `appSettings` table, `projects` table, `INTERVAL_MS` from shared types
- Produces: `IScanSchedulerService` interface with `init()`, `stop()`, `scheduleProject(projectId)`, `unscheduleProject(projectId)`, `onGlobalDefaultChanged()`, `onScanComplete(projectId)`

- [ ] **Step 1: Install bree**

Run: `yarn add bree`

- [ ] **Step 2: Create abstraction**

Create `src/api/services/abstractions/ScanSchedulerService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IScanSchedulerService {
  init(): Promise<void>;
  stop(): Promise<void>;
  scheduleProject(projectId: string): Promise<void>;
  unscheduleProject(projectId: string): Promise<void>;
  onGlobalDefaultChanged(): Promise<void>;
  onScanComplete(projectId: string): Promise<void>;
}

export const ScanSchedulerService = createAbstraction<IScanSchedulerService>(
  "Api/ScanSchedulerService"
);

export namespace ScanSchedulerService {
  export type Interface = IScanSchedulerService;
}
```

- [ ] **Step 3: Create bree worker script**

Create `src/api/services/workers/scanWorker.js`:

```javascript
import { parentPort, workerData } from "node:worker_threads";

if (parentPort) {
  parentPort.postMessage({ projectId: workerData.projectId });
}
```

- [ ] **Step 4: Write failing tests**

Create `src/api/services/__tests__/ScanSchedulerService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects, scanSchedules, appSettings } from "#api/db/schema.js";
import { eq } from "drizzle-orm";
import { ScanSchedulerServiceImpl } from "../ScanSchedulerService.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

function createMockJobWorker() {
  return {
    enqueue: vi.fn().mockResolvedValue("job-1"),
    getJob: vi.fn(),
    getJobsForReference: vi.fn(),
    processNextJob: vi.fn(),
    cancelJob: vi.fn(),
    listAllJobs: vi.fn(),
    drain: vi.fn()
  };
}

function createMockErrorReporter() {
  return {
    reportJobWarning: vi.fn(),
    reportError: vi.fn()
  };
}

async function seedProject(db: TestDb, id: string, name: string): Promise<void> {
  await db
    .insert(projects)
    .values({ id, name, path: `/test/${name}`, addedAt: Date.now() })
    .run();
}

describe("ScanSchedulerService", () => {
  let db: TestDb;
  let jobWorker: ReturnType<typeof createMockJobWorker>;
  let errorReporter: ReturnType<typeof createMockErrorReporter>;

  beforeEach(async () => {
    db = await createTestDb();
    jobWorker = createMockJobWorker();
    errorReporter = createMockErrorReporter();
  });

  describe("resolveInterval", () => {
    it("returns per-project interval when override exists", async () => {
      const projectId = generateId();
      await seedProject(db, projectId, "test-project");
      const now = Date.now();
      await db
        .insert(scanSchedules)
        .values({
          id: generateId(),
          projectId,
          interval: "6h",
          enabled: 1,
          createdAt: now,
          updatedAt: now
        })
        .run();

      const service = new ScanSchedulerServiceImpl(
        { db } as DatabaseClient.Interface,
        jobWorker,
        errorReporter
      );
      const interval = await service.resolveInterval(projectId);
      expect(interval).toBe("6h");
    });

    it("falls back to global default when no override", async () => {
      const projectId = generateId();
      await seedProject(db, projectId, "test-project");
      await db.insert(appSettings).values({ key: "scan_schedule_default", value: "24h" }).run();

      const service = new ScanSchedulerServiceImpl(
        { db } as DatabaseClient.Interface,
        jobWorker,
        errorReporter
      );
      const interval = await service.resolveInterval(projectId);
      expect(interval).toBe("24h");
    });

    it("returns disabled when neither override nor global default exists", async () => {
      const projectId = generateId();
      await seedProject(db, projectId, "test-project");

      const service = new ScanSchedulerServiceImpl(
        { db } as DatabaseClient.Interface,
        jobWorker,
        errorReporter
      );
      const interval = await service.resolveInterval(projectId);
      expect(interval).toBe("disabled");
    });
  });

  describe("computeNextRunAt", () => {
    it("computes next run from last run time", () => {
      const lastRun = 1000000;
      const intervalMs = 6 * 60 * 60 * 1000;
      const service = new ScanSchedulerServiceImpl(
        { db } as DatabaseClient.Interface,
        jobWorker,
        errorReporter
      );
      const next = service.computeNextRunAt(lastRun, intervalMs);
      expect(next).toBe(lastRun + intervalMs);
    });

    it("uses now when no last run", () => {
      const service = new ScanSchedulerServiceImpl(
        { db } as DatabaseClient.Interface,
        jobWorker,
        errorReporter
      );
      const before = Date.now();
      const next = service.computeNextRunAt(null, 6 * 60 * 60 * 1000);
      const after = Date.now();
      expect(next).toBeGreaterThanOrEqual(before + 6 * 60 * 60 * 1000);
      expect(next).toBeLessThanOrEqual(after + 6 * 60 * 60 * 1000);
    });
  });

  describe("onScanComplete", () => {
    it("updates lastRunAt and nextRunAt in DB", async () => {
      const projectId = generateId();
      await seedProject(db, projectId, "test-project");
      const now = Date.now();
      await db
        .insert(scanSchedules)
        .values({
          id: generateId(),
          projectId,
          interval: "6h",
          enabled: 1,
          createdAt: now,
          updatedAt: now
        })
        .run();

      const service = new ScanSchedulerServiceImpl(
        { db } as DatabaseClient.Interface,
        jobWorker,
        errorReporter
      );
      await service.onScanComplete(projectId);

      const row = await db
        .select()
        .from(scanSchedules)
        .where(eq(scanSchedules.projectId, projectId))
        .get();

      expect(row!.lastRunAt).toBeGreaterThan(0);
      expect(row!.nextRunAt).toBeGreaterThan(row!.lastRunAt!);
    });
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `yarn test src/api/services/__tests__/ScanSchedulerService.test.ts`
Expected: FAIL — `ScanSchedulerServiceImpl` not found

- [ ] **Step 6: Implement ScanSchedulerService**

Create `src/api/services/ScanSchedulerService.ts`:

```typescript
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Bree from "bree";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { ScanSchedulerService as Abstraction } from "./abstractions/ScanSchedulerService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "./abstractions/JobWorker.js";
import { ErrorReporter } from "./abstractions/ErrorReporter.js";
import { projects, scanSchedules, appSettings } from "#api/db/schema.js";
import { INTERVAL_MS, type ScanInterval } from "#shared/schedules/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ScanSchedulerServiceImpl implements Abstraction.Interface {
  private bree: Bree | null = null;
  private readonly activeJobs = new Set<string>();

  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly jobWorker: JobWorker.Interface,
    private readonly errorReporter: ErrorReporter.Interface
  ) {}

  public async resolveInterval(projectId: string): Promise<ScanInterval> {
    const override = await this.databaseClient.db
      .select({ interval: scanSchedules.interval })
      .from(scanSchedules)
      .where(eq(scanSchedules.projectId, projectId))
      .get();

    if (override) {
      return override.interval as ScanInterval;
    }

    const globalDefault = await this.databaseClient.db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, "scan_schedule_default"))
      .get();

    return (globalDefault?.value as ScanInterval) ?? "disabled";
  }

  public computeNextRunAt(lastRunAt: number | null, intervalMs: number): number {
    const base = lastRunAt ?? Date.now();
    return base + intervalMs;
  }

  public async init(): Promise<void> {
    const workerPath = resolve(__dirname, "workers", "scanWorker.js");

    this.bree = new Bree({
      root: false,
      jobs: [],
      workerMessageHandler: ({
        message
      }: {
        name: string;
        worker: unknown;
        message: { projectId: string };
      }) => {
        void this.handleWorkerMessage(message.projectId);
      }
    });

    await this.bree.start();

    const allProjects = await this.databaseClient.db.select().from(projects).all();

    for (let i = 0; i < allProjects.length; i++) {
      const project = allProjects[i]!;
      const interval = await this.resolveInterval(project.id);

      if (interval === "disabled") {
        continue;
      }

      const intervalMs = INTERVAL_MS[interval];
      const scheduleRow = await this.databaseClient.db
        .select()
        .from(scanSchedules)
        .where(eq(scanSchedules.projectId, project.id))
        .get();

      const nextRunAt = scheduleRow?.nextRunAt ?? this.computeNextRunAt(null, intervalMs);
      const now = Date.now();
      const staggerMs = i * 5000;
      const delayMs = Math.max(0, nextRunAt - now) + staggerMs;

      await this.addBreeJob(project.id, workerPath, intervalMs, delayMs);
    }
  }

  public async stop(): Promise<void> {
    if (this.bree) {
      await this.bree.stop();
      this.bree = null;
    }
    this.activeJobs.clear();
  }

  public async scheduleProject(projectId: string): Promise<void> {
    const interval = await this.resolveInterval(projectId);

    if (this.activeJobs.has(projectId)) {
      await this.removeBreeJob(projectId);
    }

    if (interval === "disabled") {
      return;
    }

    const intervalMs = INTERVAL_MS[interval];
    const workerPath = resolve(__dirname, "workers", "scanWorker.js");
    await this.addBreeJob(projectId, workerPath, intervalMs, intervalMs);
  }

  public async unscheduleProject(projectId: string): Promise<void> {
    if (this.activeJobs.has(projectId)) {
      await this.removeBreeJob(projectId);
    }
  }

  public async onGlobalDefaultChanged(): Promise<void> {
    const allProjects = await this.databaseClient.db
      .select({ id: projects.id })
      .from(projects)
      .all();
    const overrideProjectIds = new Set(
      (
        await this.databaseClient.db
          .select({ projectId: scanSchedules.projectId })
          .from(scanSchedules)
          .all()
      ).map(r => r.projectId)
    );

    for (const project of allProjects) {
      if (!overrideProjectIds.has(project.id)) {
        await this.scheduleProject(project.id);
      }
    }
  }

  public async onScanComplete(projectId: string): Promise<void> {
    const row = await this.databaseClient.db
      .select()
      .from(scanSchedules)
      .where(eq(scanSchedules.projectId, projectId))
      .get();

    if (!row) {
      return;
    }

    const interval = row.interval as ScanInterval;
    if (interval === "disabled") {
      return;
    }

    const now = Date.now();
    const intervalMs = INTERVAL_MS[interval];
    const nextRunAt = now + intervalMs;

    await this.databaseClient.db
      .update(scanSchedules)
      .set({ lastRunAt: now, nextRunAt, updatedAt: now })
      .where(eq(scanSchedules.projectId, projectId))
      .run();
  }

  private async handleWorkerMessage(projectId: string): Promise<void> {
    try {
      await this.jobWorker.enqueue({
        referenceId: projectId,
        referenceType: "project",
        type: "scan"
      });
    } catch (error) {
      await this.errorReporter.reportError(
        "ScanScheduler",
        projectId,
        `Failed to enqueue scheduled scan: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async addBreeJob(
    projectId: string,
    workerPath: string,
    intervalMs: number,
    delayMs: number
  ): Promise<void> {
    if (!this.bree) {
      return;
    }

    const jobName = `scan-${projectId}`;

    await this.bree.add({
      name: jobName,
      path: workerPath,
      interval: intervalMs,
      timeout: delayMs,
      worker: { workerData: { projectId } }
    });

    await this.bree.start(jobName);
    this.activeJobs.add(projectId);
  }

  private async removeBreeJob(projectId: string): Promise<void> {
    if (!this.bree) {
      return;
    }

    const jobName = `scan-${projectId}`;

    try {
      await this.bree.stop(jobName);
      await this.bree.remove(jobName);
    } catch {
      // Job may not exist — safe to ignore
    }

    this.activeJobs.delete(projectId);
  }
}

export const ScanSchedulerService = Abstraction.createImplementation({
  implementation: ScanSchedulerServiceImpl,
  dependencies: [DatabaseClient, JobWorker, ErrorReporter]
});
```

- [ ] **Step 7: Register in API feature**

In `src/api/feature.ts`, add import:

```typescript
import { ScanSchedulerService } from "./services/ScanSchedulerService.js";
```

Add inside `register()`, after `container.register(ErrorReporter).inSingletonScope();`:

```typescript
container.register(ScanSchedulerService).inSingletonScope();
```

- [ ] **Step 8: Hook onScanComplete into ScanJobExecutor**

In `src/api/services/jobExecutors/ScanJobExecutor.ts`, add `ScanSchedulerService` as a constructor dependency. At the end of the `execute()` method, after `this.webSocketBroadcaster.broadcast("scan:complete", ...)`, add:

```typescript
await this.scanSchedulerService.onScanComplete(context.referenceId);
```

Update the `JobExecutorRegistry` to pass the new dependency when constructing `ScanJobExecutor`.

- [ ] **Step 9: Wire init/stop in server.ts**

In `src/api/server.ts`, add import:

```typescript
import { ScanSchedulerService } from "./services/abstractions/ScanSchedulerService.js";
```

After `await seedAppSettings(databaseClient.db);`, add:

```typescript
const scanScheduler = container.resolve(ScanSchedulerService);
await scanScheduler.init();
```

In the `onClose` hook, before `clearInterval(pollInterval);`, add:

```typescript
await scanScheduler.stop();
```

- [ ] **Step 10: Run tests**

Run: `yarn test src/api/services/__tests__/ScanSchedulerService.test.ts`
Expected: PASS

- [ ] **Step 11: Verify build**

Run: `yarn typecheck`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/api/services/abstractions/ScanSchedulerService.ts src/api/services/ScanSchedulerService.ts src/api/services/workers/scanWorker.js src/api/services/__tests__/ScanSchedulerService.test.ts src/api/feature.ts src/api/server.ts package.json yarn.lock
git commit -m "feat(scan-schedules): add ScanSchedulerService with bree integration"
```

---

### Task 3: API Routes + Integration Tests

**Files:**

- Create: `src/api/routes/scanSchedules.ts`
- Modify: `src/api/routes/index.ts` (barrel export)
- Modify: `src/api/server.ts` (register routes)
- Test: `src/api/routes/__tests__/scanSchedules.test.ts`

**Interfaces:**

- Consumes: `DatabaseClient`, `ScanSchedulerService`, `scanSchedules` table, `appSettings` table, `projects` table, route definitions from `src/shared/routes/scanSchedules.ts`
- Produces: Fastify route plugin `scanScheduleRoutes`

- [ ] **Step 1: Write failing route tests**

Create `src/api/routes/__tests__/scanSchedules.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { ScanSchedulerService } from "#api/services/abstractions/ScanSchedulerService.js";
import { projects, scanSchedules, appSettings } from "#api/db/schema.js";
import { scanScheduleRoutes } from "../scanSchedules.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

function createMockScheduler(): ScanSchedulerService.Interface {
  return {
    init: vi.fn(),
    stop: vi.fn(),
    scheduleProject: vi.fn(),
    unscheduleProject: vi.fn(),
    onGlobalDefaultChanged: vi.fn(),
    onScanComplete: vi.fn()
  };
}

describe("scan schedule routes", () => {
  let app: FastifyInstance;
  let db: TestDb;
  let scheduler: ScanSchedulerService.Interface;

  beforeEach(async () => {
    db = await createTestDb();
    scheduler = createMockScheduler();
    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
    container.registerInstance(ScanSchedulerService, scheduler);

    app = Fastify();
    await app.register(scanScheduleRoutes, { container });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /api/scan-schedules returns all projects with resolved schedules", async () => {
    const projectId = generateId();
    await db
      .insert(projects)
      .values({ id: projectId, name: "test", path: "/test", addedAt: Date.now() })
      .run();

    const response = await app.inject({ method: "GET", url: "/api/scan-schedules" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].projectId).toBe(projectId);
    expect(body.items[0].source).toBe("default");
    expect(body.globalDefault).toBe("disabled");
  });

  it("PUT /api/scan-schedules/:projectId creates per-project override", async () => {
    const projectId = generateId();
    await db
      .insert(projects)
      .values({ id: projectId, name: "test", path: "/test", addedAt: Date.now() })
      .run();

    const response = await app.inject({
      method: "PUT",
      url: `/api/scan-schedules/${projectId}`,
      payload: { interval: "12h" }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.item.interval).toBe("12h");
    expect(body.item.projectId).toBe(projectId);
    expect(scheduler.scheduleProject).toHaveBeenCalledWith(projectId);
  });

  it("DELETE /api/scan-schedules/:projectId removes override", async () => {
    const projectId = generateId();
    await db
      .insert(projects)
      .values({ id: projectId, name: "test", path: "/test", addedAt: Date.now() })
      .run();

    const now = Date.now();
    await db
      .insert(scanSchedules)
      .values({
        id: generateId(),
        projectId,
        interval: "12h",
        enabled: 1,
        createdAt: now,
        updatedAt: now
      })
      .run();

    const response = await app.inject({
      method: "DELETE",
      url: `/api/scan-schedules/${projectId}`
    });

    expect(response.statusCode).toBe(204);
    expect(scheduler.scheduleProject).toHaveBeenCalledWith(projectId);
  });

  it("GET /api/settings/scan-schedule-default returns disabled when unset", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/settings/scan-schedule-default"
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().item.interval).toBe("disabled");
  });

  it("PUT /api/settings/scan-schedule-default sets global default", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/scan-schedule-default",
      payload: { interval: "24h" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().item.interval).toBe("24h");
    expect(scheduler.onGlobalDefaultChanged).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/api/routes/__tests__/scanSchedules.test.ts`
Expected: FAIL — `scanScheduleRoutes` not found

- [ ] **Step 3: Implement route handlers**

Create `src/api/routes/scanSchedules.ts`:

```typescript
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { registerRoute, sendOne, sendNone } from "#shared/routing/index.js";
import {
  listScanSchedulesRoute,
  upsertScanScheduleRoute,
  deleteScanScheduleRoute,
  getScanScheduleDefaultRoute,
  upsertScanScheduleDefaultRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { ScanSchedulerService } from "#api/services/abstractions/ScanSchedulerService.js";
import { projects, scanSchedules, appSettings } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
  container: Container;
}

export async function scanScheduleRoutes(
  app: FastifyInstance,
  options: PluginOptions
): Promise<void> {
  const { container } = options;
  const databaseClient = container.resolve(DatabaseClient);
  const scheduler = container.resolve(ScanSchedulerService);
  const { db } = databaseClient;

  registerRoute(app, listScanSchedulesRoute, {}, async (_request, reply) => {
    const allProjects = await db.select().from(projects).all();
    const overrides = await db.select().from(scanSchedules).all();
    const overrideMap = new Map(overrides.map(o => [o.projectId, o]));

    const globalRow = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "scan_schedule_default"))
      .get();
    const globalDefault = globalRow?.value ?? "disabled";

    const items = allProjects.map(project => {
      const override = overrideMap.get(project.id);
      return {
        projectId: project.id,
        projectName: project.name,
        interval: override?.interval ?? globalDefault,
        source: override ? ("project" as const) : ("default" as const),
        lastRunAt: override?.lastRunAt ?? null,
        nextRunAt: override?.nextRunAt ?? null
      };
    });

    reply.send({ items, globalDefault });
  });

  registerRoute(app, upsertScanScheduleRoute, {}, async (request, reply) => {
    const { projectId } = request.params;
    const { interval } = request.body;
    const now = Date.now();

    const existing = await db
      .select()
      .from(scanSchedules)
      .where(eq(scanSchedules.projectId, projectId))
      .get();

    if (existing) {
      await db
        .update(scanSchedules)
        .set({ interval, updatedAt: now })
        .where(eq(scanSchedules.projectId, projectId))
        .run();

      await scheduler.scheduleProject(projectId);

      sendOne(reply, { ...existing, interval, updatedAt: now, enabled: existing.enabled === 1 });
    } else {
      const id = generateId();
      const row = {
        id,
        projectId,
        interval,
        lastRunAt: null,
        nextRunAt: null,
        enabled: 1,
        createdAt: now,
        updatedAt: now
      };

      await db.insert(scanSchedules).values(row).run();
      await scheduler.scheduleProject(projectId);

      sendOne(reply, { ...row, enabled: true });
    }
  });

  registerRoute(app, deleteScanScheduleRoute, {}, async (request, reply) => {
    const { projectId } = request.params;

    await db.delete(scanSchedules).where(eq(scanSchedules.projectId, projectId)).run();

    await scheduler.scheduleProject(projectId);
    sendNone(reply, 204);
  });

  registerRoute(app, getScanScheduleDefaultRoute, {}, async (_request, reply) => {
    const row = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "scan_schedule_default"))
      .get();

    sendOne(reply, { interval: row?.value ?? "disabled" });
  });

  registerRoute(app, upsertScanScheduleDefaultRoute, {}, async (request, reply) => {
    const { interval } = request.body;

    await db
      .insert(appSettings)
      .values({ key: "scan_schedule_default", value: interval })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: interval }
      })
      .run();

    await scheduler.onGlobalDefaultChanged();
    sendOne(reply, { interval });
  });
}
```

- [ ] **Step 4: Add barrel export and server registration**

In `src/api/routes/index.ts`, add:

```typescript
export { scanScheduleRoutes } from "./scanSchedules.js";
```

In `src/api/server.ts`, add to the imports:

```typescript
import { scanScheduleRoutes } from "./routes/index.js";
```

After `await app.register(dashboardRoutes, { container });`, add:

```typescript
await app.register(scanScheduleRoutes, { container });
```

- [ ] **Step 5: Run tests**

Run: `yarn test src/api/routes/__tests__/scanSchedules.test.ts`
Expected: PASS

- [ ] **Step 6: Verify build**

Run: `yarn typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/api/routes/scanSchedules.ts src/api/routes/index.ts src/api/routes/__tests__/scanSchedules.test.ts src/api/server.ts
git commit -m "feat(scan-schedules): add API routes with integration tests"
```

---

### Task 4: UI Feature Layer (Gateway + Repository)

**Files:**

- Create: `src/ui/features/scanSchedules/abstractions/ScanSchedulesGateway.ts`
- Create: `src/ui/features/scanSchedules/ScanSchedulesGateway.ts`
- Create: `src/ui/features/scanSchedules/abstractions/ScanSchedulesRepository.ts`
- Create: `src/ui/features/scanSchedules/ScanSchedulesRepository.ts`
- Create: `src/ui/features/scanSchedules/index.ts` (feature registration)
- Test: `src/ui/features/scanSchedules/__tests__/ScanSchedulesRepository.test.ts`

**Interfaces:**

- Consumes: `HTTPClient`, route definitions from `src/shared/routes/scanSchedules.ts`
- Produces: `IScanSchedulesGateway` (list, upsert, delete, getDefault, setDefault), `IScanSchedulesRepository` (get/set schedules and global default in memory)

- [ ] **Step 1: Create gateway abstraction**

Create `src/ui/features/scanSchedules/abstractions/ScanSchedulesGateway.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IResolvedSchedule {
  projectId: string;
  projectName: string;
  interval: string;
  source: "project" | "default";
  lastRunAt: number | null;
  nextRunAt: number | null;
}

export interface IScheduleListResult {
  items: IResolvedSchedule[];
  globalDefault: string;
}

export interface IScanScheduleRow {
  id: string;
  projectId: string;
  interval: string;
  lastRunAt: number | null;
  nextRunAt: number | null;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface IScanSchedulesGateway {
  list(): Promise<IScheduleListResult>;
  upsert(projectId: string, interval: string): Promise<IScanScheduleRow>;
  remove(projectId: string): Promise<void>;
  getDefault(): Promise<string>;
  setDefault(interval: string): Promise<string>;
}

export const ScanSchedulesGateway =
  createAbstraction<IScanSchedulesGateway>("Ui/ScanSchedulesGateway");

export namespace ScanSchedulesGateway {
  export type Interface = IScanSchedulesGateway;
  export type ResolvedSchedule = IResolvedSchedule;
  export type ScheduleListResult = IScheduleListResult;
  export type ScheduleRow = IScanScheduleRow;
}
```

- [ ] **Step 2: Create repository abstraction**

Create `src/ui/features/scanSchedules/abstractions/ScanSchedulesRepository.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import { ScanSchedulesGateway } from "./ScanSchedulesGateway.js";

export interface IScanSchedulesRepository {
  getSchedules(): ScanSchedulesGateway.ResolvedSchedule[];
  setSchedules(schedules: ScanSchedulesGateway.ResolvedSchedule[]): void;
  getSchedule(projectId: string): ScanSchedulesGateway.ResolvedSchedule | undefined;
  updateSchedule(projectId: string, interval: string, source: "project" | "default"): void;
  getGlobalDefault(): string;
  setGlobalDefault(interval: string): void;
}

export const ScanSchedulesRepository = createAbstraction<IScanSchedulesRepository>(
  "Ui/ScanSchedulesRepository"
);

export namespace ScanSchedulesRepository {
  export type Interface = IScanSchedulesRepository;
}
```

- [ ] **Step 3: Write failing repository test**

Create `src/ui/features/scanSchedules/__tests__/ScanSchedulesRepository.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ScanSchedulesRepositoryImpl } from "../ScanSchedulesRepository.js";

function createRepo(): ScanSchedulesRepositoryImpl {
  return new ScanSchedulesRepositoryImpl();
}

describe("ScanSchedulesRepository", () => {
  it("stores and retrieves schedules", () => {
    const repo = createRepo();
    const schedule = {
      projectId: "p1",
      projectName: "test",
      interval: "24h",
      source: "default" as const,
      lastRunAt: null,
      nextRunAt: null
    };

    repo.setSchedules([schedule]);
    expect(repo.getSchedules()).toEqual([schedule]);
  });

  it("retrieves a single schedule by projectId", () => {
    const repo = createRepo();
    repo.setSchedules([
      {
        projectId: "p1",
        projectName: "a",
        interval: "6h",
        source: "project",
        lastRunAt: null,
        nextRunAt: null
      },
      {
        projectId: "p2",
        projectName: "b",
        interval: "24h",
        source: "default",
        lastRunAt: null,
        nextRunAt: null
      }
    ]);

    expect(repo.getSchedule("p2")?.interval).toBe("24h");
  });

  it("updates a schedule in place", () => {
    const repo = createRepo();
    repo.setSchedules([
      {
        projectId: "p1",
        projectName: "a",
        interval: "24h",
        source: "default",
        lastRunAt: null,
        nextRunAt: null
      }
    ]);

    repo.updateSchedule("p1", "6h", "project");
    expect(repo.getSchedule("p1")?.interval).toBe("6h");
    expect(repo.getSchedule("p1")?.source).toBe("project");
  });

  it("stores and retrieves global default", () => {
    const repo = createRepo();
    expect(repo.getGlobalDefault()).toBe("disabled");
    repo.setGlobalDefault("24h");
    expect(repo.getGlobalDefault()).toBe("24h");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `yarn test src/ui/features/scanSchedules/__tests__/ScanSchedulesRepository.test.ts`
Expected: FAIL

- [ ] **Step 5: Implement repository**

Create `src/ui/features/scanSchedules/ScanSchedulesRepository.ts`:

```typescript
import { ScanSchedulesRepository as Abstraction } from "./abstractions/ScanSchedulesRepository.js";
import type { ScanSchedulesGateway } from "./abstractions/ScanSchedulesGateway.js";

export class ScanSchedulesRepositoryImpl implements Abstraction.Interface {
  private schedules: ScanSchedulesGateway.ResolvedSchedule[] = [];
  private globalDefault = "disabled";

  public getSchedules(): ScanSchedulesGateway.ResolvedSchedule[] {
    return this.schedules;
  }

  public setSchedules(schedules: ScanSchedulesGateway.ResolvedSchedule[]): void {
    this.schedules = schedules;
  }

  public getSchedule(projectId: string): ScanSchedulesGateway.ResolvedSchedule | undefined {
    return this.schedules.find(s => s.projectId === projectId);
  }

  public updateSchedule(projectId: string, interval: string, source: "project" | "default"): void {
    const schedule = this.schedules.find(s => s.projectId === projectId);
    if (schedule) {
      schedule.interval = interval;
      schedule.source = source;
    }
  }

  public getGlobalDefault(): string {
    return this.globalDefault;
  }

  public setGlobalDefault(interval: string): void {
    this.globalDefault = interval;
  }
}

export const ScanSchedulesRepository = Abstraction.createImplementation({
  implementation: ScanSchedulesRepositoryImpl,
  dependencies: []
});
```

- [ ] **Step 6: Implement gateway**

Create `src/ui/features/scanSchedules/ScanSchedulesGateway.ts`:

```typescript
import {
  listScanSchedulesRoute,
  upsertScanScheduleRoute,
  deleteScanScheduleRoute,
  getScanScheduleDefaultRoute,
  upsertScanScheduleDefaultRoute
} from "#shared/routes/index.js";
import { ScanSchedulesGateway as Abstraction } from "./abstractions/ScanSchedulesGateway.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";

class ScanSchedulesGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(): Promise<Abstraction.ScheduleListResult> {
    const response = await this.httpClient.request(listScanSchedulesRoute, { params: {} });
    return { items: response.items, globalDefault: response.globalDefault };
  }

  public async upsert(projectId: string, interval: string): Promise<Abstraction.ScheduleRow> {
    const response = await this.httpClient.request(upsertScanScheduleRoute, {
      params: { projectId },
      body: { interval }
    });
    return response.item;
  }

  public async remove(projectId: string): Promise<void> {
    await this.httpClient.request(deleteScanScheduleRoute, { params: { projectId } });
  }

  public async getDefault(): Promise<string> {
    const response = await this.httpClient.request(getScanScheduleDefaultRoute, { params: {} });
    return response.item.interval;
  }

  public async setDefault(interval: string): Promise<string> {
    const response = await this.httpClient.request(upsertScanScheduleDefaultRoute, {
      params: {},
      body: { interval }
    });
    return response.item.interval;
  }
}

export const ScanSchedulesGateway = Abstraction.createImplementation({
  implementation: ScanSchedulesGatewayImpl,
  dependencies: [HTTPClient]
});
```

- [ ] **Step 7: Create feature registration**

Create `src/ui/features/scanSchedules/index.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { ScanSchedulesGateway } from "./ScanSchedulesGateway.js";
import { ScanSchedulesRepository } from "./ScanSchedulesRepository.js";

export const ScanSchedulesFeature = createFeature({
  name: "ScanSchedules",
  register(container) {
    container.register(ScanSchedulesGateway).inSingletonScope();
    container.register(ScanSchedulesRepository).inSingletonScope();
  }
});
```

- [ ] **Step 8: Run tests**

Run: `yarn test src/ui/features/scanSchedules/__tests__/ScanSchedulesRepository.test.ts`
Expected: PASS

- [ ] **Step 9: Verify build**

Run: `yarn typecheck`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/ui/features/scanSchedules/
git commit -m "feat(scan-schedules): add UI gateway and repository"
```

---

### Task 5: UI Presentation Layer (UseCases + Presenter Extensions)

**Files:**

- Create: `src/ui/presentation/scanSchedules/useCases/abstractions/LoadScanSchedulesUseCase.ts`
- Create: `src/ui/presentation/scanSchedules/useCases/LoadScanSchedulesUseCase.ts`
- Create: `src/ui/presentation/scanSchedules/useCases/abstractions/UpdateScanScheduleUseCase.ts`
- Create: `src/ui/presentation/scanSchedules/useCases/UpdateScanScheduleUseCase.ts`
- Create: `src/ui/presentation/scanSchedules/useCases/abstractions/ResetScanScheduleUseCase.ts`
- Create: `src/ui/presentation/scanSchedules/useCases/ResetScanScheduleUseCase.ts`
- Create: `src/ui/presentation/scanSchedules/useCases/abstractions/UpdateScanScheduleDefaultUseCase.ts`
- Create: `src/ui/presentation/scanSchedules/useCases/UpdateScanScheduleDefaultUseCase.ts`
- Create: `src/ui/presentation/scanSchedules/useCases/feature.ts`
- Test: `src/ui/presentation/scanSchedules/useCases/__tests__/useCases.test.ts`

**Interfaces:**

- Consumes: `ScanSchedulesGateway`, `ScanSchedulesRepository`
- Produces: `ILoadScanSchedulesUseCase.execute()`, `IUpdateScanScheduleUseCase.execute(projectId, interval)`, `IResetScanScheduleUseCase.execute(projectId)`, `IUpdateScanScheduleDefaultUseCase.execute(interval)`

- [ ] **Step 1: Create use case abstractions**

Create `src/ui/presentation/scanSchedules/useCases/abstractions/LoadScanSchedulesUseCase.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface ILoadScanSchedulesUseCase {
  execute(): Promise<void>;
}

export const LoadScanSchedulesUseCase = createAbstraction<ILoadScanSchedulesUseCase>(
  "Ui/LoadScanSchedulesUseCase"
);

export namespace LoadScanSchedulesUseCase {
  export type Interface = ILoadScanSchedulesUseCase;
}
```

Create `src/ui/presentation/scanSchedules/useCases/abstractions/UpdateScanScheduleUseCase.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IUpdateScanScheduleUseCase {
  execute(projectId: string, interval: string): Promise<void>;
}

export const UpdateScanScheduleUseCase = createAbstraction<IUpdateScanScheduleUseCase>(
  "Ui/UpdateScanScheduleUseCase"
);

export namespace UpdateScanScheduleUseCase {
  export type Interface = IUpdateScanScheduleUseCase;
}
```

Create `src/ui/presentation/scanSchedules/useCases/abstractions/ResetScanScheduleUseCase.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IResetScanScheduleUseCase {
  execute(projectId: string): Promise<void>;
}

export const ResetScanScheduleUseCase = createAbstraction<IResetScanScheduleUseCase>(
  "Ui/ResetScanScheduleUseCase"
);

export namespace ResetScanScheduleUseCase {
  export type Interface = IResetScanScheduleUseCase;
}
```

Create `src/ui/presentation/scanSchedules/useCases/abstractions/UpdateScanScheduleDefaultUseCase.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IUpdateScanScheduleDefaultUseCase {
  execute(interval: string): Promise<void>;
}

export const UpdateScanScheduleDefaultUseCase =
  createAbstraction<IUpdateScanScheduleDefaultUseCase>("Ui/UpdateScanScheduleDefaultUseCase");

export namespace UpdateScanScheduleDefaultUseCase {
  export type Interface = IUpdateScanScheduleDefaultUseCase;
}
```

- [ ] **Step 2: Write failing use case tests**

Create `src/ui/presentation/scanSchedules/useCases/__tests__/useCases.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { ScanSchedulesGateway } from "../../../../features/scanSchedules/abstractions/ScanSchedulesGateway.js";
import { ScanSchedulesRepository } from "../../../../features/scanSchedules/abstractions/ScanSchedulesRepository.js";
import { ScanSchedulesRepositoryImpl } from "../../../../features/scanSchedules/ScanSchedulesRepository.js";
import { LoadScanSchedulesUseCase as LoadAbstraction } from "../abstractions/LoadScanSchedulesUseCase.js";
import { LoadScanSchedulesUseCase } from "../LoadScanSchedulesUseCase.js";
import { UpdateScanScheduleUseCase as UpdateAbstraction } from "../abstractions/UpdateScanScheduleUseCase.js";
import { UpdateScanScheduleUseCase } from "../UpdateScanScheduleUseCase.js";
import { ResetScanScheduleUseCase as ResetAbstraction } from "../abstractions/ResetScanScheduleUseCase.js";
import { ResetScanScheduleUseCase } from "../ResetScanScheduleUseCase.js";
import { UpdateScanScheduleDefaultUseCase as DefaultAbstraction } from "../abstractions/UpdateScanScheduleDefaultUseCase.js";
import { UpdateScanScheduleDefaultUseCase } from "../UpdateScanScheduleDefaultUseCase.js";

interface TestContext {
  gateway: ScanSchedulesGateway.Interface;
  repository: ScanSchedulesRepositoryImpl;
  loadUseCase: LoadAbstraction.Interface;
  updateUseCase: UpdateAbstraction.Interface;
  resetUseCase: ResetAbstraction.Interface;
  defaultUseCase: DefaultAbstraction.Interface;
}

function createContext(): TestContext {
  const gateway: ScanSchedulesGateway.Interface = {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          projectId: "p1",
          projectName: "test",
          interval: "24h",
          source: "default",
          lastRunAt: null,
          nextRunAt: null
        }
      ],
      globalDefault: "24h"
    }),
    upsert: vi.fn().mockResolvedValue({
      id: "s1",
      projectId: "p1",
      interval: "6h",
      lastRunAt: null,
      nextRunAt: null,
      enabled: true,
      createdAt: 0,
      updatedAt: 0
    }),
    remove: vi.fn(),
    getDefault: vi.fn().mockResolvedValue("24h"),
    setDefault: vi.fn().mockResolvedValue("12h")
  };

  const container = createContainer();
  container.registerInstance(ScanSchedulesGateway, gateway);
  container.register(LoadScanSchedulesUseCase).inSingletonScope();
  container.register(UpdateScanScheduleUseCase).inSingletonScope();
  container.register(ResetScanScheduleUseCase).inSingletonScope();
  container.register(UpdateScanScheduleDefaultUseCase).inSingletonScope();

  const repository = new ScanSchedulesRepositoryImpl();
  container.registerInstance(ScanSchedulesRepository, repository);

  return {
    gateway,
    repository,
    loadUseCase: container.resolve(LoadAbstraction),
    updateUseCase: container.resolve(UpdateAbstraction),
    resetUseCase: container.resolve(ResetAbstraction),
    defaultUseCase: container.resolve(DefaultAbstraction)
  };
}

describe("scan schedule use cases", () => {
  it("LoadScanSchedulesUseCase populates repository", async () => {
    const { loadUseCase, repository } = createContext();
    await loadUseCase.execute();
    expect(repository.getSchedules()).toHaveLength(1);
    expect(repository.getGlobalDefault()).toBe("24h");
  });

  it("UpdateScanScheduleUseCase calls gateway and updates repository", async () => {
    const { updateUseCase, repository, gateway } = createContext();
    repository.setSchedules([
      {
        projectId: "p1",
        projectName: "test",
        interval: "24h",
        source: "default",
        lastRunAt: null,
        nextRunAt: null
      }
    ]);

    await updateUseCase.execute("p1", "6h");
    expect(gateway.upsert).toHaveBeenCalledWith("p1", "6h");
    expect(repository.getSchedule("p1")?.interval).toBe("6h");
  });

  it("ResetScanScheduleUseCase calls gateway remove and resets source", async () => {
    const { resetUseCase, repository, gateway } = createContext();
    repository.setSchedules([
      {
        projectId: "p1",
        projectName: "test",
        interval: "6h",
        source: "project",
        lastRunAt: null,
        nextRunAt: null
      }
    ]);
    repository.setGlobalDefault("24h");

    await resetUseCase.execute("p1");
    expect(gateway.remove).toHaveBeenCalledWith("p1");
    expect(repository.getSchedule("p1")?.interval).toBe("24h");
    expect(repository.getSchedule("p1")?.source).toBe("default");
  });

  it("UpdateScanScheduleDefaultUseCase sets global default", async () => {
    const { defaultUseCase, repository, gateway } = createContext();
    await defaultUseCase.execute("12h");
    expect(gateway.setDefault).toHaveBeenCalledWith("12h");
    expect(repository.getGlobalDefault()).toBe("12h");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test src/ui/presentation/scanSchedules/useCases/__tests__/useCases.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement use cases**

Create `src/ui/presentation/scanSchedules/useCases/LoadScanSchedulesUseCase.ts`:

```typescript
import { LoadScanSchedulesUseCase as Abstraction } from "./abstractions/LoadScanSchedulesUseCase.js";
import { ScanSchedulesGateway } from "../../../features/scanSchedules/abstractions/ScanSchedulesGateway.js";
import { ScanSchedulesRepository } from "../../../features/scanSchedules/abstractions/ScanSchedulesRepository.js";

class LoadScanSchedulesUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ScanSchedulesGateway.Interface,
    private readonly repository: ScanSchedulesRepository.Interface
  ) {}

  public execute = async (): Promise<void> => {
    const result = await this.gateway.list();
    this.repository.setSchedules(result.items);
    this.repository.setGlobalDefault(result.globalDefault);
  };
}

export const LoadScanSchedulesUseCase = Abstraction.createImplementation({
  implementation: LoadScanSchedulesUseCaseImpl,
  dependencies: [ScanSchedulesGateway, ScanSchedulesRepository]
});
```

Create `src/ui/presentation/scanSchedules/useCases/UpdateScanScheduleUseCase.ts`:

```typescript
import { UpdateScanScheduleUseCase as Abstraction } from "./abstractions/UpdateScanScheduleUseCase.js";
import { ScanSchedulesGateway } from "../../../features/scanSchedules/abstractions/ScanSchedulesGateway.js";
import { ScanSchedulesRepository } from "../../../features/scanSchedules/abstractions/ScanSchedulesRepository.js";

class UpdateScanScheduleUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ScanSchedulesGateway.Interface,
    private readonly repository: ScanSchedulesRepository.Interface
  ) {}

  public execute = async (projectId: string, interval: string): Promise<void> => {
    await this.gateway.upsert(projectId, interval);
    this.repository.updateSchedule(projectId, interval, "project");
  };
}

export const UpdateScanScheduleUseCase = Abstraction.createImplementation({
  implementation: UpdateScanScheduleUseCaseImpl,
  dependencies: [ScanSchedulesGateway, ScanSchedulesRepository]
});
```

Create `src/ui/presentation/scanSchedules/useCases/ResetScanScheduleUseCase.ts`:

```typescript
import { ResetScanScheduleUseCase as Abstraction } from "./abstractions/ResetScanScheduleUseCase.js";
import { ScanSchedulesGateway } from "../../../features/scanSchedules/abstractions/ScanSchedulesGateway.js";
import { ScanSchedulesRepository } from "../../../features/scanSchedules/abstractions/ScanSchedulesRepository.js";

class ResetScanScheduleUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ScanSchedulesGateway.Interface,
    private readonly repository: ScanSchedulesRepository.Interface
  ) {}

  public execute = async (projectId: string): Promise<void> => {
    await this.gateway.remove(projectId);
    const globalDefault = this.repository.getGlobalDefault();
    this.repository.updateSchedule(projectId, globalDefault, "default");
  };
}

export const ResetScanScheduleUseCase = Abstraction.createImplementation({
  implementation: ResetScanScheduleUseCaseImpl,
  dependencies: [ScanSchedulesGateway, ScanSchedulesRepository]
});
```

Create `src/ui/presentation/scanSchedules/useCases/UpdateScanScheduleDefaultUseCase.ts`:

```typescript
import { UpdateScanScheduleDefaultUseCase as Abstraction } from "./abstractions/UpdateScanScheduleDefaultUseCase.js";
import { ScanSchedulesGateway } from "../../../features/scanSchedules/abstractions/ScanSchedulesGateway.js";
import { ScanSchedulesRepository } from "../../../features/scanSchedules/abstractions/ScanSchedulesRepository.js";

class UpdateScanScheduleDefaultUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ScanSchedulesGateway.Interface,
    private readonly repository: ScanSchedulesRepository.Interface
  ) {}

  public execute = async (interval: string): Promise<void> => {
    const result = await this.gateway.setDefault(interval);
    this.repository.setGlobalDefault(result);
  };
}

export const UpdateScanScheduleDefaultUseCase = Abstraction.createImplementation({
  implementation: UpdateScanScheduleDefaultUseCaseImpl,
  dependencies: [ScanSchedulesGateway, ScanSchedulesRepository]
});
```

- [ ] **Step 5: Create feature registration**

Create `src/ui/presentation/scanSchedules/useCases/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { ScanSchedulesFeature } from "../../../features/scanSchedules/index.js";
import { LoadScanSchedulesUseCase } from "./LoadScanSchedulesUseCase.js";
import { UpdateScanScheduleUseCase } from "./UpdateScanScheduleUseCase.js";
import { ResetScanScheduleUseCase } from "./ResetScanScheduleUseCase.js";
import { UpdateScanScheduleDefaultUseCase } from "./UpdateScanScheduleDefaultUseCase.js";

export const ScanSchedulesUseCasesFeature = createFeature({
  name: "ScanSchedulesUseCases",
  dependencies: [ScanSchedulesFeature],
  register(container) {
    container.register(LoadScanSchedulesUseCase).inSingletonScope();
    container.register(UpdateScanScheduleUseCase).inSingletonScope();
    container.register(ResetScanScheduleUseCase).inSingletonScope();
    container.register(UpdateScanScheduleDefaultUseCase).inSingletonScope();
  }
});
```

- [ ] **Step 6: Run tests**

Run: `yarn test src/ui/presentation/scanSchedules/useCases/__tests__/useCases.test.ts`
Expected: PASS

- [ ] **Step 7: Verify build**

Run: `yarn typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/ui/presentation/scanSchedules/
git commit -m "feat(scan-schedules): add UI use cases for scan schedule management"
```

---

### Task 6: UI Components (App Settings + Project Detail Integration)

**Files:**

- Modify: `src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts` (add scan schedule default to KNOWN_SETTINGS)
- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts` (add schedule state)
- Modify: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts` (extend ViewModel)
- Create: `src/ui/presentation/projects/ProjectDetail/components/ScanScheduleSection.tsx`
- Modify: `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx` (add section)
- Modify: `src/ui/App.tsx` (register features)
- Test: `src/ui/presentation/settings/AppSettings/__tests__/AppSettingsPresenter.test.ts` (extend)

**Interfaces:**

- Consumes: `LoadScanSchedulesUseCase`, `UpdateScanScheduleUseCase`, `ResetScanScheduleUseCase`, `UpdateScanScheduleDefaultUseCase`, `ScanSchedulesRepository`, `SCAN_INTERVALS` from shared types
- Produces: Schedule dropdown in App Settings page, schedule override section in Project Detail page

- [ ] **Step 1: Create ScanScheduleDefaultSection component for App Settings page**

The global scan schedule default is served by `/api/settings/scan-schedule-default` via `ScanSchedulesGateway`, NOT by the `listAppSettingsRoute` that `AppSettingsPresenter` uses. So instead of adding to `KNOWN_SETTINGS`, create a standalone section component that uses `ScanSchedulesGateway` directly.

Create `src/ui/presentation/settings/AppSettings/components/ScanScheduleDefaultSection.tsx`:

```tsx
import type React from "react";
import { useEffect, useState } from "react";
import { Select, Stack, Text } from "@mantine/core";
import { useContainer } from "../../../../shared/di/ContainerProvider.js";
import { LoadScanSchedulesUseCase } from "../../../scanSchedules/useCases/abstractions/LoadScanSchedulesUseCase.js";
import { UpdateScanScheduleDefaultUseCase } from "../../../scanSchedules/useCases/abstractions/UpdateScanScheduleDefaultUseCase.js";
import { ScanSchedulesRepository } from "../../../../features/scanSchedules/abstractions/ScanSchedulesRepository.js";
import { SCAN_INTERVALS } from "#shared/schedules/types.js";

const INTERVAL_LABELS: Record<string, string> = {
  "6h": "Every 6 hours",
  "12h": "Every 12 hours",
  "24h": "Every 24 hours",
  "48h": "Every 48 hours",
  weekly: "Weekly",
  disabled: "Disabled"
};

export function ScanScheduleDefaultSection(): React.ReactNode {
  const container = useContainer();
  const loadUseCase = container.resolve(LoadScanSchedulesUseCase);
  const updateUseCase = container.resolve(UpdateScanScheduleDefaultUseCase);
  const repository = container.resolve(ScanSchedulesRepository);
  const [value, setValue] = useState("disabled");

  useEffect(() => {
    void loadUseCase.execute().then(() => {
      setValue(repository.getGlobalDefault());
    });
  }, [loadUseCase, repository]);

  const handleChange = async (newValue: string | null): Promise<void> => {
    if (!newValue) {
      return;
    }
    await updateUseCase.execute(newValue);
    setValue(newValue);
  };

  return (
    <Stack gap="xs">
      <Text fw={500} size="sm">
        Default Scan Schedule
      </Text>
      <Text size="xs" c="dimmed">
        How often to automatically scan all projects for dependency updates.
      </Text>
      <Select
        data={SCAN_INTERVALS.map(interval => ({
          value: interval,
          label: INTERVAL_LABELS[interval] ?? interval
        }))}
        value={value}
        onChange={value => void handleChange(value)}
        style={{ width: 250 }}
      />
    </Stack>
  );
}
```

Then add `<ScanScheduleDefaultSection />` to `AppSettingsPage.tsx` as a new section below the existing settings.

- [ ] **Step 2: Extend ProjectDetail ViewModel with schedule**

In `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`, add to the `IProjectDetailViewModel` interface:

```typescript
    schedule: {
        interval: string;
        source: "project" | "default";
        globalDefault: string;
    } | null;
```

And add to `IProjectDetailPresenter`:

```typescript
updateSchedule: (interval: string) => Promise<void>;
resetSchedule: () => Promise<void>;
```

- [ ] **Step 3: Wire schedule into ProjectDetailPresenter**

In `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`, add `ScanSchedulesRepository` and `UpdateScanScheduleUseCase` and `ResetScanScheduleUseCase` and `LoadScanSchedulesUseCase` to constructor dependencies. In the `vm` getter, add:

```typescript
const schedule = this.currentProjectId
    ? this.scanSchedulesRepository.getSchedule(this.currentProjectId)
    : undefined;

// In the return object:
schedule: schedule
    ? {
          interval: schedule.interval,
          source: schedule.source,
          globalDefault: this.scanSchedulesRepository.getGlobalDefault()
      }
    : null,
```

Add `updateSchedule` and `resetSchedule` methods and call `loadScanSchedulesUseCase.execute()` in `load()`.

- [ ] **Step 4: Create ScanScheduleSection component**

Create `src/ui/presentation/projects/ProjectDetail/components/ScanScheduleSection.tsx`:

```tsx
import type React from "react";
import { Group, Select, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import { SCAN_INTERVALS } from "#shared/schedules/types.js";

interface ScanScheduleSectionProps {
  presenter: ProjectDetailPresenter.Interface;
}

const INTERVAL_LABELS: Record<string, string> = {
  "6h": "Every 6 hours",
  "12h": "Every 12 hours",
  "24h": "Every 24 hours",
  "48h": "Every 48 hours",
  weekly: "Weekly",
  disabled: "Disabled"
};

export const ScanScheduleSection = observer(function ScanScheduleSection({
  presenter
}: ScanScheduleSectionProps): React.ReactNode {
  const { vm } = presenter;

  if (!vm.schedule) {
    return null;
  }

  const options = [
    {
      value: "__default__",
      label: `Default (${INTERVAL_LABELS[vm.schedule.globalDefault] ?? vm.schedule.globalDefault})`
    },
    ...SCAN_INTERVALS.map(interval => ({
      value: interval,
      label: INTERVAL_LABELS[interval] ?? interval
    }))
  ];

  const currentValue = vm.schedule.source === "default" ? "__default__" : vm.schedule.interval;

  const handleChange = async (value: string | null): Promise<void> => {
    if (!value) {
      return;
    }

    if (value === "__default__") {
      await presenter.resetSchedule();
    } else {
      await presenter.updateSchedule(value);
    }
  };

  return (
    <Stack gap="xs">
      <Text fw={500} size="sm">
        Scan Schedule
      </Text>
      <Group>
        <Select
          data={options}
          value={currentValue}
          onChange={value => void handleChange(value)}
          style={{ width: 250 }}
        />
      </Group>
    </Stack>
  );
});
```

- [ ] **Step 5: Add ScanScheduleSection to ProjectDetailPage**

In the project detail page component, add `<ScanScheduleSection presenter={presenter} />` in an appropriate location after the scan controls.

- [ ] **Step 6: Register features in App.tsx**

In `src/ui/App.tsx`, add imports:

```typescript
import { ScanSchedulesFeature } from "./features/scanSchedules/index.js";
import { ScanSchedulesUseCasesFeature } from "./presentation/scanSchedules/useCases/feature.js";
```

Add to `ALL_FEATURES`:

```typescript
    ScanSchedulesFeature,
    ScanSchedulesUseCasesFeature,
```

- [ ] **Step 7: Run full test suite**

Run: `yarn test`
Expected: ALL PASS

- [ ] **Step 8: Verify build**

Run: `yarn typecheck && yarn build`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts src/ui/presentation/projects/ProjectDetail/ src/ui/App.tsx src/shared/schedules/
git commit -m "feat(scan-schedules): add scan schedule UI to settings and project detail"
```
