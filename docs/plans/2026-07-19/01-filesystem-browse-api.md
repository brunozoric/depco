# Filesystem Browse API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API endpoint that returns directory listings for a folder browser UI.

**Architecture:** Single Fastify route plugin with no DI deps. Uses `fs.readdir` with `withFileTypes`, filters to directories only, canonicalizes paths for security.

**Tech Stack:** Fastify, Node.js `fs/promises`, Zod route definitions

## Global Constraints

- Linter: oxlint (`yarn lint`), Formatter: oxfmt (`yarn format:fix`)
- Test runner: vitest (`yarn test`)
- Route definitions in `src/shared/routes/`, handlers in `src/api/routes/`
- Response helpers: `sendList`, `sendError` from `#shared/routing/index.js`
- Build before test: `yarn build` (vitest resolves through `dist/` for some modules)

---

### Task 1: Route Definition + Handler + Tests

**Files:**

- Create: `src/shared/routes/filesystem.ts`
- Create: `src/api/routes/filesystem.ts`
- Create: `src/api/routes/__tests__/filesystem.test.ts`
- Modify: `src/api/routes/index.ts` — add `filesystemRoutes` export
- Modify: `src/shared/routes/index.ts` — add re-export
- Modify: `src/api/server.ts` — register filesystem routes

**Interfaces:**

- Consumes: `defineRoute` from `#shared/routing/index.js`, `sendList`/`sendError` from same
- Produces: `GET /api/filesystem/browse?path=X&showHidden=true` returning `{ items: [{ name, path, type }], total }`

- [ ] **Step 1: Write the route definition**

```typescript
// src/shared/routes/filesystem.ts
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const directoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.literal("directory")
});

export const browseFilesystemRoute = defineRoute({
  method: "GET",
  path: "/api/filesystem/browse",
  description: "Browse directories at a given path",
  params: z.object({}),
  querystring: z.object({
    path: z.string().optional(),
    showHidden: z.string().optional()
  }),
  response: z.object({ items: z.array(directoryEntrySchema), total: z.number() })
});
```

Add to `src/shared/routes/index.ts`:

```typescript
export * from "./filesystem.js";
```

- [ ] **Step 2: Write the tests**

```typescript
// src/api/routes/__tests__/filesystem.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, symlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { filesystemRoutes } from "../filesystem.js";

describe("filesystem routes", () => {
  let app: FastifyInstance;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `fs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, "alpha"));
    mkdirSync(join(testDir, "beta"));
    mkdirSync(join(testDir, ".hidden"));

    app = Fastify();
    await app.register(filesystemRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  it("returns directories sorted alphabetically, excluding hidden by default", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/browse?path=${encodeURIComponent(testDir)}`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ name: string }>; total: number };
    expect(body.items.map(item => item.name)).toEqual(["alpha", "beta"]);
    expect(body.total).toBe(2);
  });

  it("includes hidden directories when showHidden=true", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/browse?path=${encodeURIComponent(testDir)}&showHidden=true`
    });

    const body = response.json() as { items: Array<{ name: string }> };
    expect(body.items.map(item => item.name)).toEqual([".hidden", "alpha", "beta"]);
  });

  it("returns 400 for nonexistent path", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/browse?path=${encodeURIComponent("/nonexistent/path/xyz")}`
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns empty items for empty directory", async () => {
    const emptyDir = join(testDir, "empty");
    mkdirSync(emptyDir);

    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/browse?path=${encodeURIComponent(emptyDir)}`
    });

    const body = response.json() as { items: unknown[]; total: number };
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("defaults to process.cwd() when no path is provided", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/filesystem/browse"
    });

    expect(response.statusCode).toBe(200);
  });

  it("resolves symlinks and returns contents of the real path", async () => {
    const outsideDir = join(tmpdir(), `fs-outside-${Date.now()}`);
    mkdirSync(outsideDir, { recursive: true });
    symlinkSync(outsideDir, join(testDir, "escape-link"));

    try {
      const response = await app.inject({
        method: "GET",
        url: `/api/filesystem/browse?path=${encodeURIComponent(join(testDir, "escape-link"))}`
      });

      // Should resolve symlink and return contents of the real path
      expect(response.statusCode).toBe(200);
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it("each item has name, path, and type=directory", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/filesystem/browse?path=${encodeURIComponent(testDir)}`
    });

    const body = response.json() as {
      items: Array<{ name: string; path: string; type: string }>;
    };
    for (const item of body.items) {
      expect(item.type).toBe("directory");
      expect(item.path).toContain(item.name);
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn build && yarn vitest run src/api/routes/__tests__/filesystem.test.ts`
Expected: FAIL — `filesystemRoutes` not found

- [ ] **Step 4: Write the route handler**

```typescript
// src/api/routes/filesystem.ts
import { readdir, realpath } from "fs/promises";
import { resolve, join } from "path";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { registerRoute, sendList, sendError } from "#shared/routing/index.js";
import { browseFilesystemRoute } from "#shared/routes/index.js";

interface PluginOptions extends FastifyPluginOptions {
  container?: unknown;
}

export async function filesystemRoutes(
  app: FastifyInstance,
  _options: PluginOptions
): Promise<void> {
  registerRoute(app, browseFilesystemRoute, {}, async (request, reply) => {
    const rawPath = request.query.path ?? process.cwd();
    const showHidden = request.query.showHidden === "true";

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

    const directories = entries
      .filter(entry => entry.isDirectory())
      .filter(entry => showHidden || !entry.name.startsWith("."))
      .map(entry => ({
        name: entry.name,
        path: join(resolvedPath, entry.name),
        type: "directory" as const
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    sendList(reply, directories, directories.length);
  });
}
```

- [ ] **Step 5: Register in server.ts and route barrel**

Add to `src/api/routes/index.ts`:

```typescript
export { filesystemRoutes } from "./filesystem.js";
```

Add to `src/api/server.ts` after other route registrations:

```typescript
await app.register(filesystemRoutes, { container });
```

Import `filesystemRoutes` from `"./routes/index.js"` if not already covered by the existing barrel import.

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn build && yarn vitest run src/api/routes/__tests__/filesystem.test.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 7: Run full pipeline**

Run: `yarn lint && yarn format:fix && yarn build && yarn test`
Expected: All 469+ tests pass, no lint errors

- [ ] **Step 8: Commit**

```bash
git add src/shared/routes/filesystem.ts src/api/routes/filesystem.ts \
  src/api/routes/__tests__/filesystem.test.ts src/api/routes/index.ts \
  src/shared/routes/index.ts src/api/server.ts
git commit -m "feat: filesystem browse API endpoint"
```
