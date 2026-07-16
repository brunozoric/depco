# Backup Export Implementation Plan (Part 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `GET /api/projects/backup` — export all projects, settings, and package data as a single JSON payload.

**Architecture:** New `backupRoutes` Fastify plugin with route definitions in shared, handlers in api. Export reads all relevant tables and assembles a nested JSON structure. Dependencies are joined with their versions and changelogs.

**Tech Stack:** Fastify, Drizzle ORM, Zod, Vitest

## Global Constraints

- Follow existing route patterns: `defineRoute` in `src/shared/routes/`, `registerRoute` in `src/api/routes/`
- Use named interfaces, never inline structural types
- Tests use `createTestDb` helper and Fastify inject

---

### Task 1: Route definitions and Zod schemas

**Files:**

- Create: `src/shared/routes/backup.ts`
- Modify: `src/shared/routes/index.ts` (add re-export)

**Interfaces:**

- Consumes: `defineRoute` from `#shared/routing/index.js`
- Produces: `exportBackupRoute` (GET), `importBackupRoute` (POST), and all Zod schemas used by both routes

- [ ] **Step 1: Create route definitions with Zod schemas**

```typescript
// src/shared/routes/backup.ts
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const backupAppSettingSchema = z.object({
  key: z.string(),
  value: z.string()
});

const backupSecuritySettingSchema = z.object({
  packageManager: z.string(),
  configFile: z.string(),
  fieldName: z.string(),
  expectedValue: z.string()
});

const backupProjectSchema = z.object({
  name: z.string(),
  path: z.string(),
  packageManager: z.string().nullable(),
  pmVersion: z.string().nullable()
});

const backupChangelogSchema = z.object({
  content: z.string().nullable(),
  source: z.string().nullable()
});

const backupVersionSchema = z.object({
  version: z.string(),
  publishedAt: z.number().nullable(),
  changelog: backupChangelogSchema.optional()
});

const backupDependencySchema = z.object({
  name: z.string(),
  repoUrl: z.string().nullable(),
  versions: z.array(backupVersionSchema)
});

const backupRegistryCacheSchema = z.object({
  packageName: z.string(),
  data: z.string(),
  cachedAt: z.number()
});

const backupPayloadSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number(),
  appSettings: z.array(backupAppSettingSchema),
  securitySettings: z.array(backupSecuritySettingSchema),
  projects: z.array(backupProjectSchema),
  dependencies: z.array(backupDependencySchema),
  registryCache: z.array(backupRegistryCacheSchema)
});

const importSectionResultSchema = z.object({
  imported: z.number(),
  skipped: z.number()
});

const importProjectsResultSchema = importSectionResultSchema.extend({
  failed: z.number(),
  errors: z.array(z.string())
});

const importResultSchema = z.object({
  appSettings: importSectionResultSchema,
  securitySettings: importSectionResultSchema,
  projects: importProjectsResultSchema,
  dependencies: importSectionResultSchema,
  registryCache: importSectionResultSchema
});

export const exportBackupRoute = defineRoute({
  method: "GET",
  path: "/api/projects/backup",
  description: "Export full application backup as JSON",
  params: z.object({}),
  response: backupPayloadSchema
});

export const importBackupRoute = defineRoute({
  method: "POST",
  path: "/api/projects/backup",
  description: "Import application backup from JSON",
  params: z.object({}),
  body: backupPayloadSchema,
  response: importResultSchema
});
```

- [ ] **Step 2: Add re-export to routes index**

Add to `src/shared/routes/index.ts`:

```typescript
export { exportBackupRoute, importBackupRoute } from "./backup.js";
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/routes/backup.ts src/shared/routes/index.ts
git commit -m "feat: add backup export/import route definitions and Zod schemas"
```

---

### Task 2: Export route handler + tests

**Files:**

- Create: `src/api/routes/backup.ts`
- Create: `src/api/routes/__tests__/backup.test.ts`
- Modify: `src/api/routes/index.ts` (add re-export)
- Modify: `src/api/server.ts` (register plugin)

**Interfaces:**

- Consumes: `exportBackupRoute` from `#shared/routes/index.js`, all DB schemas from `#api/db/schema.js`
- Produces: `backupRoutes` Fastify plugin

- [ ] **Step 1: Write failing test — export returns empty backup when DB is empty**

```typescript
// src/api/routes/__tests__/backup.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { backupRoutes } from "../backup.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

describe("backup routes", () => {
  let app: FastifyInstance;
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
    app = Fastify();
    await app.register(backupRoutes, { container });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/projects/backup", () => {
    it("returns empty backup when DB is empty", async () => {
      const response = await app.inject({ method: "GET", url: "/api/projects/backup" });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.version).toBe(1);
      expect(typeof body.exportedAt).toBe("number");
      expect(body.appSettings).toEqual([]);
      expect(body.securitySettings).toEqual([]);
      expect(body.projects).toEqual([]);
      expect(body.dependencies).toEqual([]);
      expect(body.registryCache).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --config testing/vitest.config.ts --run src/api/routes/__tests__/backup.test.ts`
Expected: FAIL — `backupRoutes` not found

- [ ] **Step 3: Implement export handler**

```typescript
// src/api/routes/backup.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { registerRoute } from "#shared/routing/index.js";
import { exportBackupRoute } from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import {
  appSettings,
  pmSecuritySettings,
  projects,
  dependencies,
  dependencyVersions,
  changelogs,
  registryCache
} from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
  container: Container;
}

export async function backupRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
  const { container } = options;
  const databaseClient = container.resolve(DatabaseClient);
  const { db } = databaseClient;

  registerRoute(app, exportBackupRoute, {}, async (_request, reply) => {
    const allSettings = await db.select().from(appSettings).all();

    const allSecuritySettings = await db
      .select({
        packageManager: pmSecuritySettings.packageManager,
        configFile: pmSecuritySettings.configFile,
        fieldName: pmSecuritySettings.fieldName,
        expectedValue: pmSecuritySettings.expectedValue
      })
      .from(pmSecuritySettings)
      .all();

    const allProjects = await db
      .select({
        name: projects.name,
        path: projects.path,
        packageManager: projects.packageManager,
        pmVersion: projects.pmVersion
      })
      .from(projects)
      .all();

    const allDeps = await db.select().from(dependencies).all();
    const allVersions = await db.select().from(dependencyVersions).all();
    const allChangelogs = await db.select().from(changelogs).all();

    const exportDeps = allDeps.map(dep => {
      const versions = allVersions
        .filter(v => v.dependencyId === dep.id)
        .map(v => {
          const cl = allChangelogs.find(c => c.dependencyVersionId === v.id);
          const entry: {
            version: string;
            publishedAt: number | null;
            changelog?: { content: string | null; source: string | null };
          } = {
            version: v.version,
            publishedAt: v.publishedAt
          };
          if (cl) {
            entry.changelog = { content: cl.content, source: cl.source };
          }
          return entry;
        });
      return {
        name: dep.name,
        repoUrl: dep.repoUrl,
        versions
      };
    });

    const allCache = await db.select().from(registryCache).all();

    reply.send({
      version: 1,
      exportedAt: Date.now(),
      appSettings: allSettings,
      securitySettings: allSecuritySettings,
      projects: allProjects,
      dependencies: exportDeps,
      registryCache: allCache
    });
  });
}
```

- [ ] **Step 4: Add re-export and wire into server**

Add to `src/api/routes/index.ts`:

```typescript
export { backupRoutes } from "./backup.js";
```

Add to `src/api/server.ts` imports and registration:

```typescript
// In imports:
(backupRoutes,
  // In route registration:
  await app.register(backupRoutes, { container }));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest --config testing/vitest.config.ts --run src/api/routes/__tests__/backup.test.ts`
Expected: PASS

- [ ] **Step 6: Write test — export includes populated data**

Add to the existing describe block in `backup.test.ts`:

```typescript
it("exports app settings, projects, and security settings", async () => {
  await db
    .insert(appSettings)
    .values([
      { key: "branch_template", value: "chore/${YYYY}" },
      { key: "log_level", value: "warn" }
    ])
    .run();

  await db
    .insert(projects)
    .values({
      id: "p1",
      name: "test-proj",
      path: "/tmp/test",
      packageManager: "pnpm",
      pmVersion: "11.0.0",
      addedAt: 1000
    })
    .run();

  await db
    .insert(pmSecuritySettings)
    .values({
      id: "s1",
      packageManager: "pnpm",
      configFile: "pnpm-workspace.yaml",
      fieldName: "ignoreScripts",
      expectedValue: "true"
    })
    .run();

  const response = await app.inject({ method: "GET", url: "/api/projects/backup" });
  const body = response.json();

  expect(body.appSettings).toHaveLength(2);
  expect(body.projects).toHaveLength(1);
  expect(body.projects[0].name).toBe("test-proj");
  expect(body.projects[0]).not.toHaveProperty("id");
  expect(body.projects[0]).not.toHaveProperty("addedAt");
  expect(body.securitySettings).toHaveLength(1);
  expect(body.securitySettings[0]).not.toHaveProperty("id");
});
```

Add these imports to the test file if not already present:

```typescript
import {
  appSettings,
  projects,
  pmSecuritySettings,
  dependencies,
  dependencyVersions,
  changelogs,
  registryCache
} from "#api/db/schema.js";
```

- [ ] **Step 7: Run test — should pass**

Run: `npx vitest --config testing/vitest.config.ts --run src/api/routes/__tests__/backup.test.ts`
Expected: PASS

- [ ] **Step 8: Write test — export includes dependencies with versions and changelogs**

```typescript
it("exports dependencies with nested versions and changelogs", async () => {
  await db
    .insert(dependencies)
    .values({
      id: "d1",
      name: "react",
      repoUrl: "https://github.com/facebook/react",
      createdAt: 1000
    })
    .run();

  await db
    .insert(dependencyVersions)
    .values([
      { id: "v1", dependencyId: "d1", version: "19.0.0", publishedAt: 2000 },
      { id: "v2", dependencyId: "d1", version: "18.0.0", publishedAt: 1000 }
    ])
    .run();

  await db
    .insert(changelogs)
    .values({
      id: "cl1",
      dependencyId: "d1",
      dependencyVersionId: "v1",
      content: "Breaking changes",
      source: "github",
      fetchedAt: 3000
    })
    .run();

  const response = await app.inject({ method: "GET", url: "/api/projects/backup" });
  const body = response.json();

  expect(body.dependencies).toHaveLength(1);
  const dep = body.dependencies[0];
  expect(dep.name).toBe("react");
  expect(dep.versions).toHaveLength(2);

  const v19 = dep.versions.find((v: { version: string }) => v.version === "19.0.0");
  expect(v19.changelog).toEqual({ content: "Breaking changes", source: "github" });

  const v18 = dep.versions.find((v: { version: string }) => v.version === "18.0.0");
  expect(v18.changelog).toBeUndefined();
});

it("exports dependency with zero versions as empty array", async () => {
  await db
    .insert(dependencies)
    .values({
      id: "d1",
      name: "lodash",
      repoUrl: null,
      createdAt: 1000
    })
    .run();

  const response = await app.inject({ method: "GET", url: "/api/projects/backup" });
  const body = response.json();

  expect(body.dependencies[0].versions).toEqual([]);
});

it("exports changelog with null content", async () => {
  await db
    .insert(dependencies)
    .values({
      id: "d1",
      name: "react",
      repoUrl: null,
      createdAt: 1000
    })
    .run();
  await db
    .insert(dependencyVersions)
    .values({
      id: "v1",
      dependencyId: "d1",
      version: "19.0.0",
      publishedAt: 2000
    })
    .run();
  await db
    .insert(changelogs)
    .values({
      id: "cl1",
      dependencyId: "d1",
      dependencyVersionId: "v1",
      content: null,
      source: "github",
      fetchedAt: 3000
    })
    .run();

  const response = await app.inject({ method: "GET", url: "/api/projects/backup" });
  const dep = response.json().dependencies[0];
  expect(dep.versions[0].changelog).toEqual({ content: null, source: "github" });
});
```

- [ ] **Step 9: Run all tests**

Run: `npx vitest --config testing/vitest.config.ts --run`
Expected: All pass

- [ ] **Step 10: Commit**

```bash
git add src/api/routes/backup.ts src/api/routes/__tests__/backup.test.ts src/api/routes/index.ts src/api/server.ts
git commit -m "feat: add backup export route with tests"
```
