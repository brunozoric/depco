# Security Settings — Plan 2: Shared Route Definitions + API Route Handler

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the 4 security settings routes (list, create, update, delete) and implement the API handler with validation and tests.

**Architecture:** Shared route definitions with Zod schemas in `src/shared/routes/settings.ts`. API handler in `src/api/routes/settings.ts` with direct Drizzle queries on `pmSecuritySettings`. Route tests use in-memory SQLite with seeded data.

**Tech Stack:** TypeScript, Zod, Fastify, Drizzle ORM, Vitest

## Global Constraints

- All routes use envelope pattern: `{item}`, `{items, total}`, `{success: true}`, or no body (204)
- Routes defined via `defineRoute` with Zod schemas
- API handlers use `registerRoute` + `sendOne`/`sendList`/`sendNone`/`sendError`
- Tests use `createTestDb` + `seedYarnSecuritySettings` for in-memory SQLite
- Run `yarn build` after each task

---

### Task 5: Shared route definitions

**Files:**

- Create: `src/shared/routes/settings.ts`
- Modify: `src/shared/routes/index.ts`

**Interfaces:**

- Consumes: `defineRoute` from `#shared/routing/index.js`
- Produces: `listSecuritySettingsRoute`, `createSecuritySettingRoute`, `updateSecuritySettingRoute`, `deleteSecuritySettingRoute`

- [ ] **Step 1: Create route definitions**

```ts
// src/shared/routes/settings.ts
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const securitySettingSchema = z.object({
  id: z.string(),
  packageManager: z.string(),
  configFile: z.string(),
  fieldName: z.string(),
  expectedValue: z.string()
});

export const listSecuritySettingsRoute = defineRoute({
  method: "GET",
  path: "/api/settings/security",
  description: "List all security settings",
  params: z.object({}),
  response: z.object({ items: z.array(securitySettingSchema), total: z.number() })
});

export const createSecuritySettingRoute = defineRoute({
  method: "POST",
  path: "/api/settings/security",
  description: "Create a security setting",
  params: z.object({}),
  body: z.object({
    packageManager: z.string(),
    fieldName: z.string(),
    expectedValue: z.string()
  }),
  response: z.object({ item: securitySettingSchema })
});

export const updateSecuritySettingRoute = defineRoute({
  method: "PUT",
  path: "/api/settings/security/:id",
  description: "Update a security setting's expected value",
  params: z.object({ id: z.string() }),
  body: z.object({ expectedValue: z.string() }),
  response: z.object({ item: securitySettingSchema })
});

export const deleteSecuritySettingRoute = defineRoute({
  method: "DELETE",
  path: "/api/settings/security/:id",
  description: "Delete a security setting",
  params: z.object({ id: z.string() })
});
```

- [ ] **Step 2: Add to barrel export**

In `src/shared/routes/index.ts`, add:

```ts
export * from "./settings.js";
```

- [ ] **Step 3: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add src/shared/routes/settings.ts src/shared/routes/index.ts
git commit -m "feat: add shared route definitions for security settings CRUD"
```

---

### Task 6: API route handler — list and create

**Files:**

- Create: `src/api/routes/settings.ts`
- Modify: `src/api/routes/index.ts`
- Modify: `src/api/server.ts`

**Interfaces:**

- Consumes: `listSecuritySettingsRoute`, `createSecuritySettingRoute` from shared routes; `SECURITY_FIELD_REGISTRY` from shared security; `pmSecuritySettings` from DB schema; `DatabaseClient` from DI
- Produces: `settingsRoutes` Fastify plugin

- [ ] **Step 1: Create settings route handler with list + create**

```ts
// src/api/routes/settings.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq, and } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { registerRoute, sendList, sendOne, sendError } from "#shared/routing/index.js";
import { listSecuritySettingsRoute, createSecuritySettingRoute } from "#shared/routes/index.js";
import { SECURITY_FIELD_REGISTRY } from "#shared/security/index.js";
import { DatabaseClient } from "../db/abstractions/DatabaseClient.js";
import { pmSecuritySettings } from "../db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
  container: Container;
}

export async function settingsRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
  const { container } = options;
  const databaseClient = container.resolve(DatabaseClient);

  registerRoute(app, listSecuritySettingsRoute, {}, async (_request, reply) => {
    const rows = await databaseClient.db.select().from(pmSecuritySettings).all();
    sendList(reply, rows);
  });

  registerRoute(app, createSecuritySettingRoute, {}, async (request, reply) => {
    const { packageManager, fieldName, expectedValue } = request.body;

    const fields = SECURITY_FIELD_REGISTRY[packageManager as keyof typeof SECURITY_FIELD_REGISTRY];
    if (!fields) {
      sendError(reply, 400, `Unknown package manager: ${packageManager}`);
      return;
    }

    const fieldDef = fields.find(f => f.fieldName === fieldName);
    if (!fieldDef) {
      sendError(reply, 400, `Unknown field "${fieldName}" for ${packageManager}`);
      return;
    }

    const validation = fieldDef.expectedValueSchema.safeParse(expectedValue);
    if (!validation.success) {
      sendError(reply, 400, validation.error.issues[0]?.message ?? "Invalid expected value");
      return;
    }

    const existing = await databaseClient.db
      .select()
      .from(pmSecuritySettings)
      .where(
        and(
          eq(pmSecuritySettings.packageManager, packageManager),
          eq(pmSecuritySettings.fieldName, fieldName)
        )
      )
      .get();

    if (existing) {
      sendError(reply, 409, `Setting "${fieldName}" already exists for ${packageManager}`);
      return;
    }

    const row = {
      id: generateId(),
      packageManager,
      configFile: fieldDef.configFile,
      fieldName,
      expectedValue
    };

    await databaseClient.db.insert(pmSecuritySettings).values(row).run();
    sendOne(reply, row, 201);
  });
}
```

- [ ] **Step 2: Register in route barrel and server**

In `src/api/routes/index.ts`, add:

```ts
export { settingsRoutes } from "./settings.js";
```

In `src/api/server.ts`, add import and registration:

```ts
// Add to imports:
import { settingsRoutes } from "./routes/index.js";

// Add after cacheRoutes registration:
await app.register(settingsRoutes, { container });
```

- [ ] **Step 3: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/settings.ts src/api/routes/index.ts src/api/server.ts
git commit -m "feat: add settings API routes — list and create"
```

---

### Task 7: API route handler — update and delete

**Files:**

- Modify: `src/api/routes/settings.ts`

**Interfaces:**

- Consumes: `updateSecuritySettingRoute`, `deleteSecuritySettingRoute` from shared routes
- Produces: PUT and DELETE handlers added to `settingsRoutes`

- [ ] **Step 1: Add update and delete route imports**

In `src/api/routes/settings.ts`, update the imports:

```ts
import {
  listSecuritySettingsRoute,
  createSecuritySettingRoute,
  updateSecuritySettingRoute,
  deleteSecuritySettingRoute
} from "#shared/routes/index.js";
```

Also add `sendNone` to the routing import:

```ts
import { registerRoute, sendList, sendOne, sendNone, sendError } from "#shared/routing/index.js";
```

- [ ] **Step 2: Add update handler inside settingsRoutes function**

```ts
registerRoute(app, updateSecuritySettingRoute, {}, async (request, reply) => {
  const { id } = request.params;
  const { expectedValue } = request.body;

  const existing = await databaseClient.db
    .select()
    .from(pmSecuritySettings)
    .where(eq(pmSecuritySettings.id, id))
    .get();

  if (!existing) {
    sendError(reply, 404, "Setting not found");
    return;
  }

  const fields =
    SECURITY_FIELD_REGISTRY[existing.packageManager as keyof typeof SECURITY_FIELD_REGISTRY];
  const fieldDef = fields?.find(f => f.fieldName === existing.fieldName);

  if (fieldDef) {
    const validation = fieldDef.expectedValueSchema.safeParse(expectedValue);
    if (!validation.success) {
      sendError(reply, 400, validation.error.issues[0]?.message ?? "Invalid expected value");
      return;
    }
  }

  await databaseClient.db
    .update(pmSecuritySettings)
    .set({ expectedValue })
    .where(eq(pmSecuritySettings.id, id))
    .run();

  sendOne(reply, { ...existing, expectedValue });
});
```

- [ ] **Step 3: Add delete handler inside settingsRoutes function**

```ts
registerRoute(app, deleteSecuritySettingRoute, {}, async (request, reply) => {
  const { id } = request.params;

  const existing = await databaseClient.db
    .select()
    .from(pmSecuritySettings)
    .where(eq(pmSecuritySettings.id, id))
    .get();

  if (!existing) {
    sendError(reply, 404, "Setting not found");
    return;
  }

  await databaseClient.db.delete(pmSecuritySettings).where(eq(pmSecuritySettings.id, id)).run();

  sendNone(reply);
});
```

- [ ] **Step 4: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/settings.ts
git commit -m "feat: add settings API routes — update and delete"
```

---

### Task 8: API route tests

**Files:**

- Create: `src/api/routes/__tests__/settings.test.ts`

**Interfaces:**

- Consumes: all 4 route definitions, `createTestDb`, `seedYarnSecuritySettings`
- Produces: test suite covering CRUD + validation + error cases

- [ ] **Step 1: Create test file**

Follow the pattern from `src/api/routes/__tests__/projects.test.ts`. The test creates a Fastify app, registers `settingsRoutes` with an in-memory DB container, and exercises all 4 routes.

```ts
// src/api/routes/__tests__/settings.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { seedYarnSecuritySettings } from "#testing/helpers/seedYarnSecuritySettings.js";
import { DatabaseClient } from "../../db/abstractions/DatabaseClient.js";
import { settingsRoutes } from "../settings.js";

describe("settings routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const db = await createTestDb();
    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });

    app = Fastify();
    await app.register(settingsRoutes, { container });
  });

  describe("GET /api/settings/security", () => {
    it("returns empty list when no settings exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/settings/security"
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items).toEqual([]);
      expect(body.total).toBe(0);
    });

    it("returns seeded settings", async () => {
      const db = (app.server as any).__testDb ?? (await createTestDb());
      // Re-create with seeded data
      const seededDb = await createTestDb();
      await seedYarnSecuritySettings(seededDb);
      const container = createContainer();
      container.registerInstance(DatabaseClient, { db: seededDb });
      const seededApp = Fastify();
      await seededApp.register(settingsRoutes, { container });

      const response = await seededApp.inject({
        method: "GET",
        url: "/api/settings/security"
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items).toHaveLength(4);
      expect(body.total).toBe(4);
    });
  });

  describe("POST /api/settings/security", () => {
    it("creates a setting for a known PM and field", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/settings/security",
        payload: {
          packageManager: "yarn",
          fieldName: "enableScripts",
          expectedValue: "false"
        }
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.item.packageManager).toBe("yarn");
      expect(body.item.fieldName).toBe("enableScripts");
      expect(body.item.configFile).toBe(".yarnrc.yml");
      expect(body.item.expectedValue).toBe("false");
      expect(body.item.id).toBeDefined();
    });

    it("returns 400 for unknown package manager", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/settings/security",
        payload: {
          packageManager: "bun",
          fieldName: "foo",
          expectedValue: "bar"
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for unknown field name", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/settings/security",
        payload: {
          packageManager: "yarn",
          fieldName: "nonExistentField",
          expectedValue: "bar"
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for invalid expected value", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/settings/security",
        payload: {
          packageManager: "yarn",
          fieldName: "enableScripts",
          expectedValue: "maybe"
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 409 for duplicate setting", async () => {
      await app.inject({
        method: "POST",
        url: "/api/settings/security",
        payload: {
          packageManager: "yarn",
          fieldName: "enableScripts",
          expectedValue: "false"
        }
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/settings/security",
        payload: {
          packageManager: "yarn",
          fieldName: "enableScripts",
          expectedValue: "true"
        }
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe("PUT /api/settings/security/:id", () => {
    it("updates the expected value of an existing setting", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/settings/security",
        payload: {
          packageManager: "yarn",
          fieldName: "enableScripts",
          expectedValue: "false"
        }
      });
      const { id } = createResponse.json().item;

      const response = await app.inject({
        method: "PUT",
        url: `/api/settings/security/${id}`,
        payload: { expectedValue: "true" }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().item.expectedValue).toBe("true");
    });

    it("returns 404 for unknown id", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/settings/security/nonexistent",
        payload: { expectedValue: "true" }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/settings/security/:id", () => {
    it("deletes an existing setting", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/settings/security",
        payload: {
          packageManager: "yarn",
          fieldName: "enableScripts",
          expectedValue: "false"
        }
      });
      const { id } = createResponse.json().item;

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/api/settings/security/${id}`
      });

      expect(deleteResponse.statusCode).toBe(204);

      const listResponse = await app.inject({
        method: "GET",
        url: "/api/settings/security"
      });
      expect(listResponse.json().items).toHaveLength(0);
    });

    it("returns 404 for unknown id", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/settings/security/nonexistent"
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `yarn test src/api/routes/__tests__/settings.test.ts`
Expected: all tests pass

- [ ] **Step 3: Run full pipeline**

Run: `yarn full`
Expected: all green

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/__tests__/settings.test.ts
git commit -m "test: add settings API route tests"
```
