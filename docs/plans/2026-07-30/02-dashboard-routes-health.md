# Dashboard Routes — Health & Trend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add route definitions and API handlers for the health and trend dashboard endpoints.

**Architecture:** Shared Zod-validated route definitions in `src/shared/routes/dashboard.ts`. Route handlers in `src/api/routes/dashboard.ts`. Both endpoints query `health_snapshots` table with joins to `projects`.

**Tech Stack:** Fastify, Drizzle ORM, Zod, Vitest

## Global Constraints

- Yarn 4, not npm
- oxlint for linting, oxfmt for formatting
- Named interfaces only, no inline structural types
- API tests use in-memory SQLite, real services, mock only CommandRunner
- Path aliases: `#api/*`, `#shared/*`, `#testing/*`
- Route definitions use `defineRoute` from `#shared/routing/index.js`
- Response helpers: `sendOne`, `sendList` from `#shared/routing/index.js`

## Prerequisite

Plan 01 (schema + snapshot) must be completed first.

---

### Task 1: Route definitions for health and trend

**Files:**

- Create: `src/shared/routes/dashboard.ts`
- Modify: `src/shared/routes/index.ts` (add re-export)

**Interfaces:**

- Produces: `dashboardHealthRoute`, `dashboardTrendRoute` used by plan 02 Task 2 and plan 04

- [ ] **Step 1: Create route definitions**

Create `src/shared/routes/dashboard.ts`:

```typescript
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const healthProjectSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  score: z.number(),
  scoreDelta: z.number().nullable(),
  totalPackages: z.number(),
  upToDate: z.number(),
  patchOutdated: z.number(),
  minorOutdated: z.number(),
  majorOutdated: z.number(),
  lastScannedAt: z.number().nullable()
});

const worstProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number()
});

const healthSummarySchema = z.object({
  totalProjects: z.number(),
  averageScore: z.number(),
  worstProject: worstProjectSchema.nullable()
});

export const dashboardHealthRoute = defineRoute({
  method: "GET",
  path: "/api/dashboard/health",
  description: "Get current health snapshot per project",
  params: z.object({}),
  response: z.object({
    summary: healthSummarySchema,
    projects: z.array(healthProjectSchema)
  })
});

const trendSnapshotSchema = z.object({
  date: z.string(),
  score: z.number()
});

const trendProjectSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  snapshots: z.array(trendSnapshotSchema)
});

export const dashboardTrendRoute = defineRoute({
  method: "GET",
  path: "/api/dashboard/health/trend",
  description: "Get historical health snapshots for trend chart",
  params: z.object({}),
  querystring: z.object({
    range: z.enum(["7d", "30d", "90d", "all"]).optional()
  }),
  response: z.object({
    items: z.array(trendProjectSchema)
  })
});
```

- [ ] **Step 2: Add re-export in index**

Add to `src/shared/routes/index.ts`:

```typescript
export { dashboardHealthRoute, dashboardTrendRoute } from "./dashboard.js";
```

- [ ] **Step 3: Verify build passes**

Run: `yarn build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/shared/routes/dashboard.ts src/shared/routes/index.ts
git commit -m "feat: add dashboard health and trend route definitions"
```

---

### Task 2: API handlers for health and trend

**Files:**

- Create: `src/api/routes/dashboard.ts`
- Modify: `src/api/routes/index.ts` (register dashboard routes)
- Create: `src/api/routes/__tests__/dashboard.test.ts`

**Interfaces:**

- Consumes: `dashboardHealthRoute`, `dashboardTrendRoute` from Task 1; `healthSnapshots`, `projects`, `scanResults` from schema
- Produces: `dashboardRoutes` plugin function registered in route index

- [ ] **Step 1: Write failing test — health endpoint returns empty on no data**

Create `src/api/routes/__tests__/dashboard.test.ts`. Follow the exact setup pattern from `src/api/routes/__tests__/packages.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { generateId } from "@webiny/stdlib";
import { projects, healthSnapshots } from "#api/db/schema.js";
import { dashboardRoutes } from "../dashboard.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

describe("Dashboard Routes", () => {
  let db: TestDb;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = await createTestDb();
    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
    app = Fastify();
    await app.register(dashboardRoutes, { container });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/dashboard/health", () => {
    it("should return empty summary when no projects exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/dashboard/health"
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.summary.totalProjects).toBe(0);
      expect(body.summary.averageScore).toBe(0);
      expect(body.summary.worstProject).toBeNull();
      expect(body.projects).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/api/routes/__tests__/dashboard.test.ts`
Expected: FAIL (route not registered)

- [ ] **Step 3: Create dashboard route handler**

Create `src/api/routes/dashboard.ts`:

```typescript
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { sql } from "drizzle-orm";
import { registerRoute } from "#shared/routing/index.js";
import { dashboardHealthRoute, dashboardTrendRoute } from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { healthSnapshots, projects } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
  container: Container;
}

interface IRawHealthRow {
  projectId: string;
  projectName: string;
  score: number;
  totalPackages: number;
  upToDate: number;
  patchOutdated: number;
  minorOutdated: number;
  majorOutdated: number;
  lastScannedAt: number | null;
  prevScore: number | null;
}

interface IRawTrendRow {
  projectId: string;
  projectName: string;
  date: string;
  score: number;
}

interface ITrendSnapshot {
  date: string;
  score: number;
}

interface ITrendGroupItem {
  projectId: string;
  projectName: string;
  snapshots: ITrendSnapshot[];
}

const RANGE_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90
};

export async function dashboardRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
  const { container } = options;
  const databaseClient = container.resolve(DatabaseClient);
  const { db } = databaseClient;

  registerRoute(app, dashboardHealthRoute, {}, async (_request, reply) => {
    const rows = await db.all<IRawHealthRow>(sql`
            SELECT
                hs.project_id AS projectId,
                p.name AS projectName,
                hs.score,
                hs.total_packages AS totalPackages,
                hs.up_to_date AS upToDate,
                hs.patch_outdated AS patchOutdated,
                hs.minor_outdated AS minorOutdated,
                hs.major_outdated AS majorOutdated,
                p.last_scanned_at AS lastScannedAt,
                prev.score AS prevScore
            FROM health_snapshots hs
            INNER JOIN projects p ON hs.project_id = p.id
            LEFT JOIN health_snapshots prev ON prev.project_id = hs.project_id
                AND prev.date = (
                    SELECT MAX(h2.date) FROM health_snapshots h2
                    WHERE h2.project_id = hs.project_id
                    AND h2.date <= DATE(hs.date, '-7 days')
                )
            WHERE hs.date = (
                SELECT MAX(h3.date) FROM health_snapshots h3
                WHERE h3.project_id = hs.project_id
            )
            ORDER BY hs.score ASC
        `);

    const projectList = rows.map(row => ({
      projectId: row.projectId,
      projectName: row.projectName,
      score: row.score,
      scoreDelta: row.prevScore !== null ? row.score - row.prevScore : null,
      totalPackages: row.totalPackages,
      upToDate: row.upToDate,
      patchOutdated: row.patchOutdated,
      minorOutdated: row.minorOutdated,
      majorOutdated: row.majorOutdated,
      lastScannedAt: row.lastScannedAt
    }));

    const totalProjects = projectList.length;

    const averageScore =
      totalProjects > 0
        ? Math.round(projectList.reduce((sum, p) => sum + p.score, 0) / totalProjects)
        : 0;

    const worstProject =
      projectList.length > 0
        ? {
            id: projectList[0]!.projectId,
            name: projectList[0]!.projectName,
            score: projectList[0]!.score
          }
        : null;

    reply.send({
      summary: { totalProjects, averageScore, worstProject },
      projects: projectList
    });
  });

  registerRoute(app, dashboardTrendRoute, {}, async (request, reply) => {
    const range = request.query.range ?? "30d";
    const days = RANGE_DAYS[range];

    const modifier = `-${days} days`;
    const dateFilter = days ? sql`AND hs.date >= DATE('now', ${modifier})` : sql``;

    const rows = await db.all<IRawTrendRow>(sql`
            SELECT
                hs.project_id AS projectId,
                p.name AS projectName,
                hs.date,
                hs.score
            FROM health_snapshots hs
            INNER JOIN projects p ON hs.project_id = p.id
            WHERE 1=1 ${dateFilter}
            ORDER BY p.name ASC, hs.date ASC
        `);

    const grouped = new Map<string, ITrendGroupItem>();
    for (const row of rows) {
      let entry = grouped.get(row.projectId);
      if (!entry) {
        entry = { projectId: row.projectId, projectName: row.projectName, snapshots: [] };
        grouped.set(row.projectId, entry);
      }
      entry.snapshots.push({ date: row.date, score: row.score });
    }

    reply.send({ items: Array.from(grouped.values()) });
  });
}
```

- [ ] **Step 4: Register dashboard routes**

In `src/api/routes/index.ts`, import and register:

```typescript
import { dashboardRoutes } from "./dashboard.js";
```

Add to the route registration list following the existing pattern (look at how other routes like `packagesRoutes` are registered).

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/api/routes/__tests__/dashboard.test.ts`
Expected: PASS

- [ ] **Step 6: Write additional tests**

Add more test cases for the health endpoint:

```typescript
it("should return project health sorted by score ascending", async () => {
  const projectA = { id: generateId(), name: "project-a", path: "/a", addedAt: Date.now() };
  const projectB = { id: generateId(), name: "project-b", path: "/b", addedAt: Date.now() };
  await db.insert(projects).values([projectA, projectB]).run();

  const today = new Date().toISOString().slice(0, 10);
  await db
    .insert(healthSnapshots)
    .values([
      {
        id: generateId(),
        projectId: projectA.id,
        date: today,
        score: 90,
        totalPackages: 10,
        upToDate: 9,
        patchOutdated: 1,
        minorOutdated: 0,
        majorOutdated: 0,
        scannedAt: Date.now()
      },
      {
        id: generateId(),
        projectId: projectB.id,
        date: today,
        score: 50,
        totalPackages: 10,
        upToDate: 5,
        patchOutdated: 2,
        minorOutdated: 2,
        majorOutdated: 1,
        scannedAt: Date.now()
      }
    ])
    .run();

  const response = await app.inject({ method: "GET", url: "/api/dashboard/health" });
  const body = JSON.parse(response.body);

  expect(body.projects[0].projectName).toBe("project-b");
  expect(body.projects[1].projectName).toBe("project-a");
  expect(body.summary.worstProject.name).toBe("project-b");
  expect(body.summary.averageScore).toBe(70);
});
```

Add trend endpoint tests:

```typescript
describe("GET /api/dashboard/health/trend", () => {
  it("should return snapshots within range", async () => {
    const project = { id: generateId(), name: "project-a", path: "/a", addedAt: Date.now() };
    await db.insert(projects).values(project).run();

    await db
      .insert(healthSnapshots)
      .values([
        {
          id: generateId(),
          projectId: project.id,
          date: "2026-07-30",
          score: 80,
          totalPackages: 10,
          upToDate: 8,
          patchOutdated: 2,
          minorOutdated: 0,
          majorOutdated: 0,
          scannedAt: Date.now()
        },
        {
          id: generateId(),
          projectId: project.id,
          date: "2026-06-01",
          score: 60,
          totalPackages: 10,
          upToDate: 6,
          patchOutdated: 2,
          minorOutdated: 1,
          majorOutdated: 1,
          scannedAt: Date.now()
        }
      ])
      .run();

    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/health/trend?range=7d"
    });
    const body = JSON.parse(response.body);

    expect(body.items).toHaveLength(1);
    expect(body.items[0].snapshots).toHaveLength(1);
    expect(body.items[0].snapshots[0].date).toBe("2026-07-30");
  });

  it("should return all snapshots when range is all", async () => {
    const project = { id: generateId(), name: "project-a", path: "/a", addedAt: Date.now() };
    await db.insert(projects).values(project).run();

    await db
      .insert(healthSnapshots)
      .values([
        {
          id: generateId(),
          projectId: project.id,
          date: "2026-07-30",
          score: 80,
          totalPackages: 10,
          upToDate: 8,
          patchOutdated: 2,
          minorOutdated: 0,
          majorOutdated: 0,
          scannedAt: Date.now()
        },
        {
          id: generateId(),
          projectId: project.id,
          date: "2026-01-01",
          score: 40,
          totalPackages: 10,
          upToDate: 4,
          patchOutdated: 3,
          minorOutdated: 2,
          majorOutdated: 1,
          scannedAt: Date.now()
        }
      ])
      .run();

    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/health/trend?range=all"
    });
    const body = JSON.parse(response.body);

    expect(body.items[0].snapshots).toHaveLength(2);
  });
});
```

- [ ] **Step 7: Run all tests**

Run: `yarn test`
Expected: All PASS

- [ ] **Step 8: Lint and format**

Run: `yarn lint:fix && yarn format:fix`

- [ ] **Step 9: Commit**

```bash
git add src/shared/routes/dashboard.ts src/shared/routes/index.ts src/api/routes/dashboard.ts src/api/routes/index.ts src/api/routes/__tests__/dashboard.test.ts
git commit -m "feat: add dashboard health and trend API endpoints"
```
