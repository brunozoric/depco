# Part B1: App Logs Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `app_logs` DB table, `AppLogService` with configurable log level, API routes for listing/deleting logs, and wire logging into existing error paths.

**Architecture:** New Drizzle table + migration. DI-wired `AppLogService` singleton reads `log_level` from `app_settings` (cached 10s), gates writes, broadcasts `log:created` via WebSocket. REST endpoints for list (filtered, paginated) and bulk delete.

**Tech Stack:** TypeScript, Drizzle ORM, SQLite, Fastify, Zod, Vitest

## Global Constraints

- oxfmt formatter, oxlint linter
- `yarn full` must pass
- Follow existing DI patterns (`createAbstraction` / `createImplementation`)
- Follow existing route patterns (`defineRoute` / `registerRoute`)

---

### Task 1: DB schema + migration

**Files:**

- Modify: `src/api/db/schema.ts` — add `appLogs` table
- Create: `src/api/db/migrations/0009_app_logs.sql`
- Modify: `src/api/db/migrations/meta/_journal.json` — add entry

**Interfaces:**

- Consumes: nothing
- Produces: `appLogs` Drizzle table export (used by AppLogService and log routes)

- [ ] **Step 1: Add appLogs table to Drizzle schema**

In `src/api/db/schema.ts`, add after `upgradeSessions`:

```typescript
export const appLogs = sqliteTable("app_logs", {
  id: text("id").primaryKey().notNull(),
  level: text("level").notNull(),
  source: text("source").notNull(),
  projectId: text("project_id"),
  message: text("message").notNull(),
  details: text("details"),
  createdAt: integer("created_at").notNull()
});
```

- [ ] **Step 2: Create migration file**

Create `src/api/db/migrations/0009_app_logs.sql`:

```sql
CREATE TABLE `app_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`source` text NOT NULL,
	`project_id` text,
	`message` text NOT NULL,
	`details` text,
	`created_at` integer NOT NULL
);
```

- [ ] **Step 3: Update migration journal**

In `src/api/db/migrations/meta/_journal.json`, add entry to `entries` array:

```json
{
  "idx": 9,
  "version": "6",
  "when": 1753353600000,
  "tag": "0009_app_logs",
  "breakpoints": true
}
```

- [ ] **Step 4: Verify build and tests**

Run: `yarn build && yarn test`
Expected: Clean build, all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/api/db/schema.ts src/api/db/migrations/
git commit -m "feat: add app_logs table schema and migration"
```

---

### Task 2: WebSocket event type

**Files:**

- Modify: `src/shared/websocket/types.ts`

**Interfaces:**

- Consumes: nothing
- Produces: `WSLogCreated` interface, `"log:created"` entry in `WSEventMap`

- [ ] **Step 1: Add WSLogCreated type and event map entry**

In `src/shared/websocket/types.ts`, add before `WSEventMap`:

```typescript
export interface WSLogCreated {
  id: string;
  level: string;
  source: string;
  projectId: string | null;
  message: string;
  createdAt: number;
}
```

Add to `WSEventMap`:

```typescript
"log:created": WSLogCreated;
```

- [ ] **Step 2: Verify build**

Run: `yarn build`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add src/shared/websocket/types.ts
git commit -m "feat: add log:created WebSocket event type"
```

---

### Task 3: AppLogService abstraction + implementation

**Files:**

- Create: `src/api/services/abstractions/AppLogService.ts`
- Create: `src/api/services/AppLogService.ts`
- Create: `src/api/services/__tests__/AppLogService.test.ts`
- Modify: `src/api/feature.ts` — register service

**Interfaces:**

- Consumes: `DatabaseClient`, `WebSocketBroadcaster`, `appSettings` table, `appLogs` table
- Produces: `AppLogService.Interface` with `log(level, source, projectId, message, details?)` method

- [ ] **Step 1: Write AppLogService abstraction**

Create `src/api/services/abstractions/AppLogService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export type LogLevel = "error" | "warn" | "info";

export interface IAppLogService {
  log(
    level: LogLevel,
    source: string,
    projectId: string | null,
    message: string,
    details?: string
  ): Promise<void>;
}

export const AppLogService = createAbstraction<IAppLogService>("Api/AppLogService");

export namespace AppLogService {
  export type Interface = IAppLogService;
  export type Level = LogLevel;
}
```

- [ ] **Step 2: Write failing tests**

Create `src/api/services/__tests__/AppLogService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { AppLogService } from "../abstractions/AppLogService.js";
import { AppLogService as AppLogServiceRegistration } from "../AppLogService.js";
import { appLogs, appSettings } from "#api/db/schema.js";

describe("AppLogService", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let service: AppLogService.Interface;
  let broadcaster: WebSocketBroadcaster.Interface;

  beforeEach(async () => {
    db = await createTestDb();
    broadcaster = { broadcast: vi.fn(), addClient: vi.fn(), removeClient: vi.fn() };

    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
    container.registerInstance(WebSocketBroadcaster, broadcaster);
    container.register(AppLogServiceRegistration).inSingletonScope();

    service = container.resolve(AppLogService);
  });

  it("writes an error log entry to the database", async () => {
    await service.log("error", "scan", "p1", "Scan failed", "stack trace");

    const rows = await db.select().from(appLogs).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      level: "error",
      source: "scan",
      projectId: "p1",
      message: "Scan failed",
      details: "stack trace"
    });
  });

  it("broadcasts log:created event", async () => {
    await service.log("error", "scan", null, "Something broke");

    expect(broadcaster.broadcast).toHaveBeenCalledWith(
      "log:created",
      expect.objectContaining({
        level: "error",
        source: "scan",
        projectId: null,
        message: "Something broke"
      })
    );
  });

  it("respects log_level setting — skips info when level is warn", async () => {
    await db.insert(appSettings).values({ key: "log_level", value: "warn" }).run();

    await service.log("info", "scan", null, "Scan started");

    const rows = await db.select().from(appLogs).all();
    expect(rows).toHaveLength(0);
  });

  it("respects log_level setting — allows error when level is warn", async () => {
    await db.insert(appSettings).values({ key: "log_level", value: "warn" }).run();

    await service.log("error", "scan", null, "Scan failed");

    const rows = await db.select().from(appLogs).all();
    expect(rows).toHaveLength(1);
  });

  it("respects log_level setting — allows warn when level is warn", async () => {
    await db.insert(appSettings).values({ key: "log_level", value: "warn" }).run();

    await service.log("warn", "scan", null, "Lockfile stale");

    const rows = await db.select().from(appLogs).all();
    expect(rows).toHaveLength(1);
  });

  it("defaults to warn level when no setting exists", async () => {
    await service.log("info", "scan", null, "Should be skipped");

    const rows = await db.select().from(appLogs).all();
    expect(rows).toHaveLength(0);
  });

  it("writes without details when not provided", async () => {
    await service.log("error", "scan", null, "No details");

    const rows = await db.select().from(appLogs).all();
    expect(rows[0]!.details).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test src/api/services/__tests__/AppLogService.test.ts`
Expected: FAIL (AppLogService module not found)

- [ ] **Step 4: Write AppLogService implementation**

Create `src/api/services/AppLogService.ts`:

```typescript
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { AppLogService as Abstraction } from "./abstractions/AppLogService.js";
import type { AppLogService } from "./abstractions/AppLogService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { appLogs, appSettings } from "#api/db/schema.js";

const LEVEL_PRIORITY: Record<string, number> = {
  error: 3,
  warn: 2,
  info: 1
};

const CACHE_TTL_MS = 10_000;

class AppLogServiceImpl implements Abstraction.Interface {
  private cachedLevel: string | null = null;
  private cachedAt = 0;

  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface
  ) {}

  public async log(
    level: AppLogService.Level,
    source: string,
    projectId: string | null,
    message: string,
    details?: string
  ): Promise<void> {
    const threshold = await this.getLogLevel();
    const thresholdPriority = LEVEL_PRIORITY[threshold] ?? 2;
    const entryPriority = LEVEL_PRIORITY[level] ?? 1;

    if (entryPriority < thresholdPriority) {
      return;
    }

    const id = generateId();
    const createdAt = Date.now();

    await this.databaseClient.db
      .insert(appLogs)
      .values({
        id,
        level,
        source,
        projectId,
        message,
        details: details ?? null,
        createdAt
      })
      .run();

    this.webSocketBroadcaster.broadcast("log:created", {
      id,
      level,
      source,
      projectId,
      message,
      createdAt
    });
  }

  private async getLogLevel(): Promise<string> {
    const now = Date.now();
    if (this.cachedLevel !== null && now - this.cachedAt < CACHE_TTL_MS) {
      return this.cachedLevel;
    }

    const row = await this.databaseClient.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "log_level"))
      .get();

    this.cachedLevel = row?.value ?? "warn";
    this.cachedAt = now;
    return this.cachedLevel;
  }
}

export const AppLogService = Abstraction.createImplementation({
  implementation: AppLogServiceImpl,
  dependencies: [DatabaseClient, WebSocketBroadcaster]
});
```

- [ ] **Step 5: Register in feature.ts**

In `src/api/feature.ts`, add import and registration:

```typescript
import { AppLogService } from "./services/AppLogService.js";

// In register() function, add:
container.register(AppLogService).inSingletonScope();
```

- [ ] **Step 6: Run tests**

Run: `yarn test src/api/services/__tests__/AppLogService.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 7: Run full test suite**

Run: `yarn test`
Expected: All tests pass

- [ ] **Step 8: Format and commit**

```bash
yarn format:fix
git add src/api/services/abstractions/AppLogService.ts src/api/services/AppLogService.ts src/api/services/__tests__/AppLogService.test.ts src/api/feature.ts
git commit -m "feat: add AppLogService with configurable log level"
```

---

### Task 4: Shared route definitions for logs

**Files:**

- Create: `src/shared/routes/logs.ts`
- Modify: `src/shared/routes/index.ts` — re-export

**Interfaces:**

- Consumes: nothing
- Produces: `listLogsRoute` (GET /api/logs), `deleteLogsRoute` (DELETE /api/logs)

- [ ] **Step 1: Check routes index for export pattern**

Read `src/shared/routes/index.ts` to see the re-export pattern.

- [ ] **Step 2: Create shared route definitions**

Create `src/shared/routes/logs.ts`:

```typescript
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const appLogSchema = z.object({
  id: z.string(),
  level: z.string(),
  source: z.string(),
  projectId: z.string().nullable(),
  message: z.string(),
  details: z.string().nullable(),
  createdAt: z.number()
});

export const listLogsRoute = defineRoute({
  method: "GET",
  path: "/api/logs",
  description: "List app logs with optional filters",
  params: z.object({}),
  querystring: z.object({
    level: z.string().optional(),
    source: z.string().optional(),
    projectId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.string().optional(),
    offset: z.string().optional()
  }),
  response: z.object({
    items: z.array(appLogSchema),
    total: z.number()
  })
});

export const deleteLogsRoute = defineRoute({
  method: "DELETE",
  path: "/api/logs",
  description: "Bulk delete app logs with optional filters",
  params: z.object({}),
  body: z.object({
    level: z.string().optional(),
    source: z.string().optional(),
    projectId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional()
  }),
  response: z.object({
    deleted: z.number()
  })
});
```

- [ ] **Step 3: Add re-exports to shared routes index**

In `src/shared/routes/index.ts`, add:

```typescript
export { listLogsRoute, deleteLogsRoute } from "./logs.js";
```

- [ ] **Step 4: Verify build**

Run: `yarn build`
Expected: Clean build

- [ ] **Step 5: Commit**

```bash
yarn format:fix
git add src/shared/routes/logs.ts src/shared/routes/index.ts
git commit -m "feat: add shared route definitions for app logs"
```

---

### Task 5: API routes for logs

**Files:**

- Create: `src/api/routes/logs.ts`
- Create: `src/api/routes/__tests__/logs.test.ts`
- Modify: `src/api/server.ts` — register plugin
- Modify: `src/api/routes/index.ts` — export (if barrel exists)

**Interfaces:**

- Consumes: `listLogsRoute`, `deleteLogsRoute`, `DatabaseClient`, `appLogs` table
- Produces: GET /api/logs (filtered, paginated), DELETE /api/logs (filtered bulk delete)

- [ ] **Step 1: Write route tests**

Create `src/api/routes/__tests__/logs.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { appLogs } from "#api/db/schema.js";
import { logsRoutes } from "../logs.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

async function insertLog(
  db: TestDb,
  overrides: Partial<{
    level: string;
    source: string;
    projectId: string | null;
    message: string;
    createdAt: number;
  }> = {}
): Promise<string> {
  const id = generateId();
  await db
    .insert(appLogs)
    .values({
      id,
      level: "error",
      source: "scan",
      projectId: null,
      message: "test error",
      details: null,
      createdAt: Date.now(),
      ...overrides
    })
    .run();
  return id;
}

describe("logs routes", () => {
  let app: FastifyInstance;
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();

    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });

    app = Fastify();
    await app.register(logsRoutes, { container });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("lists all logs", async () => {
    await insertLog(db);
    await insertLog(db, { level: "warn", message: "warning msg" });

    const response = await app.inject({ method: "GET", url: "/api/logs" });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.items).toHaveLength(2);
    expect(json.total).toBe(2);
  });

  it("filters by level", async () => {
    await insertLog(db, { level: "error" });
    await insertLog(db, { level: "warn" });

    const response = await app.inject({
      method: "GET",
      url: "/api/logs?level=error"
    });

    const json = response.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].level).toBe("error");
  });

  it("filters by source", async () => {
    await insertLog(db, { source: "scan" });
    await insertLog(db, { source: "install" });

    const response = await app.inject({
      method: "GET",
      url: "/api/logs?source=scan"
    });

    const json = response.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].source).toBe("scan");
  });

  it("filters by date range", async () => {
    const old = Date.now() - 100_000;
    const recent = Date.now();
    await insertLog(db, { createdAt: old });
    await insertLog(db, { createdAt: recent });

    const response = await app.inject({
      method: "GET",
      url: `/api/logs?from=${recent - 1}`
    });

    const json = response.json();
    expect(json.items).toHaveLength(1);
  });

  it("paginates with limit and offset", async () => {
    for (let i = 0; i < 5; i++) {
      await insertLog(db, { createdAt: Date.now() + i });
    }

    const response = await app.inject({
      method: "GET",
      url: "/api/logs?limit=2&offset=2"
    });

    const json = response.json();
    expect(json.items).toHaveLength(2);
    expect(json.total).toBe(5);
  });

  it("returns logs ordered by createdAt DESC", async () => {
    await insertLog(db, { message: "first", createdAt: 1000 });
    await insertLog(db, { message: "second", createdAt: 2000 });

    const response = await app.inject({ method: "GET", url: "/api/logs" });

    const json = response.json();
    expect(json.items[0].message).toBe("second");
    expect(json.items[1].message).toBe("first");
  });

  it("deletes all logs when no filters", async () => {
    await insertLog(db);
    await insertLog(db);

    const response = await app.inject({
      method: "DELETE",
      url: "/api/logs",
      payload: {}
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.deleted).toBe(2);

    const remaining = await db.select().from(appLogs).all();
    expect(remaining).toHaveLength(0);
  });

  it("deletes only filtered logs", async () => {
    await insertLog(db, { level: "error" });
    await insertLog(db, { level: "warn" });

    const response = await app.inject({
      method: "DELETE",
      url: "/api/logs",
      payload: { level: "error" }
    });

    const json = response.json();
    expect(json.deleted).toBe(1);

    const remaining = await db.select().from(appLogs).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.level).toBe("warn");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/api/routes/__tests__/logs.test.ts`
Expected: FAIL (logsRoutes module not found)

- [ ] **Step 3: Write logs route plugin**

Create `src/api/routes/logs.ts`:

```typescript
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { registerRoute, sendList } from "#shared/routing/index.js";
import { listLogsRoute, deleteLogsRoute } from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { appLogs } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
  container: Container;
}

function buildConditions(filters: {
  level?: string;
  source?: string;
  projectId?: string;
  from?: string;
  to?: string;
}) {
  const conditions = [];
  if (filters.level) {
    conditions.push(eq(appLogs.level, filters.level));
  }
  if (filters.source) {
    conditions.push(eq(appLogs.source, filters.source));
  }
  if (filters.projectId) {
    conditions.push(eq(appLogs.projectId, filters.projectId));
  }
  if (filters.from) {
    conditions.push(gte(appLogs.createdAt, parseInt(filters.from, 10)));
  }
  if (filters.to) {
    conditions.push(lte(appLogs.createdAt, parseInt(filters.to, 10)));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function logsRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
  const { container } = options;
  const databaseClient = container.resolve(DatabaseClient);
  const { db } = databaseClient;

  registerRoute(app, listLogsRoute, {}, async (request, reply) => {
    const { level, source, projectId, from, to, limit, offset } = request.query;
    const where = buildConditions({ level, source, projectId, from, to });

    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(appLogs)
        .where(where)
        .orderBy(sql`${appLogs.createdAt} DESC`)
        .limit(parsedLimit)
        .offset(parsedOffset)
        .all(),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(appLogs)
        .where(where)
        .get()
    ]);

    sendList(reply, items, countResult?.count ?? 0);
  });

  registerRoute(app, deleteLogsRoute, {}, async (request, reply) => {
    const { level, source, projectId, from, to } = request.body;
    const where = buildConditions({ level, source, projectId, from, to });

    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(appLogs)
      .where(where)
      .get();

    const deleted = countResult?.count ?? 0;

    if (where) {
      await db.delete(appLogs).where(where).run();
    } else {
      await db.delete(appLogs).run();
    }

    reply.send({ deleted });
  });
}
```

- [ ] **Step 4: Register in server.ts**

Read `src/api/server.ts` to find the route registration pattern, then add:

```typescript
import { logsRoutes } from "./routes/logs.js";

// In the route registration section:
await app.register(logsRoutes, { container });
```

- [ ] **Step 5: Run tests**

Run: `yarn test src/api/routes/__tests__/logs.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 6: Run full suite**

Run: `yarn test`
Expected: All tests pass

- [ ] **Step 7: Format and commit**

```bash
yarn format:fix
git add src/api/routes/logs.ts src/api/routes/__tests__/logs.test.ts src/api/server.ts src/shared/routes/logs.ts
git commit -m "feat: add API routes for listing and deleting app logs"
```

---

### Task 6: Wire AppLogService into error paths

**Files:**

- Modify: `src/api/services/JobWorker.ts` — inject AppLogService, log on job failure
- Modify: `src/api/services/jobExecutors/ScanJobExecutor.ts` — log 0-dep warning
- Modify: `src/api/services/UpgradeSessionService.ts` — try/catch around resolver.execute(), log error

**Interfaces:**

- Consumes: `AppLogService.Interface`
- Produces: Log entries written on errors/warnings

- [ ] **Step 1: Inject AppLogService into JobWorker**

In `src/api/services/JobWorker.ts`:

Add import:

```typescript
import { AppLogService } from "./abstractions/AppLogService.js";
```

Add to constructor:

```typescript
private readonly appLogService: AppLogService.Interface
```

In the `catch` block of `executeJob()` (around line 190), add before the `finishJob` call:

```typescript
await this.appLogService.log(
  "error",
  job.type,
  job.projectId,
  `Job failed: ${String(error)}`,
  String(error)
);
```

Update dependencies array:

```typescript
dependencies: [
  DatabaseClient,
  PackageManagerService,
  SecurityService,
  WebSocketBroadcaster,
  JobExecutorRegistry,
  AppLogService
];
```

- [ ] **Step 2: Inject AppLogService into ScanJobExecutor**

In `src/api/services/jobExecutors/ScanJobExecutor.ts`:

Add import:

```typescript
import { AppLogService } from "../abstractions/AppLogService.js";
```

Add to constructor parameter list. Where the warning is set (around line 273), add:

```typescript
if (warning) {
  await this.appLogService.log("warn", "scan", context.projectId, warning);
}
```

Update the implementation's dependencies array to include `AppLogService`.

- [ ] **Step 3: Wrap resolver.execute() in UpgradeSessionService**

In `src/api/services/UpgradeSessionService.ts`:

Add import:

```typescript
import { AppLogService } from "./abstractions/AppLogService.js";
```

Add `AppLogService.Interface` to constructor. Wrap the resolver.execute() call:

```typescript
let result;
try {
  result = await resolver.execute(project.path, context, input, onProgress);
} catch (error) {
  await this.appLogService.log(
    "error",
    "step-resolver",
    projectId,
    `Step ${stepType} failed: ${String(error)}`,
    String(error)
  );
  throw error;
}
```

Update dependencies array to include `AppLogService`.

- [ ] **Step 4: Update tests that construct these services**

Any test that constructs `JobWorker`, `ScanJobExecutor`, or `UpgradeSessionService` via DI needs `AppLogService` registered. Add mock:

```typescript
import { AppLogService } from "#api/services/abstractions/AppLogService.js";

// In beforeEach:
container.registerInstance(AppLogService, { log: vi.fn() });
```

Check which test files need this by running `yarn test` and fixing failures.

- [ ] **Step 5: Run full test suite**

Run: `yarn test`
Expected: All tests pass

- [ ] **Step 6: Format and commit**

```bash
yarn format:fix
git add src/api/services/JobWorker.ts src/api/services/jobExecutors/ScanJobExecutor.ts src/api/services/UpgradeSessionService.ts src/api/feature.ts
git add -A  # pick up any test file changes
git commit -m "feat: wire AppLogService into job worker, scan executor, and step resolver error paths"
```
