# Dashboard Routes — Activity, Staleness, Security — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add route definitions and API handlers for the three widget endpoints: recent activity, scan freshness, and security overview.

**Architecture:** Additional route definitions in `src/shared/routes/dashboard.ts`. Handlers added to existing `src/api/routes/dashboard.ts`. All read from existing tables (no new tables).

**Tech Stack:** Fastify, Drizzle ORM, Zod, Vitest

## Global Constraints

- Yarn 4, not npm
- oxlint for linting, oxfmt for formatting
- Named interfaces only, no inline structural types
- API tests use in-memory SQLite, real services, mock only CommandRunner
- Path aliases: `#api/*`, `#shared/*`, `#testing/*`

## Prerequisite

Plan 02 (health/trend routes) must be completed first — route file and registration already exist.

---

### Task 1: Activity, staleness, and security route definitions

**Files:**

- Modify: `src/shared/routes/dashboard.ts` (add 3 more route definitions)
- Modify: `src/shared/routes/index.ts` (add re-exports)

**Interfaces:**

- Produces: `dashboardActivityRoute`, `dashboardStalenessRoute`, `dashboardSecurityRoute`

- [ ] **Step 1: Add route definitions**

Append to `src/shared/routes/dashboard.ts`:

```typescript
const activityJobSchema = z.object({
  id: z.string(),
  type: z.string(),
  referenceId: z.string(),
  referenceType: z.string(),
  status: z.string(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable()
});

export const dashboardActivityRoute = defineRoute({
  method: "GET",
  path: "/api/dashboard/activity",
  description: "Get recent jobs across all projects",
  params: z.object({}),
  response: z.object({
    items: z.array(activityJobSchema)
  })
});

const stalenessProjectSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  lastScannedAt: z.number().nullable()
});

export const dashboardStalenessRoute = defineRoute({
  method: "GET",
  path: "/api/dashboard/staleness",
  description: "Get projects sorted by scan freshness",
  params: z.object({}),
  response: z.object({
    items: z.array(stalenessProjectSchema)
  })
});

const securityProjectSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  totalChecks: z.number(),
  passingChecks: z.number()
});

export const dashboardSecurityRoute = defineRoute({
  method: "GET",
  path: "/api/dashboard/security",
  description: "Get aggregate security check results per project",
  params: z.object({}),
  response: z.object({
    items: z.array(securityProjectSchema)
  })
});
```

- [ ] **Step 2: Add re-exports in index**

Add to `src/shared/routes/index.ts`:

```typescript
export {
  dashboardActivityRoute,
  dashboardStalenessRoute,
  dashboardSecurityRoute
} from "./dashboard.js";
```

Update the existing dashboard re-export line to include these, or add a second export line.

- [ ] **Step 3: Verify build passes**

Run: `yarn build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/shared/routes/dashboard.ts src/shared/routes/index.ts
git commit -m "feat: add dashboard activity, staleness, security route definitions"
```

---

### Task 2: API handlers for activity, staleness, and security

**Files:**

- Modify: `src/api/routes/dashboard.ts` (add 3 more handlers)
- Modify: `src/api/routes/__tests__/dashboard.test.ts` (add tests)

**Interfaces:**

- Consumes: Route definitions from Task 1; `upgradeJobs`, `projects`, `securityChecks` from schema

- [ ] **Step 1: Write failing tests for activity endpoint**

Add to `src/api/routes/__tests__/dashboard.test.ts`:

```typescript
describe("GET /api/dashboard/activity", () => {
  it("should return recent jobs sorted by startedAt descending", async () => {
    const project = { id: generateId(), name: "project-a", path: "/a", addedAt: Date.now() };
    await db.insert(projects).values(project).run();

    await db
      .insert(upgradeJobs)
      .values([
        {
          id: generateId(),
          referenceId: project.id,
          referenceType: "project",
          type: "scan",
          status: "completed",
          startedAt: 1000,
          completedAt: 2000
        },
        {
          id: generateId(),
          referenceId: project.id,
          referenceType: "project",
          type: "dependency",
          status: "completed",
          startedAt: 3000,
          completedAt: 4000
        }
      ])
      .run();

    const response = await app.inject({ method: "GET", url: "/api/dashboard/activity" });
    const body = JSON.parse(response.body);

    expect(body.items).toHaveLength(2);
    expect(body.items[0].startedAt).toBe(3000);
  });

  it("should limit to 20 jobs", async () => {
    const project = { id: generateId(), name: "project-a", path: "/a", addedAt: Date.now() };
    await db.insert(projects).values(project).run();

    const jobs = Array.from({ length: 25 }, (_, i) => ({
      id: generateId(),
      referenceId: project.id,
      referenceType: "project",
      type: "scan",
      status: "completed",
      startedAt: i * 1000,
      completedAt: i * 1000 + 500
    }));
    await db.insert(upgradeJobs).values(jobs).run();

    const response = await app.inject({ method: "GET", url: "/api/dashboard/activity" });
    const body = JSON.parse(response.body);

    expect(body.items).toHaveLength(20);
  });
});
```

Import `upgradeJobs` from `#api/db/schema.js`.

- [ ] **Step 2: Write failing tests for staleness endpoint**

```typescript
describe("GET /api/dashboard/staleness", () => {
  it("should return projects sorted by lastScannedAt ascending with nulls first", async () => {
    await db
      .insert(projects)
      .values([
        {
          id: generateId(),
          name: "recent",
          path: "/recent",
          addedAt: Date.now(),
          lastScannedAt: Date.now()
        },
        {
          id: generateId(),
          name: "never-scanned",
          path: "/never",
          addedAt: Date.now(),
          lastScannedAt: null
        },
        { id: generateId(), name: "old", path: "/old", addedAt: Date.now(), lastScannedAt: 1000 }
      ])
      .run();

    const response = await app.inject({ method: "GET", url: "/api/dashboard/staleness" });
    const body = JSON.parse(response.body);

    expect(body.items[0].projectName).toBe("never-scanned");
    expect(body.items[0].lastScannedAt).toBeNull();
    expect(body.items[1].projectName).toBe("old");
  });
});
```

- [ ] **Step 3: Write failing tests for security endpoint**

```typescript
describe("GET /api/dashboard/security", () => {
  it("should return aggregate security results sorted by passing ratio ascending", async () => {
    const projectA = { id: generateId(), name: "project-a", path: "/a", addedAt: Date.now() };
    const projectB = { id: generateId(), name: "project-b", path: "/b", addedAt: Date.now() };
    await db.insert(projects).values([projectA, projectB]).run();

    await db
      .insert(securityChecks)
      .values([
        {
          id: generateId(),
          projectId: projectA.id,
          checkedAt: Date.now(),
          results: JSON.stringify([{ pass: true }, { pass: true }, { pass: false }]),
          passes: 2
        },
        {
          id: generateId(),
          projectId: projectB.id,
          checkedAt: Date.now(),
          results: JSON.stringify([{ pass: true }, { pass: true }]),
          passes: 2
        }
      ])
      .run();

    const response = await app.inject({ method: "GET", url: "/api/dashboard/security" });
    const body = JSON.parse(response.body);

    expect(body.items).toHaveLength(2);
  });
});
```

Import `securityChecks` from `#api/db/schema.js`.

- [ ] **Step 4: Run tests to verify they fail**

Run: `yarn test src/api/routes/__tests__/dashboard.test.ts`
Expected: FAIL (handlers not implemented)

- [ ] **Step 5: Implement activity handler**

Add to `src/api/routes/dashboard.ts`, import `upgradeJobs` from schema:

```typescript
import {
  dashboardActivityRoute,
  dashboardStalenessRoute,
  dashboardSecurityRoute
} from "#shared/routes/index.js";
import { upgradeJobs, securityChecks } from "#api/db/schema.js";
```

Add interface and handler:

```typescript
interface IRawActivityRow {
  id: string;
  type: string;
  referenceId: string;
  referenceType: string;
  status: string;
  startedAt: number | null;
  completedAt: number | null;
}

registerRoute(app, dashboardActivityRoute, {}, async (_request, reply) => {
  const rows = await db.all<IRawActivityRow>(sql`
        SELECT
            id, type, reference_id AS referenceId, reference_type AS referenceType,
            status, started_at AS startedAt, completed_at AS completedAt
        FROM upgrade_jobs
        ORDER BY started_at DESC
        LIMIT 20
    `);

  reply.send({ items: rows });
});
```

- [ ] **Step 6: Implement staleness handler**

```typescript
interface IRawStalenessRow {
  projectId: string;
  projectName: string;
  lastScannedAt: number | null;
}

registerRoute(app, dashboardStalenessRoute, {}, async (_request, reply) => {
  const rows = await db.all<IRawStalenessRow>(sql`
        SELECT
            id AS projectId,
            name AS projectName,
            last_scanned_at AS lastScannedAt
        FROM projects
        ORDER BY
            CASE WHEN last_scanned_at IS NULL THEN 0 ELSE 1 END ASC,
            last_scanned_at ASC
    `);

  reply.send({ items: rows });
});
```

- [ ] **Step 7: Implement security handler**

The security checks table stores `results` as a JSON string and `passes` as an integer. To compute total checks, parse the results JSON array length. Use the latest check per project:

```typescript
interface IRawSecurityRow {
  projectId: string;
  projectName: string;
  totalChecks: number;
  passingChecks: number;
}

registerRoute(app, dashboardSecurityRoute, {}, async (_request, reply) => {
  const rows = await db.all<IRawSecurityRow>(sql`
        SELECT
            sc.project_id AS projectId,
            p.name AS projectName,
            json_array_length(sc.results) AS totalChecks,
            sc.passes AS passingChecks
        FROM security_checks sc
        INNER JOIN projects p ON sc.project_id = p.id
        WHERE sc.checked_at = (
            SELECT MAX(sc2.checked_at)
            FROM security_checks sc2
            WHERE sc2.project_id = sc.project_id
        )
        ORDER BY
            CASE WHEN json_array_length(sc.results) = 0 THEN 2
            ELSE CAST(sc.passes AS REAL) / json_array_length(sc.results) END ASC
    `);

  reply.send({ items: rows });
});
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `yarn test src/api/routes/__tests__/dashboard.test.ts`
Expected: PASS

- [ ] **Step 9: Run full test suite**

Run: `yarn test`
Expected: All PASS

- [ ] **Step 10: Lint and format**

Run: `yarn lint:fix && yarn format:fix`

- [ ] **Step 11: Commit**

```bash
git add src/api/routes/dashboard.ts src/api/routes/__tests__/dashboard.test.ts
git commit -m "feat: add dashboard activity, staleness, security API endpoints"
```
