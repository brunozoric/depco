# Vulnerability Enhancements & Trend Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project filter, bulk dismiss/snooze/rescan, CSV/JSON export to the vulnerability page, and a vulnerability trend chart widget to the dashboard.

**Architecture:** Extends existing vulnerability and dashboard subsystems. Backend adds dismiss columns to `vulnerabilities` table with query-time snooze expiry, new bulk/export/trend endpoints. Frontend extends gateway/repository/use-case/presenter layers per existing MVP pattern.

**Tech Stack:** Drizzle ORM, Fastify, Zod, MobX, Mantine, Recharts

## Global Constraints

- All interfaces in `abstractions/` directories, one file per DI token
- Named interfaces only — no inline structural types
- Resolve via DI container — never `new XxxImpl()`
- Destructive UI actions require `ConfirmDialog`
- Backend tests: in-memory SQLite, real services, mock only CommandRunner
- Frontend tests: mock HTTPClient + WebSocketListener at DI level
- Use `yarn` for all commands

---

### Task 1: DB Migration + Dismiss Service Logic

**Files:**

- Create: `src/api/db/migrations/0005_add_vulnerability_dismiss.sql`
- Modify: `src/api/db/schema.ts` — add `dismissedAt`, `dismissedUntil`, `dismissedBy` columns
- Modify: `src/api/services/abstractions/VulnerabilityService.ts` — extend `IVulnFilters`, add dismiss methods to interface
- Modify: `src/api/services/VulnerabilityService.ts` — implement dismiss methods, update `buildWhere` for dismissed/projectIds filtering

**Interfaces:**

- Consumes: existing `vulnerabilities` table schema, `buildWhere` helper, Drizzle `db` client
- Produces: `bulkDismiss(ids: string[]): Promise<number>`, `bulkSnooze(ids: string[], days: 7 | 30 | 90): Promise<number>`, `bulkUndismiss(ids: string[]): Promise<number>`, `getProjectIdsForVulnIds(ids: string[]): Promise<string[]>`, extended `IVulnFilters` with `projectIds?: string[]` and `includeDismissed?: boolean`

- [ ] **Step 1: Create migration SQL**

Create `src/api/db/migrations/0005_add_vulnerability_dismiss.sql`:

```sql
ALTER TABLE `vulnerabilities` ADD COLUMN `dismissed_at` integer;
--> statement-breakpoint
ALTER TABLE `vulnerabilities` ADD COLUMN `dismissed_until` integer;
--> statement-breakpoint
ALTER TABLE `vulnerabilities` ADD COLUMN `dismissed_by` text;
```

- [ ] **Step 2: Update Drizzle schema**

In `src/api/db/schema.ts`, add three columns to the `vulnerabilities` table definition after `scannedAt`:

```typescript
dismissedAt: integer("dismissed_at"),
dismissedUntil: integer("dismissed_until"),
dismissedBy: text("dismissed_by")
```

- [ ] **Step 3: Run migration to verify schema**

```bash
yarn drizzle-kit generate
```

Verify the generated migration matches step 1. If drizzle-kit generated a new file, delete it and keep the hand-written `0005_add_vulnerability_dismiss.sql`.

- [ ] **Step 4: Write tests for dismiss/snooze/undismiss service methods**

Create or extend test file. Use the existing TestContext pattern with in-memory SQLite. Seed a few vulnerabilities, then test:

```typescript
describe("VulnerabilityService dismiss operations", () => {
  it("bulkDismiss sets dismissedAt and dismissedBy, leaves dismissedUntil null", async () => {
    const { service, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 3);

    const count = await service.bulkDismiss([vulnIds[0], vulnIds[1]]);

    expect(count).toBe(2);
    const rows = await db
      .select()
      .from(vulnerabilities)
      .where(inArray(vulnerabilities.id, [vulnIds[0], vulnIds[1]]))
      .all();
    for (const row of rows) {
      expect(row.dismissedAt).toBeTypeOf("number");
      expect(row.dismissedUntil).toBeNull();
      expect(row.dismissedBy).toBe("user");
    }
  });

  it("bulkSnooze sets dismissedAt, dismissedUntil to now+days, dismissedBy", async () => {
    const { service, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 2);

    const count = await service.bulkSnooze([vulnIds[0]], 7);

    expect(count).toBe(1);
    const [row] = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.id, vulnIds[0]))
      .all();
    expect(row.dismissedAt).toBeTypeOf("number");
    expect(row.dismissedUntil).toBeTypeOf("number");
    expect(row.dismissedUntil! - row.dismissedAt!).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -3);
    expect(row.dismissedBy).toBe("user");
  });

  it("bulkUndismiss clears all dismiss columns", async () => {
    const { service, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 2);
    await service.bulkDismiss(vulnIds);

    const count = await service.bulkUndismiss(vulnIds);

    expect(count).toBe(2);
    const rows = await db.select().from(vulnerabilities).all();
    for (const row of rows) {
      expect(row.dismissedAt).toBeNull();
      expect(row.dismissedUntil).toBeNull();
      expect(row.dismissedBy).toBeNull();
    }
  });
});
```

- [ ] **Step 5: Run tests — expect FAIL (methods don't exist)**

```bash
yarn vitest run src/api/services/__tests__/VulnerabilityService.test.ts
```

- [ ] **Step 6: Extend IVulnerabilityService abstraction**

In `src/api/services/abstractions/VulnerabilityService.ts`, add to `IVulnFilters`:

```typescript
export interface IVulnFilters {
  severity?: string;
  packageName?: string;
  source?: string;
  projectIds?: string[];
  includeDismissed?: boolean;
  ids?: string[];
}
```

Add to `IVulnerabilityService`:

```typescript
bulkDismiss(ids: string[]): Promise<number>;
bulkSnooze(ids: string[], days: 7 | 30 | 90): Promise<number>;
bulkUndismiss(ids: string[]): Promise<number>;
getProjectIdsForVulnIds(ids: string[]): Promise<string[]>;
```

- [ ] **Step 7: Implement dismiss methods in VulnerabilityService**

In `src/api/services/VulnerabilityService.ts`:

```typescript
public async bulkDismiss(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const now = Date.now();
    const result = await this.databaseClient.db
        .update(vulnerabilities)
        .set({ dismissedAt: now, dismissedUntil: null, dismissedBy: "user" })
        .where(inArray(vulnerabilities.id, ids));
    return result.changes;
}

public async bulkSnooze(ids: string[], days: 7 | 30 | 90): Promise<number> {
    if (ids.length === 0) return 0;
    const now = Date.now();
    const until = now + days * 24 * 60 * 60 * 1000;
    const result = await this.databaseClient.db
        .update(vulnerabilities)
        .set({ dismissedAt: now, dismissedUntil: until, dismissedBy: "user" })
        .where(inArray(vulnerabilities.id, ids));
    return result.changes;
}

public async bulkUndismiss(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.databaseClient.db
        .update(vulnerabilities)
        .set({ dismissedAt: null, dismissedUntil: null, dismissedBy: null })
        .where(inArray(vulnerabilities.id, ids));
    return result.changes;
}

public async getProjectIdsForVulnIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.databaseClient.db
        .selectDistinct({ projectId: vulnerabilities.projectId })
        .from(vulnerabilities)
        .where(inArray(vulnerabilities.id, ids))
        .all();
    return rows.map(r => r.projectId);
}
```

- [ ] **Step 8: Run tests — expect PASS for dismiss/snooze/undismiss**

```bash
yarn vitest run src/api/services/__tests__/VulnerabilityService.test.ts
```

- [ ] **Step 9: Write tests for dismissed filtering in getAll/getLatest**

```typescript
describe("dismissed filtering", () => {
  it("getAll excludes dismissed vulns by default", async () => {
    const { service, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 3);
    await service.bulkDismiss([vulnIds[0]]);

    const results = await service.getAll();

    expect(results).toHaveLength(2);
    expect(results.map(r => r.id)).not.toContain(vulnIds[0]);
  });

  it("getAll includes dismissed when includeDismissed is true", async () => {
    const { service, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 3);
    await service.bulkDismiss([vulnIds[0]]);

    const results = await service.getAll({ includeDismissed: true });

    expect(results).toHaveLength(3);
  });

  it("getAll treats expired snooze as active", async () => {
    const { service, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 2);
    // Set snooze that already expired
    await db
      .update(vulnerabilities)
      .set({
        dismissedAt: Date.now() - 100000,
        dismissedUntil: Date.now() - 1,
        dismissedBy: "user"
      })
      .where(eq(vulnerabilities.id, vulnIds[0]));

    const results = await service.getAll();

    expect(results).toHaveLength(2);
    expect(results.map(r => r.id)).toContain(vulnIds[0]);
  });

  it("getAll filters by projectIds", async () => {
    const { service } = await createTestContext();
    // Seed vulns for 2 different projects
    const results = await service.getAll({ projectIds: ["project-1"] });

    expect(results.every(r => r.projectId === "project-1")).toBe(true);
  });
});
```

- [ ] **Step 10: Run tests — expect FAIL**

```bash
yarn vitest run src/api/services/__tests__/VulnerabilityService.test.ts
```

- [ ] **Step 11: Update buildWhere to handle dismissed + projectIds filtering**

In `src/api/services/VulnerabilityService.ts`, update the `buildWhere` function:

```typescript
function buildWhere(projectId?: string, filters?: Abstraction.Filters) {
  const conditions: SQL[] = [];

  if (projectId) {
    conditions.push(eq(vulnerabilities.projectId, projectId));
  }

  if (filters?.severity) {
    conditions.push(eq(vulnerabilities.severity, filters.severity));
  }

  if (filters?.packageName) {
    conditions.push(like(vulnerabilities.packageName, `%${filters.packageName}%`));
  }

  if (filters?.source) {
    conditions.push(eq(vulnerabilities.source, filters.source));
  }

  if (filters?.projectIds && filters.projectIds.length > 0) {
    conditions.push(inArray(vulnerabilities.projectId, filters.projectIds));
  }

  if (filters?.ids && filters.ids.length > 0) {
    conditions.push(inArray(vulnerabilities.id, filters.ids));
  }

  if (!filters?.includeDismissed) {
    conditions.push(
      or(
        isNull(vulnerabilities.dismissedAt),
        and(
          isNotNull(vulnerabilities.dismissedUntil),
          lte(vulnerabilities.dismissedUntil, Date.now())
        )
      )!
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}
```

Also update `toVulnerability` mapper to include dismiss fields:

```typescript
function toVulnerability(row: typeof vulnerabilities.$inferSelect): Abstraction.Vulnerability {
  return {
    ...existingFields,
    dismissedAt: row.dismissedAt,
    dismissedUntil: row.dismissedUntil,
    dismissedBy: row.dismissedBy
  };
}
```

Update `IVulnerability` type in abstraction to include:

```typescript
dismissedAt: number | null;
dismissedUntil: number | null;
dismissedBy: string | null;
```

- [ ] **Step 12: Update getSummary to exclude dismissed**

In `getSummary()`, filter out dismissed vulns before aggregating:

```typescript
public async getSummary(): Promise<Abstraction.Summary> {
    const dismissFilter = or(
        isNull(vulnerabilities.dismissedAt),
        and(
            isNotNull(vulnerabilities.dismissedUntil),
            lte(vulnerabilities.dismissedUntil, Date.now())
        )
    );
    const allVulns = await this.databaseClient.db
        .select()
        .from(vulnerabilities)
        .where(dismissFilter)
        .all();
    // ... rest of existing summary logic
}
```

- [ ] **Step 13: Run all tests — expect PASS**

```bash
yarn vitest run src/api/services/__tests__/VulnerabilityService.test.ts
```

- [ ] **Step 14: Commit**

```bash
git add src/api/db/migrations/0005_add_vulnerability_dismiss.sql src/api/db/schema.ts src/api/services/abstractions/VulnerabilityService.ts src/api/services/VulnerabilityService.ts src/api/services/__tests__/VulnerabilityService.test.ts
git commit -m "feat(vulnerabilities): add dismiss/snooze columns and service methods"
```

---

### Task 2: Backend Bulk/Export/Filter Routes

**Files:**

- Modify: `src/shared/routes/vulnerabilities.ts` — add bulk, export route definitions; update list route with `projectIds` + `includeDismissed` params
- Modify: `src/api/routes/vulnerabilities.ts` — register new routes, implement handlers

**Interfaces:**

- Consumes: `IVulnerabilityService.bulkDismiss`, `bulkSnooze`, `bulkUndismiss`, `getProjectIdsForVulnIds`, `getAll` from Task 1. Existing `JobManager` for scan queueing.
- Produces: `bulkVulnerabilitiesRoute` (PATCH `/api/vulnerabilities/bulk`), `bulkRescanVulnerabilitiesRoute` (POST `/api/vulnerabilities/bulk/rescan`), `exportVulnerabilitiesRoute` (GET `/api/vulnerabilities/export`). Updated `listVulnerabilitiesRoute` and `getProjectVulnerabilitiesRoute` with new query params.

- [ ] **Step 1: Add new route definitions in shared routes**

In `src/shared/routes/vulnerabilities.ts`, add the `vulnerabilitySchema` fields for dismiss (if not inline — add to existing schema):

```typescript
// Add to the existing vulnerabilitySchema or response schemas:
dismissedAt: z.number().nullable(),
dismissedUntil: z.number().nullable(),
dismissedBy: z.string().nullable()
```

Update `listVulnerabilitiesRoute` querystring:

```typescript
querystring: z.object({
  severity: z.string().optional(),
  packageName: z.string().optional(),
  source: z.string().optional(),
  projectIds: z.string().optional(),
  includeDismissed: z.enum(["true", "false"]).optional()
});
```

Add same `projectIds` and `includeDismissed` to `getProjectVulnerabilitiesRoute` querystring.

Add new route definitions:

```typescript
export const bulkVulnerabilitiesRoute = defineRoute({
  method: "PATCH",
  path: "/api/vulnerabilities/bulk",
  description: "Bulk dismiss, snooze, or undismiss vulnerabilities",
  params: z.object({}),
  body: z.discriminatedUnion("action", [
    z.object({ ids: z.array(z.string()).min(1), action: z.literal("dismiss") }),
    z.object({
      ids: z.array(z.string()).min(1),
      action: z.literal("snooze"),
      snoozeDays: z.union([z.literal(7), z.literal(30), z.literal(90)])
    }),
    z.object({ ids: z.array(z.string()).min(1), action: z.literal("undismiss") })
  ]),
  response: z.object({ updatedCount: z.number() })
});

export const bulkRescanVulnerabilitiesRoute = defineRoute({
  method: "POST",
  path: "/api/vulnerabilities/bulk/rescan",
  description: "Trigger rescan for projects of selected vulnerabilities",
  params: z.object({}),
  body: z.object({ ids: z.array(z.string()).min(1) }),
  response: z.object({ projectsQueued: z.number() })
});

export const exportVulnerabilitiesRoute = defineRoute({
  method: "GET",
  path: "/api/vulnerabilities/export",
  description: "Export vulnerabilities as CSV or JSON",
  params: z.object({}),
  querystring: z.object({
    format: z.enum(["csv", "json"]),
    severity: z.string().optional(),
    packageName: z.string().optional(),
    source: z.string().optional(),
    projectIds: z.string().optional(),
    includeDismissed: z.enum(["true", "false"]).optional(),
    ids: z.string().optional()
  }),
  response: z.any()
});
```

- [ ] **Step 2: Write tests for bulk dismiss route**

```typescript
describe("PATCH /api/vulnerabilities/bulk", () => {
  it("dismisses selected vulnerabilities", async () => {
    const { app, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 3);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/vulnerabilities/bulk",
      payload: { ids: [vulnIds[0], vulnIds[1]], action: "dismiss" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().updatedCount).toBe(2);
  });

  it("snoozes with required snoozeDays", async () => {
    const { app, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 2);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/vulnerabilities/bulk",
      payload: { ids: [vulnIds[0]], action: "snooze", snoozeDays: 30 }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().updatedCount).toBe(1);
  });

  it("rejects snooze without snoozeDays", async () => {
    const { app, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 1);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/vulnerabilities/bulk",
      payload: { ids: [vulnIds[0]], action: "snooze" }
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects empty ids array", async () => {
    const { app } = await createTestContext();

    const response = await app.inject({
      method: "PATCH",
      url: "/api/vulnerabilities/bulk",
      payload: { ids: [], action: "dismiss" }
    });

    expect(response.statusCode).toBe(400);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
yarn vitest run src/api/routes/__tests__/vulnerabilities.test.ts
```

- [ ] **Step 4: Implement bulk route handler**

In `src/api/routes/vulnerabilities.ts`:

```typescript
registerRoute(app, bulkVulnerabilitiesRoute, {}, async (request, reply) => {
  const { ids, action } = request.body;
  let updatedCount: number;

  switch (action) {
    case "dismiss":
      updatedCount = await vulnerabilityService.bulkDismiss(ids);
      break;
    case "snooze":
      updatedCount = await vulnerabilityService.bulkSnooze(ids, request.body.snoozeDays);
      break;
    case "undismiss":
      updatedCount = await vulnerabilityService.bulkUndismiss(ids);
      break;
  }

  reply.send({ updatedCount });
});
```

- [ ] **Step 5: Run bulk tests — expect PASS**

```bash
yarn vitest run src/api/routes/__tests__/vulnerabilities.test.ts
```

- [ ] **Step 6: Write tests for bulk rescan route**

```typescript
describe("POST /api/vulnerabilities/bulk/rescan", () => {
  it("queues scans for unique projects of selected vulns", async () => {
    const { app, db } = await createTestContext();
    // Seed vulns across 2 projects
    const vulnIds = await seedVulnerabilitiesAcrossProjects(db, {
      "project-1": 2,
      "project-2": 1
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/vulnerabilities/bulk/rescan",
      payload: { ids: vulnIds }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().projectsQueued).toBe(2);
  });
});
```

- [ ] **Step 7: Implement bulk rescan handler**

```typescript
registerRoute(app, bulkRescanVulnerabilitiesRoute, {}, async (request, reply) => {
  const { ids } = request.body;
  const projectIds = await vulnerabilityService.getProjectIdsForVulnIds(ids);

  for (const projectId of projectIds) {
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (project) {
      await vulnerabilityService.scan(projectId, project.path, project.packageManager);
    }
  }

  reply.send({ projectsQueued: projectIds.length });
});
```

- [ ] **Step 8: Run rescan tests — expect PASS**

```bash
yarn vitest run src/api/routes/__tests__/vulnerabilities.test.ts
```

- [ ] **Step 9: Write tests for export route**

```typescript
describe("GET /api/vulnerabilities/export", () => {
  it("exports as JSON with correct content-disposition", async () => {
    const { app, db } = await createTestContext();
    await seedVulnerabilities(db, 3);

    const response = await app.inject({
      method: "GET",
      url: "/api/vulnerabilities/export?format=json"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["content-type"]).toContain("application/json");
    const data = response.json();
    expect(data).toHaveLength(3);
  });

  it("exports as CSV with header row and quoted fields", async () => {
    const { app, db } = await createTestContext();
    await seedVulnerabilities(db, 2);

    const response = await app.inject({
      method: "GET",
      url: "/api/vulnerabilities/export?format=csv"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["content-type"]).toContain("text/csv");
    const lines = response.body.split("\n").filter(Boolean);
    expect(lines[0]).toContain("packageName");
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it("exports only selected ids when ids param provided", async () => {
    const { app, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 5);

    const response = await app.inject({
      method: "GET",
      url: `/api/vulnerabilities/export?format=json&ids=${vulnIds[0]},${vulnIds[1]}`
    });

    expect(response.json()).toHaveLength(2);
  });

  it("applies filters to export", async () => {
    const { app, db } = await createTestContext();
    await seedVulnerabilitiesWithSeverities(db, { critical: 2, low: 3 });

    const response = await app.inject({
      method: "GET",
      url: "/api/vulnerabilities/export?format=json&severity=critical"
    });

    expect(response.json()).toHaveLength(2);
  });
});
```

- [ ] **Step 10: Implement export route handler**

```typescript
registerRoute(app, exportVulnerabilitiesRoute, {}, async (request, reply) => {
  const { format, ids: idsParam, ...filterParams } = request.query;
  const filters = buildFilters(filterParams);

  let items: Abstraction.Vulnerability[];
  if (idsParam) {
    const ids = idsParam.split(",");
    items = await vulnerabilityService.getAll({ ...filters, ids });
  } else {
    items = await vulnerabilityService.getAll(filters);
  }

  const enriched = await enrichWithProjectNames(items, db);
  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    reply
      .header("Content-Type", "application/json")
      .header("Content-Disposition", `attachment; filename="vulnerabilities-${timestamp}.json"`)
      .send(JSON.stringify(enriched, null, 2));
  } else {
    const csv = toCsv(enriched);
    reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", `attachment; filename="vulnerabilities-${timestamp}.csv"`)
      .send(csv);
  }
});
```

Add CSV helper in the same file (or a shared util):

```typescript
function toCsv(items: Array<Record<string, unknown>>): string {
  if (items.length === 0) return "";
  const headers = [
    "packageName",
    "severity",
    "title",
    "cveId",
    "advisoryUrl",
    "source",
    "projectName",
    "vulnerableRange",
    "fixVersion"
  ];
  const quote = (val: unknown): string => {
    const str = val == null ? "" : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const lines = [headers.join(",")];
  for (const item of items) {
    lines.push(headers.map(h => quote(item[h])).join(","));
  }
  return lines.join("\n");
}
```

- [ ] **Step 11: Update buildFilters to parse new query params**

In the route handler file, update `buildFilters`:

```typescript
function buildFilters(query: Record<string, string | undefined>): Abstraction.Filters {
  return {
    ...(query.severity ? { severity: query.severity } : {}),
    ...(query.packageName ? { packageName: query.packageName } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.projectIds ? { projectIds: query.projectIds.split(",") } : {}),
    ...(query.includeDismissed === "true" ? { includeDismissed: true } : {})
  };
}
```

- [ ] **Step 12: Run all route tests — expect PASS**

```bash
yarn vitest run src/api/routes/__tests__/vulnerabilities.test.ts
```

- [ ] **Step 13: Run full test suite to check for regressions**

```bash
yarn vitest run
```

- [ ] **Step 14: Commit**

```bash
git add src/shared/routes/vulnerabilities.ts src/api/routes/vulnerabilities.ts src/api/routes/__tests__/vulnerabilities.test.ts
git commit -m "feat(vulnerabilities): add bulk dismiss/rescan and export API routes"
```

---

### Task 3: Backend Vuln Trend Endpoint

**Files:**

- Modify: `src/shared/routes/dashboard.ts` — add `dashboardVulnTrendRoute` definition
- Modify: `src/api/routes/dashboard.ts` — register vuln-trend handler

**Interfaces:**

- Consumes: `healthSnapshots` table (existing columns `vulnCritical`, `vulnHigh`, `vulnModerate`, `vulnLow`, `date`)
- Produces: `dashboardVulnTrendRoute` — GET `/api/dashboard/vuln-trend` returning `{ points: Array<{ date: string, critical: number, high: number, moderate: number, low: number }> }`

- [ ] **Step 1: Add route definition**

In `src/shared/routes/dashboard.ts`:

```typescript
export const dashboardVulnTrendRoute = defineRoute({
  method: "GET",
  path: "/api/dashboard/vuln-trend",
  description: "Get historical vulnerability counts for trend chart",
  params: z.object({}),
  querystring: z.object({
    days: z.enum(["7", "30", "90"]).optional()
  }),
  response: z.object({
    points: z.array(
      z.object({
        date: z.string(),
        critical: z.number(),
        high: z.number(),
        moderate: z.number(),
        low: z.number()
      })
    )
  })
});
```

- [ ] **Step 2: Write tests for vuln trend endpoint**

```typescript
describe("GET /api/dashboard/vuln-trend", () => {
  it("returns aggregated vuln counts per date from healthSnapshots", async () => {
    const { app, db } = await createTestContext();
    await seedHealthSnapshots(db, [
      { date: "2026-07-01", vulnCritical: 2, vulnHigh: 3, vulnModerate: 1, vulnLow: 0 },
      { date: "2026-07-01", vulnCritical: 1, vulnHigh: 0, vulnModerate: 2, vulnLow: 1 },
      { date: "2026-07-02", vulnCritical: 0, vulnHigh: 1, vulnModerate: 0, vulnLow: 2 }
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/vuln-trend"
    });

    expect(response.statusCode).toBe(200);
    const { points } = response.json();
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({ date: "2026-07-01", critical: 3, high: 3, moderate: 3, low: 1 });
    expect(points[1]).toEqual({ date: "2026-07-02", critical: 0, high: 1, moderate: 0, low: 2 });
  });

  it("filters by days param", async () => {
    const { app, db } = await createTestContext();
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
    await seedHealthSnapshots(db, [
      { date: today, vulnCritical: 1, vulnHigh: 0, vulnModerate: 0, vulnLow: 0 },
      { date: thirtyDaysAgo, vulnCritical: 5, vulnHigh: 0, vulnModerate: 0, vulnLow: 0 }
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/vuln-trend?days=7"
    });

    const { points } = response.json();
    expect(points).toHaveLength(1);
    expect(points[0].date).toBe(today);
  });

  it("returns empty array when no snapshots exist", async () => {
    const { app } = await createTestContext();

    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/vuln-trend"
    });

    expect(response.json().points).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
yarn vitest run src/api/routes/__tests__/dashboard.test.ts
```

- [ ] **Step 4: Implement vuln trend route handler**

In `src/api/routes/dashboard.ts`:

```typescript
registerRoute(app, dashboardVulnTrendRoute, {}, async (request, reply) => {
  const { days } = request.query;
  let dateFilter: SQL | undefined;

  if (days) {
    const cutoff = new Date(Date.now() - Number(days) * 86400000).toISOString().slice(0, 10);
    dateFilter = gte(healthSnapshots.date, cutoff);
  }

  const rows = dateFilter
    ? await db
        .select({
          date: healthSnapshots.date,
          critical: sql<number>`SUM(${healthSnapshots.vulnCritical})`,
          high: sql<number>`SUM(${healthSnapshots.vulnHigh})`,
          moderate: sql<number>`SUM(${healthSnapshots.vulnModerate})`,
          low: sql<number>`SUM(${healthSnapshots.vulnLow})`
        })
        .from(healthSnapshots)
        .where(dateFilter)
        .groupBy(healthSnapshots.date)
        .orderBy(healthSnapshots.date)
        .all()
    : await db
        .select({
          date: healthSnapshots.date,
          critical: sql<number>`SUM(${healthSnapshots.vulnCritical})`,
          high: sql<number>`SUM(${healthSnapshots.vulnHigh})`,
          moderate: sql<number>`SUM(${healthSnapshots.vulnModerate})`,
          low: sql<number>`SUM(${healthSnapshots.vulnLow})`
        })
        .from(healthSnapshots)
        .groupBy(healthSnapshots.date)
        .orderBy(healthSnapshots.date)
        .all();

  reply.send({ points: rows });
});
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
yarn vitest run src/api/routes/__tests__/dashboard.test.ts
```

- [ ] **Step 6: Run full test suite**

```bash
yarn vitest run
```

- [ ] **Step 7: Commit**

```bash
git add src/shared/routes/dashboard.ts src/api/routes/dashboard.ts src/api/routes/__tests__/dashboard.test.ts
git commit -m "feat(dashboard): add vuln trend endpoint aggregating healthSnapshots"
```

---

### Task 4: Frontend Data Layer Extensions

**Files:**

- Modify: `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts` — add bulk/export methods and types
- Modify: `src/ui/features/vulnerabilities/VulnerabilitiesGateway.ts` — implement new methods
- Modify: `src/ui/features/dashboard/abstractions/DashboardGateway.ts` — add `getVulnTrend` method and types
- Modify: `src/ui/features/dashboard/DashboardGateway.ts` — implement
- Modify: `src/ui/features/dashboard/abstractions/DashboardRepository.ts` — add vuln trend storage
- Modify: `src/ui/features/dashboard/DashboardRepository.ts` — implement
- Create: `src/ui/presentation/vulnerabilities/useCases/BulkVulnerabilityActionUseCase.ts` + abstraction
- Create: `src/ui/presentation/vulnerabilities/useCases/BulkRescanVulnerabilitiesUseCase.ts` + abstraction
- Create: `src/ui/presentation/vulnerabilities/useCases/ExportVulnerabilitiesUseCase.ts` + abstraction
- Create: `src/ui/presentation/dashboard/useCases/LoadVulnTrendUseCase.ts` + abstraction
- Modify: `src/ui/presentation/vulnerabilities/useCases/feature.ts` — register new use cases
- Modify: `src/ui/presentation/dashboard/useCases/feature.ts` — register LoadVulnTrendUseCase

**Interfaces:**

- Consumes: shared route definitions from Tasks 2–3
- Produces:
  - `IVulnerabilitiesGateway.bulkAction(ids, action, snoozeDays?): Promise<{ updatedCount: number }>`
  - `IVulnerabilitiesGateway.bulkRescan(ids): Promise<{ projectsQueued: number }>`
  - `IVulnerabilitiesGateway.getExportUrl(filters, format, ids?): string`
  - `IDashboardGateway.getVulnTrend(days?): Promise<IVulnTrendResponse>`
  - `IDashboardRepository.getVulnTrend() / setVulnTrend()`
  - `BulkVulnerabilityActionUseCase.execute(ids, action, snoozeDays?)`
  - `BulkRescanVulnerabilitiesUseCase.execute(ids)`
  - `ExportVulnerabilitiesUseCase.execute(filters, format, ids?)`
  - `LoadVulnTrendUseCase.execute(days?)`

- [ ] **Step 1: Extend VulnerabilitiesGateway abstraction**

In `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts`, add to `IVulnListFilters`:

```typescript
export interface IVulnListFilters {
  severity?: string;
  packageName?: string;
  source?: string;
  projectIds?: string[];
  includeDismissed?: boolean;
}
```

Add to `IVulnerabilityItem`:

```typescript
dismissedAt: number | null;
dismissedUntil: number | null;
```

Add methods to `IVulnerabilitiesGateway`:

```typescript
bulkAction(ids: string[], action: "dismiss" | "snooze" | "undismiss", snoozeDays?: 7 | 30 | 90): Promise<{ updatedCount: number }>;
bulkRescan(ids: string[]): Promise<{ projectsQueued: number }>;
getExportUrl(filters: IVulnListFilters, format: "csv" | "json", ids?: string[]): string;
```

- [ ] **Step 2: Implement new gateway methods**

In `src/ui/features/vulnerabilities/VulnerabilitiesGateway.ts`:

Update `list()` to pass new filter params:

```typescript
public async list(filters?: Abstraction.ListFilters): Promise<Abstraction.ListResponse> {
    const query: Record<string, string> = {};
    if (filters?.severity) query["severity"] = filters.severity;
    if (filters?.packageName) query["packageName"] = filters.packageName;
    if (filters?.source) query["source"] = filters.source;
    if (filters?.projectIds?.length) query["projectIds"] = filters.projectIds.join(",");
    if (filters?.includeDismissed) query["includeDismissed"] = "true";

    return this.httpClient.request(listVulnerabilitiesRoute, {
        params: {},
        query: Object.keys(query).length > 0 ? query : undefined
    });
}
```

Add new methods:

```typescript
public async bulkAction(
    ids: string[],
    action: "dismiss" | "snooze" | "undismiss",
    snoozeDays?: 7 | 30 | 90
): Promise<{ updatedCount: number }> {
    const body = action === "snooze"
        ? { ids, action, snoozeDays }
        : { ids, action };
    return this.httpClient.request(bulkVulnerabilitiesRoute, { params: {}, body });
}

public async bulkRescan(ids: string[]): Promise<{ projectsQueued: number }> {
    return this.httpClient.request(bulkRescanVulnerabilitiesRoute, { params: {}, body: { ids } });
}

public getExportUrl(
    filters: Abstraction.ListFilters,
    format: "csv" | "json",
    ids?: string[]
): string {
    const params = new URLSearchParams({ format });
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.packageName) params.set("packageName", filters.packageName);
    if (filters.source) params.set("source", filters.source);
    if (filters.projectIds?.length) params.set("projectIds", filters.projectIds.join(","));
    if (filters.includeDismissed) params.set("includeDismissed", "true");
    if (ids?.length) params.set("ids", ids.join(","));
    return `/api/vulnerabilities/export?${params.toString()}`;
}
```

- [ ] **Step 3: Write tests for gateway new methods**

```typescript
describe("VulnerabilitiesGateway bulk methods", () => {
  it("bulkAction calls bulkVulnerabilitiesRoute with correct body", async () => {
    const { gateway, httpClient } = createTestContext();
    httpClient.mockResponse({ updatedCount: 3 });

    const result = await gateway.bulkAction(["id1", "id2", "id3"], "dismiss");

    expect(httpClient.lastRequest().route).toBe(bulkVulnerabilitiesRoute);
    expect(httpClient.lastRequest().body).toEqual({
      ids: ["id1", "id2", "id3"],
      action: "dismiss"
    });
    expect(result.updatedCount).toBe(3);
  });

  it("bulkAction includes snoozeDays for snooze action", async () => {
    const { gateway, httpClient } = createTestContext();
    httpClient.mockResponse({ updatedCount: 1 });

    await gateway.bulkAction(["id1"], "snooze", 30);

    expect(httpClient.lastRequest().body).toEqual({
      ids: ["id1"],
      action: "snooze",
      snoozeDays: 30
    });
  });

  it("bulkRescan calls bulkRescanVulnerabilitiesRoute", async () => {
    const { gateway, httpClient } = createTestContext();
    httpClient.mockResponse({ projectsQueued: 2 });

    const result = await gateway.bulkRescan(["id1", "id2"]);

    expect(httpClient.lastRequest().route).toBe(bulkRescanVulnerabilitiesRoute);
    expect(result.projectsQueued).toBe(2);
  });

  it("getExportUrl builds correct URL with filters", () => {
    const { gateway } = createTestContext();

    const url = gateway.getExportUrl({ severity: "critical", projectIds: ["p1", "p2"] }, "csv");

    expect(url).toContain("format=csv");
    expect(url).toContain("severity=critical");
    expect(url).toContain("projectIds=p1%2Cp2");
  });

  it("list passes projectIds and includeDismissed", async () => {
    const { gateway, httpClient } = createTestContext();
    httpClient.mockResponse({ items: [], total: 0 });

    await gateway.list({ projectIds: ["p1"], includeDismissed: true });

    const query = httpClient.lastRequest().query;
    expect(query.projectIds).toBe("p1");
    expect(query.includeDismissed).toBe("true");
  });
});
```

- [ ] **Step 4: Run gateway tests — expect PASS**

```bash
yarn vitest run src/ui/features/vulnerabilities/__tests__/VulnerabilitiesGateway.test.ts
```

- [ ] **Step 5: Extend DashboardGateway with getVulnTrend**

In `src/ui/features/dashboard/abstractions/DashboardGateway.ts`, add types and method:

```typescript
export interface IVulnTrendPoint {
  date: string;
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

export interface IVulnTrendResponse {
  points: IVulnTrendPoint[];
}
```

Add to `IDashboardGateway`:

```typescript
getVulnTrend(days?: 7 | 30 | 90): Promise<IVulnTrendResponse>;
```

In `src/ui/features/dashboard/DashboardGateway.ts`:

```typescript
public async getVulnTrend(days?: 7 | 30 | 90): Promise<Abstraction.VulnTrendResponse> {
    const query = days ? { days: String(days) } : {};
    return this.httpClient.request(dashboardVulnTrendRoute, {
        params: {},
        query: Object.keys(query).length > 0 ? query : undefined
    });
}
```

- [ ] **Step 6: Extend DashboardRepository with vuln trend storage**

In `src/ui/features/dashboard/abstractions/DashboardRepository.ts`, add:

```typescript
getVulnTrend(): DashboardGateway.VulnTrendPoint[];
setVulnTrend(points: DashboardGateway.VulnTrendPoint[]): void;
```

In `src/ui/features/dashboard/DashboardRepository.ts`, add field and methods:

```typescript
private vulnTrend: DashboardGateway.VulnTrendPoint[] = [];

public getVulnTrend(): DashboardGateway.VulnTrendPoint[] {
    return this.vulnTrend;
}

public setVulnTrend(points: DashboardGateway.VulnTrendPoint[]): void {
    this.vulnTrend = points;
}
```

- [ ] **Step 7: Create BulkVulnerabilityActionUseCase**

Create abstraction at `src/ui/presentation/vulnerabilities/useCases/abstractions/BulkVulnerabilityActionUseCase.ts`:

```typescript
export interface IBulkVulnerabilityActionUseCase {
  execute(
    ids: string[],
    action: "dismiss" | "snooze" | "undismiss",
    snoozeDays?: 7 | 30 | 90
  ): Promise<number>;
}
```

Create implementation at `src/ui/presentation/vulnerabilities/useCases/BulkVulnerabilityActionUseCase.ts`:

```typescript
class BulkVulnerabilityActionUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: VulnerabilitiesGateway.Interface,
    private readonly repository: VulnerabilitiesRepository.Interface,
    private readonly loadVulnerabilities: LoadVulnerabilitiesUseCase.Interface
  ) {}

  public execute = async (
    ids: string[],
    action: "dismiss" | "snooze" | "undismiss",
    snoozeDays?: 7 | 30 | 90
  ): Promise<number> => {
    const { updatedCount } = await this.gateway.bulkAction(ids, action, snoozeDays);
    return updatedCount;
  };
}
```

- [ ] **Step 8: Create BulkRescanVulnerabilitiesUseCase**

Create abstraction at `src/ui/presentation/vulnerabilities/useCases/abstractions/BulkRescanVulnerabilitiesUseCase.ts`:

```typescript
export interface IBulkRescanVulnerabilitiesUseCase {
  execute(ids: string[]): Promise<number>;
}
```

Create implementation at `src/ui/presentation/vulnerabilities/useCases/BulkRescanVulnerabilitiesUseCase.ts`:

```typescript
class BulkRescanVulnerabilitiesUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly gateway: VulnerabilitiesGateway.Interface) {}

  public execute = async (ids: string[]): Promise<number> => {
    const { projectsQueued } = await this.gateway.bulkRescan(ids);
    return projectsQueued;
  };
}
```

- [ ] **Step 9: Create ExportVulnerabilitiesUseCase**

Create abstraction at `src/ui/presentation/vulnerabilities/useCases/abstractions/ExportVulnerabilitiesUseCase.ts`:

```typescript
export interface IExportVulnerabilitiesUseCase {
  execute(
    filters: VulnerabilitiesGateway.ListFilters,
    format: "csv" | "json",
    ids?: string[]
  ): void;
}
```

Create implementation at `src/ui/presentation/vulnerabilities/useCases/ExportVulnerabilitiesUseCase.ts`:

```typescript
class ExportVulnerabilitiesUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly gateway: VulnerabilitiesGateway.Interface) {}

  public execute = (
    filters: VulnerabilitiesGateway.ListFilters,
    format: "csv" | "json",
    ids?: string[]
  ): void => {
    const url = this.gateway.getExportUrl(filters, format, ids);
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
}
```

- [ ] **Step 10: Create LoadVulnTrendUseCase**

Create abstraction at `src/ui/presentation/dashboard/useCases/abstractions/LoadVulnTrendUseCase.ts`:

```typescript
export interface ILoadVulnTrendUseCase {
  execute(days?: 7 | 30 | 90): Promise<void>;
}
```

Create implementation at `src/ui/presentation/dashboard/useCases/LoadVulnTrendUseCase.ts`:

```typescript
class LoadVulnTrendUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: DashboardGateway.Interface,
    private readonly repository: DashboardRepository.Interface
  ) {}

  public execute = async (days?: 7 | 30 | 90): Promise<void> => {
    const response = await this.gateway.getVulnTrend(days);
    this.repository.setVulnTrend(response.points);
  };
}
```

- [ ] **Step 11: Register new use cases in features**

In `src/ui/presentation/vulnerabilities/useCases/feature.ts`, add:

```typescript
container.register(BulkVulnerabilityActionUseCase);
container.register(BulkRescanVulnerabilitiesUseCase);
container.register(ExportVulnerabilitiesUseCase);
```

In `src/ui/presentation/dashboard/useCases/feature.ts`, add:

```typescript
container.register(LoadVulnTrendUseCase);
```

- [ ] **Step 12: Write tests for use cases**

```typescript
describe("BulkVulnerabilityActionUseCase", () => {
  it("calls gateway bulkAction and returns count", async () => {
    const { useCase, httpClient } = createTestContext();
    httpClient.mockResponse({ updatedCount: 5 });

    const count = await useCase.execute(["id1", "id2"], "dismiss");

    expect(count).toBe(5);
  });
});

describe("BulkRescanVulnerabilitiesUseCase", () => {
  it("calls gateway bulkRescan and returns projects queued", async () => {
    const { useCase, httpClient } = createTestContext();
    httpClient.mockResponse({ projectsQueued: 3 });

    const count = await useCase.execute(["id1", "id2"]);

    expect(count).toBe(3);
  });
});

describe("LoadVulnTrendUseCase", () => {
  it("fetches trend data and stores in repository", async () => {
    const { useCase, repository, httpClient } = createTestContext();
    const points = [{ date: "2026-07-01", critical: 1, high: 2, moderate: 0, low: 0 }];
    httpClient.mockResponse({ points });

    await useCase.execute(30);

    expect(repository.getVulnTrend()).toEqual(points);
  });
});
```

- [ ] **Step 13: Run all frontend tests**

```bash
yarn vitest run src/ui/
```

- [ ] **Step 14: Commit**

```bash
git add src/ui/features/ src/ui/presentation/vulnerabilities/useCases/ src/ui/presentation/dashboard/useCases/
git commit -m "feat(ui): add bulk action, rescan, export, vuln trend data layer"
```

---

### Task 5: Vuln Page Presenter + Component

**Files:**

- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts` — extend interface with project filter, selection, bulk actions, dismissed toggle
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts` — implement new state and methods
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx` — add project dropdown, checkbox column, bulk action bar, dismissed toggle, export button
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/feature.ts` — wire new use cases to presenter

**Interfaces:**

- Consumes: `BulkVulnerabilityActionUseCase`, `BulkRescanVulnerabilitiesUseCase`, `ExportVulnerabilitiesUseCase` from Task 4. Existing projects gateway for project list.
- Produces: Extended `IVulnerabilitiesPresenter` with `setProjectIds`, `toggleSelected`, `selectAllOnPage`, `clearSelection`, `bulkDismiss`, `bulkSnooze`, `bulkUndismiss`, `bulkRescan`, `exportSelected`, `exportAll`, `setIncludeDismissed`

- [ ] **Step 1: Extend presenter interface**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts`:

Add to view model:

```typescript
export interface IVulnerabilitiesViewModel {
  // ... existing fields
  projectIds: string[];
  includeDismissed: boolean;
  selectedIds: string[];
  selectedCount: number;
  allOnPageSelected: boolean;
  bulkActionRunning: boolean;
  availableProjects: Array<{ value: string; label: string }>;
}
```

Add to row view model:

```typescript
export interface IVulnerabilityRowViewModel {
  // ... existing fields
  dismissedAt: number | null;
  dismissedUntil: number | null;
  isDismissed: boolean;
  dismissLabel: string | null;
}
```

Add methods to interface:

```typescript
setProjectIds(ids: string[]): void;
setIncludeDismissed(value: boolean): void;
toggleSelected(id: string): void;
selectAllOnPage(): void;
clearSelection(): void;
bulkDismiss(): Promise<void>;
bulkSnooze(days: 7 | 30 | 90): Promise<void>;
bulkUndismiss(): Promise<void>;
bulkRescan(): Promise<void>;
exportSelected(format: "csv" | "json"): void;
exportAll(format: "csv" | "json"): void;
```

- [ ] **Step 2: Write presenter tests for new state management**

```typescript
describe("VulnerabilitiesPresenter selection and filters", () => {
  it("setProjectIds updates filter and reloads", async () => {
    const { presenter, httpClient } = createTestContext();
    httpClient.mockResponse({ items: [], total: 0 });

    presenter.setProjectIds(["p1", "p2"]);
    await flushPromises();

    expect(presenter.vm.projectIds).toEqual(["p1", "p2"]);
    expect(httpClient.lastRequest().query.projectIds).toBe("p1,p2");
  });

  it("toggleSelected adds/removes from selection", () => {
    const { presenter } = createTestContext();

    presenter.toggleSelected("id1");
    expect(presenter.vm.selectedIds).toContain("id1");

    presenter.toggleSelected("id1");
    expect(presenter.vm.selectedIds).not.toContain("id1");
  });

  it("selectAllOnPage selects all visible vuln ids", async () => {
    const { presenter, httpClient } = createTestContext();
    httpClient.mockResponse({ items: [{ id: "v1" }, { id: "v2" }, { id: "v3" }], total: 3 });
    await presenter.load();

    presenter.selectAllOnPage();

    expect(presenter.vm.selectedIds).toEqual(["v1", "v2", "v3"]);
    expect(presenter.vm.allOnPageSelected).toBe(true);
  });

  it("clears selection on filter change", async () => {
    const { presenter, httpClient } = createTestContext();
    httpClient.mockResponse({ items: [{ id: "v1" }], total: 1 });
    await presenter.load();
    presenter.toggleSelected("v1");

    presenter.setSeverity("critical");

    expect(presenter.vm.selectedIds).toEqual([]);
  });

  it("clears selection on page change", async () => {
    const { presenter, httpClient } = createTestContext();
    httpClient.mockResponse({
      items: Array.from({ length: 30 }, (_, i) => ({ id: `v${i}` })),
      total: 30
    });
    await presenter.load();
    presenter.toggleSelected("v0");

    presenter.setPage(2);

    expect(presenter.vm.selectedIds).toEqual([]);
  });

  it("setIncludeDismissed toggles and reloads", async () => {
    const { presenter, httpClient } = createTestContext();
    httpClient.mockResponse({ items: [], total: 0 });

    presenter.setIncludeDismissed(true);
    await flushPromises();

    expect(presenter.vm.includeDismissed).toBe(true);
  });
});

describe("VulnerabilitiesPresenter bulk actions", () => {
  it("bulkDismiss calls use case with selected ids, clears selection, reloads", async () => {
    const { presenter, httpClient } = createTestContext();
    httpClient.mockResponse({ items: [{ id: "v1" }, { id: "v2" }], total: 2 });
    await presenter.load();
    presenter.toggleSelected("v1");
    httpClient.mockResponse({ updatedCount: 1 });

    await presenter.bulkDismiss();

    expect(presenter.vm.selectedIds).toEqual([]);
  });

  it("bulkSnooze passes days to use case", async () => {
    const { presenter, httpClient, calls } = createTestContext();
    httpClient.mockResponse({ items: [{ id: "v1" }], total: 1 });
    await presenter.load();
    presenter.toggleSelected("v1");
    httpClient.mockResponse({ updatedCount: 1 });

    await presenter.bulkSnooze(30);

    const bulkCall = calls.find(c => c.route === bulkVulnerabilitiesRoute);
    expect(bulkCall?.body).toEqual({ ids: ["v1"], action: "snooze", snoozeDays: 30 });
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
yarn vitest run src/ui/presentation/vulnerabilities/
```

- [ ] **Step 4: Implement presenter state and methods**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts`, add new fields:

```typescript
private projectIds: string[] = [];
private includeDismissed = false;
private selectedIds = new Set<string>();
private bulkActionRunning = false;
private availableProjects: Array<{ value: string; label: string }> = [];
```

Update constructor to accept new use cases:

```typescript
public constructor(
    private readonly loadVulnerabilities: LoadVulnerabilitiesUseCase.Interface,
    private readonly repository: VulnerabilitiesRepository.Interface,
    private readonly bulkActionUseCase: BulkVulnerabilityActionUseCase.Interface,
    private readonly bulkRescanUseCase: BulkRescanVulnerabilitiesUseCase.Interface,
    private readonly exportUseCase: ExportVulnerabilitiesUseCase.Interface,
    private readonly projectsGateway: ProjectsGateway.Interface
) {
    makeAutoObservable(this, { vm: computed });
}
```

Extend `vm` getter to include new fields:

```typescript
public get vm(): Abstraction.ViewModel {
    // ... existing logic
    return {
        // ... existing fields
        projectIds: this.projectIds,
        includeDismissed: this.includeDismissed,
        selectedIds: [...this.selectedIds],
        selectedCount: this.selectedIds.size,
        allOnPageSelected: vulnerabilities.length > 0 && vulnerabilities.every(v => this.selectedIds.has(v.id)),
        bulkActionRunning: this.bulkActionRunning,
        availableProjects: this.availableProjects
    };
}
```

Add row dismiss fields to the mapping inside `vm`:

```typescript
vulnerabilities: sorted.slice(start, start + PAGE_SIZE).map(v => ({
  ...v,
  isDismissed: v.dismissedAt != null && (v.dismissedUntil == null || v.dismissedUntil > Date.now()),
  dismissLabel:
    v.dismissedAt == null
      ? null
      : v.dismissedUntil != null
        ? `Snoozed until ${new Date(v.dismissedUntil).toLocaleDateString()}`
        : "Dismissed"
}));
```

Add new methods:

```typescript
public setProjectIds = (ids: string[]): void => {
    this.projectIds = ids;
    this.selectedIds.clear();
    this.page = 1;
    void this.load();
};

public setIncludeDismissed = (value: boolean): void => {
    this.includeDismissed = value;
    this.selectedIds.clear();
    this.page = 1;
    void this.load();
};

public toggleSelected = (id: string): void => {
    if (this.selectedIds.has(id)) {
        this.selectedIds.delete(id);
    } else {
        this.selectedIds.add(id);
    }
};

public selectAllOnPage = (): void => {
    const items = this.vm.vulnerabilities;
    const allSelected = items.every(v => this.selectedIds.has(v.id));
    if (allSelected) {
        items.forEach(v => this.selectedIds.delete(v.id));
    } else {
        items.forEach(v => this.selectedIds.add(v.id));
    }
};

public clearSelection = (): void => {
    this.selectedIds.clear();
};

public bulkDismiss = async (): Promise<void> => {
    this.bulkActionRunning = true;
    try {
        await this.bulkActionUseCase.execute([...this.selectedIds], "dismiss");
        runInAction(() => { this.selectedIds.clear(); });
        await this.load();
    } finally {
        runInAction(() => { this.bulkActionRunning = false; });
    }
};

public bulkSnooze = async (days: 7 | 30 | 90): Promise<void> => {
    this.bulkActionRunning = true;
    try {
        await this.bulkActionUseCase.execute([...this.selectedIds], "snooze", days);
        runInAction(() => { this.selectedIds.clear(); });
        await this.load();
    } finally {
        runInAction(() => { this.bulkActionRunning = false; });
    }
};

public bulkUndismiss = async (): Promise<void> => {
    this.bulkActionRunning = true;
    try {
        await this.bulkActionUseCase.execute([...this.selectedIds], "undismiss");
        runInAction(() => { this.selectedIds.clear(); });
        await this.load();
    } finally {
        runInAction(() => { this.bulkActionRunning = false; });
    }
};

public bulkRescan = async (): Promise<void> => {
    this.bulkActionRunning = true;
    try {
        await this.bulkRescanUseCase.execute([...this.selectedIds]);
        runInAction(() => { this.selectedIds.clear(); });
        await this.load();
    } finally {
        runInAction(() => { this.bulkActionRunning = false; });
    }
};

public exportSelected = (format: "csv" | "json"): void => {
    this.exportUseCase.execute(this.currentFilters(), format, [...this.selectedIds]);
};

public exportAll = (format: "csv" | "json"): void => {
    this.exportUseCase.execute(this.currentFilters(), format);
};

private currentFilters(): VulnerabilitiesGateway.ListFilters {
    return {
        ...(this.severity ? { severity: this.severity } : {}),
        ...(this.packageName ? { packageName: this.packageName } : {}),
        ...(this.source ? { source: this.source } : {}),
        ...(this.projectIds.length > 0 ? { projectIds: this.projectIds } : {}),
        ...(this.includeDismissed ? { includeDismissed: true } : {})
    };
}
```

Update `load()` to pass new filters:

```typescript
const filters = this.currentFilters();
await this.loadVulnerabilities.execute(Object.keys(filters).length > 0 ? filters : undefined);
```

Clear selection in `setSeverity`, `setPackageName`, `setSource`, `setPage`:

```typescript
public setSeverity = (value: string | null): void => {
    this.severity = value;
    this.page = 1;
    this.selectedIds.clear();
    void this.load();
};
// Same pattern for other filter setters and setPage
```

Load available projects on initial load:

```typescript
public load = async (): Promise<void> => {
    // ... existing sequence counter and loading logic
    if (this.availableProjects.length === 0) {
        const projects = await this.projectsGateway.list();
        runInAction(() => {
            this.availableProjects = projects.map(p => ({ value: p.id, label: p.name }));
        });
    }
    // ... rest of existing load
};
```

- [ ] **Step 5: Update feature.ts to wire new dependencies**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/feature.ts`, the presenter now needs additional constructor args. The DI container should auto-resolve them if they're registered. Verify that `ProjectsGateway` is accessible (it may need to be added as a dependency of the feature).

- [ ] **Step 6: Run presenter tests — expect PASS**

```bash
yarn vitest run src/ui/presentation/vulnerabilities/
```

- [ ] **Step 7: Update VulnerabilitiesPage component**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx`:

Add project multi-select in filter row:

```tsx
<MultiSelect
  placeholder="Projects"
  data={vm.availableProjects}
  value={vm.projectIds}
  onChange={ids => presenter.setProjectIds(ids)}
  clearable
  searchable
/>
```

Add dismissed toggle:

```tsx
<Switch
  label="Show dismissed"
  checked={vm.includeDismissed}
  onChange={event => presenter.setIncludeDismissed(event.currentTarget.checked)}
/>
```

Add export dropdown button in toolbar:

```tsx
<Menu>
  <Menu.Target>
    <Button variant="outline">Export</Button>
  </Menu.Target>
  <Menu.Dropdown>
    <Menu.Item onClick={() => presenter.exportAll("csv")}>Export CSV</Menu.Item>
    <Menu.Item onClick={() => presenter.exportAll("json")}>Export JSON</Menu.Item>
  </Menu.Dropdown>
</Menu>
```

Add checkbox column to table:

```tsx
<Table.Thead>
    <Table.Tr>
        <Table.Th>
            <Checkbox
                checked={vm.allOnPageSelected}
                indeterminate={vm.selectedCount > 0 && !vm.allOnPageSelected}
                onChange={() => presenter.selectAllOnPage()}
            />
        </Table.Th>
        {/* ... existing headers */}
    </Table.Tr>
</Table.Thead>
<Table.Tbody>
    {vm.vulnerabilities.map(vuln => (
        <Table.Tr key={vuln.id} opacity={vuln.isDismissed ? 0.5 : 1}>
            <Table.Td>
                <Checkbox
                    checked={vm.selectedIds.includes(vuln.id)}
                    onChange={() => presenter.toggleSelected(vuln.id)}
                />
            </Table.Td>
            {/* ... existing cells */}
            {vuln.dismissLabel && (
                <Badge size="xs" color="gray" ml="xs">{vuln.dismissLabel}</Badge>
            )}
        </Table.Tr>
    ))}
</Table.Tbody>
```

Add bulk action bar (appears when items selected):

```tsx
{
  vm.selectedCount > 0 && (
    <Group bg="blue.0" p="xs" style={{ borderRadius: 4 }}>
      <Text size="sm" fw={500}>
        {vm.selectedCount} selected
      </Text>
      <Button
        size="xs"
        variant="outline"
        loading={vm.bulkActionRunning}
        onClick={() => setShowDismissConfirm(true)}
      >
        Dismiss
      </Button>
      <Menu>
        <Menu.Target>
          <Button size="xs" variant="outline" loading={vm.bulkActionRunning}>
            Snooze
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => setSnoozeConfirm(7)}>7 days</Menu.Item>
          <Menu.Item onClick={() => setSnoozeConfirm(30)}>30 days</Menu.Item>
          <Menu.Item onClick={() => setSnoozeConfirm(90)}>90 days</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {vm.includeDismissed && (
        <Button
          size="xs"
          variant="outline"
          loading={vm.bulkActionRunning}
          onClick={() => setShowUndismissConfirm(true)}
        >
          Undismiss
        </Button>
      )}
      <Button
        size="xs"
        variant="outline"
        loading={vm.bulkActionRunning}
        onClick={() => setShowRescanConfirm(true)}
      >
        Rescan
      </Button>
      <Menu>
        <Menu.Target>
          <Button size="xs" variant="outline">
            Export Selected
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => presenter.exportSelected("csv")}>CSV</Menu.Item>
          <Menu.Item onClick={() => presenter.exportSelected("json")}>JSON</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Button size="xs" variant="subtle" onClick={() => presenter.clearSelection()}>
        Clear
      </Button>
    </Group>
  );
}
```

Add ConfirmDialog instances for destructive actions:

```tsx
<ConfirmDialog
    opened={showDismissConfirm}
    title="Dismiss Vulnerabilities"
    message={`Dismiss ${vm.selectedCount} selected vulnerabilities? They will be hidden from the default view.`}
    confirmLabel="Dismiss"
    onConfirm={async () => { setShowDismissConfirm(false); await presenter.bulkDismiss(); }}
    onCancel={() => setShowDismissConfirm(false)}
/>
<ConfirmDialog
    opened={snoozeConfirmDays !== null}
    title="Snooze Vulnerabilities"
    message={`Snooze ${vm.selectedCount} vulnerabilities for ${snoozeConfirmDays} days?`}
    confirmLabel="Snooze"
    onConfirm={async () => { const days = snoozeConfirmDays!; setSnoozeConfirm(null); await presenter.bulkSnooze(days); }}
    onCancel={() => setSnoozeConfirm(null)}
/>
<ConfirmDialog
    opened={showRescanConfirm}
    title="Rescan Projects"
    message={`Trigger vulnerability rescan for projects associated with ${vm.selectedCount} selected vulnerabilities?`}
    confirmLabel="Rescan"
    onConfirm={async () => { setShowRescanConfirm(false); await presenter.bulkRescan(); }}
    onCancel={() => setShowRescanConfirm(false)}
/>
<ConfirmDialog
    opened={showUndismissConfirm}
    title="Undismiss Vulnerabilities"
    message={`Undismiss ${vm.selectedCount} selected vulnerabilities?`}
    confirmLabel="Undismiss"
    onConfirm={async () => { setShowUndismissConfirm(false); await presenter.bulkUndismiss(); }}
    onCancel={() => setShowUndismissConfirm(false)}
/>
```

Add local state for confirm dialogs at top of component:

```tsx
const [showDismissConfirm, setShowDismissConfirm] = useState(false);
const [snoozeConfirmDays, setSnoozeConfirm] = useState<7 | 30 | 90 | null>(null);
const [showRescanConfirm, setShowRescanConfirm] = useState(false);
const [showUndismissConfirm, setShowUndismissConfirm] = useState(false);
```

- [ ] **Step 8: Run all vuln page tests**

```bash
yarn vitest run src/ui/presentation/vulnerabilities/
```

- [ ] **Step 9: Run full test suite + lint + build**

```bash
yarn vitest run && yarn lint && yarn build
```

- [ ] **Step 10: Commit**

```bash
git add src/ui/presentation/vulnerabilities/
git commit -m "feat(vulnerabilities): add project filter, bulk actions, export, dismissed toggle to vuln page"
```

---

### Task 6: Dashboard VulnTrendChart Widget

**Files:**

- Create: `src/ui/presentation/dashboard/Dashboard/components/VulnTrendChart.tsx`
- Modify: `src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts` — add `vulnTrend` to VM, `setVulnTrendRange` method
- Modify: `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts` — implement trend range state, pass to load
- Modify: `src/ui/presentation/dashboard/useCases/LoadDashboardUseCase.ts` — add vuln trend to parallel fetch
- Modify: `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx` — add VulnTrendChart widget

**Interfaces:**

- Consumes: `IDashboardRepository.getVulnTrend()`, `LoadVulnTrendUseCase`, `DashboardGateway.getVulnTrend()` from Task 4. `SEVERITY_COLORS` from `src/ui/shared/vulnerabilities/severityColors.ts`.
- Produces: `VulnTrendChart` component with time range toggle, `IDashboardPresenter.setVulnTrendRange(range)`, updated dashboard VM with `vulnTrend` and `vulnTrendRange`

- [ ] **Step 1: Add vuln trend to DashboardPresenter interface**

In `src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts`:

Add to `IDashboardViewModel`:

```typescript
vulnTrend: Array<{ date: string; critical: number; high: number; moderate: number; low: number }>;
vulnTrendRange: string;
```

Add to `IDashboardPresenter`:

```typescript
setVulnTrendRange: (range: string) => void;
```

- [ ] **Step 2: Write presenter tests for vuln trend**

```typescript
describe("DashboardPresenter vuln trend", () => {
  it("includes vulnTrend from repository in vm", async () => {
    const { presenter, httpClient } = createTestContext();
    const trendPoints = [{ date: "2026-07-01", critical: 1, high: 2, moderate: 0, low: 3 }];
    httpClient.mockDashboardResponses({ vulnTrend: { points: trendPoints } });

    await presenter.load();

    expect(presenter.vm.vulnTrend).toEqual(trendPoints);
  });

  it("setVulnTrendRange updates range and reloads trend", async () => {
    const { presenter, httpClient } = createTestContext();
    httpClient.mockDashboardResponses({});

    await presenter.load();
    presenter.setVulnTrendRange("7d");

    expect(presenter.vm.vulnTrendRange).toBe("7d");
  });

  it("defaults vulnTrendRange to 30d", () => {
    const { presenter } = createTestContext();
    expect(presenter.vm.vulnTrendRange).toBe("30d");
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
yarn vitest run src/ui/presentation/dashboard/
```

- [ ] **Step 4: Implement presenter changes**

In `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts`:

Add field:

```typescript
private vulnTrendRange = "30d";
```

Add to `vm` getter:

```typescript
vulnTrend: this.repository.getVulnTrend(),
vulnTrendRange: this.vulnTrendRange
```

Add method:

```typescript
public setVulnTrendRange = (range: string): void => {
    this.vulnTrendRange = range;
    this.loadVulnTrend().catch(() => {});
};

private loadVulnTrend = async (): Promise<void> => {
    const days = this.vulnTrendRange === "all" ? undefined : Number(this.vulnTrendRange.replace("d", "")) as 7 | 30 | 90;
    await this.loadVulnTrendUseCase.execute(days);
};
```

Update constructor to accept `LoadVulnTrendUseCase`:

```typescript
public constructor(
    private readonly repository: DashboardRepository.Interface,
    private readonly loadDashboard: LoadDashboardUseCase.Interface,
    private readonly loadVulnTrendUseCase: LoadVulnTrendUseCase.Interface,
    private readonly webSocketListener: WebSocketListener.Interface
) {
    makeAutoObservable(this, { vm: computed });
    // ... existing WS listeners
}
```

- [ ] **Step 5: Update LoadDashboardUseCase to fetch vuln trend**

In `src/ui/presentation/dashboard/useCases/LoadDashboardUseCase.ts`, add vuln trend to parallel fetch:

```typescript
public execute = async (trendRange: string): Promise<void> => {
    const vulnTrendDays = trendRange === "all" ? undefined : Number(trendRange.replace("d", ""));
    const [health, trend, activity, staleness, security, vulnSummary, vulnTrend] = await Promise.all([
        this.gateway.getHealth(),
        this.gateway.getTrend(trendRange),
        this.gateway.getActivity(),
        this.gateway.getStaleness(),
        this.gateway.getSecurity(),
        this.gateway.getVulnSummary(),
        this.gateway.getVulnTrend(vulnTrendDays as 7 | 30 | 90 | undefined)
    ]);

    this.repository.setHealthResponse(health);
    this.repository.setTrendResponse(trend);
    this.repository.setActivity(activity.items);
    this.repository.setStaleness(staleness.items);
    this.repository.setSecurity(security.items);
    this.repository.setVulnSummary(vulnSummary);
    this.repository.setVulnTrend(vulnTrend.points);
};
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
yarn vitest run src/ui/presentation/dashboard/
```

- [ ] **Step 7: Create VulnTrendChart component**

Create `src/ui/presentation/dashboard/Dashboard/components/VulnTrendChart.tsx`:

```tsx
import { Card, Group, SegmentedControl, Text } from "@mantine/core";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { SEVERITY_COLORS } from "#ui/shared/vulnerabilities/severityColors.js";

const RANGE_OPTIONS = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" }
];

interface VulnTrendPoint {
  date: string;
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

interface VulnTrendChartProps {
  data: VulnTrendPoint[];
  range: string;
  onRangeChange: (range: string) => void;
}

export function VulnTrendChart({
  data,
  range,
  onRangeChange
}: VulnTrendChartProps): React.ReactNode {
  return (
    <Card shadow="sm" padding="lg" withBorder>
      <Group justify="space-between" mb="md">
        <Text fw={600}>Vulnerability Trend</Text>
        <SegmentedControl data={RANGE_OPTIONS} value={range} onChange={onRangeChange} size="xs" />
      </Group>

      {data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No vulnerability data yet — run a scan to start tracking trends
        </Text>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="critical"
              stroke={SEVERITY_COLORS.critical}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="high"
              stroke={SEVERITY_COLORS.high}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="moderate"
              stroke={SEVERITY_COLORS.moderate}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="low"
              stroke={SEVERITY_COLORS.low}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
```

- [ ] **Step 8: Add VulnTrendChart to DashboardPage**

In `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx`, add after `HealthTrendChart`:

```tsx
<VulnTrendChart
  data={vm.vulnTrend}
  range={vm.vulnTrendRange}
  onRangeChange={range => presenter.setVulnTrendRange(range)}
/>
```

Place it as a full-width row, before the `SimpleGrid` with the 2x2 widgets.

- [ ] **Step 9: Update DashboardPresentation feature.ts**

Ensure `LoadVulnTrendUseCase` is wired to the presenter. Update the feature's dependencies if needed to include the vuln trend use case registration.

- [ ] **Step 10: Run all dashboard tests**

```bash
yarn vitest run src/ui/presentation/dashboard/
```

- [ ] **Step 11: Run full test suite + lint + build**

```bash
yarn vitest run && yarn lint && yarn build
```

- [ ] **Step 12: Commit**

```bash
git add src/ui/presentation/dashboard/
git commit -m "feat(dashboard): add VulnTrendChart widget with severity lines and time range toggle"
```
