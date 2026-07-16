# Security File Config Part 2: API Routes — Error Surfacing and File Config Awareness

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend appSettings and security settings routes to surface file config validation errors and support file-managed security settings with full-replace-per-PM semantics.

**Architecture:** Shared route response schemas gain optional `configError`. AppSettings route handles error results gracefully. Security settings route reads file config and synthesizes file-based rows for managed PMs.

**Tech Stack:** Zod, Fastify, `@webiny/stdlib` generateId

## Global Constraints

- Response helpers: `sendOne`, `sendList`, `sendNone`, `sendError` from `#shared/routing/index.js`
- Route definitions in `src/shared/routes/` with Zod schemas
- API tests use in-memory SQLite via `createTestDb()`, real services, only mock `CommandRunner`
- `yarn test` / `yarn lint` / `yarn typecheck` must pass after each task

---

### Task 5: Extend shared route schemas with `configError`

**Files:**

- Modify: `src/shared/routes/appSettings.ts`, `src/shared/routes/settings.ts`
- Test: (no dedicated tests — schema changes verified by route tests in Tasks 6-7)

**Interfaces:**

- Consumes: existing `listAppSettingsRoute`, `listSecuritySettingsRoute` schemas
- Produces: updated response schemas with `configSource: z.enum(["db", "file", "error"])`, optional `configError`, `fileManagedPms` for security

- [ ] **Step 1: Update `listAppSettingsRoute` response schema**

In `src/shared/routes/appSettings.ts`:

```typescript
const configErrorSchema = z
  .object({
    type: z.enum(["json", "schema"]),
    message: z.string()
  })
  .optional();

export const listAppSettingsRoute = defineRoute({
  method: "GET",
  path: "/api/settings/app",
  description: "List all app settings",
  params: z.object({}),
  querystring: z.object({}),
  response: z.object({
    items: z.array(appSettingSchema),
    total: z.number(),
    configSource: z.enum(["db", "file", "error"]),
    fileManaged: z.array(z.string()),
    configError: configErrorSchema
  })
});
```

- [ ] **Step 2: Update `listSecuritySettingsRoute` response schema**

In `src/shared/routes/settings.ts`:

```typescript
const configErrorSchema = z
  .object({
    type: z.enum(["json", "schema"]),
    message: z.string()
  })
  .optional();

export const listSecuritySettingsRoute = defineRoute({
  method: "GET",
  path: "/api/settings/security",
  description: "List all security settings",
  params: z.object({}),
  response: z.object({
    items: z.array(securitySettingSchema),
    total: z.number(),
    configSource: z.enum(["db", "file", "error"]),
    fileManagedPms: z.array(z.string()),
    configError: configErrorSchema
  })
});
```

- [ ] **Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: type errors in route handlers (response shape mismatch) — that's expected, fixed in Tasks 6-7

- [ ] **Step 4: Commit**

```bash
git add src/shared/routes/appSettings.ts src/shared/routes/settings.ts
git commit -m "feat: extend route response schemas with configError and configSource error value"
```

---

### Task 6: AppSettings route — error result handling

**Files:**

- Modify: `src/api/routes/appSettings.ts`
- Test: `src/api/routes/__tests__/appSettings.test.ts`

**Interfaces:**

- Consumes: `FileConfigService.readGlobalSettings()` returning `IFileSettingsResult`
- Produces: `configSource: "error"` + `configError` when file invalid, DB fallback

- [ ] **Step 1: Write failing test — configSource error on invalid file**

In `src/api/routes/__tests__/appSettings.test.ts`:

```typescript
import { JsonFileToolFeature } from "@webiny/stdlib/node";
```

Update `beforeEach` to register `JsonFileToolFeature`:

```typescript
beforeEach(async () => {
  db = await createTestDb();
  const container = createContainer();
  container.registerInstance(DatabaseClient, { db });
  JsonFileToolFeature.register(container);
  container.register(FileConfigService).inSingletonScope();
  app = Fastify();
  await app.register(appSettingsRoutes, { container });
  await app.ready();
});
```

Add test:

```typescript
it("returns configSource error and configError when file has invalid JSON", async () => {
  const configPath = join(process.cwd(), ".dependency-upgrader.json");
  await writeFile(configPath, "bad json{{{", "utf-8");

  try {
    await db.insert(appSettings).values({ key: "log_level", value: "warn" }).run();

    const response = await app.inject({
      method: "GET",
      url: "/api/settings/app"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.configSource).toBe("error");
    expect(body.configError).toBeDefined();
    expect(body.configError.type).toBe("json");
    expect(body.fileManaged).toEqual([]);
    expect(body.items).toHaveLength(1);
  } finally {
    await rm(configPath, { force: true });
  }
});

it("returns configSource error on invalid schema", async () => {
  const configPath = join(process.cwd(), ".dependency-upgrader.json");
  await writeFile(configPath, JSON.stringify({ settings: { logLevel: "debug" } }), "utf-8");

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/settings/app"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.configSource).toBe("error");
    expect(body.configError).toBeDefined();
    expect(body.configError.type).toBe("schema");
  } finally {
    await rm(configPath, { force: true });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/api/routes/__tests__/appSettings.test.ts`
Expected: FAIL — currently returns 500 instead of structured error

- [ ] **Step 3: Update appSettings route handler**

In `src/api/routes/appSettings.ts`, update the list handler to use the result type:

```typescript
registerRoute(app, listAppSettingsRoute, {}, async (_request, reply) => {
  const rows = await db.select().from(appSettings).all();

  const fileConfigService = container.resolve(FileConfigService);
  const fileSettingsResult = await fileConfigService.readGlobalSettings();

  if (fileSettingsResult.error) {
    reply.send({
      items: rows,
      total: rows.length,
      configSource: "error",
      fileManaged: [],
      configError: fileSettingsResult.error
    });
    return;
  }

  const fileSettings = fileSettingsResult.settings;

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
    const fileValue = fileSettings[mapping.fileKey];
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
```

- [ ] **Step 4: Run tests**

Run: `yarn vitest run src/api/routes/__tests__/appSettings.test.ts`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/appSettings.ts src/api/routes/__tests__/appSettings.test.ts
git commit -m "feat: surface file config validation errors in appSettings route"
```

---

### Task 7: Security settings route — file config awareness

**Files:**

- Modify: `src/api/routes/settings.ts`
- Test: `src/api/routes/__tests__/settings.test.ts`

**Interfaces:**

- Consumes: `FileConfigService.readGlobalConfig()` returning `IFileConfigResult`, `SECURITY_FIELD_REGISTRY`
- Produces: `configSource`, `fileManagedPms`, `configError` in list response; file-derived rows replace DB rows per PM

- [ ] **Step 1: Write failing test — file-managed PM replaces DB rows**

In `src/api/routes/__tests__/settings.test.ts`, add imports:

```typescript
import { join } from "node:path";
import { writeFile, rm } from "node:fs/promises";
import { JsonFileToolFeature } from "@webiny/stdlib/node";
import { FileConfigService } from "#api/services/FileConfigService.js";
```

Update `beforeEach` to register dependencies:

```typescript
beforeEach(async () => {
  db = await createTestDb();
  const container = createContainer();
  container.registerInstance(DatabaseClient, { db });
  JsonFileToolFeature.register(container);
  container.register(FileConfigService).inSingletonScope();

  app = Fastify();
  await app.register(settingsRoutes, { container });
});
```

Add test:

```typescript
it("returns file-derived rows when file config defines security for a PM", async () => {
  const configPath = join(process.cwd(), ".dependency-upgrader.json");
  await writeFile(
    configPath,
    JSON.stringify({
      securitySettings: {
        pnpm: { ignoreScripts: "true", strictSsl: "true" }
      }
    }),
    "utf-8"
  );

  try {
    // Seed DB with pnpm rows — should be ignored
    await seedPnpmSecuritySettings(db);

    const response = await app.inject({
      method: "GET",
      url: "/api/settings/security"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.configSource).toBe("file");
    expect(body.fileManagedPms).toEqual(["pnpm"]);

    const pnpmItems = body.items.filter(
      (i: { packageManager: string }) => i.packageManager === "pnpm"
    );
    expect(pnpmItems).toHaveLength(2);
    expect(pnpmItems.map((i: { fieldName: string }) => i.fieldName).sort()).toEqual([
      "ignoreScripts",
      "strictSsl"
    ]);
    expect(pnpmItems.every((i: { enabled: boolean }) => i.enabled)).toBe(true);
  } finally {
    await rm(configPath, { force: true });
  }
});
```

Note: you may need to create a `seedPnpmSecuritySettings` helper or seed inline:

```typescript
import { pmSecuritySettings } from "#api/db/schema.js";
import { generateId } from "@webiny/stdlib";

// Inline seed:
await db
  .insert(pmSecuritySettings)
  .values([
    {
      id: generateId(),
      packageManager: "pnpm",
      configFile: "pnpm-workspace.yaml",
      fieldName: "ignoreScripts",
      expectedValue: "true",
      enabled: 1
    },
    {
      id: generateId(),
      packageManager: "pnpm",
      configFile: "pnpm-workspace.yaml",
      fieldName: "minimumReleaseAge",
      expectedValue: "4320",
      enabled: 1
    }
  ])
  .run();
```

- [ ] **Step 2: Write test — non-file-managed PM uses DB rows**

```typescript
it("returns DB rows for PMs not in file config", async () => {
  const configPath = join(process.cwd(), ".dependency-upgrader.json");
  await writeFile(
    configPath,
    JSON.stringify({
      securitySettings: {
        pnpm: { ignoreScripts: "true" }
      }
    }),
    "utf-8"
  );

  try {
    await seedYarnSecuritySettings(db);

    const response = await app.inject({
      method: "GET",
      url: "/api/settings/security"
    });

    const body = response.json();
    expect(body.fileManagedPms).toEqual(["pnpm"]);

    const yarnItems = body.items.filter(
      (i: { packageManager: string }) => i.packageManager === "yarn"
    );
    expect(yarnItems.length).toBeGreaterThan(0);
  } finally {
    await rm(configPath, { force: true });
  }
});
```

- [ ] **Step 3: Write test — configSource error when file is invalid**

```typescript
it("returns configSource error and configError when file has bad JSON", async () => {
  const configPath = join(process.cwd(), ".dependency-upgrader.json");
  await writeFile(configPath, "bad json{{{", "utf-8");

  try {
    await seedYarnSecuritySettings(db);

    const response = await app.inject({
      method: "GET",
      url: "/api/settings/security"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.configSource).toBe("error");
    expect(body.configError).toBeDefined();
    expect(body.configError.type).toBe("json");
    expect(body.fileManagedPms).toEqual([]);
    expect(body.items).toHaveLength(4); // yarn DB rows
  } finally {
    await rm(configPath, { force: true });
  }
});
```

- [ ] **Step 4: Write test — configSource db when no file**

```typescript
it("returns configSource db when no file config exists", async () => {
  await seedYarnSecuritySettings(db);

  const response = await app.inject({
    method: "GET",
    url: "/api/settings/security"
  });

  const body = response.json();
  expect(body.configSource).toBe("db");
  expect(body.fileManagedPms).toEqual([]);
  expect(body.configError).toBeUndefined();
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `yarn vitest run src/api/routes/__tests__/settings.test.ts`
Expected: FAIL — route doesn't return configSource/fileManagedPms

- [ ] **Step 6: Implement file config awareness in security settings route**

In `src/api/routes/settings.ts`, add imports:

```typescript
import { FileConfigService } from "#api/services/abstractions/FileConfigService.js";
import { SECURITY_FIELD_REGISTRY } from "#shared/security/index.js";
import type { PackageManagerId } from "#shared/security/index.js";
import { generateId } from "@webiny/stdlib";
```

Update `listSecuritySettingsRoute` handler:

```typescript
registerRoute(app, listSecuritySettingsRoute, {}, async (_request, reply) => {
  const dbRows = await databaseClient.db.select().from(pmSecuritySettings).all();

  const fileConfigService = container.resolve(FileConfigService);
  const fileConfigResult = await fileConfigService.readGlobalConfig();

  if (fileConfigResult.error) {
    const items = dbRows.map(toResponse);
    reply.send({
      items,
      total: items.length,
      configSource: "error",
      fileManagedPms: [],
      configError: fileConfigResult.error
    });
    return;
  }

  const fileSecuritySettings = fileConfigResult.config?.securitySettings;

  if (!fileSecuritySettings || Object.keys(fileSecuritySettings).length === 0) {
    const items = dbRows.map(toResponse);
    reply.send({
      items,
      total: items.length,
      configSource: "db",
      fileManagedPms: []
    });
    return;
  }

  const fileManagedPms = Object.keys(fileSecuritySettings);

  // Keep DB rows for non-file-managed PMs
  const dbItems = dbRows
    .filter(row => !fileManagedPms.includes(row.packageManager))
    .map(toResponse);

  // Synthesize rows for file-managed PMs
  const fileItems: SecuritySettingResponse[] = [];
  for (const [pm, fields] of Object.entries(fileSecuritySettings)) {
    const registry = SECURITY_FIELD_REGISTRY[pm as PackageManagerId];
    if (!registry) {
      continue;
    }
    for (const [fieldName, expectedValue] of Object.entries(fields)) {
      const fieldDef = registry.find(f => f.fieldName === fieldName);
      fileItems.push({
        id: generateId(),
        packageManager: pm,
        configFile: fieldDef?.configFile ?? "",
        fieldName,
        expectedValue,
        enabled: true
      });
    }
  }

  const items = [...dbItems, ...fileItems];
  reply.send({
    items,
    total: items.length,
    configSource: "file",
    fileManagedPms
  });
});
```

- [ ] **Step 7: Run all tests**

Run: `yarn vitest run`
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/api/routes/settings.ts src/api/routes/__tests__/settings.test.ts
git commit -m "feat: add file config awareness to security settings route"
```
