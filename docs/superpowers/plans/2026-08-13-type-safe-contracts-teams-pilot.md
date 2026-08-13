# Type-Safe API/UI Contracts — Teams Pilot

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite send helpers (sendOne/sendList/sendNone/sendError) to accept Result, handle errors internally with SendableError interface, and prove pattern end-to-end on teams domain.

**Architecture:** Shared routing abstractions (SendableError, RoutingOptions, ErrorLoggerHook) define error contract. Send helpers accept Result and delegate error handling to sendError with routing options. Response schemas move to `src/shared/responses/`. Route handlers shrink to single send call. Use case errors gain `code` field.

**Tech Stack:** TypeScript, Fastify, Zod, Vitest, @webiny/stdlib Result

**Spec:** `docs/superpowers/specs/2026-08-13-type-safe-api-ui-contracts-design.md`

## Global Constraints

- Use `Result` from `#shared/index.js` (re-exported from `@webiny/stdlib`)
- One file per abstraction, one file per implementation
- Named interfaces only, no inline structural types
- Object params with named keys for 2+ params
- Full words in identifiers (no abbreviations)
- Run `yarn full` to verify (lint, format, typecheck, build, tests)
- Format with `yarn format:fix && yarn lint:fix` before commit

---

### Task 1: SendableError + RoutingOptions + ErrorLoggerHook abstractions

**Files:**

- Create: `src/shared/routing/abstractions/SendableError.ts`
- Create: `src/shared/routing/abstractions/ErrorLoggerHook.ts`
- Create: `src/shared/routing/abstractions/RoutingOptions.ts`
- Create: `src/shared/routing/abstractions/index.ts`
- Create: `src/shared/routing/getRoutingOptions.ts`
- Modify: `src/shared/routing/index.ts`

**Interfaces:**

- Consumes: nothing
- Produces: `SendableError` interface, `RoutingOptions` interface, `ErrorLoggerHook` abstraction, `getRoutingOptions` function — used by all send helpers in Task 2

- [ ] **Step 1: Create SendableError interface**

```typescript
// src/shared/routing/abstractions/SendableError.ts
export interface SendableError {
  code: string;
  message: string;
  statusCode?: number;
  data?: unknown;
  stack?: string;
}
```

- [ ] **Step 2: Create ErrorLoggerHook abstraction**

```typescript
// src/shared/routing/abstractions/ErrorLoggerHook.ts
import type { FastifyRequest } from "fastify";
import { createAbstraction } from "#shared/index.js";
import type { SendableError } from "./SendableError.js";

interface IErrorLoggerHook {
  log(error: SendableError, request: FastifyRequest): Promise<void>;
}

export const ErrorLoggerHook = createAbstraction<IErrorLoggerHook>("Routing/ErrorLoggerHook");

export namespace ErrorLoggerHook {
  export type Interface = IErrorLoggerHook;
}
```

- [ ] **Step 3: Create RoutingOptions interface**

```typescript
// src/shared/routing/abstractions/RoutingOptions.ts
import type { ErrorLoggerHook } from "./ErrorLoggerHook.js";

export interface RoutingOptions {
  showStackTrace: boolean;
  errorLoggerHook?: ErrorLoggerHook.Interface;
}
```

- [ ] **Step 4: Create abstractions barrel export**

```typescript
// src/shared/routing/abstractions/index.ts
export { ErrorLoggerHook } from "./ErrorLoggerHook.js";
export type { SendableError } from "./SendableError.js";
export type { RoutingOptions } from "./RoutingOptions.js";
```

- [ ] **Step 5: Create getRoutingOptions helper**

```typescript
// src/shared/routing/getRoutingOptions.ts
import type { FastifyRequest } from "fastify";
import type { RoutingOptions } from "./abstractions/index.js";

export function getRoutingOptions(request: FastifyRequest): RoutingOptions | undefined {
  return (request as unknown as { routingOptions?: RoutingOptions }).routingOptions;
}
```

- [ ] **Step 6: Update routing barrel export**

Add to `src/shared/routing/index.ts`:

```typescript
export type { SendableError, RoutingOptions } from "./abstractions/index.js";
export { ErrorLoggerHook } from "./abstractions/index.js";
export { getRoutingOptions } from "./getRoutingOptions.js";
```

**Note:** `getRoutingOptions` will return `undefined` until a middleware/plugin attaches `routingOptions` to the request. This is fine — all fields are optional, and send helpers use optional chaining. Wiring up the middleware (e.g., setting `showStackTrace` in dev mode) is a follow-up concern, not part of this pilot.

- [ ] **Step 7: Verify**

Run: `yarn full`
Expected: all checks pass — new files are types/abstractions only, no consumers yet

- [ ] **Step 8: Commit**

```bash
git add src/shared/routing/abstractions/ src/shared/routing/getRoutingOptions.ts src/shared/routing/index.ts
git commit -m "feat: add SendableError, RoutingOptions, and ErrorLoggerHook routing abstractions"
```

---

### Task 2: Rewrite sendError, sendOne, sendList, sendNone

**Files:**

- Modify: `src/shared/routing/sendError.ts`
- Modify: `src/shared/routing/sendOne.ts`
- Modify: `src/shared/routing/sendList.ts`
- Modify: `src/shared/routing/sendNone.ts`
- Modify: `src/shared/routing/__tests__/sendHelpers.test.ts`

**Interfaces:**

- Consumes: `SendableError`, `RoutingOptions`, `getRoutingOptions` from Task 1
- Produces: `sendError(params: SendErrorParams): FastifyReply`, `sendOne<TResponse>(params: SendOneParams<TResponse>): FastifyReply`, `sendList<TResponse>(key: keyof TResponse & string, params: SendListParams<TResponse>): FastifyReply`, `sendNone(params: SendNoneParams): FastifyReply` — used by all route handlers

- [ ] **Step 1: Write failing tests for new sendError**

Replace the existing sendError test in `src/shared/routing/__tests__/sendHelpers.test.ts` and add new ones:

```typescript
it("sendError sends structured error with code and message", async () => {
  const app = Fastify();
  const route = defineRoute({
    method: "GET",
    path: "/test/:id",
    description: "test",
    params: z.object({ id: z.string() })
  });
  registerRoute(app, route, {}, async (request, reply) => {
    return sendError({
      reply,
      request,
      error: { code: "NOT_FOUND", message: "Not found", statusCode: 404 }
    });
  });

  const res = await app.inject({ method: "GET", url: "/test/1" });
  expect(res.statusCode).toBe(404);
  expect(res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
});

it("sendError defaults to status 400 when statusCode not provided", async () => {
  const app = Fastify();
  const route = defineRoute({
    method: "GET",
    path: "/test/:id",
    description: "test",
    params: z.object({ id: z.string() })
  });
  registerRoute(app, route, {}, async (request, reply) => {
    return sendError({
      reply,
      request,
      error: { code: "VALIDATION_ERROR", message: "Bad input" }
    });
  });

  const res = await app.inject({ method: "GET", url: "/test/1" });
  expect(res.statusCode).toBe(400);
  expect(res.json()).toEqual({ error: { code: "VALIDATION_ERROR", message: "Bad input" } });
});

it("sendError includes data when present", async () => {
  const app = Fastify();
  const route = defineRoute({
    method: "GET",
    path: "/test/:id",
    description: "test",
    params: z.object({ id: z.string() })
  });
  registerRoute(app, route, {}, async (request, reply) => {
    return sendError({
      reply,
      request,
      error: {
        code: "VALIDATION_ERROR",
        message: "Bad input",
        statusCode: 400,
        data: { field: "name" }
      }
    });
  });

  const res = await app.inject({ method: "GET", url: "/test/1" });
  expect(res.json()).toEqual({
    error: { code: "VALIDATION_ERROR", message: "Bad input", data: { field: "name" } }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/shared/routing/__tests__/sendHelpers.test.ts`
Expected: new sendError tests fail (signature mismatch)

- [ ] **Step 3: Implement new sendError**

```typescript
// src/shared/routing/sendError.ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { SendableError } from "./abstractions/index.js";
import type { ErrorLoggerHook } from "./abstractions/index.js";

interface SendErrorParams {
  reply: FastifyReply;
  request: FastifyRequest;
  error: SendableError;
  showStackTrace?: boolean;
  errorLoggerHook?: ErrorLoggerHook.Interface;
}

export function sendError(params: SendErrorParams): FastifyReply {
  const { reply, request, error, showStackTrace, errorLoggerHook } = params;

  if (errorLoggerHook !== undefined) {
    errorLoggerHook.log(error, request).catch(() => {});
  }

  const errorBody: Record<string, unknown> = {
    code: error.code,
    message: error.message
  };

  if (error.data !== undefined) {
    errorBody["data"] = error.data;
  }

  if (error.stack !== undefined && showStackTrace === true) {
    errorBody["stack"] = error.stack;
  }

  return reply.status(error.statusCode ?? 400).send({ error: errorBody });
}
```

- [ ] **Step 4: Run sendError tests to verify they pass**

Run: `yarn vitest run src/shared/routing/__tests__/sendHelpers.test.ts`
Expected: new sendError tests pass, old sendOne/sendList/sendNone tests still pass (not yet changed)

- [ ] **Step 5: Write failing tests for new sendOne**

Replace the existing sendOne test and add Result-based tests:

```typescript
it("sendOne returns item envelope on success Result", async () => {
  const app = Fastify();
  const route = defineRoute({
    method: "GET",
    path: "/test/:id",
    description: "test",
    params: z.object({ id: z.string() }),
    response: z.object({ item: z.object({ name: z.string() }) })
  });
  registerRoute(app, route, {}, async (request, reply) => {
    const result = Result.ok({ name: "hello" });
    return sendOne({ reply, request, result });
  });

  const res = await app.inject({ method: "GET", url: "/test/1" });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ item: { name: "hello" } });
});

it("sendOne returns error on fail Result", async () => {
  const app = Fastify();
  const route = defineRoute({
    method: "GET",
    path: "/test/:id",
    description: "test",
    params: z.object({ id: z.string() })
  });
  registerRoute(app, route, {}, async (request, reply) => {
    const result = Result.fail({
      code: "NOT_FOUND",
      message: "Not found",
      statusCode: 404
    });
    return sendOne({ reply, request, result });
  });

  const res = await app.inject({ method: "GET", url: "/test/1" });
  expect(res.statusCode).toBe(404);
  expect(res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
});

it("sendOne uses custom status on success", async () => {
  const app = Fastify();
  const route = defineRoute({
    method: "POST",
    path: "/test",
    description: "test",
    params: z.object({}),
    body: z.object({ name: z.string() }),
    response: z.object({ item: z.object({ name: z.string() }) })
  });
  registerRoute(app, route, {}, async (request, reply) => {
    const result = Result.ok({ name: "created" });
    return sendOne({ reply, request, result, status: 201 });
  });

  const res = await app.inject({
    method: "POST",
    url: "/test",
    payload: { name: "created" }
  });
  expect(res.statusCode).toBe(201);
  expect(res.json()).toEqual({ item: { name: "created" } });
});
```

Add `Result` import at top of test file:

```typescript
import { Result } from "#shared/index.js";
```

- [ ] **Step 6: Run tests to verify sendOne tests fail**

Run: `yarn vitest run src/shared/routing/__tests__/sendHelpers.test.ts`
Expected: new sendOne tests fail

- [ ] **Step 7: Implement new sendOne**

```typescript
// src/shared/routing/sendOne.ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Result } from "#shared/index.js";
import { sendError } from "./sendError.js";
import type { SendableError } from "./abstractions/index.js";
import { getRoutingOptions } from "./getRoutingOptions.js";

interface SendOneParams<TResponse> {
  reply: FastifyReply;
  request: FastifyRequest;
  result: Result<TResponse, SendableError>;
  status?: number;
}

export function sendOne<TResponse>(params: SendOneParams<TResponse>): FastifyReply {
  const { reply, request, result, status } = params;

  if (result.isFail()) {
    const routingOptions = getRoutingOptions(request);
    return sendError({
      reply,
      request,
      error: result.error,
      showStackTrace: routingOptions?.showStackTrace,
      errorLoggerHook: routingOptions?.errorLoggerHook
    });
  }

  return reply.status(status ?? 200).send({ item: result.value });
}
```

- [ ] **Step 8: Run tests to verify sendOne tests pass**

Run: `yarn vitest run src/shared/routing/__tests__/sendHelpers.test.ts`
Expected: sendOne tests pass

- [ ] **Step 9: Write failing tests for new sendList**

Replace existing sendList test:

```typescript
it("sendList returns items envelope on success Result", async () => {
  const app = Fastify();
  const route = defineRoute({
    method: "GET",
    path: "/test",
    description: "test",
    params: z.object({}),
    response: z.object({ items: z.array(z.string()), total: z.number() })
  });
  registerRoute(app, route, {}, async (request, reply) => {
    const result = Result.ok({ items: ["a", "b"], total: 2 });
    return sendList({ reply, request, result });
  });

  const res = await app.inject({ method: "GET", url: "/test" });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ items: ["a", "b"], total: 2 });
});

it("sendList returns error on fail Result", async () => {
  const app = Fastify();
  const route = defineRoute({
    method: "GET",
    path: "/test",
    description: "test",
    params: z.object({})
  });
  registerRoute(app, route, {}, async (request, reply) => {
    const result = Result.fail({
      code: "UNEXPECTED",
      message: "Something went wrong",
      statusCode: 500
    });
    return sendList({ reply, request, result });
  });

  const res = await app.inject({ method: "GET", url: "/test" });
  expect(res.statusCode).toBe(500);
  expect(res.json()).toEqual({
    error: { code: "UNEXPECTED", message: "Something went wrong" }
  });
});
```

- [ ] **Step 10: Run tests to verify sendList tests fail**

Run: `yarn vitest run src/shared/routing/__tests__/sendHelpers.test.ts`
Expected: sendList tests fail

- [ ] **Step 11: Implement new sendList**

```typescript
// src/shared/routing/sendList.ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Result } from "#shared/index.js";
import { sendError } from "./sendError.js";
import type { SendableError } from "./abstractions/index.js";
import { getRoutingOptions } from "./getRoutingOptions.js";

interface SendListParams<TResponse> {
  reply: FastifyReply;
  request: FastifyRequest;
  result: Result<TResponse, SendableError>;
  status?: number;
}

export function sendList<TResponse>(params: SendListParams<TResponse>): FastifyReply {
  const { reply, request, result, status } = params;

  if (result.isFail()) {
    const routingOptions = getRoutingOptions(request);
    return sendError({
      reply,
      request,
      error: result.error,
      showStackTrace: routingOptions?.showStackTrace,
      errorLoggerHook: routingOptions?.errorLoggerHook
    });
  }

  return reply.status(status ?? 200).send(result.value);
}
```

- [ ] **Step 12: Run tests to verify sendList tests pass**

Run: `yarn vitest run src/shared/routing/__tests__/sendHelpers.test.ts`
Expected: sendList tests pass

- [ ] **Step 13: Write failing tests for new sendNone**

Replace existing sendNone test:

```typescript
it("sendNone sends { success: true } on success Result", async () => {
  const app = Fastify();
  const route = defineRoute({
    method: "PUT",
    path: "/test/:id",
    description: "test",
    params: z.object({ id: z.string() }),
    body: z.object({ data: z.string() })
  });
  registerRoute(app, route, {}, async (request, reply) => {
    const result = Result.ok(undefined);
    return sendNone({ reply, request, result });
  });

  const res = await app.inject({
    method: "PUT",
    url: "/test/1",
    payload: { data: "x" }
  });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ success: true });
});

it("sendNone sends 204 with no body when status is 204", async () => {
  const app = Fastify();
  const route = defineRoute({
    method: "DELETE",
    path: "/test/:id",
    description: "test",
    params: z.object({ id: z.string() })
  });
  registerRoute(app, route, {}, async (request, reply) => {
    const result = Result.ok(undefined);
    return sendNone({ reply, request, result, status: 204 });
  });

  const res = await app.inject({ method: "DELETE", url: "/test/1" });
  expect(res.statusCode).toBe(204);
  expect(res.body).toBe("");
});

it("sendNone sends error on fail Result", async () => {
  const app = Fastify();
  const route = defineRoute({
    method: "DELETE",
    path: "/test/:id",
    description: "test",
    params: z.object({ id: z.string() })
  });
  registerRoute(app, route, {}, async (request, reply) => {
    const result = Result.fail({
      code: "NOT_FOUND",
      message: "Not found",
      statusCode: 404
    });
    return sendNone({ reply, request, result });
  });

  const res = await app.inject({ method: "DELETE", url: "/test/1" });
  expect(res.statusCode).toBe(404);
  expect(res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
});
```

- [ ] **Step 14: Run tests to verify sendNone tests fail**

Run: `yarn vitest run src/shared/routing/__tests__/sendHelpers.test.ts`
Expected: sendNone tests fail

- [ ] **Step 15: Implement new sendNone**

```typescript
// src/shared/routing/sendNone.ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Result } from "#shared/index.js";
import { sendError } from "./sendError.js";
import type { SendableError } from "./abstractions/index.js";
import { getRoutingOptions } from "./getRoutingOptions.js";

interface SendNoneParams {
  reply: FastifyReply;
  request: FastifyRequest;
  result: Result<unknown, SendableError>;
  status?: number;
}

export function sendNone(params: SendNoneParams): FastifyReply {
  const { reply, request, result, status } = params;

  if (result.isFail()) {
    const routingOptions = getRoutingOptions(request);
    return sendError({
      reply,
      request,
      error: result.error,
      showStackTrace: routingOptions?.showStackTrace,
      errorLoggerHook: routingOptions?.errorLoggerHook
    });
  }

  const statusCode = status ?? 200;

  if (statusCode === 204) {
    return reply.status(204).send();
  }

  return reply.status(statusCode).send({ success: true });
}
```

- [ ] **Step 16: Run all send helper tests**

Run: `yarn vitest run src/shared/routing/__tests__/sendHelpers.test.ts`
Expected: all tests pass

- [ ] **Step 17: Commit**

```bash
git add src/shared/routing/sendError.ts src/shared/routing/sendOne.ts src/shared/routing/sendList.ts src/shared/routing/sendNone.ts src/shared/routing/__tests__/sendHelpers.test.ts
git commit -m "feat: rewrite send helpers to accept Result and handle errors with SendableError"
```

---

### Task 3: Add code field to teams use case errors

**Files:**

- Modify: `src/api/routes/useCases/teams/abstractions/CreateTeamUseCase.ts`
- Modify: `src/api/routes/useCases/teams/abstractions/DeleteTeamUseCase.ts`
- Modify: `src/api/routes/useCases/teams/abstractions/GetTeamUseCase.ts`
- Modify: `src/api/routes/useCases/teams/abstractions/ListTeamsUseCase.ts`
- Modify: `src/api/routes/useCases/teams/abstractions/SetTeamProjectsUseCase.ts`
- Modify: `src/api/routes/useCases/teams/abstractions/UpdateTeamUseCase.ts`
- Modify: `src/api/routes/useCases/teams/CreateTeamUseCase.ts`
- Modify: `src/api/routes/useCases/teams/DeleteTeamUseCase.ts`
- Modify: `src/api/routes/useCases/teams/GetTeamUseCase.ts`
- Modify: `src/api/routes/useCases/teams/ListTeamsUseCase.ts`
- Modify: `src/api/routes/useCases/teams/SetTeamProjectsUseCase.ts`
- Modify: `src/api/routes/useCases/teams/UpdateTeamUseCase.ts`
- Modify: `src/api/routes/useCases/teams/__tests__/CreateTeamUseCase.test.ts`
- Modify: `src/api/routes/useCases/teams/__tests__/DeleteTeamUseCase.test.ts`
- Modify: `src/api/routes/useCases/teams/__tests__/GetTeamUseCase.test.ts`
- Modify: `src/api/routes/useCases/teams/__tests__/ListTeamsUseCase.test.ts`
- Modify: `src/api/routes/useCases/teams/__tests__/SetTeamProjectsUseCase.test.ts`
- Modify: `src/api/routes/useCases/teams/__tests__/UpdateTeamUseCase.test.ts`

**Interfaces:**

- Consumes: `SendableError` from Task 1 (error types must conform to it)
- Produces: Updated use case error types with `code` field — used by route handlers in Task 5

- [ ] **Step 1: Update CreateTeamUseCase abstraction — add code to error interfaces**

In `src/api/routes/useCases/teams/abstractions/CreateTeamUseCase.ts`:

```typescript
// Change INameConflictError:
export interface INameConflictError {
  code: "TEAM_NAME_CONFLICT";
  statusCode: 409;
  message: string;
}

// Change IUnexpectedError:
export interface IUnexpectedError {
  code: "UNEXPECTED_ERROR";
  statusCode: number;
  message: string;
}
```

- [ ] **Step 2: Update CreateTeamUseCase implementation — add code to Result.fail calls**

In `src/api/routes/useCases/teams/CreateTeamUseCase.ts`:

```typescript
// Line 20-23: add code
return Result.fail({
  code: "TEAM_NAME_CONFLICT",
  statusCode: 409,
  message: `A team named "${params.name}" already exists`
});

// Line 37: add code
return Result.fail({
  code: "UNEXPECTED_ERROR",
  statusCode: 500,
  message: (error as Error).message
});
```

- [ ] **Step 3: Repeat for remaining 5 use case abstractions and implementations**

Apply same pattern to each use case. Error code naming convention:

| Use Case               | Error        | Code                 |
| ---------------------- | ------------ | -------------------- |
| DeleteTeamUseCase      | notFound     | `TEAM_NOT_FOUND`     |
| DeleteTeamUseCase      | unexpected   | `UNEXPECTED_ERROR`   |
| GetTeamUseCase         | notFound     | `TEAM_NOT_FOUND`     |
| GetTeamUseCase         | unexpected   | `UNEXPECTED_ERROR`   |
| ListTeamsUseCase       | unexpected   | `UNEXPECTED_ERROR`   |
| SetTeamProjectsUseCase | notFound     | `TEAM_NOT_FOUND`     |
| SetTeamProjectsUseCase | unexpected   | `UNEXPECTED_ERROR`   |
| UpdateTeamUseCase      | notFound     | `TEAM_NOT_FOUND`     |
| UpdateTeamUseCase      | nameConflict | `TEAM_NAME_CONFLICT` |
| UpdateTeamUseCase      | unexpected   | `UNEXPECTED_ERROR`   |

For each abstraction file, add `code` literal type to error interface. For each implementation file, add `code` string to every `Result.fail()` call.

- [ ] **Step 4: Update all 6 teams use case test files**

In each test file, add `code` field to error assertions. Example for CreateTeamUseCase.test.ts — find assertions like:

```typescript
expect(result.error.statusCode).toBe(409);
```

Add alongside:

```typescript
expect(result.error.code).toBe("TEAM_NAME_CONFLICT");
```

- [ ] **Step 5: Run teams use case tests**

Run: `yarn vitest run src/api/routes/useCases/teams/__tests__/`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/useCases/teams/
git commit -m "feat: add error code field to teams use case error types"
```

---

### Task 4: Create teams response schemas

**Files:**

- Create: `src/shared/responses/teams.ts`
- Create: `src/shared/responses/index.ts`
- Modify: `src/shared/routes/teams.ts`

**Interfaces:**

- Consumes: Zod schemas from existing `src/shared/routes/teams.ts` (teamWithStatsSchema will move)
- Produces: `listTeamsResponseSchema`, `createTeamResponseSchema`, `getTeamDetailResponseSchema`, `updateTeamResponseSchema` — referenced by route definitions

- [ ] **Step 1: Create response schemas file**

Extract the `teamWithStatsSchema` from `src/shared/routes/teams.ts` into the response file, and define response schemas:

```typescript
// src/shared/responses/teams.ts
import { z } from "zod";

export const teamWithStatsSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  createdAt: z.number(),
  projectCount: z.number(),
  vulnerabilityCount: z.number(),
  compliantPercent: z.number(),
  averageHealthScore: z.number()
});

export const teamDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  createdAt: z.number(),
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      path: z.string()
    })
  )
});

export const listTeamsResponseSchema = z.object({
  items: z.array(teamWithStatsSchema),
  total: z.number()
});

export const createTeamResponseSchema = z.object({
  item: teamWithStatsSchema
});

export const getTeamDetailResponseSchema = z.object({
  item: teamDetailSchema
});

export const updateTeamResponseSchema = z.object({
  item: teamWithStatsSchema
});
```

- [ ] **Step 2: Create responses barrel export**

```typescript
// src/shared/responses/index.ts
export {
  teamWithStatsSchema,
  teamDetailSchema,
  listTeamsResponseSchema,
  createTeamResponseSchema,
  getTeamDetailResponseSchema,
  updateTeamResponseSchema
} from "./teams.js";
```

- [ ] **Step 3: Update route definitions to import schemas from responses**

In `src/shared/routes/teams.ts`:

- Remove the inline `teamWithStatsSchema` definition
- Import from `../responses/teams.js` instead
- Replace inline response schemas with the named exports

```typescript
// src/shared/routes/teams.ts
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
  teamWithStatsSchema,
  teamDetailSchema,
  listTeamsResponseSchema,
  createTeamResponseSchema,
  getTeamDetailResponseSchema,
  updateTeamResponseSchema
} from "../responses/teams.js";

export const listTeamsRoute = defineRoute({
  method: "GET",
  path: "/api/teams",
  description: "List all teams with aggregate stats",
  params: z.object({}),
  querystring: z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(200).optional()
  }),
  response: listTeamsResponseSchema
});

export const createTeamRoute = defineRoute({
  method: "POST",
  path: "/api/teams",
  description: "Create a new team",
  params: z.object({}),
  body: z.object({ name: z.string(), color: z.string() }),
  response: createTeamResponseSchema
});

export const getTeamDetailRoute = defineRoute({
  method: "GET",
  path: "/api/teams/:id",
  description: "Get team detail with projects",
  params: z.object({ id: z.string() }),
  response: getTeamDetailResponseSchema
});

export const updateTeamRoute = defineRoute({
  method: "PUT",
  path: "/api/teams/:id",
  description: "Update a team",
  params: z.object({ id: z.string() }),
  body: z.object({ name: z.string().optional(), color: z.string().optional() }),
  response: updateTeamResponseSchema
});

export const setTeamProjectsRoute = defineRoute({
  method: "PUT",
  path: "/api/teams/:id/projects",
  description: "Set team project assignments",
  params: z.object({ id: z.string() }),
  body: z.object({ projectIds: z.array(z.string()) })
});

export const deleteTeamRoute = defineRoute({
  method: "DELETE",
  path: "/api/teams/:id",
  description: "Delete a team",
  params: z.object({ id: z.string() })
});
```

- [ ] **Step 4: Verify**

Run: `yarn full`
Expected: all checks pass — schemas moved but shapes unchanged

- [ ] **Step 5: Commit**

```bash
git add src/shared/responses/ src/shared/routes/teams.ts
git commit -m "feat: extract teams response schemas to shared/responses"
```

---

### Task 5: Simplify teams route handlers

**Files:**

- Modify: `src/api/routes/teams.ts`

**Interfaces:**

- Consumes: `sendOne`, `sendList`, `sendNone` from Task 2 (new Result-based signatures); use case error types with `code` from Task 3
- Produces: Simplified route handlers that pass Result directly to send helpers

- [ ] **Step 1: Rewrite teams route handlers**

Replace `src/api/routes/teams.ts` with simplified handlers. Each handler now passes Result directly to the send helper — no more `result.match()`:

```typescript
// src/api/routes/teams.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendNone } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
  listTeamsRoute,
  createTeamRoute,
  updateTeamRoute,
  deleteTeamRoute,
  getTeamDetailRoute,
  setTeamProjectsRoute
} from "#shared/routes/index.js";
import {
  ListTeamsUseCase,
  CreateTeamUseCase,
  GetTeamUseCase,
  UpdateTeamUseCase,
  SetTeamProjectsUseCase,
  DeleteTeamUseCase
} from "./useCases/teams/index.js";

interface PluginOptions extends FastifyPluginOptions {
  container: Container;
}

export async function teamsRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
  const { container } = options;

  registerRoute(app, listTeamsRoute, {}, async (request, reply) => {
    const useCase = container.resolve(ListTeamsUseCase);
    const result = await useCase.execute({
      page: request.query.page,
      pageSize: request.query.pageSize
    });

    return sendList({ reply, request, result });
  });

  registerRoute(
    app,
    createTeamRoute,
    { preHandler: [requirePermission("full")] },
    async (request, reply) => {
      const useCase = container.resolve(CreateTeamUseCase);
      const result = await useCase.execute(request.body);

      return sendOne({ reply, request, result, status: 201 });
    }
  );

  registerRoute(app, getTeamDetailRoute, {}, async (request, reply) => {
    const useCase = container.resolve(GetTeamUseCase);
    const result = await useCase.execute({ id: request.params.id });

    return sendOne({ reply, request, result });
  });

  registerRoute(
    app,
    updateTeamRoute,
    { preHandler: [requirePermission("full")] },
    async (request, reply) => {
      const useCase = container.resolve(UpdateTeamUseCase);
      const result = await useCase.execute({
        id: request.params.id,
        name: request.body.name,
        color: request.body.color
      });

      return sendOne({ reply, request, result });
    }
  );

  registerRoute(
    app,
    setTeamProjectsRoute,
    { preHandler: [requirePermission("full")] },
    async (request, reply) => {
      const useCase = container.resolve(SetTeamProjectsUseCase);
      const result = await useCase.execute({
        id: request.params.id,
        projectIds: request.body.projectIds
      });

      return sendNone({ reply, request, result });
    }
  );

  registerRoute(
    app,
    deleteTeamRoute,
    { preHandler: [requirePermission("full")] },
    async (request, reply) => {
      const useCase = container.resolve(DeleteTeamUseCase);
      const result = await useCase.execute({ id: request.params.id });

      return sendNone({ reply, request, result, status: 204 });
    }
  );
}
```

- [ ] **Step 2: Note on sendError import removal**

The `sendError` import is no longer needed in route files — error handling is internal to sendOne/sendList/sendNone. Remove it from the import line.

- [ ] **Step 3: Verify full test suite**

Run: `yarn full`
Expected: all checks pass. Teams route tests (if any exist as integration tests) and use case tests all green.

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/teams.ts
git commit -m "feat: simplify teams route handlers to use Result-based send helpers"
```

---

### Task 6: Update all other route handlers (non-teams) for new send signatures

**Files:**

- Modify: every file in `src/api/routes/` that imports `sendOne`, `sendList`, `sendNone`, or `sendError`

**Interfaces:**

- Consumes: new send helper signatures from Task 2
- Produces: all route handlers compile with new signatures

Since this is a clean break (no backward compatibility), ALL route handlers must be updated in this task to avoid compilation errors. Convert all handlers to pass Result directly to send helpers, using `mapError` to add a temporary `code: "UNKNOWN"` for use cases that don't have the `code` field yet.

- [ ] **Step 1: Find all files importing send helpers**

Run: `grep -rn "sendOne\|sendList\|sendNone\|sendError" src/api/routes/ --include="*.ts" -l`

- [ ] **Step 2: Update each file**

For non-teams routes, convert all handlers to pass Result directly. Since non-teams use cases don't have the `code` field yet, use `result.mapError()` to add a temporary `code: "UNKNOWN"`:

```typescript
return sendOne({
  reply,
  request,
  result: result.mapError(error => ({
    ...error,
    code: error.code ?? "UNKNOWN"
  }))
});
```

**Pattern for sendNone:**

```typescript
// Before:
result.match({
  ok: () => sendNone(reply),
  fail: error => sendError({ reply, statusCode: error.statusCode, message: error.message })
});

// After:
return sendNone({
  reply,
  request,
  result: result.mapError(error => ({
    ...error,
    code: error.code ?? "UNKNOWN"
  }))
});
```

**Pattern for sendList:**

```typescript
// Before:
result.match({
  ok: data => sendList({ reply, items: data.items, total: data.total }),
  fail: error => sendError({ reply, statusCode: error.statusCode, message: error.message })
});

// After:
return sendList({
  reply,
  request,
  result: result.mapError(error => ({
    ...error,
    code: error.code ?? "UNKNOWN"
  }))
});
```

**For direct sendError calls** (e.g., in middleware or non-use-case routes):

```typescript
// Before:
sendError({ reply, statusCode: 404, message: "Not found" });

// After:
sendError({ reply, request, error: { code: "NOT_FOUND", statusCode: 404, message: "Not found" } });
```

- [ ] **Step 3: Update requirePermission middleware if it calls sendError**

Check `src/api/middleware/requirePermission.ts` — if it calls `sendError`, update the signature.

- [ ] **Step 4: Verify full test suite**

Run: `yarn full`
Expected: all checks pass

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/ src/api/middleware/
git commit -m "feat: update all route handlers to use Result-based send helpers"
```
