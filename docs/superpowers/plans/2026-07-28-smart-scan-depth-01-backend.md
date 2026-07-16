# Smart Scan Depth Part 1: Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the scan endpoint with a `depth` parameter and workspace-aware scanning. If root `package.json` has `workspaces`, resolve workspace globs directly. Otherwise recurse to the specified depth.

**Architecture:** Extend `scanFilesystemRoute` schema with `depth` query param and `mode` response field. Refactor scan handler to check for workspaces first, fall back to recursive depth scanning. Reuse glob resolution pattern from `collectWorkspacesFromPackageJson` in ScanService.

**Tech Stack:** TypeScript, Fastify, Zod, Vitest, `fast-glob` (for workspace pattern resolution)

## Global Constraints

- Named interfaces only, no inline structural types
- yarn for all package management
- After all changes: `yarn format:fix && yarn lint:fix`
- Commit directly to main

---

### Task 1: Route Schema and Recursive Scan Logic

**Files:**

- Modify: `src/shared/routes/filesystem.ts` — add `depth` to querystring, `mode` to response
- Modify: `src/api/routes/filesystem.ts` — workspace detection + recursive scan logic

**Interfaces:**

- Consumes:
  - `scanFilesystemRoute` existing schema
  - `package.json` workspaces field format: `string[] | { packages?: string[] }`
  - `fast-glob` for workspace pattern resolution (check if already a dependency; if not, use Node's `fs` glob or implement simple glob)
- Produces:
  - `scanFilesystemRoute` — adds `depth` query param (integer, 1-5, default 1)
  - Response adds `mode: "workspaces" | "depth"` field
  - Backwards compatible — depth 1 without workspaces = current behavior

- [ ] **Step 1: Check if fast-glob or glob is available**

Run: `grep -E '"fast-glob"|"glob"' package.json`

If not available, we'll implement workspace glob resolution using the pattern from `collectWorkspacesFromPackageJson` in `src/api/services/ScanService.ts` which uses `globWorkspacePattern`. Check what that function uses.

- [ ] **Step 2: Update route schema**

In `src/shared/routes/filesystem.ts`, modify `scanFilesystemRoute`:

```typescript
export const scanFilesystemRoute = defineRoute({
  method: "GET",
  path: "/api/filesystem/scan",
  description: "Scan directory for subdirectories containing package.json",
  params: z.object({}),
  querystring: z.object({
    path: z.string(),
    depth: z.coerce.number().int().min(1).max(5).optional().default(1)
  }),
  response: z.object({
    items: z.array(scanItemSchema),
    total: z.number(),
    scannedPath: z.string(),
    scannedCount: z.number(),
    filteredCount: z.number(),
    mode: z.enum(["workspaces", "depth"])
  })
});
```

- [ ] **Step 3: Add workspace resolution and recursive scan to handler**

In `src/api/routes/filesystem.ts`, refactor the scan handler. Add these helper functions before `filesystemRoutes`:

```typescript
interface IWorkspacesResult {
  patterns: string[];
  found: boolean;
}

async function readWorkspaces(dirPath: string): Promise<IWorkspacesResult> {
  try {
    const content = await readFile(join(dirPath, "package.json"), "utf-8");
    const pkg = JSON.parse(content) as { workspaces?: string[] | { packages?: string[] } };

    if (Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0) {
      return { patterns: pkg.workspaces, found: true };
    }
    if (pkg.workspaces?.packages && pkg.workspaces.packages.length > 0) {
      return { patterns: pkg.workspaces.packages, found: true };
    }
  } catch {
    // no package.json or parse error
  }
  return { patterns: [], found: false };
}

// Minimal workspace glob — same approach as globWorkspacePattern in
// src/api/services/ScanService.ts. Supports "*" (one segment) and "**"
// (zero or more segments). No external dependency needed.
async function globWorkspacePattern(root: string, pattern: string): Promise<string[]> {
  const segments = pattern.split("/").filter(Boolean);

  async function resolve(baseAbs: string, baseRel: string, remaining: string[]): Promise<string[]> {
    if (remaining.length === 0) {
      try {
        await access(join(baseAbs, "package.json"));
        return [baseRel];
      } catch {
        return [];
      }
    }

    const [segment, ...rest] = remaining;

    if (segment === "**") {
      const results = await resolve(baseAbs, baseRel, rest);
      let entries;
      try {
        entries = await readdir(baseAbs, { withFileTypes: true });
      } catch {
        return results;
      }
      for (const entry of entries) {
        if (
          !entry.isDirectory() ||
          SKIP_DIRECTORIES.has(entry.name) ||
          entry.name.startsWith(".")
        ) {
          continue;
        }
        const childRel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
        results.push(...(await resolve(join(baseAbs, entry.name), childRel, remaining)));
      }
      return results;
    }

    if (segment === "*") {
      let entries;
      try {
        entries = await readdir(baseAbs, { withFileTypes: true });
      } catch {
        return [];
      }
      const results: string[] = [];
      for (const entry of entries) {
        if (
          !entry.isDirectory() ||
          SKIP_DIRECTORIES.has(entry.name) ||
          entry.name.startsWith(".")
        ) {
          continue;
        }
        const childRel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
        results.push(...(await resolve(join(baseAbs, entry.name), childRel, rest)));
      }
      return results;
    }

    const childRel = baseRel ? `${baseRel}/${segment}` : segment!;
    return resolve(join(baseAbs, segment!), childRel, rest);
  }

  return resolve(root, "", segments);
}

async function resolveWorkspacePatterns(
  basePath: string,
  patterns: string[]
): Promise<Array<{ name: string; path: string }>> {
  const includePatterns = patterns.filter(p => !p.startsWith("!"));
  const excludePatterns = patterns.filter(p => p.startsWith("!")).map(p => p.slice(1));

  const [includedSets, excludedSets] = await Promise.all([
    Promise.all(includePatterns.map(p => globWorkspacePattern(basePath, p))),
    Promise.all(excludePatterns.map(p => globWorkspacePattern(basePath, p)))
  ]);

  const excluded = new Set(excludedSets.flat());
  const locations = includedSets.flat().filter(loc => !excluded.has(loc));
  const unique = [...new Set(locations)];

  return unique
    .map(loc => ({
      name: loc.split("/").pop() ?? loc,
      path: join(basePath, loc)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function scanRecursive(
  basePath: string,
  maxDepth: number
): Promise<{ items: Array<{ name: string; path: string }>; scannedCount: number }> {
  const items: Array<{ name: string; path: string }> = [];
  let scannedCount = 0;

  async function walk(currentPath: string, currentDepth: number): Promise<void> {
    if (currentDepth > maxDepth) {
      return;
    }

    let entries;
    try {
      entries = await readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    const subdirectories = entries
      .filter(entry => entry.isDirectory())
      .filter(entry => !SKIP_DIRECTORIES.has(entry.name))
      .filter(entry => !entry.name.startsWith("."));

    scannedCount += subdirectories.length;

    for (const entry of subdirectories) {
      const entryPath = join(currentPath, entry.name);
      const pkgPath = join(entryPath, "package.json");

      try {
        await access(pkgPath);
        items.push({ name: entry.name, path: entryPath });
      } catch {
        // no package.json — recurse deeper if within depth
        if (currentDepth < maxDepth) {
          await walk(entryPath, currentDepth + 1);
        }
      }
    }
  }

  await walk(basePath, 1);
  return { items, scannedCount };
}
```

- [ ] **Step 4: Refactor scan handler to use workspace detection + depth**

Replace the existing scan handler body in `filesystemRoutes`:

```typescript
registerRoute(app, scanFilesystemRoute, {}, async (request, reply) => {
  const rawPath = request.query.path;
  const depth = Math.min(request.query.depth ?? 1, 5);

  let resolvedPath: string;
  try {
    resolvedPath = await realpath(resolve(rawPath));
  } catch {
    sendError(reply, 400, `Path does not exist: ${rawPath}`);
    return;
  }

  let existingPaths = new Set<string>();
  if (options.container) {
    const databaseClient = options.container.resolve(DatabaseClient);
    const rows = await databaseClient.db.select({ path: projects.path }).from(projects).all();
    existingPaths = new Set(rows.map(row => row.path));
  }

  // Try workspace resolution first
  const workspaces = await readWorkspaces(resolvedPath);
  if (workspaces.found) {
    const workspaceItems = await resolveWorkspacePatterns(resolvedPath, workspaces.patterns);
    const filtered = workspaceItems
      .filter(item => !existingPaths.has(item.path))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (filtered.length > 0 || workspaceItems.length > 0) {
      reply.send({
        items: filtered,
        total: filtered.length,
        scannedPath: resolvedPath,
        scannedCount: workspaceItems.length,
        filteredCount: filtered.length,
        mode: "workspaces" as const
      });
      return;
    }
    // Workspaces found but resolved to nothing — fall through to depth scan
  }

  // Depth scan
  const { items, scannedCount } = await scanRecursive(resolvedPath, depth);
  const filtered = items
    .filter(item => !existingPaths.has(item.path))
    .sort((a, b) => a.name.localeCompare(b.name));

  reply.send({
    items: filtered,
    total: filtered.length,
    scannedPath: resolvedPath,
    scannedCount,
    filteredCount: filtered.length,
    mode: "depth" as const
  });
});
```

- [ ] **Step 5: Add readFile import**

At the top of `src/api/routes/filesystem.ts`, add `readFile` to the imports:

```typescript
import { readdir, readFile, realpath, access } from "fs/promises";
```

- [ ] **Step 6: Run format and lint**

Run: `yarn format:fix && yarn lint:fix`

- [ ] **Step 7: Run full test suite**

Run: `yarn vitest run`
Expected: All tests PASS. Existing scan tests should still pass since depth defaults to 1.

- [ ] **Step 8: Commit**

```bash
git add src/shared/routes/filesystem.ts src/api/routes/filesystem.ts
git commit -m "feat: workspace-aware scan with configurable depth"
```

---

### Task 2: Scan Endpoint Tests

**Files:**

- Create or modify: `src/api/routes/__tests__/filesystem.test.ts`

**Interfaces:**

- Consumes:
  - `scanFilesystemRoute` with `depth` param and `mode` response field
  - Filesystem helpers for creating temp directory structures
- Produces:
  - Tests for workspace mode, depth mode, fallback, dedup, depth clamping

- [ ] **Step 1: Write tests for workspace and depth modes**

Add new tests to the existing `src/api/routes/__tests__/filesystem.test.ts`. The file already uses Fastify `inject()` and has a `beforeEach`/`afterEach` setup. Add a new `describe` block for scan depth/workspace tests:

```typescript
// Add helper outside describe blocks (uses sync ops to match existing test pattern):
function createProjectDir(basePath: string, name: string): string {
  const dirPath = join(basePath, name);
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(join(dirPath, "package.json"), JSON.stringify({ name }), "utf-8");
  return dirPath;
}

// Add new describe block inside existing "filesystem routes" describe:
describe("scan with depth and workspaces", () => {
  let scanDir: string;

  beforeEach(() => {
    scanDir = join(tmpdir(), `scan-depth-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(scanDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(scanDir, { recursive: true, force: true });
  });

  it("returns mode=workspaces when root package.json has workspaces", async () => {
    writeFileSync(
      join(scanDir, "package.json"),
      JSON.stringify({ workspaces: ["packages/*"] }),
      "utf-8"
    );
    mkdirSync(join(scanDir, "packages", "app-a"), { recursive: true });
    writeFileSync(join(scanDir, "packages", "app-a", "package.json"), "{}", "utf-8");
    mkdirSync(join(scanDir, "packages", "app-b"), { recursive: true });
    writeFileSync(join(scanDir, "packages", "app-b", "package.json"), "{}", "utf-8");

    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.mode).toBe("workspaces");
    expect(body.items).toHaveLength(2);
    expect(body.items.map((i: { name: string }) => i.name).sort()).toEqual(["app-a", "app-b"]);
  });

  it("falls back to depth mode when workspace globs resolve to nothing", async () => {
    writeFileSync(
      join(scanDir, "package.json"),
      JSON.stringify({ workspaces: ["nonexistent/*"] }),
      "utf-8"
    );
    createProjectDir(scanDir, "project-a");

    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
    });

    const body = response.json();
    expect(body.mode).toBe("depth");
    expect(body.items.map((i: { name: string }) => i.name)).toContain("project-a");
  });

  it("scans to depth 1 by default", async () => {
    createProjectDir(scanDir, "top-level");
    mkdirSync(join(scanDir, "nested"), { recursive: true });
    createProjectDir(join(scanDir, "nested"), "deep-project");

    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
    });

    const body = response.json();
    expect(body.mode).toBe("depth");
    expect(body.items.map((i: { name: string }) => i.name)).toEqual(["top-level"]);
  });

  it("finds nested projects at specified depth", async () => {
    mkdirSync(join(scanDir, "level1", "level2"), { recursive: true });
    createProjectDir(join(scanDir, "level1", "level2"), "deep-project");

    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}&depth=3`
    });

    const body = response.json();
    expect(body.items.map((i: { name: string }) => i.name)).toContain("deep-project");
  });

  it("skips node_modules and hidden directories during depth scan", async () => {
    mkdirSync(join(scanDir, "node_modules", "some-pkg"), { recursive: true });
    writeFileSync(join(scanDir, "node_modules", "some-pkg", "package.json"), "{}", "utf-8");
    mkdirSync(join(scanDir, ".hidden-dir"), { recursive: true });
    writeFileSync(join(scanDir, ".hidden-dir", "package.json"), "{}", "utf-8");
    createProjectDir(scanDir, "real-project");

    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}&depth=2`
    });

    const body = response.json();
    const names = body.items.map((i: { name: string }) => i.name);
    expect(names).toContain("real-project");
    expect(names).not.toContain("some-pkg");
    expect(names).not.toContain(".hidden-dir");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `yarn vitest run src/api/routes/__tests__/filesystem.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/api/routes/__tests__/filesystem.test.ts
git commit -m "test: scan endpoint workspace and depth mode tests"
```
