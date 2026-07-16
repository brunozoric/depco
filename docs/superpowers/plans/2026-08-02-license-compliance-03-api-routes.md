# License Compliance Part 3: API Routes and Shared Route Definitions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create shared route definitions (Zod schemas) and Fastify route handlers for licenses, policy rules, and violations.

**Architecture:** Shared route definitions in `src/shared/routes/licenses.ts` using `defineRoute()` pattern. API route handlers in `src/api/routes/licenses.ts` and `src/api/routes/licensePolicies.ts`. Routes registered in server.ts and re-exported from shared routes index.

**Tech Stack:** TypeScript, Fastify, Zod, Drizzle ORM

## Global Constraints

- Use full words in identifiers
- Named interfaces only
- Fixed path segments registered before parametrized routes
- Follow existing `registerRoute()` pattern from vulnerability routes
- Real SQLite in-memory for tests

---

### Task 6: Shared Route Definitions

**Files:**

- Create: `src/shared/routes/licenses.ts`
- Modify: `src/shared/routes/index.ts` (add re-export)

**Interfaces:**

- Consumes: `defineRoute` from `#shared/routing/index.js`, `RISK_TIER_VALUES` and `LICENSE_POLICY_ACTIONS` from Task 1
- Produces: Route constants: `listLicensesRoute`, `getLicenseSummaryRoute`, `getProjectLicensesRoute`, `scanProjectLicensesRoute`, `listLicensePoliciesRoute`, `createLicensePolicyRoute`, `updateLicensePolicyRoute`, `deleteLicensePolicyRoute`, `listLicenseViolationsRoute`, `getLicenseViolationsSummaryRoute`

- [ ] **Step 1: Create shared route definitions**

Create `src/shared/routes/licenses.ts`:

```typescript
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import { RISK_TIER_VALUES, LICENSE_POLICY_ACTIONS } from "#shared/licenses/types.js";

const licenseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  packageName: z.string(),
  licenseName: z.string(),
  spdxId: z.string().nullable(),
  source: z.enum(["registry", "license-checker"]),
  riskTier: z.enum(RISK_TIER_VALUES),
  licenseUrl: z.string().nullable(),
  scannedAt: z.number()
});

const policyRuleSchema = z.object({
  id: z.string(),
  action: z.enum(LICENSE_POLICY_ACTIONS),
  licensePattern: z.string().nullable(),
  packagePattern: z.string().nullable(),
  projectId: z.string().nullable(),
  priority: z.number(),
  reason: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number()
});

const violationSchema = z.object({
  id: z.string(),
  licenseId: z.string(),
  ruleId: z.string(),
  projectId: z.string(),
  packageName: z.string(),
  action: z.enum(["warn", "deny"]),
  scannedAt: z.number()
});

export const listLicensesRoute = defineRoute({
  method: "GET",
  path: "/api/licenses",
  description: "List all licenses across projects",
  params: z.object({}),
  querystring: z.object({
    projectId: z.string().optional(),
    riskTier: z.string().optional(),
    spdxId: z.string().optional(),
    packageName: z.string().optional()
  }),
  response: z.object({ items: z.array(licenseSchema), total: z.number() })
});

export const getLicenseSummaryRoute = defineRoute({
  method: "GET",
  path: "/api/licenses/summary",
  description: "Get license compliance summary",
  params: z.object({}),
  response: z.object({
    totalPackages: z.number(),
    compliantPercent: z.number(),
    riskTierCounts: z.object({
      permissive: z.number(),
      "weak-copyleft": z.number(),
      copyleft: z.number(),
      proprietary: z.number(),
      unknown: z.number()
    }),
    violationCounts: z.object({
      warn: z.number(),
      deny: z.number()
    }),
    projectSummaries: z.array(
      z.object({
        projectId: z.string(),
        projectName: z.string(),
        total: z.number(),
        denied: z.number(),
        warned: z.number()
      })
    )
  })
});

export const getProjectLicensesRoute = defineRoute({
  method: "GET",
  path: "/api/licenses/:projectId",
  description: "List licenses for a specific project",
  params: z.object({ projectId: z.string() }),
  querystring: z.object({
    riskTier: z.string().optional(),
    packageName: z.string().optional()
  }),
  response: z.object({ items: z.array(licenseSchema), total: z.number() })
});

export const scanProjectLicensesRoute = defineRoute({
  method: "POST",
  path: "/api/licenses/:projectId/scan",
  description: "Trigger license scan for a project",
  params: z.object({ projectId: z.string() }),
  response: z.object({ jobId: z.string() })
});

export const listLicensePoliciesRoute = defineRoute({
  method: "GET",
  path: "/api/license-policies",
  description: "List all license policy rules",
  params: z.object({}),
  querystring: z.object({
    projectId: z.string().optional()
  }),
  response: z.object({ items: z.array(policyRuleSchema) })
});

export const createLicensePolicyRoute = defineRoute({
  method: "POST",
  path: "/api/license-policies",
  description: "Create a license policy rule",
  params: z.object({}),
  body: z.object({
    action: z.enum(LICENSE_POLICY_ACTIONS),
    licensePattern: z.string().nullable().optional(),
    packagePattern: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    priority: z.number(),
    reason: z.string().nullable().optional()
  }),
  response: policyRuleSchema
});

export const updateLicensePolicyRoute = defineRoute({
  method: "PUT",
  path: "/api/license-policies/:id",
  description: "Update a license policy rule",
  params: z.object({ id: z.string() }),
  body: z.object({
    action: z.enum(LICENSE_POLICY_ACTIONS).optional(),
    licensePattern: z.string().nullable().optional(),
    packagePattern: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    priority: z.number().optional(),
    reason: z.string().nullable().optional()
  }),
  response: policyRuleSchema
});

export const deleteLicensePolicyRoute = defineRoute({
  method: "DELETE",
  path: "/api/license-policies/:id",
  description: "Delete a license policy rule",
  params: z.object({ id: z.string() }),
  response: z.object({ deleted: z.boolean() })
});

export const listLicenseViolationsRoute = defineRoute({
  method: "GET",
  path: "/api/license-violations",
  description: "List license violations",
  params: z.object({}),
  querystring: z.object({
    projectId: z.string().optional(),
    action: z.string().optional(),
    packageName: z.string().optional()
  }),
  response: z.object({ items: z.array(violationSchema), total: z.number() })
});

export const getLicenseViolationsSummaryRoute = defineRoute({
  method: "GET",
  path: "/api/license-violations/summary",
  description: "Get license violations summary",
  params: z.object({}),
  response: z.object({
    total: z.number(),
    warnCount: z.number(),
    denyCount: z.number(),
    byProject: z.array(
      z.object({
        projectId: z.string(),
        projectName: z.string(),
        warnCount: z.number(),
        denyCount: z.number()
      })
    )
  })
});
```

- [ ] **Step 2: Add re-export to shared routes index**

In `src/shared/routes/index.ts`, add:

```typescript
export * from "./licenses.js";
```

- [ ] **Step 3: Verify build**

Run: `yarn build`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/shared/routes/licenses.ts src/shared/routes/index.ts
git commit -m "feat(licenses): add shared route definitions for licenses, policies, and violations"
```

---

### Task 7: License and Violation Route Handlers

**Files:**

- Create: `src/api/routes/licenses.ts`
- Modify: `src/api/server.ts` (register license routes)

**Interfaces:**

- Consumes: Route constants from Task 6, `DatabaseClient.Interface`, `JobWorker.Interface`, `licenses`/`licenseViolations`/`projects` tables
- Produces: Fastify route plugin `licenseRoutes`

- [ ] **Step 1: Create license routes**

Create `src/api/routes/licenses.ts` following the vulnerability routes pattern. Implement handlers for:

- `GET /api/licenses` — query `licenses` table with optional filters (projectId, riskTier, spdxId, packageName via LIKE)
- `GET /api/licenses/summary` — aggregate licenses by risk tier, join violations for counts, join projects for names. Registered BEFORE `/:projectId`
- `GET /api/licenses/:projectId` — filter licenses by projectId
- `POST /api/licenses/:projectId/scan` — enqueue `license-scan` job via `JobWorker`
- `GET /api/license-violations` — query violations with optional filters
- `GET /api/license-violations/summary` — aggregate violations by project with counts. Registered BEFORE any parametrized violation routes

Use `registerRoute()`, `sendList()`, `sendError()` from `#shared/routing/index.js`. Resolve `DatabaseClient`, `JobWorker` from container.

- [ ] **Step 2: Register in server.ts**

In `src/api/server.ts`:

1. Import `licenseRoutes` from `#api/routes/licenses.js`
2. Add `await app.register(licenseRoutes, { container });` after the vulnerability routes registration

- [ ] **Step 3: Verify build**

Run: `yarn build`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/licenses.ts src/api/server.ts
git commit -m "feat(licenses): add license and violation route handlers"
```

---

### Task 8: License Policy Route Handlers

**Files:**

- Create: `src/api/routes/licensePolicies.ts`
- Modify: `src/api/server.ts` (register policy routes)

**Interfaces:**

- Consumes: Policy route constants from Task 6, `DatabaseClient.Interface`, `licensePolicyRules` table
- Produces: Fastify route plugin `licensePolicyRoutes`

- [ ] **Step 1: Create policy routes**

Create `src/api/routes/licensePolicies.ts` implementing CRUD:

- `GET /api/license-policies` — list all rules, optional `projectId` filter (null = global only)
- `POST /api/license-policies` — create rule with `generateId()`, set `createdAt`/`updatedAt` to `Date.now()`
- `PUT /api/license-policies/:id` — partial update, set `updatedAt` to `Date.now()`, return 404 if not found
- `DELETE /api/license-policies/:id` — delete by id, CASCADE handles violations, return `{ deleted: true }`

- [ ] **Step 2: Register in server.ts**

Add `await app.register(licensePolicyRoutes, { container });` after license routes.

- [ ] **Step 3: Write route integration tests**

Create `src/api/routes/__tests__/licenses.test.ts` with tests covering:

1. GET `/api/licenses` returns empty initially
2. POST `/api/license-policies` creates a rule, GET returns it
3. PUT `/api/license-policies/:id` updates a rule
4. DELETE `/api/license-policies/:id` removes rule and its violations
5. GET `/api/licenses/summary` returns correct aggregates
6. POST `/api/licenses/:projectId/scan` returns jobId

Follow existing route test patterns — use real in-memory DB, create test Fastify instance.

- [ ] **Step 4: Run all tests**

Run: `yarn test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/licensePolicies.ts src/api/server.ts src/api/routes/__tests__/licenses.test.ts
git commit -m "feat(licenses): add policy CRUD routes and integration tests"
```
