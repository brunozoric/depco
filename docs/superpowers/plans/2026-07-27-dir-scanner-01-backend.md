# Directory Scanner Part 1: Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `GET /api/filesystem/scan` endpoint that scans a directory's immediate subdirectories for `package.json` files and returns discovered projects not already in the database.

**Architecture:** New route schema in shared routes, new handler in existing `filesystemRoutes` plugin. Handler reads subdirectories, checks for `package.json` via `access()`, queries `projects` table for dedup, returns filtered list.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM (SQLite), Zod, Vitest

## Global Constraints

- Named interfaces only, no inline structural types
- yarn for all package management
- After all changes: `yarn format:fix && yarn lint:fix`
- Commit directly to main

---

### Task 1: Route Schema and Scan Endpoint

**Files:**

- Modify: `src/shared/routes/filesystem.ts` — add `scanFilesystemRoute`
- Modify: `src/api/routes/filesystem.ts` — add scan handler, use container for `DatabaseClient`
- Create: `src/api/routes/__tests__/filesystem.test.ts` — add scan tests (file exists, extend it)

**Interfaces:**

- Consumes:
  - `DatabaseClient.Interface` — `db` for querying `projects` table
  - `projects` table from `src/api/db/schema.ts` — `SELECT path FROM projects`
  - `browseFilesystemRoute` pattern from `src/shared/routes/filesystem.ts`
- Produces:
  - `scanFilesystemRoute` — `GET /api/filesystem/scan?path=<dir>`
  - Response: `{ items: [{name, path}], total, scannedPath, scannedCount, filteredCount }`

- [ ] **Step 1: Add scanFilesystemRoute schema**

In `src/shared/routes/filesystem.ts`, add after the existing `browseFilesystemRoute`:

```typescript
const scanItemSchema = z.object({
  name: z.string(),
  path: z.string()
});

export const scanFilesystemRoute = defineRoute({
  method: "GET",
  path: "/api/filesystem/scan",
  description: "Scan directory for subdirectories containing package.json",
  params: z.object({}),
  querystring: z.object({
    path: z.string()
  }),
  response: z.object({
    items: z.array(scanItemSchema),
    total: z.number(),
    scannedPath: z.string(),
    scannedCount: z.number(),
    filteredCount: z.number()
  })
});
```

- [ ] **Step 2: Write failing tests for scan endpoint**

Add to `src/api/routes/__tests__/filesystem.test.ts`. Tests need `DatabaseClient` now, so the `beforeEach` must create a test DB and pass container. Add these tests after existing ones:

```typescript
import { writeFileSync } from "fs";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createContainer } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects } from "#api/db/schema.js";

describe("scan endpoint", () => {
  let app: FastifyInstance;
  let testDir: string;
  let db: Awaited<ReturnType<typeof createTestDb>>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `fs-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });

    mkdirSync(join(testDir, "project-a"));
    writeFileSync(join(testDir, "project-a", "package.json"), "{}");

    mkdirSync(join(testDir, "project-b"));
    writeFileSync(join(testDir, "project-b", "package.json"), "{}");

    mkdirSync(join(testDir, "not-a-project"));

    mkdirSync(join(testDir, "node_modules"));
    writeFileSync(join(testDir, "node_modules", "package.json"), "{}");

    mkdirSync(join(testDir, ".git"));

    db = await createTestDb();
    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });

    app = Fastify();
    await app.register(filesystemRoutes, { container });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  it("returns subdirectories containing package.json", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/scan?path=${encodeURIComponent(testDir)}`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items.map((i: { name: string }) => i.name).sort()).toEqual([
      "project-a",
      "project-b"
    ]);
    expect(body.filteredCount).toBe(2);
    expect(body.total).toBe(2);
    expect(body.scannedPath).toBe(testDir);
  });

  it("excludes node_modules and .git directories", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/scan?path=${encodeURIComponent(testDir)}`
    });

    const body = response.json();
    const names = body.items.map((i: { name: string }) => i.name);
    expect(names).not.toContain("node_modules");
    expect(names).not.toContain(".git");
  });

  it("excludes already-added projects", async () => {
    const resolvedPath = join(testDir, "project-a");
    await db
      .insert(projects)
      .values({
        id: "existing",
        name: "project-a",
        path: resolvedPath,
        addedAt: Date.now()
      })
      .run();

    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/scan?path=${encodeURIComponent(testDir)}`
    });

    const body = response.json();
    expect(body.items.map((i: { name: string }) => i.name)).toEqual(["project-b"]);
    expect(body.filteredCount).toBe(1);
  });

  it("returns scannedCount as total subdirectories checked", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/scan?path=${encodeURIComponent(testDir)}`
    });

    const body = response.json();
    expect(body.scannedCount).toBe(3);
  });

  it("returns 400 for nonexistent path", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/scan?path=${encodeURIComponent("/nonexistent/xyz")}`
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns empty items when no projects found", async () => {
    const emptyDir = join(testDir, "empty-parent");
    mkdirSync(emptyDir);
    mkdirSync(join(emptyDir, "child-no-pkg"));

    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/scan?path=${encodeURIComponent(emptyDir)}`
    });

    const body = response.json();
    expect(body.items).toEqual([]);
    expect(body.filteredCount).toBe(0);
    expect(body.scannedCount).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn vitest run src/api/routes/__tests__/filesystem.test.ts`
Expected: FAIL — `scanFilesystemRoute` not registered as handler

- [ ] **Step 4: Implement scan handler**

In `src/api/routes/filesystem.ts`, update to use the container and add the scan handler:

```typescript
import { readdir, realpath, access } from "fs/promises";
import { resolve, join } from "path";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendError } from "#shared/routing/index.js";
import { browseFilesystemRoute, scanFilesystemRoute } from "#shared/routes/index.js";
import { DatabaseClient } from "../db/abstractions/DatabaseClient.js";
import { projects } from "../db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
  container?: Container;
}

const SKIP_DIRECTORIES = new Set(["node_modules", ".git"]);

export async function filesystemRoutes(
  app: FastifyInstance,
  options: PluginOptions
): Promise<void> {
  // existing browse handler stays unchanged ...

  registerRoute(app, scanFilesystemRoute, {}, async (request, reply) => {
    const rawPath = request.query.path;

    let resolvedPath: string;
    try {
      resolvedPath = await realpath(resolve(rawPath));
    } catch {
      sendError(reply, 400, `Path does not exist: ${rawPath}`);
      return;
    }

    let entries;
    try {
      entries = await readdir(resolvedPath, { withFileTypes: true });
    } catch {
      sendError(reply, 400, `Cannot read directory: ${resolvedPath}`);
      return;
    }

    const subdirectories = entries
      .filter(entry => entry.isDirectory())
      .filter(entry => !SKIP_DIRECTORIES.has(entry.name))
      .filter(entry => !entry.name.startsWith("."));

    const scannedCount = subdirectories.length;

    const withPackageJson: Array<{ name: string; path: string }> = [];
    for (const entry of subdirectories) {
      const pkgPath = join(resolvedPath, entry.name, "package.json");
      try {
        await access(pkgPath);
        withPackageJson.push({
          name: entry.name,
          path: join(resolvedPath, entry.name)
        });
      } catch {
        // no package.json — skip
      }
    }

    let existingPaths = new Set<string>();
    if (options.container) {
      const databaseClient = options.container.resolve(DatabaseClient);
      const rows = await databaseClient.db.select({ path: projects.path }).from(projects).all();
      existingPaths = new Set(rows.map(row => row.path));
    }

    const filtered = withPackageJson
      .filter(item => !existingPaths.has(item.path))
      .sort((a, b) => a.name.localeCompare(b.name));

    reply.send({
      items: filtered,
      total: filtered.length,
      scannedPath: resolvedPath,
      scannedCount,
      filteredCount: filtered.length
    });
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/api/routes/__tests__/filesystem.test.ts`
Expected: PASS — all existing + 6 new tests green

- [ ] **Step 6: Run full suite, format, lint**

Run: `yarn vitest run && yarn tsc --noEmit && yarn format:fix && yarn lint:fix`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add src/shared/routes/filesystem.ts src/api/routes/filesystem.ts src/api/routes/__tests__/filesystem.test.ts
git commit -m "feat: add filesystem scan endpoint for project discovery

Scans immediate subdirectories for package.json, excludes node_modules
and .git, filters out already-added projects from database."
```
