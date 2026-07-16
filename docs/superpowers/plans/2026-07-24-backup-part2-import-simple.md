# Backup Import — Settings, Cache, Projects (Part 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `POST /api/projects/backup` import handler for appSettings, securitySettings, registryCache, and projects sections.

**Architecture:** Add import handler to existing `backupRoutes` plugin. Each section uses `onConflictDoNothing`. Projects use `registerProject` helper. Dependencies import is Part 3.

**Tech Stack:** Fastify, Drizzle ORM, Zod, Vitest

## Global Constraints

- All inserts use `onConflictDoNothing` — never overwrite existing data
- Projects import validates `existsSync(path)` and catches `registerProject` errors
- Import response reports per-section counts

---

### Task 1: Import handler for settings + cache + projects

**Files:**

- Modify: `src/api/routes/backup.ts` (add import handler)
- Modify: `src/api/routes/__tests__/backup.test.ts` (add import tests)

**Interfaces:**

- Consumes: `importBackupRoute` from `#shared/routes/index.js`, `registerProject` from `#api/services/registerProject.js`, `PackageManagerService` from DI
- Produces: Import handler that accepts full backup JSON and returns per-section counts

- [ ] **Step 1: Write failing test — import appSettings**

Add to `backup.test.ts`:

```typescript
describe("POST /api/projects/backup", () => {
  function makeBackup(overrides: Record<string, unknown> = {}) {
    return {
      version: 1,
      exportedAt: Date.now(),
      appSettings: [],
      securitySettings: [],
      projects: [],
      dependencies: [],
      registryCache: [],
      ...overrides
    };
  }

  it("imports app settings", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/projects/backup",
      payload: makeBackup({
        appSettings: [
          { key: "branch_template", value: "chore/${YYYY}" },
          { key: "log_level", value: "warn" }
        ]
      })
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.appSettings).toEqual({ imported: 2, skipped: 0 });

    const rows = await db.select().from(appSettings).all();
    expect(rows).toHaveLength(2);
  });

  it("skips existing app settings on import", async () => {
    await db.insert(appSettings).values({ key: "log_level", value: "error" }).run();

    const response = await app.inject({
      method: "POST",
      url: "/api/projects/backup",
      payload: makeBackup({
        appSettings: [{ key: "log_level", value: "warn" }]
      })
    });

    const body = response.json();
    expect(body.appSettings).toEqual({ imported: 0, skipped: 1 });

    const row = await db.select().from(appSettings).all();
    expect(row[0]!.value).toBe("error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --config testing/vitest.config.ts --run src/api/routes/__tests__/backup.test.ts`
Expected: FAIL — import route not registered

- [ ] **Step 3: Implement import handler skeleton**

Add to `src/api/routes/backup.ts` — new imports and the import route handler. The handler will be built section by section. Start with appSettings only, return zeros for other sections:

```typescript
// Add to imports:
import { existsSync } from "fs";
import { generateId } from "@webiny/stdlib";
import { importBackupRoute } from "#shared/routes/index.js";
import { PackageManagerService } from "../services/abstractions/PackageManagerService.js";
import { registerProject } from "../services/registerProject.js";

// Add after the export route handler:
const packageManagerService = container.resolve(PackageManagerService);

registerRoute(app, importBackupRoute, {}, async (request, reply) => {
  const backup = request.body;
  const result = {
    appSettings: { imported: 0, skipped: 0 },
    securitySettings: { imported: 0, skipped: 0 },
    projects: { imported: 0, skipped: 0, failed: 0, errors: [] as string[] },
    dependencies: { imported: 0, skipped: 0 },
    registryCache: { imported: 0, skipped: 0 }
  };

  // App settings
  for (const setting of backup.appSettings) {
    const inserted = await db.insert(appSettings).values(setting).onConflictDoNothing().run();
    if (inserted.changes > 0) {
      result.appSettings.imported++;
    } else {
      result.appSettings.skipped++;
    }
  }

  reply.send(result);
});
```

- [ ] **Step 4: Run test — appSettings tests pass**

Run: `npx vitest --config testing/vitest.config.ts --run src/api/routes/__tests__/backup.test.ts`
Expected: PASS

- [ ] **Step 5: Write test + implement — security settings import**

Add test:

```typescript
it("imports security settings", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects/backup",
    payload: makeBackup({
      securitySettings: [
        {
          packageManager: "pnpm",
          configFile: "pnpm-workspace.yaml",
          fieldName: "ignoreScripts",
          expectedValue: "true"
        }
      ]
    })
  });

  const body = response.json();
  expect(body.securitySettings).toEqual({ imported: 1, skipped: 0 });

  const rows = await db.select().from(pmSecuritySettings).all();
  expect(rows).toHaveLength(1);
  expect(rows[0]!.id).toBeTruthy();
});

it("skips duplicate security settings on import", async () => {
  await db
    .insert(pmSecuritySettings)
    .values({
      id: "existing",
      packageManager: "pnpm",
      configFile: "pnpm-workspace.yaml",
      fieldName: "ignoreScripts",
      expectedValue: "true"
    })
    .run();

  const response = await app.inject({
    method: "POST",
    url: "/api/projects/backup",
    payload: makeBackup({
      securitySettings: [
        {
          packageManager: "pnpm",
          configFile: "pnpm-workspace.yaml",
          fieldName: "ignoreScripts",
          expectedValue: "false"
        }
      ]
    })
  });

  const body = response.json();
  expect(body.securitySettings).toEqual({ imported: 0, skipped: 1 });
});
```

Add to import handler (after appSettings section):

```typescript
// Security settings
for (const setting of backup.securitySettings) {
  const inserted = await db
    .insert(pmSecuritySettings)
    .values({ id: generateId(), ...setting })
    .onConflictDoNothing()
    .run();
  if (inserted.changes > 0) {
    result.securitySettings.imported++;
  } else {
    result.securitySettings.skipped++;
  }
}
```

- [ ] **Step 6: Run tests — pass**

Run: `npx vitest --config testing/vitest.config.ts --run src/api/routes/__tests__/backup.test.ts`

- [ ] **Step 7: Write test + implement — registry cache import**

Add test:

```typescript
it("imports registry cache", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects/backup",
    payload: makeBackup({
      registryCache: [{ packageName: "react", data: '{"versions":{}}', cachedAt: 1000 }]
    })
  });

  const body = response.json();
  expect(body.registryCache).toEqual({ imported: 1, skipped: 0 });
});

it("skips existing registry cache entries", async () => {
  await db
    .insert(registryCache)
    .values({
      packageName: "react",
      data: '{"old":true}',
      cachedAt: 500
    })
    .run();

  const response = await app.inject({
    method: "POST",
    url: "/api/projects/backup",
    payload: makeBackup({
      registryCache: [{ packageName: "react", data: '{"new":true}', cachedAt: 1000 }]
    })
  });

  const body = response.json();
  expect(body.registryCache).toEqual({ imported: 0, skipped: 1 });
});
```

Add to import handler:

```typescript
// Registry cache
for (const entry of backup.registryCache) {
  const inserted = await db.insert(registryCache).values(entry).onConflictDoNothing().run();
  if (inserted.changes > 0) {
    result.registryCache.imported++;
  } else {
    result.registryCache.skipped++;
  }
}
```

- [ ] **Step 8: Write test + implement — projects import**

Note: Projects import needs `PackageManagerService` mock. Add to beforeEach:

```typescript
import { PackageManagerService } from "#api/services/abstractions/PackageManagerService.js";

// In beforeEach, after container.registerInstance(DatabaseClient, { db }):
container.registerInstance(PackageManagerService, {
  detect: async () => "pnpm",
  getVersion: async () => "11.0.0",
  listWorkspaces: async () => []
});
```

Add tests:

```typescript
it("imports projects when path exists", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects/backup",
    payload: makeBackup({
      projects: [{ name: "test", path: process.cwd(), packageManager: "pnpm", pmVersion: "11.0.0" }]
    })
  });

  const body = response.json();
  expect(body.projects.imported).toBe(1);
  expect(body.projects.failed).toBe(0);

  const rows = await db.select().from(projects).all();
  expect(rows).toHaveLength(1);
});

it("fails project import when path does not exist", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects/backup",
    payload: makeBackup({
      projects: [
        { name: "ghost", path: "/nonexistent/path/xyz", packageManager: null, pmVersion: null }
      ]
    })
  });

  const body = response.json();
  expect(body.projects.imported).toBe(0);
  expect(body.projects.failed).toBe(1);
  expect(body.projects.errors[0]).toContain("/nonexistent/path/xyz");
});

it("skips project with duplicate path", async () => {
  await db
    .insert(projects)
    .values({
      id: "existing",
      name: "test",
      path: process.cwd(),
      packageManager: "pnpm",
      addedAt: 1000
    })
    .run();

  const response = await app.inject({
    method: "POST",
    url: "/api/projects/backup",
    payload: makeBackup({
      projects: [{ name: "test", path: process.cwd(), packageManager: "pnpm", pmVersion: "11.0.0" }]
    })
  });

  const body = response.json();
  expect(body.projects.imported).toBe(0);
  expect(body.projects.skipped).toBe(1);
});
```

Add to import handler:

```typescript
// Projects
for (const project of backup.projects) {
  if (!existsSync(project.path)) {
    result.projects.failed++;
    result.projects.errors.push(`Path does not exist: ${project.path}`);
    continue;
  }

  const existing = await db.select().from(projects).where(eq(projects.path, project.path)).get();

  if (existing) {
    result.projects.skipped++;
    continue;
  }

  try {
    await registerProject({
      projectPath: project.path,
      databaseClient,
      packageManagerService
    });
    result.projects.imported++;
  } catch (err) {
    result.projects.failed++;
    result.projects.errors.push(
      `${project.path}: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}
```

Add `eq` to imports: `import { eq } from "drizzle-orm";`

- [ ] **Step 9: Run all tests**

Run: `npx vitest --config testing/vitest.config.ts --run`
Expected: All pass

- [ ] **Step 10: Commit**

```bash
git add src/api/routes/backup.ts src/api/routes/__tests__/backup.test.ts
git commit -m "feat: add backup import for settings, cache, and projects"
```
