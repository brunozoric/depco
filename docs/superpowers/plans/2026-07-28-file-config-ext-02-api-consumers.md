# File Config Extension — Part 2: API Consumers (AppSettings Route + AppLogService)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `FileConfigService.readGlobalSettings()` into the AppSettings route (returning `configSource` + `fileManaged`) and AppLogService (file-first log level).

**Architecture:** AppSettings route resolves FileConfigService, checks for global file settings. File-managed keys override DB values in the response. AppLogService gains FileConfigService as a dependency; `getLogLevel()` checks file settings first.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, Vitest

## Global Constraints

- Yarn 4, oxlint, oxfmt
- Named interfaces only
- DI abstractions in `abstractions/`, one file per token
- Work directly on main

---

### Task 1: AppSettings route — configSource and fileManaged

**Files:**

- Modify: `src/shared/routes/appSettings.ts:1-19` (extend response Zod schema)
- Modify: `src/api/routes/appSettings.ts:1-40`
- Modify: `src/api/feature.ts` (register FileConfigService if not already registered for appSettings route)
- Test: `src/api/routes/__tests__/appSettings.test.ts`

**Interfaces:**

- Consumes: `FileConfigService.readGlobalSettings(): Promise<IFileSettings | null>` (from Part 1)
- Produces: `GET /api/settings/app` response adds `configSource: "db" | "file"` and `fileManaged: string[]`

**Mapping from IFileSettings keys to DB app_settings keys:**

- `branchTemplate` → `branch_template`
- `commitTemplate` → `commit_template`
- `logLevel` → `log_level`

**CRITICAL prerequisite:** `HTTPClient.request()` calls `route.response.parse(json)` which uses the Zod schema. Zod strips unknown keys by default. The response schema in `src/shared/routes/appSettings.ts` must include `configSource` and `fileManaged` or they'll be silently dropped on the UI side.

- [ ] **Step 0: Update shared route response schema**

In `src/shared/routes/appSettings.ts`, extend the `listAppSettingsRoute` response:

```typescript
export const listAppSettingsRoute = defineRoute({
  method: "GET",
  path: "/api/settings/app",
  description: "List all app settings",
  params: z.object({}),
  querystring: z.object({}),
  response: z.object({
    items: z.array(appSettingSchema),
    total: z.number(),
    configSource: z.enum(["db", "file"]),
    fileManaged: z.array(z.string())
  })
});
```

- [ ] **Step 1: Write failing tests for appSettings route with file config**

Add tests to `src/api/routes/__tests__/appSettings.test.ts`. The test setup needs FileConfigService registered. For the "file config active" tests, write a `.dependency-upgrader.json` in CWD (or mock at DI level — since FileConfigService reads `process.cwd()`, use a real temp file in CWD and clean up).

```typescript
it("returns configSource db and empty fileManaged when no global config file", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/settings/app"
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.configSource).toBe("db");
  expect(body.fileManaged).toEqual([]);
  expect(body.items).toBeDefined();
});

it("returns configSource file and fileManaged keys when global config has settings", async () => {
  const configPath = join(process.cwd(), ".dependency-upgrader.json");
  await writeFile(
    configPath,
    JSON.stringify({
      settings: { branchTemplate: "custom/${YYYY}" }
    }),
    "utf-8"
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/settings/app"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.configSource).toBe("file");
    expect(body.fileManaged).toEqual(["branch_template"]);
    const branchItem = body.items.find((item: { key: string }) => item.key === "branch_template");
    expect(branchItem.value).toBe("custom/${YYYY}");
  } finally {
    await rm(configPath, { force: true });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/api/routes/__tests__/appSettings.test.ts`
Expected: FAIL — response has no `configSource` or `fileManaged` fields.

- [ ] **Step 3: Implement appSettings route changes**

In `src/api/routes/appSettings.ts`:

```typescript
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList, sendOne } from "#shared/routing/index.js";
import { listAppSettingsRoute, upsertAppSettingRoute } from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { FileConfigService } from "#api/services/abstractions/FileConfigService.js";
import { appSettings } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
  container: Container;
}

interface IFileKeyMapping {
  fileKey: string;
  dbKey: string;
}

const FILE_KEY_MAPPINGS: IFileKeyMapping[] = [
  { fileKey: "branchTemplate", dbKey: "branch_template" },
  { fileKey: "commitTemplate", dbKey: "commit_template" },
  { fileKey: "logLevel", dbKey: "log_level" }
];

export async function appSettingsRoutes(
  app: FastifyInstance,
  options: PluginOptions
): Promise<void> {
  const { container } = options;
  const databaseClient = container.resolve(DatabaseClient);
  const { db } = databaseClient;

  registerRoute(app, listAppSettingsRoute, {}, async (_request, reply) => {
    const rows = await db.select().from(appSettings).all();

    const fileConfigService = container.resolve(FileConfigService);
    const fileSettings = await fileConfigService.readGlobalSettings();

    if (!fileSettings) {
      reply.send({
        items: rows,
        total: rows.length,
        configSource: "db",
        fileManaged: []
      });
      return;
    }

    const fileManaged: string[] = [];
    const merged = rows.map(row => ({ ...row }));

    for (const mapping of FILE_KEY_MAPPINGS) {
      const fileValue = fileSettings[mapping.fileKey as keyof typeof fileSettings];
      if (fileValue !== undefined) {
        fileManaged.push(mapping.dbKey);
        const existing = merged.find(row => row.key === mapping.dbKey);
        if (existing) {
          existing.value = String(fileValue);
        } else {
          merged.push({ key: mapping.dbKey, value: String(fileValue) });
        }
      }
    }

    reply.send({
      items: merged,
      total: merged.length,
      configSource: "file",
      fileManaged
    });
  });

  registerRoute(app, upsertAppSettingRoute, {}, async (request, reply) => {
    const { key } = request.params;
    const { value } = request.body;

    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value }
      })
      .run();

    sendOne(reply, { key, value });
  });
}
```

- [ ] **Step 4: Ensure FileConfigService is registered in feature.ts**

Check `src/api/feature.ts` — FileConfigService is already registered (used by StepHookService). No change needed if so.

- [ ] **Step 5: Run tests**

Run: `yarn test src/api/routes/__tests__/appSettings.test.ts`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared/routes/appSettings.ts src/api/routes/appSettings.ts src/api/routes/__tests__/appSettings.test.ts
git commit -m "feat: appSettings route returns configSource and fileManaged from global file config"
```

### Task 2: AppLogService — file-first log level

**Files:**

- Modify: `src/api/services/AppLogService.ts:16-87`
- Modify: `src/api/services/abstractions/AppLogService.ts` (if dependency list changes)
- Test: `src/api/services/__tests__/AppLogService.test.ts`

**Interfaces:**

- Consumes: `FileConfigService.readGlobalSettings(): Promise<IFileSettings | null>` (from Part 1)
- Produces: `getLogLevel()` checks file settings first, falls back to DB

- [ ] **Step 1: Write failing test for file-first log level**

Add to `src/api/services/__tests__/AppLogService.test.ts`:

```typescript
it("reads logLevel from global file config when present", async () => {
  // Seed DB with log_level = "warn"
  await db.insert(appSettings).values({ key: "log_level", value: "warn" }).run();

  // Write global config with logLevel: "info"
  const configPath = join(process.cwd(), ".dependency-upgrader.json");
  await writeFile(configPath, JSON.stringify({ settings: { logLevel: "info" } }), "utf-8");

  try {
    // Log an info-level entry — should be stored because file config says "info"
    await service.log("info", "test", null, "info message");

    const rows = await db.select().from(appLogs).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.level).toBe("info");
  } finally {
    await rm(configPath, { force: true });
  }
});

it("falls back to DB log level when file config has no logLevel", async () => {
  await db.insert(appSettings).values({ key: "log_level", value: "error" }).run();

  // Write global config with only branchTemplate, no logLevel
  const configPath = join(process.cwd(), ".dependency-upgrader.json");
  await writeFile(
    configPath,
    JSON.stringify({ settings: { branchTemplate: "chore/deps" } }),
    "utf-8"
  );

  try {
    // Log an info-level entry — should be filtered because DB says "error"
    await service.log("info", "test", null, "info message");

    const rows = await db.select().from(appLogs).all();
    expect(rows).toHaveLength(0);
  } finally {
    await rm(configPath, { force: true });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/api/services/__tests__/AppLogService.test.ts`
Expected: FAIL — AppLogService does not check file config.

- [ ] **Step 3: Add FileConfigService dependency to AppLogService**

In `src/api/services/AppLogService.ts`, add `FileConfigService` to constructor and dependencies:

```typescript
import { FileConfigService } from "./abstractions/FileConfigService.js";

class AppLogServiceImpl implements Abstraction.Interface {
  private cachedLevel: string | null = null;
  private cachedAt = 0;

  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
    private readonly fileConfigService: FileConfigService.Interface
  ) {}

  // ... log() unchanged ...

  private async getLogLevel(): Promise<string> {
    const now = Date.now();
    if (this.cachedLevel !== null && now - this.cachedAt < CACHE_TTL_MS) {
      return this.cachedLevel;
    }

    const fileSettings = await this.fileConfigService.readGlobalSettings();
    if (fileSettings?.logLevel) {
      this.cachedLevel = fileSettings.logLevel;
      this.cachedAt = now;
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
  dependencies: [DatabaseClient, WebSocketBroadcaster, FileConfigService]
});
```

- [ ] **Step 4: Update test setup to register FileConfigService**

In `src/api/services/__tests__/AppLogService.test.ts`, add FileConfigService registration to the test container setup.

- [ ] **Step 5: Run tests**

Run: `yarn test src/api/services/__tests__/AppLogService.test.ts`
Expected: All pass.

- [ ] **Step 6: Run full pipeline**

Run: `yarn full`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/api/services/AppLogService.ts src/api/services/__tests__/AppLogService.test.ts
git commit -m "feat: AppLogService reads logLevel from global file config first, falls back to DB"
```
