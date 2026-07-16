# Async Scan, Typed Routes, WebSocket, Multi-PM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make scans async via JobWorker with WebSocket progress, adopt shared typed route infrastructure (defineRoute/Zod), support npm/yarn/pnpm package managers.

**Architecture:** Shared route definitions with Zod schemas live in `src/shared/routes/` and are imported by both API route handlers and UI gateways. WebSocket event bus provides real-time notifications. Scan runs as a background job, persists results to DB, broadcasts per-package progress. Package manager is auto-detected on project creation.

**Tech Stack:** Fastify, Zod, @fastify/websocket, Drizzle ORM (SQLite via @libsql/client), MobX, React, Mantine, @webiny/di

## Global Constraints

- Use `@libsql/client` for SQLite — NOT better-sqlite3
- DI token identity: use `#api/*` alias for cross-tree imports, relative for same-tree
- API tests mock only CommandRunner, UI tests mock only HTTPClient
- Never `new XxxImpl()` in tests — resolve through DI container
- Subpath imports: `#api/*`, `#ui/*`, `#shared/*`, `#testing/*`
- All route responses use envelope pattern: `sendOne` (`{ item: T }`), `sendList` (`{ items: T[], total }`), `sendNone` (`{ success: true }`)
- Existing abstractions use `createAbstraction` / `createImplementation` pattern from `#shared/index.js`

---

### Task 1: Add zod and @fastify/websocket dependencies

**Files:**

- Modify: `package.json`

**Interfaces:**

- Consumes: nothing
- Produces: `@fastify/websocket` available as import (`zod` already installed)

- [ ] **Step 1: Install dependencies**

```bash
yarn add @fastify/websocket
```

- [ ] **Step 2: Verify imports resolve**

```bash
node -e "require('zod'); require('@fastify/websocket'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add zod and @fastify/websocket dependencies"
```

---

### Task 2: Shared routing infrastructure (defineRoute, registerRoute, response helpers, interpolatePath)

**Files:**

- Create: `src/shared/routing/defineRoute.ts`
- Create: `src/shared/routing/registerRoute.ts`
- Create: `src/shared/routing/interpolatePath.ts`
- Create: `src/shared/routing/sendOne.ts`
- Create: `src/shared/routing/sendList.ts`
- Create: `src/shared/routing/sendNone.ts`
- Create: `src/shared/routing/sendError.ts`
- Create: `src/shared/routing/types.ts`
- Create: `src/shared/routing/index.ts`
- Create: `src/shared/routing/__tests__/defineRoute.test.ts`
- Create: `src/shared/routing/__tests__/registerRoute.test.ts`
- Create: `src/shared/routing/__tests__/interpolatePath.test.ts`
- Create: `src/shared/routing/__tests__/sendHelpers.test.ts`

**Interfaces:**

- Consumes: `zod`, `fastify`
- Produces:
  - `defineRoute<TPath, TMethod, TParams, TBody, TResponse, TQuerystring>(config) => RouteDefinition`
  - `registerRoute(app, route, options, handler) => void`
  - `interpolatePath(path, params) => string`
  - `sendOne(reply, data) => void` — sends `{ item: data }` with status 200
  - `sendList(reply, items, total) => void` — sends `{ items, total }` with status 200
  - `sendNone(reply, status?) => void` — sends `{ success: true }` or 204
  - `sendError(reply, statusCode, message) => void`
  - Types: `RouteDefinition`, `HTTPMethod`, `ExtractParams`, `IRequestArgs`

This is a simplified version of the fundus routing — no Result monad, no routeStore/RouteRegistry, no ErrorLoggerHook. Direct response helpers that work with plain values instead of Result objects.

- [ ] **Step 1: Write defineRoute tests**

```typescript
// src/shared/routing/__tests__/defineRoute.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineRoute } from "../defineRoute.js";

describe("defineRoute", () => {
  it("creates a route definition with all fields", () => {
    const route = defineRoute({
      method: "POST",
      path: "/api/projects/:id/scan",
      description: "Start scan",
      params: z.object({ id: z.string() }),
      body: z.object({ force: z.boolean() }),
      response: z.object({ item: z.object({ jobId: z.string() }) })
    });

    expect(route.method).toBe("POST");
    expect(route.path).toBe("/api/projects/:id/scan");
    expect(route.description).toBe("Start scan");
    expect(route.params).toBeDefined();
    expect(route.body).toBeDefined();
    expect(route.response).toBeDefined();
  });

  it("creates a route without optional body and response", () => {
    const route = defineRoute({
      method: "DELETE",
      path: "/api/cache/:packageName",
      description: "Clear cache",
      params: z.object({ packageName: z.string() })
    });

    expect(route.body).toBeUndefined();
    expect(route.response).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write defineRoute implementation**

```typescript
// src/shared/routing/defineRoute.ts
import type { z } from "zod";

export type ExtractParams<T extends string> = T extends `${string}:${infer Param}/${infer Rest}`
  ? Param | ExtractParams<Rest>
  : T extends `${string}:${infer Param}`
    ? Param
    : never;

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ParamValue = string | number;

type ExactParamKeys<TPath extends string> = { [K in ExtractParams<TPath>]: ParamValue };

export interface RouteDefinition<
  TPath extends string = string,
  TParams = unknown,
  TBody = never,
  TResponse = void,
  TMethod extends HTTPMethod = HTTPMethod,
  TQuerystring = never
> {
  description: string;
  method: TMethod;
  path: TPath;
  params: z.ZodType<TParams>;
  body?: z.ZodType<TBody>;
  response?: z.ZodType<TResponse>;
  querystring?: z.ZodType<TQuerystring>;
}

interface RouteConfig<
  TPath extends string,
  TMethod extends HTTPMethod,
  TParams extends ExactParamKeys<TPath>,
  TBody,
  TResponse,
  TQuerystring
> {
  description: string;
  method: TMethod;
  path: TPath;
  params: ExactParamKeys<TPath> extends Record<keyof TParams, ParamValue>
    ? z.ZodType<TParams>
    : never;
  body?: z.ZodType<TBody>;
  response?: z.ZodType<TResponse>;
  querystring?: z.ZodType<TQuerystring>;
}

export function defineRoute<
  TPath extends string,
  TMethod extends HTTPMethod,
  TParams extends ExactParamKeys<TPath>,
  TBody = never,
  TResponse = void,
  TQuerystring = never
>(
  config: RouteConfig<TPath, TMethod, TParams, TBody, TResponse, TQuerystring>
): RouteDefinition<TPath, TParams, TBody, TResponse, TMethod, TQuerystring> {
  return config;
}

export type { IRequestArgs } from "./types.js";
```

```typescript
// src/shared/routing/types.ts
import type { HTTPMethod } from "./defineRoute.js";

type BaseRequestArgs<TParams, TQuerystring> = [TQuerystring] extends [never]
  ? { params: TParams; query?: Record<string, string | string[]> }
  : { params: TParams; query: TQuerystring };

export type IRequestArgs<
  TMethod extends HTTPMethod,
  TParams,
  TBody,
  TQuerystring = never
> = TMethod extends "GET" | "DELETE"
  ? BaseRequestArgs<TParams, TQuerystring> & { body?: never }
  : [TBody] extends [never]
    ? BaseRequestArgs<TParams, TQuerystring>
    : BaseRequestArgs<TParams, TQuerystring> & { body: TBody };
```

- [ ] **Step 3: Run defineRoute tests — verify pass**

```bash
yarn vitest run src/shared/routing/__tests__/defineRoute.test.ts
```

- [ ] **Step 4: Write interpolatePath tests**

```typescript
// src/shared/routing/__tests__/interpolatePath.test.ts
import { describe, it, expect } from "vitest";
import { interpolatePath } from "../interpolatePath.js";

describe("interpolatePath", () => {
  it("replaces single param", () => {
    expect(interpolatePath("/api/projects/:id", { id: "p1" })).toBe("/api/projects/p1");
  });

  it("replaces multiple params", () => {
    expect(interpolatePath("/api/projects/:id/jobs/:jobId", { id: "p1", jobId: "j1" })).toBe(
      "/api/projects/p1/jobs/j1"
    );
  });

  it("URL-encodes param values", () => {
    expect(interpolatePath("/api/cache/:packageName", { packageName: "@scope/pkg" })).toBe(
      "/api/cache/%40scope%2Fpkg"
    );
  });

  it("throws on missing param", () => {
    expect(() => interpolatePath("/api/projects/:id", {})).toThrow('missing value for param "id"');
  });
});
```

- [ ] **Step 5: Write interpolatePath implementation**

```typescript
// src/shared/routing/interpolatePath.ts
export function interpolatePath(path: string, params: Record<string, string>): string {
  return path.replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) {
      throw new Error(`interpolatePath: missing value for param "${key}" in path "${path}"`);
    }
    return encodeURIComponent(value);
  });
}
```

- [ ] **Step 6: Run interpolatePath tests — verify pass**

```bash
yarn vitest run src/shared/routing/__tests__/interpolatePath.test.ts
```

- [ ] **Step 7: Write registerRoute tests**

```typescript
// src/shared/routing/__tests__/registerRoute.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import Fastify from "fastify";
import { defineRoute } from "../defineRoute.js";
import { registerRoute } from "../registerRoute.js";
import { sendOne } from "../sendOne.js";

describe("registerRoute", () => {
  it("validates params and calls handler with parsed data", async () => {
    const app = Fastify();
    const route = defineRoute({
      method: "GET",
      path: "/api/projects/:id",
      description: "Get project",
      params: z.object({ id: z.string().min(1) }),
      response: z.object({ item: z.object({ id: z.string() }) })
    });

    registerRoute(app, route, {}, async (request, reply) => {
      sendOne(reply, { id: request.params.id });
    });

    const response = await app.inject({ method: "GET", url: "/api/projects/p1" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ item: { id: "p1" } });
  });

  it("validates body and rejects invalid input with 400", async () => {
    const app = Fastify();
    const route = defineRoute({
      method: "POST",
      path: "/api/projects",
      description: "Create project",
      params: z.object({}),
      body: z.object({ path: z.string().min(1) }),
      response: z.object({ item: z.object({ id: z.string() }) })
    });

    registerRoute(app, route, {}, async (_request, reply) => {
      sendOne(reply, { id: "new" });
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { path: "" }
    });
    expect(response.statusCode).toBe(400);
  });
});
```

- [ ] **Step 8: Write registerRoute implementation**

```typescript
// src/shared/routing/registerRoute.ts
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  RouteShorthandOptions
} from "fastify";
import type { RouteDefinition, HTTPMethod } from "./defineRoute.js";
import type { z } from "zod";

export function registerRoute<
  TPath extends string,
  TParams,
  TBody,
  TResponse,
  TMethod extends HTTPMethod,
  TQuerystring = never
>(
  app: FastifyInstance,
  route: RouteDefinition<TPath, TParams, TBody, TResponse, TMethod, TQuerystring>,
  options: Omit<RouteShorthandOptions, "schema">,
  handler: (
    request: FastifyRequest<{
      Params: TParams;
      Body: TBody extends never ? unknown : TBody;
      Querystring: TQuerystring extends never ? unknown : TQuerystring;
    }>,
    reply: FastifyReply
  ) => Promise<unknown>
): void {
  const preValidation = async (request: FastifyRequest): Promise<void> => {
    const paramsResult = (route.params as z.ZodType).safeParse(request.params);
    if (!paramsResult.success) {
      throw Object.assign(new Error("Validation failed: params"), {
        statusCode: 400,
        validation: paramsResult.error.issues
      });
    }
    request.params = paramsResult.data;

    if (route.body) {
      const bodyResult = (route.body as z.ZodType).safeParse(request.body);
      if (!bodyResult.success) {
        throw Object.assign(new Error("Validation failed: body"), {
          statusCode: 400,
          validation: bodyResult.error.issues
        });
      }
      request.body = bodyResult.data;
    }

    if (route.querystring) {
      const queryResult = (route.querystring as z.ZodType).safeParse(request.query);
      if (!queryResult.success) {
        throw Object.assign(new Error("Validation failed: querystring"), {
          statusCode: 400,
          validation: queryResult.error.issues
        });
      }
      request.query = queryResult.data;
    }
  };

  const existingPreValidation = options.preValidation;
  const mergedPreValidation = existingPreValidation
    ? [
        preValidation,
        ...(Array.isArray(existingPreValidation) ? existingPreValidation : [existingPreValidation])
      ]
    : [preValidation];

  app.route({
    method: route.method as HTTPMethods,
    url: route.path,
    ...options,
    preValidation: mergedPreValidation,
    handler: handler as (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>
  });
}
```

- [ ] **Step 9: Run registerRoute tests — verify pass**

```bash
yarn vitest run src/shared/routing/__tests__/registerRoute.test.ts
```

- [ ] **Step 10: Write response helper tests**

```typescript
// src/shared/routing/__tests__/sendHelpers.test.ts
import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { z } from "zod";
import { defineRoute } from "../defineRoute.js";
import { registerRoute } from "../registerRoute.js";
import { sendOne, sendList, sendNone, sendError } from "../index.js";

describe("response helpers", () => {
  it("sendOne wraps value in { item }", async () => {
    const app = Fastify();
    const route = defineRoute({
      method: "GET",
      path: "/test/:id",
      description: "test",
      params: z.object({ id: z.string() }),
      response: z.object({ item: z.object({ name: z.string() }) })
    });
    registerRoute(app, route, {}, async (_req, reply) => {
      sendOne(reply, { name: "hello" });
    });

    const res = await app.inject({ method: "GET", url: "/test/1" });
    expect(res.json()).toEqual({ item: { name: "hello" } });
  });

  it("sendList wraps values in { items, total }", async () => {
    const app = Fastify();
    const route = defineRoute({
      method: "GET",
      path: "/test",
      description: "test",
      params: z.object({}),
      response: z.object({ items: z.array(z.string()), total: z.number() })
    });
    registerRoute(app, route, {}, async (_req, reply) => {
      sendList(reply, ["a", "b"], 2);
    });

    const res = await app.inject({ method: "GET", url: "/test" });
    expect(res.json()).toEqual({ items: ["a", "b"], total: 2 });
  });

  it("sendNone sends { success: true }", async () => {
    const app = Fastify();
    const route = defineRoute({
      method: "DELETE",
      path: "/test/:id",
      description: "test",
      params: z.object({ id: z.string() })
    });
    registerRoute(app, route, {}, async (_req, reply) => {
      sendNone(reply);
    });

    const res = await app.inject({ method: "DELETE", url: "/test/1" });
    expect(res.json()).toEqual({ success: true });
  });

  it("sendError sends error with status code", async () => {
    const app = Fastify();
    const route = defineRoute({
      method: "GET",
      path: "/test/:id",
      description: "test",
      params: z.object({ id: z.string() })
    });
    registerRoute(app, route, {}, async (_req, reply) => {
      sendError(reply, 404, "Not found");
    });

    const res = await app.inject({ method: "GET", url: "/test/1" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { message: "Not found" } });
  });
});
```

- [ ] **Step 11: Write response helper implementations**

```typescript
// src/shared/routing/sendOne.ts
import type { FastifyReply } from "fastify";

export function sendOne<T>(reply: FastifyReply, data: T, status = 200): void {
  reply.status(status).send({ item: data });
}
```

```typescript
// src/shared/routing/sendList.ts
import type { FastifyReply } from "fastify";

export function sendList<T>(reply: FastifyReply, items: T[], total: number, status = 200): void {
  reply.status(status).send({ items, total });
}
```

```typescript
// src/shared/routing/sendNone.ts
import type { FastifyReply } from "fastify";

export function sendNone(reply: FastifyReply, status = 200): void {
  if (status === 204) {
    reply.status(204).send();
    return;
  }
  reply.status(status).send({ success: true });
}
```

```typescript
// src/shared/routing/sendError.ts
import type { FastifyReply } from "fastify";

export function sendError(reply: FastifyReply, statusCode: number, message: string): void {
  reply.status(statusCode).send({ error: { message } });
}
```

```typescript
// src/shared/routing/index.ts
export { defineRoute } from "./defineRoute.js";
export type { RouteDefinition, HTTPMethod, ExtractParams } from "./defineRoute.js";
export type { IRequestArgs } from "./types.js";
export { registerRoute } from "./registerRoute.js";
export { interpolatePath } from "./interpolatePath.js";
export { sendOne } from "./sendOne.js";
export { sendList } from "./sendList.js";
export { sendNone } from "./sendNone.js";
export { sendError } from "./sendError.js";
```

- [ ] **Step 12: Run all routing tests — verify pass**

```bash
yarn vitest run src/shared/routing/
```

- [ ] **Step 13: Commit**

```bash
git add src/shared/routing/
git commit -m "feat: add shared routing infrastructure (defineRoute, registerRoute, response helpers)"
```

---

### Task 3: DB schema changes — scanResults, pmSecuritySettings, projects table update

**Files:**

- Modify: `src/api/db/schema.ts`
- Modify: `src/api/db/migrate.ts`
- Modify: `src/api/db/__tests__/schema.test.ts`

**Interfaces:**

- Consumes: Drizzle ORM, existing schema
- Produces:
  - `scanResults` table: `id, projectId, name, currentVersion, latestVersion, latestInRange, type, upgradeType, scannedAt`
  - `pmSecuritySettings` table: `id, packageManager, configFile, fieldName, expectedValue` (unique on packageManager+configFile+fieldName)
  - `projects` table gains `packageManager` column, `yarnVersion` renamed to `pmVersion`
  - `upgradeJobs.type` accepts `"dependency" | "transient" | "packageManager" | "scan"`

- [ ] **Step 1: Write schema test for new tables**

Add tests to `src/api/db/__tests__/schema.test.ts` that verify CRUD on `scanResults` and `pmSecuritySettings` tables, and that the `projects` table has `packageManager` and `pmVersion` columns.

- [ ] **Step 2: Update schema.ts**

Add `scanResults` and `pmSecuritySettings` tables. Add `packageManager` column to `projects`. Rename `yarnVersion`/`yarn_version` to `pmVersion`/`pm_version`.

- [ ] **Step 3: Generate migration**

Run `yarn drizzle-kit generate` to generate SQL migration from updated schema. Then add seed SQL for Yarn security settings (4 INSERT rows for `pmSecuritySettings`) in the generated migration file. Do NOT modify `migrate.ts` — it already reads generated SQL from `src/api/db/migrations/`.

- [ ] **Step 4: Run schema tests — verify pass**

```bash
yarn vitest run src/api/db/__tests__/schema.test.ts
```

- [ ] **Step 5: Fix all references to `yarnVersion`/`yarn_version` across codebase**

Grep and update all references in routes, services, UI types, gateway abstractions, presenters, and tests.

- [ ] **Step 6: Run full test suite — verify all pass**

```bash
yarn test
```

- [ ] **Step 7: Commit**

```bash
git add src/api/db/ src/api/routes/ src/api/services/ src/ui/ src/shared/
git commit -m "feat: add scanResults and pmSecuritySettings tables, rename yarnVersion to pmVersion"
```

---

### Task 4: Shared route definitions (all 16 routes as Zod schemas)

**Files:**

- Create: `src/shared/routes/projects.ts`
- Create: `src/shared/routes/jobs.ts`
- Create: `src/shared/routes/packageManager.ts`
- Create: `src/shared/routes/cache.ts`
- Create: `src/shared/routes/index.ts`

**Interfaces:**

- Consumes: `defineRoute`, `zod`, DB schema types
- Produces: 16 exported route definitions with full Zod schemas for params, body, querystring, and response. Imported by both API route handlers and UI gateways.

- [ ] **Step 1: Write all route definitions**

Each file exports route definitions using `defineRoute`. All Zod schemas for input/output defined inline with the route. Example pattern:

```typescript
// src/shared/routes/projects.ts
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  packageManager: z.string().nullable(),
  pmVersion: z.string().nullable(),
  addedAt: z.number(),
  lastScannedAt: z.number().nullable(),
  security: z
    .object({
      passes: z.boolean(),
      npmPreapprovedPackages: z.boolean(),
      npmMinimalAgeGate: z.boolean(),
      enableScripts: z.boolean(),
      approvedGitRepositories: z.boolean()
    })
    .nullable()
    .optional()
});

const dependencySchema = z.object({
  name: z.string(),
  currentVersion: z.string(),
  latestVersion: z.string(),
  latestInRange: z.string(),
  type: z.string(),
  upgradeType: z.string()
});

const securityStatusSchema = z.object({
  passes: z.boolean(),
  npmPreapprovedPackages: z.boolean(),
  npmMinimalAgeGate: z.boolean(),
  enableScripts: z.boolean(),
  approvedGitRepositories: z.boolean()
});

export const createProjectRoute = defineRoute({
  method: "POST",
  path: "/api/projects",
  description: "Create a new project",
  params: z.object({}),
  body: z.object({ path: z.string().min(1) }),
  response: z.object({ item: projectSchema })
});

export const listProjectsRoute = defineRoute({
  method: "GET",
  path: "/api/projects",
  description: "List all projects",
  params: z.object({}),
  response: z.object({ items: z.array(projectSchema), total: z.number() })
});

// ... remaining 6 project routes follow same pattern
```

Follow this pattern for `jobs.ts` (4 routes), `packageManager.ts` (2 routes), `cache.ts` (2 routes).

- [ ] **Step 2: Create index.ts re-export**

```typescript
// src/shared/routes/index.ts
export * from "./projects.js";
export * from "./jobs.js";
export * from "./packageManager.js";
export * from "./cache.js";
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/routes/
git commit -m "feat: add shared route definitions with Zod schemas for all 16 routes"
```

---

### Task 5: WebSocket broadcaster (API) and listener (UI)

**Files:**

- Create: `src/shared/websocket/types.ts`
- Create: `src/api/websocket/abstractions/WebSocketBroadcaster.ts`
- Create: `src/api/websocket/WebSocketBroadcaster.ts`
- Create: `src/api/websocket/WebSocketPlugin.ts`
- Create: `src/api/websocket/__tests__/broadcaster.test.ts`
- Create: `src/ui/websocket/abstractions/WebSocketListener.ts`
- Create: `src/ui/websocket/WebSocketListener.ts`
- Create: `src/ui/websocket/feature.ts`
- Create: `src/ui/websocket/__tests__/WebSocketListener.test.ts`

**Interfaces:**

- Consumes: `@fastify/websocket`, `@webiny/di`, `createAbstraction`/`createImplementation`
- Produces:
  - `WebSocketBroadcaster.Interface`: `broadcast(type: string, data: unknown): void`, `addClient(ws): void`, `removeClient(ws): void`
  - `WebSocketListener.Interface`: `on(type: string, callback: (data: any) => void): void`, `off(type: string, callback: (data: any) => void): void`, `connect(): void`, `disconnect(): void`
  - `WSEvent` union type (shared)
  - Fastify plugin that registers `GET /ws`

- [ ] **Step 1: Write shared WS event types**

```typescript
// src/shared/websocket/types.ts
export interface WSScanProgress {
  projectId: string;
  packageName: string;
  current: number;
  total: number;
}

export interface WSScanComplete {
  projectId: string;
}

export interface WSScanFailed {
  projectId: string;
  error: string;
}

export interface WSJobStatus {
  jobId: string;
  projectId: string;
  status: string;
  logs?: string;
}

export interface WSNotification {
  message: string;
  level: "info" | "error";
}

export type WSEventMap = {
  "scan:progress": WSScanProgress;
  "scan:complete": WSScanComplete;
  "scan:failed": WSScanFailed;
  "job:status": WSJobStatus;
  notification: WSNotification;
};

export type WSEventType = keyof WSEventMap;
```

- [ ] **Step 2: Write broadcaster tests**

Test that `broadcast` sends JSON to all connected clients, `addClient`/`removeClient` manage the set, closed clients are skipped.

- [ ] **Step 3: Write broadcaster abstraction + implementation**

Abstraction uses `createAbstraction`. Implementation holds `Set<WebSocket>`, `broadcast` iterates and sends `JSON.stringify({ type, data })` to each, catches per-client errors silently.

- [ ] **Step 4: Write Fastify WS plugin**

Registers `@fastify/websocket`, then a GET `/ws` route. On connection: `broadcaster.addClient(socket)`. On close/error: `broadcaster.removeClient(socket)`.

- [ ] **Step 5: Write WebSocketListener tests**

Test: `on("scan:progress", cb)` fires callback when message with matching type arrives. Multiple callbacks per type. `off` removes specific callback.

- [ ] **Step 6: Write WebSocketListener abstraction + implementation**

Abstraction uses `createAbstraction`. Implementation holds `Map<string, Set<callback>>`. `on` adds to set, `off` removes. Internal `onMessage` parses JSON, finds type, fires all callbacks. `connect` opens WS, `disconnect` closes. Auto-reconnect with 1s/2s/4s backoff on close.

- [ ] **Step 7: Create features for DI registration (API + UI)**

Register `WebSocketBroadcaster` in `ApiFeature` (`src/api/feature.ts`) now so it's available when JobWorker needs it in Task 12:

```typescript
// Add to src/api/feature.ts register():
container.register(WebSocketBroadcaster).inSingletonScope();
```

Create UI feature:

```typescript
// src/ui/websocket/feature.ts
import { createFeature } from "#shared/index.js";
import { WebSocketListener } from "./WebSocketListener.js";

export const WebSocketFeature = createFeature({
  name: "Ui/WebSocket",
  register(container) {
    container.register(WebSocketListener).inSingletonScope();
  }
});
```

- [ ] **Step 8: Run WS tests — verify pass**

```bash
yarn vitest run src/api/websocket/ src/ui/websocket/
```

- [ ] **Step 9: Commit**

```bash
git add src/shared/websocket/ src/api/websocket/ src/ui/websocket/
git commit -m "feat: add WebSocket broadcaster (API) and listener (UI) with typed events"
```

---

### Task 6: Update HTTPClient to use typed `request(route, args)` method

**Files:**

- Modify: `src/ui/httpClient/abstractions/HTTPClient.ts`
- Modify: `src/ui/httpClient/HTTPClient.ts`
- Modify: `src/ui/httpClient/__tests__/HTTPClient.test.ts`

**Interfaces:**

- Consumes: `RouteDefinition`, `IRequestArgs`, `interpolatePath` from `#shared/routing/index.js`
- Produces: `HTTPClient.Interface` with `request(route, args)` method added **alongside** existing `get`/`post`/`del` methods. Old methods removed later in Task 8 after gateways migrate.

- [ ] **Step 1: Write tests for `request` method**

Test: `request(getRoute, { params: { id: "p1" } })` makes GET to `/api/projects/p1`. `request(postRoute, { params: {}, body: { path: "/tmp" } })` makes POST with JSON body. Response parsed through route's response schema. Keep existing get/post/del tests passing.

- [ ] **Step 2: Update HTTPClient abstraction**

Add `request` method to `IHTTPClient` interface **alongside** existing `get`/`post`/`del`. Do NOT remove old methods yet.

- [ ] **Step 3: Update HTTPClient implementation**

Implement `request`: interpolate path, append query params, stringify body for non-GET methods, fetch, parse response through `route.response` Zod schema if present. Existing `get`/`post`/`del` remain unchanged.

- [ ] **Step 4: Run HTTPClient tests — verify ALL pass (old and new)**

```bash
yarn vitest run src/ui/httpClient/
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/httpClient/
git commit -m "feat: add typed request(route, args) method to HTTPClient (alongside existing methods)"
```

---

### Task 7: Migrate all API route handlers to registerRoute + response helpers

**Files:**

- Rewrite: `src/api/routes/projects.ts` — use `registerRoute` + shared route definitions + `sendOne`/`sendList`/`sendNone`/`sendError`
- Rewrite: `src/api/routes/upgrades.ts` — rename to `src/api/routes/jobs.ts`
- Rewrite: `src/api/routes/yarn.ts` — rename to `src/api/routes/packageManager.ts`
- Rewrite: `src/api/routes/cache.ts`
- Modify: `src/api/routes/index.ts` — update exports
- Modify: `src/api/server.ts` — update route plugin registration
- Update: all route test files to match new response envelopes

**Interfaces:**

- Consumes: shared route definitions from `#shared/routes/index.js`, `registerRoute`, `sendOne`/`sendList`/`sendNone`/`sendError`, DI container
- Produces: all 16 routes registered via `registerRoute`, responses wrapped in envelopes

**Important**: The scan route (`POST /api/projects/:id/scan`) keeps its **synchronous** behavior in this task. It still runs `scanService.scan()` inline and returns deps wrapped in `sendList`. The switch to async (enqueue job, return jobId) happens in Task 12. Use a temporary route definition that matches the sync response shape; the shared route definition in `src/shared/routes/projects.ts` should have both the sync and async variants, with the async one used from Task 12 onward.

**Status codes**: `POST /api/projects` uses `sendOne(reply, project, 201)`. `DELETE /api/projects/:id` uses `sendNone(reply, 204)`. All other routes use default 200.

- [ ] **Step 1: Rewrite projects.ts routes**

Each handler: resolve services from container, `registerRoute(app, sharedRoute, {}, handler)`. Handler uses `sendOne`/`sendList`/`sendNone`/`sendError` instead of raw `return`. Scan route remains synchronous for now.

- [ ] **Step 2: Rename and rewrite upgrades.ts to jobs.ts**

Update paths from `/upgrades` to `/jobs/*`. Update the `from` version lookup that currently uses `ScanCache` — read from `scanResults` DB table instead. Update test file.

- [ ] **Step 3: Rename and rewrite yarn.ts to packageManager.ts**

Update paths from `/yarn` to `/package-manager/*`. Update test file.

- [ ] **Step 4: Rewrite cache.ts routes**

- [ ] **Step 5: Update route index and server imports**

- [ ] **Step 6: Update ALL route tests**

Tests now expect envelope responses: `{ item: ... }`, `{ items: [...], total }`, `{ success: true }`.

- [ ] **Step 7: Run full test suite — verify all pass**

```bash
yarn test
```

- [ ] **Step 8: Commit**

```bash
git add src/api/routes/ src/api/server.ts
git commit -m "feat: migrate all API routes to registerRoute with typed Zod validation and response envelopes"
```

---

### Task 8: Migrate all UI gateways to use `httpClient.request(route, args)` and remove old HTTP methods

**Files:**

- Modify: `src/ui/httpClient/abstractions/HTTPClient.ts` — remove `get`/`post`/`del`, keep only `request`
- Modify: `src/ui/httpClient/HTTPClient.ts` — remove old method implementations
- Modify: `src/ui/httpClient/__tests__/HTTPClient.test.ts` — remove old method tests
- Modify: `src/ui/features/projects/ProjectsGateway.ts`
- Modify: `src/ui/features/projects/abstractions/ProjectsGateway.ts`
- Modify: `src/ui/features/projects/__tests__/ProjectsGateway.test.ts`
- Modify: `src/ui/features/upgrades/UpgradesGateway.ts`
- Modify: `src/ui/features/upgrades/abstractions/UpgradesGateway.ts`
- Modify: `src/ui/features/upgrades/__tests__/UpgradesGateway.test.ts`
- Modify: `src/ui/presentation/upgrades/useCases/UpdateYarnUseCase.ts` — rename to `UpdatePackageManagerUseCase.ts`
- Modify: `src/ui/presentation/upgrades/useCases/abstractions/UpdateYarnUseCase.ts` — rename
- Modify: `src/ui/presentation/projects/useCases/ScanProjectUseCase.ts` — return type changes (scan now returns deps, later jobId)
- Update: all use case tests and presenter tests that mock HTTPClient

**Interfaces:**

- Consumes: shared route definitions, `HTTPClient.request(route, args)`
- Produces: gateway methods that import shared routes and call `httpClient.request(route, args)`, unwrap envelope responses. Old `get`/`post`/`del` methods removed from HTTPClient.

- [ ] **Step 1: Update ProjectsGateway**

Each method imports a shared route and calls `this.httpClient.request(route, args)`. Unwraps `{ item: ... }` or `{ items: [...], total }` envelope into domain types. Rename `getSecurity`/`checkSecurity` to use new route definitions.

- [ ] **Step 2: Update UpgradesGateway**

Same pattern. Routes now under `/jobs/*` paths. Rename `updateYarn`/`getYarnInfo` to `updatePackageManager`/`getPackageManagerInfo`.

- [ ] **Step 3: Update gateway abstractions**

Align interface return types with unwrapped envelope shapes.

- [ ] **Step 4: Remove old get/post/del from HTTPClient**

Remove `get`, `post`, `del` from `IHTTPClient` interface and implementation. Only `request` remains.

- [ ] **Step 5: Update all gateway tests**

Mock `httpClient.request` instead of `httpClient.get`/`post`/`del`. Verify correct route and args passed.

- [ ] **Step 5: Update all use case and presenter tests**

Fix mock HTTPClient to use `request` method. Update expected response shapes.

- [ ] **Step 6: Run full test suite — verify all pass**

```bash
yarn test
```

- [ ] **Step 7: Commit**

```bash
git add src/ui/
git commit -m "feat: migrate UI gateways to typed httpClient.request(route, args)"
```

---

### Task 9: Package manager detection and PackageManagerService

**Files:**

- Create: `src/api/services/abstractions/PackageManagerService.ts`
- Create: `src/api/services/PackageManagerService.ts`
- Create: `src/api/services/__tests__/PackageManagerService.test.ts`
- Delete: `src/api/services/YarnService.ts`
- Delete: `src/api/services/abstractions/YarnService.ts`
- Delete: `src/api/services/__tests__/YarnService.test.ts`
- Modify: `src/api/services/JobWorker.ts` — replace YarnService dep with PackageManagerService, rename `"yarn"` type to `"packageManager"`
- Modify: `src/api/services/abstractions/JobWorker.ts` — update `ICreateJobInput.type` union to include `"packageManager"` instead of `"yarn"`
- Modify: `src/api/services/__tests__/JobWorker.test.ts` — update job type references
- Modify: `src/api/feature.ts` — register PackageManagerService instead of YarnService
- Modify: `src/api/routes/packageManager.ts` — resolve PackageManagerService, enqueue with type `"packageManager"`
- Modify: `src/api/routes/projects.ts` — detect PM on project creation

**Interfaces:**

- Consumes: `CommandRunner`, project's `packageManager` field
- Produces:
  - `PackageManagerService.Interface`:
    - `detect(projectPath: string): Promise<"yarn" | "npm" | "pnpm">` — checks lockfile presence
    - `getVersion(projectPath: string, pm: string): Promise<string>` — dispatches to correct CLI
    - `updateVersion(projectPath: string, pm: string, version: string, onLog: (line: string) => void): Promise<void>`
  - `ICreateJobInput.type` updated: `"dependency" | "transient" | "packageManager" | "scan"`

- [ ] **Step 1: Write PackageManagerService tests**

Test `detect`: mock fs to simulate lockfile presence (yarn.lock, pnpm-lock.yaml, package-lock.json). Test `getVersion`: mock CommandRunner for each PM. Test `updateVersion`: mock CommandRunner streaming.

- [ ] **Step 2: Write abstraction + implementation**

`detect` checks `existsSync` for lockfiles in priority order. `getVersion` dispatches command by PM. `updateVersion` dispatches streaming command by PM.

- [ ] **Step 3: Update project creation route to detect PM**

On `POST /api/projects`: call `packageManagerService.detect(path)`, store in `packageManager` column. Use detected PM for `getVersion` instead of hardcoded `yarn --version`.

- [ ] **Step 4: Delete YarnService files, update feature.ts**

Replace `YarnService` registration with `PackageManagerService`.

- [ ] **Step 5: Update JobWorker — replace YarnService dep and rename job type**

In `JobWorker.ts`: replace `YarnService` import/constructor param with `PackageManagerService`. Rename `job.type === "yarn"` branch to `job.type === "packageManager"`. Read project's PM from DB and pass to `packageManagerService.updateVersion(path, pm, version, onLog)`.

In `abstractions/JobWorker.ts`: update `ICreateJobInput.type` union from `"dependency" | "transient" | "yarn"` to `"dependency" | "transient" | "packageManager" | "scan"`.

Update JobWorker tests accordingly.

- [ ] **Step 6: Run full test suite — verify all pass**

```bash
yarn test
```

- [ ] **Step 7: Commit**

```bash
git add src/api/services/ src/api/feature.ts src/api/routes/
git commit -m "feat: add PackageManagerService with npm/yarn/pnpm detection, replace YarnService"
```

---

### Task 10: Config-driven SecurityService with pmSecuritySettings

**Files:**

- Modify: `src/api/services/SecurityService.ts`
- Modify: `src/api/services/abstractions/SecurityService.ts`
- Modify: `src/api/services/__tests__/SecurityService.test.ts`

**Interfaces:**

- Consumes: `DatabaseClient` (reads `pmSecuritySettings` table), `projects` table (reads `packageManager`)
- Produces: `SecurityService.check(projectId, projectPath)` that reads settings for the project's PM from DB, parses the config file (`.yarnrc.yml`, `.npmrc`, etc.), and validates each field. Returns `{ passes: true }` if no settings configured for that PM.

**Note**: The `securityChecks` table currently has 4 hardcoded Yarn-specific boolean columns. This task also updates `securityChecks` to store results generically: replace the 4 columns with a single `results` TEXT column (JSON blob of `{ fieldName: boolean }` pairs) plus a `passes` INTEGER column. Update `getLatest()` accordingly. The `SecurityService.CheckResult` interface becomes `{ passes: boolean; checks: Record<string, boolean> }` — the UI SecurityPanel needs updating in Task 14 to render dynamic field names.

- [ ] **Step 1: Write SecurityService tests for config-driven checks**

Test: Yarn with 4 settings passes when `.yarnrc.yml` has all fields. npm with no settings returns `{ passes: true }`. Yarn with missing field fails.

- [ ] **Step 2: Rewrite SecurityService.check()**

1. Look up project's `packageManager` from projects table
2. Query `pmSecuritySettings` WHERE `packageManager = pm`
3. If no rows: return `{ passes: true, ... }` (all fields true)
4. Group settings by `configFile`, read each config file once
5. For YAML files (`.yarnrc.yml`): parse with `yaml` package
6. For `.npmrc` files: parse as INI (key=value lines)
7. For each setting: check field presence or exact value match
8. Aggregate into result object

- [ ] **Step 3: Update SecurityService abstraction**

Keep same interface — `check(projectId, projectPath)` and `getLatest(projectId)`. Internal implementation changes only.

- [ ] **Step 4: Run SecurityService tests — verify pass**

```bash
yarn vitest run src/api/services/__tests__/SecurityService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/api/services/SecurityService.ts src/api/services/abstractions/SecurityService.ts src/api/services/__tests__/SecurityService.test.ts
git commit -m "feat: config-driven SecurityService reading checks from pmSecuritySettings table"
```

---

### Task 11: PM-aware ScanService with onProgress callback

**Files:**

- Modify: `src/api/services/ScanService.ts`
- Modify: `src/api/services/abstractions/ScanService.ts`
- Modify: `src/api/services/__tests__/ScanService.test.ts`

**Interfaces:**

- Consumes: `CommandRunner`, `RegistryCacheService`
- Produces: `ScanService.scan(projectPath, packageManager, force?, onProgress?) => Promise<Dependency[]>`
  - `onProgress(packageName: string, current: number, total: number)` — called after each registry lookup
  - PM-aware: dispatches to correct commands for installed version listing and workspace discovery per PM

- [ ] **Step 1: Update scan tests**

Add tests for `onProgress` callback — verify it fires with correct current/total counts. Add test for npm/pnpm command dispatch (mock CommandRunner returns different JSON format per PM).

- [ ] **Step 2: Update ScanService abstraction**

Add `packageManager` param and optional `onProgress` callback to `scan()` signature.

- [ ] **Step 3: Update ScanService implementation**

- Dispatch installed-versions command by PM: yarn uses `yarn info --all --json`, npm uses `npm ls --all --json`, pnpm uses `pnpm list --json`
- Dispatch workspace listing by PM: yarn uses `yarn workspaces list --json`, npm/pnpm use `package.json` workspaces field
- Add cumulative counter, call `onProgress` after each registry lookup in the batch loop
- Add npm/pnpm parsers for their JSON output formats

- [ ] **Step 4: Run ScanService tests — verify pass**

```bash
yarn vitest run src/api/services/__tests__/ScanService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/api/services/ScanService.ts src/api/services/abstractions/ScanService.ts src/api/services/__tests__/ScanService.test.ts
git commit -m "feat: PM-aware ScanService with onProgress callback for per-package progress"
```

---

### Task 12: Async scan job in JobWorker + scan results persistence

**Files:**

- Modify: `src/api/services/JobWorker.ts`
- Modify: `src/api/services/abstractions/JobWorker.ts`
- Modify: `src/api/services/__tests__/JobWorker.test.ts`
- Delete: `src/api/services/ScanCache.ts`
- Delete: `src/api/services/abstractions/ScanCache.ts`
- Delete: `src/api/services/__tests__/ScanCache.test.ts`
- Modify: `src/api/feature.ts` — remove ScanCache (WebSocketBroadcaster already registered in Task 5)
- Modify: `src/api/routes/projects.ts` — scan route enqueues job, dependencies route reads from DB
- Modify: `src/api/routes/jobs.ts` — update `from` version lookup to read from `scanResults` table instead of ScanCache

**Interfaces:**

- Consumes: `ScanService`, `WebSocketBroadcaster`, `DatabaseClient`, `scanResults` table
- Produces:
  - `"scan"` job type handled in `executeJob`
  - Concurrent jobs: `#runningProjects` constraint removed
  - Scan results persisted to `scanResults` table (delete-then-insert)
  - WS events broadcast during scan: `scan:progress`, `scan:complete`, `scan:failed`

- [ ] **Step 1: Update JobWorker tests**

Test scan job execution: mock ScanService, verify onProgress callback wired to broadcaster, verify results written to DB. Test concurrent jobs: two jobs for same project both execute.

- [ ] **Step 2: Update JobWorker abstraction**

Add `"scan"` to `ICreateJobInput.type`. Add `WebSocketBroadcaster` to constructor deps.

- [ ] **Step 3: Update JobWorker implementation**

- Remove `#runningProjects` Set and the `has/add/delete` logic in `processNextJob`
- Add `"scan"` case in `executeJob`: look up project, call `scanService.scan(path, pm, force, onProgress)`, persist results to `scanResults` table, broadcast `scan:complete`
- `onProgress` callback: `broadcaster.broadcast("scan:progress", { projectId, packageName, current, total })`
- On error: `broadcaster.broadcast("scan:failed", { projectId, error: String(error) })`
- Also broadcast `job:status` events for all job type transitions (running, completed, failed)

- [ ] **Step 4: Update scan route**

`POST /api/projects/:id/scan` now enqueues a scan job via `jobWorker.enqueue({ projectId, type: "scan", packages: JSON.stringify({ force }) })` and returns `{ item: { jobId } }`. The `force` flag from querystring is serialized into the job's `packages` JSON field so the worker can read it. No longer runs scan synchronously.

- [ ] **Step 5: Update dependencies route**

`GET /api/projects/:id/dependencies` reads from `scanResults` table instead of `ScanCache`.

- [ ] **Step 6: Delete ScanCache files**

Remove `ScanCache.ts`, abstraction, tests. Remove from `feature.ts` registration.

- [ ] **Step 7: Run full test suite — verify all pass**

```bash
yarn test
```

- [ ] **Step 8: Commit**

```bash
git add src/api/
git commit -m "feat: async scan via JobWorker with WS progress, persist results to DB, remove ScanCache"
```

---

### Task 13: Wire WebSocket into server + UI app mount

**Files:**

- Modify: `src/api/server.ts` — register WS plugin, add broadcaster to DI
- Modify: `src/ui/App.tsx` — add WebSocketFeature to `ALL_FEATURES` array (this is where features are listed, NOT in ContainerProvider), connect listener on mount

**Interfaces:**

- Consumes: WebSocket plugin, WebSocketBroadcaster (already registered in Task 5), WebSocketListener feature
- Produces: WS connection established on app mount, broadcaster available to all API services

- [ ] **Step 1: Register WS plugin in server**

```typescript
import websocket from "@fastify/websocket";
import { websocketPlugin } from "./websocket/WebSocketPlugin.js";
// ...
await app.register(websocket);
await app.register(websocketPlugin, { container });
```

- [ ] **Step 2: Connect WebSocketListener in UI on mount**

In `App.tsx`: add `WebSocketFeature` to `ALL_FEATURES` array. Resolve `WebSocketListener` from container, call `connect()` on mount.

- [ ] **Step 4: Run full test suite + manual test WS connection**

```bash
yarn test
yarn dev
# Open browser, check WS connection in devtools Network tab
```

- [ ] **Step 5: Commit**

```bash
git add src/api/server.ts src/api/feature.ts src/ui/App.tsx src/ui/shared/
git commit -m "feat: wire WebSocket into server and UI app mount"
```

---

### Task 14: Update UI presenters for async scan + WS progress

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectDetail/__tests__/ProjectDetailPresenter.test.ts`
- Modify: `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`
- Modify: `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts`
- Modify: `src/ui/presentation/projects/ProjectList/components/ProjectListPage.tsx`
- Modify: `src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts`
- Modify: `src/ui/presentation/jobs/JobProgress/abstractions/JobProgressPresenter.ts` — remove polling-related interface methods, add WS-driven fields
- Modify: `src/ui/presentation/jobs/JobProgress/__tests__/JobProgressPresenter.test.ts`
- Modify: `src/ui/presentation/projects/ProjectDetail/components/SecurityPanel.tsx` — render dynamic field names from `checks: Record<string, boolean>` instead of hardcoded Yarn fields

**Interfaces:**

- Consumes: `WebSocketListener`, shared route definitions, updated gateways
- Produces:
  - `ProjectDetailPresenter`: `scanProgress` in ViewModel, WS listener for `scan:progress`/`scan:complete`
  - `ProjectListPresenter`: per-project `scanStatus` in list items, WS listeners for bulk scan
  - `JobProgressPresenter`: WS listener for `job:status` replaces polling

- [ ] **Step 1: Update ProjectDetailPresenter**

Add `scanProgress` to ViewModel. `scan()` calls scan route (returns jobId), registers WS listener. On `scan:complete`, reloads deps. `load()` no longer auto-scans.

- [ ] **Step 2: Update ProjectDetailPage component**

Show progress bar/text when `scanProgress` is set: "Scanning: lodash (45/200)".

- [ ] **Step 3: Update ProjectListPresenter**

`scanAll()` enqueues scan for each project, registers WS listeners. Per-project `scanStatus` updated on WS events.

- [ ] **Step 4: Update ProjectListPage component**

Show per-row scan status indicator. Show PM type per project.

- [ ] **Step 5: Update JobProgressPresenter**

Register WS listener for `job:status`. Remove polling interval. Update job state reactively.

- [ ] **Step 6: Update all presenter tests**

Mock WebSocketListener. Verify WS registration/unregistration. Verify scan progress state updates.

- [ ] **Step 7: Run full test suite — verify all pass**

```bash
yarn test
```

- [ ] **Step 8: Commit**

```bash
git add src/ui/
git commit -m "feat: update UI presenters for async scan with WS progress notifications"
```

---

### Task 15: Final cleanup and integration test

**Files:**

- Modify: `src/shared/index.ts` — re-export routing and websocket types
- Run: full test suite, typecheck, lint

**Interfaces:**

- Consumes: everything
- Produces: clean build, all tests pass, no unused imports/files

- [ ] **Step 1: Update shared index exports**

Add routing and websocket re-exports to `src/shared/index.ts`.

- [ ] **Step 2: Run full verification**

```bash
npx tsc --noEmit
yarn lint
yarn test
```

All must pass.

- [ ] **Step 3: Manual integration test**

```bash
yarn dev
```

1. Open browser, verify WS connection in Network tab
2. Add a project, verify PM auto-detected
3. Click Scan, verify scan enqueues and progress shows per-package
4. Verify dependencies load after scan completes
5. Click Scan All from project list, verify parallel scans with per-row status
6. Verify security check runs during scan

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: final cleanup, shared exports, integration verification"
```

## Deferred Work (Not in This Plan)

- **Settings UI for npm/pnpm security fields**: The `pmSecuritySettings` table is seeded with Yarn defaults only. npm/pnpm settings must be configured via DB seed or future UI settings page. This is a separate feature with its own CRUD routes and UI.
- **`notification` WS event type**: Defined in shared types but not broadcast or consumed by any task. Available for future use (error toasts, system notifications).
- **`lastScannedAt` in dependencies response**: Previously returned alongside deps; now dropped from the envelope. The project item (`GET /api/projects/:id`) carries `lastScannedAt` — UI should read it from there.
