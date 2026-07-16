# Historical Trend Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the dashboard with historical trend analysis across 5 dimensions (staleness, license compliance, auto-fix PRs, package count, dependency changes) with sparkline summary cards on the dashboard and a dedicated /trends page with full interactive charts.

**Architecture:** Two new DB tables (license_snapshots, dependency_changes) populated by executor hooks during existing scan flows. Four new dashboard API endpoints query existing + new tables. Dashboard gets sparkline summary cards; new /trends page has full Recharts charts with independent range toggles.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, SQLite, Zod, React, Mantine UI, MobX, Recharts

## Global Constraints

- No inline structural types — always use named interfaces
- No short names — "Vulnerability" not "Vuln", "Compliance" not "Comp"
- DI: abstractions in abstractions/ directory, Impl suffix only on class declaration, namespace exports
- API tests: in-memory SQLite via `createTestDatabaseClient()`, real services, only mock `CommandRunner`
- UI tests: mock `HTTPClient` and `WebSocketListener` at DI level
- Yarn 4, no `npx`/`yarn dlx`
- All named exports, no default exports
- 4-space indent, double quotes, no trailing commas
- Executors are constructed in `JobExecutorRegistry`, NOT individually DI-wired

---

### Task 1: DB Schema + DependencyChangeService Abstraction + Implementation + Tests

**Files:**

- Modify: `src/api/db/schema.ts` (add `licenseSnapshots` + `dependencyChanges` tables)
- Modify: `src/testing/helpers/createTestDb.ts` (add CREATE TABLE statements)
- Create: `src/api/services/abstractions/DependencyChangeService.ts`
- Create: `src/api/services/DependencyChangeService.ts`
- Create: `src/api/services/__tests__/DependencyChangeService.test.ts`
- Modify: `src/api/feature.ts` (register DependencyChangeService)

**Interfaces:**

- Consumes: `DatabaseClient`, DB schema (`scanResults`, `projects`)
- Produces:
  - `licenseSnapshots` Drizzle table export
  - `dependencyChanges` Drizzle table export
  - `DependencyChangeService.Interface` with `detectAndPersist(projectId: string, newScanResults: IScanResultInput[]): Promise<number>`
  - `DependencyChangeService.ScanResultInput` type (`{ name: string; currentVersion: string }`)

- [ ] **Step 1: Add DB tables to Drizzle schema**

In `src/api/db/schema.ts`, add after the `dependencyEdges` table:

```typescript
export const licenseSnapshots = sqliteTable(
  "license_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    totalPackages: integer("total_packages").notNull(),
    compliantCount: integer("compliant_count").notNull(),
    deniedCount: integer("denied_count").notNull(),
    warnedCount: integer("warned_count").notNull(),
    scannedAt: integer("scanned_at").notNull()
  },
  table => ({
    projectDateUnique: uniqueIndex("license_snapshots_project_date_unique").on(
      table.projectId,
      table.date
    )
  })
);

export const dependencyChanges = sqliteTable("dependency_changes", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  packageName: text("package_name").notNull(),
  changeType: text("change_type").notNull(),
  previousVersion: text("previous_version"),
  newVersion: text("new_version"),
  detectedAt: integer("detected_at").notNull()
});
```

- [ ] **Step 2: Add CREATE TABLE to createTestDb.ts**

In `src/testing/helpers/createTestDb.ts`, add inside the `CREATE_TABLES` template string (after the `dependency_edges` CREATE TABLE):

```sql
CREATE TABLE license_snapshots (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    total_packages INTEGER NOT NULL,
    compliant_count INTEGER NOT NULL,
    denied_count INTEGER NOT NULL,
    warned_count INTEGER NOT NULL,
    scanned_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX license_snapshots_project_date_unique ON license_snapshots (project_id, date);
CREATE TABLE dependency_changes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    change_type TEXT NOT NULL,
    previous_version TEXT,
    new_version TEXT,
    detected_at INTEGER NOT NULL
);
```

- [ ] **Step 3: Create DependencyChangeService abstraction**

Create `src/api/services/abstractions/DependencyChangeService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IScanResultInput {
  name: string;
  currentVersion: string;
}

export interface IDependencyChangeService {
  detectAndPersist(projectId: string, newScanResults: IScanResultInput[]): Promise<number>;
}

export const DependencyChangeService = createAbstraction<IDependencyChangeService>(
  "Api/DependencyChangeService"
);

export namespace DependencyChangeService {
  export type Interface = IDependencyChangeService;
  export type ScanResultInput = IScanResultInput;
}
```

- [ ] **Step 4: Write DependencyChangeService tests**

Create `src/api/services/__tests__/DependencyChangeService.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { DatabaseClient as DatabaseClientAbstraction } from "#api/db/abstractions/DatabaseClient.js";
import { projects, scanResults, dependencyChanges } from "#api/db/schema.js";
import { createContainer } from "#shared/index.js";
import { DependencyChangeService as DependencyChangeServiceAbstraction } from "../abstractions/DependencyChangeService.js";
import { DependencyChangeService as DependencyChangeServiceRegistration } from "../DependencyChangeService.js";

describe("DependencyChangeService", () => {
  let databaseClient: DatabaseClient.Interface;
  let service: DependencyChangeServiceAbstraction.Interface;

  beforeEach(async () => {
    databaseClient = await createTestDatabaseClient();
    const container = createContainer();
    container.registerInstance(DatabaseClientAbstraction, databaseClient);
    container.register(DependencyChangeServiceRegistration);
    service = container.resolve(DependencyChangeServiceAbstraction);
  });

  async function seedProject(id: string, name: string): Promise<void> {
    await databaseClient.db
      .insert(projects)
      .values({ id, name, path: `/projects/${name}`, addedAt: Date.now() })
      .run();
  }

  async function seedScanResult(
    projectId: string,
    name: string,
    currentVersion: string
  ): Promise<void> {
    await databaseClient.db
      .insert(scanResults)
      .values({
        id: generateId(),
        projectId,
        name,
        currentVersion,
        latestVersion: currentVersion,
        latestInRange: currentVersion,
        type: "dependency",
        upgradeType: "none",
        scannedAt: Date.now()
      })
      .run();
  }

  interface IChangeRow {
    packageName: string;
    changeType: string;
    previousVersion: string | null;
    newVersion: string | null;
  }

  async function getChanges(): Promise<IChangeRow[]> {
    return databaseClient.db
      .select({
        packageName: dependencyChanges.packageName,
        changeType: dependencyChanges.changeType,
        previousVersion: dependencyChanges.previousVersion,
        newVersion: dependencyChanges.newVersion
      })
      .from(dependencyChanges)
      .all();
  }

  it("detects added packages on first scan (no previous data)", async () => {
    await seedProject("p1", "my-app");

    const count = await service.detectAndPersist("p1", [
      { name: "lodash", currentVersion: "4.17.21" },
      { name: "axios", currentVersion: "1.6.0" }
    ]);

    expect(count).toBe(2);
    const changes = await getChanges();
    expect(changes).toHaveLength(2);
    expect(changes.every(change => change.changeType === "added")).toBe(true);
  });

  it("detects removed packages", async () => {
    await seedProject("p1", "my-app");
    await seedScanResult("p1", "lodash", "4.17.21");
    await seedScanResult("p1", "axios", "1.6.0");

    const count = await service.detectAndPersist("p1", [
      { name: "lodash", currentVersion: "4.17.21" }
    ]);

    expect(count).toBe(1);
    const changes = await getChanges();
    const removed = changes.filter(change => change.changeType === "removed");
    expect(removed).toHaveLength(1);
    expect(removed[0]!.packageName).toBe("axios");
    expect(removed[0]!.previousVersion).toBe("1.6.0");
    expect(removed[0]!.newVersion).toBeNull();
  });

  it("detects version changes", async () => {
    await seedProject("p1", "my-app");
    await seedScanResult("p1", "lodash", "4.17.20");

    const count = await service.detectAndPersist("p1", [
      { name: "lodash", currentVersion: "4.17.21" }
    ]);

    expect(count).toBe(1);
    const changes = await getChanges();
    expect(changes[0]!.changeType).toBe("version-changed");
    expect(changes[0]!.previousVersion).toBe("4.17.20");
    expect(changes[0]!.newVersion).toBe("4.17.21");
  });

  it("returns zero when scan is unchanged", async () => {
    await seedProject("p1", "my-app");
    await seedScanResult("p1", "lodash", "4.17.21");

    const count = await service.detectAndPersist("p1", [
      { name: "lodash", currentVersion: "4.17.21" }
    ]);

    expect(count).toBe(0);
    const changes = await getChanges();
    expect(changes).toHaveLength(0);
  });

  it("handles mixed adds, removes, and version changes", async () => {
    await seedProject("p1", "my-app");
    await seedScanResult("p1", "lodash", "4.17.20");
    await seedScanResult("p1", "axios", "1.5.0");

    const count = await service.detectAndPersist("p1", [
      { name: "lodash", currentVersion: "4.17.21" },
      { name: "express", currentVersion: "4.18.0" }
    ]);

    expect(count).toBe(3);
    const changes = await getChanges();
    const types = changes.map(change => `${change.packageName}:${change.changeType}`).sort();
    expect(types).toEqual(["axios:removed", "express:added", "lodash:version-changed"]);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `yarn test src/api/services/__tests__/DependencyChangeService.test.ts`
Expected: FAIL — DependencyChangeService not found

- [ ] **Step 6: Implement DependencyChangeService**

Create `src/api/services/DependencyChangeService.ts`:

```typescript
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { DependencyChangeService as Abstraction } from "./abstractions/DependencyChangeService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { scanResults, dependencyChanges } from "#api/db/schema.js";

interface IExistingPackage {
  name: string;
  currentVersion: string;
}

class DependencyChangeServiceImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async detectAndPersist(
    projectId: string,
    newScanResults: Abstraction.ScanResultInput[]
  ): Promise<number> {
    const { db } = this.databaseClient;

    const existingRows = await db
      .select({ name: scanResults.name, currentVersion: scanResults.currentVersion })
      .from(scanResults)
      .where(eq(scanResults.projectId, projectId))
      .all();

    const existingMap = new Map<string, IExistingPackage>();
    for (const row of existingRows) {
      existingMap.set(row.name, row);
    }

    const newMap = new Map<string, Abstraction.ScanResultInput>();
    for (const result of newScanResults) {
      newMap.set(result.name, result);
    }

    interface IChangeRecord {
      packageName: string;
      changeType: string;
      previousVersion: string | null;
      newVersion: string | null;
    }

    const changes: IChangeRecord[] = [];
    const now = Date.now();

    for (const [name, newResult] of newMap) {
      const existing = existingMap.get(name);
      if (!existing) {
        changes.push({
          packageName: name,
          changeType: "added",
          previousVersion: null,
          newVersion: newResult.currentVersion
        });
      } else if (existing.currentVersion !== newResult.currentVersion) {
        changes.push({
          packageName: name,
          changeType: "version-changed",
          previousVersion: existing.currentVersion,
          newVersion: newResult.currentVersion
        });
      }
    }

    for (const [name, existing] of existingMap) {
      if (!newMap.has(name)) {
        changes.push({
          packageName: name,
          changeType: "removed",
          previousVersion: existing.currentVersion,
          newVersion: null
        });
      }
    }

    if (changes.length > 0) {
      await db
        .insert(dependencyChanges)
        .values(
          changes.map(change => ({
            id: generateId(),
            projectId,
            packageName: change.packageName,
            changeType: change.changeType,
            previousVersion: change.previousVersion,
            newVersion: change.newVersion,
            detectedAt: now
          }))
        )
        .run();
    }

    return changes.length;
  }
}

export const DependencyChangeService = Abstraction.createImplementation({
  implementation: DependencyChangeServiceImpl,
  dependencies: [DatabaseClient]
});
```

- [ ] **Step 7: Register DependencyChangeService in API feature**

In `src/api/feature.ts`, add:

- Import: `import { DependencyChangeService } from "./services/DependencyChangeService.js";`
- Registration: `container.register(DependencyChangeService).inSingletonScope();` (after SbomService)

- [ ] **Step 8: Run tests to verify they pass**

Run: `yarn test src/api/services/__tests__/DependencyChangeService.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 9: Run build**

Run: `yarn build`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/api/db/schema.ts src/testing/helpers/createTestDb.ts src/api/services/abstractions/DependencyChangeService.ts src/api/services/DependencyChangeService.ts src/api/services/__tests__/DependencyChangeService.test.ts src/api/feature.ts
git commit -m "feat(trends): add license_snapshots and dependency_changes tables with DependencyChangeService"
```

---

### Task 2: Executor Integration (ScanJobExecutor + LicenseScanJobExecutor)

**Files:**

- Modify: `src/api/services/jobExecutors/ScanJobExecutor.ts` (add DependencyChangeService call before upsert)
- Modify: `src/api/services/jobExecutors/LicenseScanJobExecutor.ts` (add license_snapshots upsert after scan)
- Modify: `src/api/services/jobExecutors/JobExecutorRegistry.ts` (pass DependencyChangeService to ScanJobExecutor)

**Interfaces:**

- Consumes: `DependencyChangeService.Interface` (Task 1), `LicensePolicyService.getComplianceStatus()`, `licenseSnapshots` table (Task 1)
- Produces: scan-time dependency change recording, license snapshot recording

- [ ] **Step 1: Modify ScanJobExecutor constructor to accept DependencyChangeService**

In `src/api/services/jobExecutors/ScanJobExecutor.ts`:

- Add import: `import type { DependencyChangeService } from "../abstractions/DependencyChangeService.js";`
- Add constructor parameter after `dependencyGraphService`: `private readonly dependencyChangeService: DependencyChangeService.Interface`

- [ ] **Step 2: Add dependency change detection before scan result upsert**

In `ScanJobExecutor.execute()`, BEFORE the `delete(scanResults)` call (around line 236), add:

```typescript
try {
  await this.dependencyChangeService.detectAndPersist(
    context.referenceId,
    results.map(dependency => ({
      name: dependency.name,
      currentVersion: dependency.currentVersion
    }))
  );
} catch {
  void this.errorReporter.reportJobWarning(
    context.jobId,
    context.referenceId,
    context.projectPath,
    context.packageManager,
    "Dependency change detection failed"
  );
}
```

- [ ] **Step 3: Update JobExecutorRegistry to pass DependencyChangeService**

In `src/api/services/jobExecutors/JobExecutorRegistry.ts`:

- Add import: `import { DependencyChangeService } from "../abstractions/DependencyChangeService.js";`
- Add constructor parameter after `dependencyGraphService`: `dependencyChangeService: DependencyChangeService.Interface`
- Add to `new ScanJobExecutor(...)` call: `dependencyChangeService` as the last argument
- Add `DependencyChangeService` to the `dependencies` array at the bottom

- [ ] **Step 4: Modify LicenseScanJobExecutor to upsert license_snapshots**

In `src/api/services/jobExecutors/LicenseScanJobExecutor.ts`:

- Add import: `import { licenseSnapshots } from "#api/db/schema.js";` (add to existing schema import)
- Add import: `import { generateId } from "@webiny/stdlib";` (if not already present)

After the `evaluate()` call and BEFORE the `broadcast("license-scan:complete")` call (around line 125), add:

```typescript
try {
  const complianceStatus = await this.licensePolicyService.getComplianceStatus(projectId);
  const today = new Date().toISOString().slice(0, 10);
  await this.databaseClient.db
    .insert(licenseSnapshots)
    .values({
      id: generateId(),
      projectId,
      date: today,
      totalPackages: complianceStatus.total,
      compliantCount: complianceStatus.allowed,
      deniedCount: complianceStatus.denied,
      warnedCount: complianceStatus.warned,
      scannedAt: Date.now()
    })
    .onConflictDoUpdate({
      target: [licenseSnapshots.projectId, licenseSnapshots.date],
      set: {
        totalPackages: complianceStatus.total,
        compliantCount: complianceStatus.allowed,
        deniedCount: complianceStatus.denied,
        warnedCount: complianceStatus.warned,
        scannedAt: Date.now()
      }
    })
    .run();
} catch {
  void this.errorReporter.reportJobWarning(
    context.jobId,
    context.referenceId,
    context.projectPath,
    context.packageManager,
    "License snapshot recording failed"
  );
}
```

Note: Check the exact field names returned by `getComplianceStatus()` — read `src/api/services/abstractions/LicensePolicyService.ts` for the `IComplianceStatus` interface to confirm `total`, `allowed`, `denied`, `warned` field names.

- [ ] **Step 5: Add executor integration tests**

Extend existing `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts` — add a test that verifies `dependency_changes` rows are inserted after a scan completes. Seed scanResults with package A, run executor with packages A (version changed) + B (new), verify dependency_changes has a `version-changed` and an `added` row.

Extend existing `src/api/services/jobExecutors/__tests__/LicenseScanJobExecutor.test.ts` — add a test that verifies `license_snapshots` row is upserted after a license scan. Run executor, query license_snapshots, verify row exists with correct counts. Run executor again same day, verify upsert (still one row, updated counts).

- [ ] **Step 6: Run build**

Run: `yarn build`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `yarn test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/api/services/jobExecutors/ScanJobExecutor.ts src/api/services/jobExecutors/LicenseScanJobExecutor.ts src/api/services/jobExecutors/JobExecutorRegistry.ts src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts src/api/services/jobExecutors/__tests__/LicenseScanJobExecutor.test.ts
git commit -m "feat(trends): integrate DependencyChangeService and license snapshot recording into scan executors"
```

---

### Task 3: Dashboard API Endpoints (4 new routes) + Tests

**Files:**

- Modify: `src/shared/routes/dashboard.ts` (add 4 new route definitions)
- Modify: `src/api/routes/dashboard.ts` (add 4 new route handlers)
- Create or modify: `src/api/routes/__tests__/dashboard.test.ts` (add tests for new endpoints)

**Interfaces:**

- Consumes: `healthSnapshots`, `licenseSnapshots`, `autoFixPullRequests`, `dependencyChanges` tables, `sendList` helper
- Produces: 4 new API endpoints (staleness-trend, license-trend, auto-fix-trend, dependency-changes)

- [ ] **Step 1: Add shared route definitions**

In `src/shared/routes/dashboard.ts`, add after the existing `dashboardVulnerabilityTrendRoute`:

```typescript
export const dashboardStalenessTrendRoute = defineRoute({
  method: "GET",
  path: "/api/dashboard/staleness-trend",
  description: "Get historical staleness counts for trend chart",
  params: z.object({}),
  querystring: z.object({
    days: z.enum(["7", "30", "90"]).optional()
  }),
  response: z.object({
    points: z.array(
      z.object({
        date: z.string(),
        patchOutdated: z.number(),
        minorOutdated: z.number(),
        majorOutdated: z.number(),
        totalPackages: z.number()
      })
    )
  })
});

export const dashboardLicenseTrendRoute = defineRoute({
  method: "GET",
  path: "/api/dashboard/license-trend",
  description: "Get historical license compliance counts for trend chart",
  params: z.object({}),
  querystring: z.object({
    days: z.enum(["7", "30", "90"]).optional()
  }),
  response: z.object({
    points: z.array(
      z.object({
        date: z.string(),
        compliantCount: z.number(),
        deniedCount: z.number(),
        warnedCount: z.number(),
        totalPackages: z.number()
      })
    )
  })
});

export const dashboardAutoFixTrendRoute = defineRoute({
  method: "GET",
  path: "/api/dashboard/auto-fix-trend",
  description: "Get historical auto-fix PR counts by status",
  params: z.object({}),
  querystring: z.object({
    days: z.enum(["7", "30", "90"]).optional()
  }),
  response: z.object({
    points: z.array(
      z.object({
        date: z.string(),
        pending: z.number(),
        created: z.number(),
        merged: z.number(),
        closed: z.number(),
        failed: z.number()
      })
    )
  })
});

export const dashboardDependencyChangesRoute = defineRoute({
  method: "GET",
  path: "/api/dashboard/dependency-changes",
  description: "Get recent dependency changes across projects",
  params: z.object({}),
  querystring: z.object({
    projectId: z.string().optional(),
    limit: z.coerce.number().min(1).max(200).default(50)
  }),
  response: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        projectId: z.string(),
        packageName: z.string(),
        changeType: z.enum(["added", "removed", "version-changed"]),
        previousVersion: z.string().nullable(),
        newVersion: z.string().nullable(),
        detectedAt: z.number()
      })
    ),
    total: z.number()
  })
});
```

- [ ] **Step 2: Add route handlers**

In `src/api/routes/dashboard.ts`, add imports for the new route definitions and new table imports (`licenseSnapshots`, `dependencyChanges`, `autoFixPullRequests`). Add the 4 new route handlers after the existing vulnerability trend handler.

Note on auto-fix trend: `auto_fix_pull_requests` status mutates in place (pending→created→merged). Grouping by `updatedAt` date shows each PR's current status bucketed under the day it last changed — this gives "outcome-by-update-date" view, not a true daily snapshot. This is acceptable for MVP; a snapshot table can be added later if needed.

The staleness-trend handler follows the same pattern as the vulnerability trend handler — date cutoff via range param, SUM grouped by date:

Define typed row interfaces for each handler (same pattern as existing `IRawVulnerabilityTrendRow`):

```typescript
interface IRawStalenessTrendRow {
  date: string;
  patchOutdated: number;
  minorOutdated: number;
  majorOutdated: number;
  totalPackages: number;
}

interface IRawLicenseTrendRow {
  date: string;
  compliantCount: number;
  deniedCount: number;
  warnedCount: number;
  totalPackages: number;
}

interface IRawAutoFixTrendRow {
  date: string;
  status: string;
  count: number;
}
```

```typescript
registerRoute(app, dashboardStalenessTrendRoute, {}, async (request, reply) => {
  const { days } = request.query;
  const dateFilter = daysToCutoff(days);

  const query = dateFilter
    ? sql`
            SELECT date,
                SUM(patch_outdated) AS patchOutdated,
                SUM(minor_outdated) AS minorOutdated,
                SUM(major_outdated) AS majorOutdated,
                SUM(total_packages) AS totalPackages
            FROM health_snapshots
            WHERE date >= ${dateFilter}
            GROUP BY date ORDER BY date ASC`
    : sql`
            SELECT date,
                SUM(patch_outdated) AS patchOutdated,
                SUM(minor_outdated) AS minorOutdated,
                SUM(major_outdated) AS majorOutdated,
                SUM(total_packages) AS totalPackages
            FROM health_snapshots
            GROUP BY date ORDER BY date ASC`;

  const rows = await db.all<IRawStalenessTrendRow>(query);
  reply.send({ points: rows });
});
```

Extract a shared `daysToCutoff` helper (used by all 3 new trend endpoints + existing vuln trend can be refactored to use it):

```typescript
function daysToCutoff(days: string | undefined): string | undefined {
  if (!days) {
    return undefined;
  }
  const cutoff = new Date(Date.now() - Number(days) * 86400000).toISOString().slice(0, 10);
  return cutoff;
}
```

License-trend handler queries `license_snapshots` with same pattern (SUM by date, `daysToCutoff` for filtering).

Auto-fix-trend handler: `auto_fix_pull_requests.updatedAt` is epoch-ms (integer), NOT a text date column. Must convert with `DATE(updated_at/1000, 'unixepoch')` for grouping. Query pivots status counts per date:

```sql
SELECT DATE(updated_at/1000, 'unixepoch') AS date,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN status = 'created' THEN 1 ELSE 0 END) AS created,
    SUM(CASE WHEN status = 'merged' THEN 1 ELSE 0 END) AS merged,
    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
FROM auto_fix_pull_requests
WHERE DATE(updated_at/1000, 'unixepoch') >= ${dateFilter}
GROUP BY DATE(updated_at/1000, 'unixepoch')
ORDER BY date ASC
```

When `dateFilter` is undefined (no days param = show all), omit the WHERE clause.

Dependency-changes handler uses `sendList` with optional `projectId` filter and `limit`. Must include a separate COUNT query for `total` (since `limit` truncates `items.length`), same pattern as existing `jobs` and `logs` routes.

- [ ] **Step 3: Write route tests**

Create or extend `src/api/routes/__tests__/dashboard.test.ts` with tests for all 4 new endpoints. Seed test data into the appropriate tables, verify response shapes and filtering.

Key test cases:

- Staleness trend: seed health_snapshots for 2 projects over 3 days, verify SUM aggregation and date ordering
- License trend: seed license_snapshots, verify response shape
- Auto-fix trend: seed auto_fix_pull_requests with different statuses and dates, verify pivot
- Dependency changes: seed dependency_changes, verify limit, projectId filter, and total count
- Range filtering: verify "7d" only returns recent data, "all" returns everything

- [ ] **Step 4: Run tests**

Run: `yarn test src/api/routes/__tests__/dashboard.test.ts`
Expected: PASS

- [ ] **Step 5: Run full build and test suite**

Run: `yarn build && yarn test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/routes/dashboard.ts src/api/routes/dashboard.ts src/api/routes/__tests__/dashboard.test.ts
git commit -m "feat(trends): add staleness, license, auto-fix trend and dependency changes API endpoints"
```

---

### Task 4: Dashboard Sparkline Extension (Gateway + Repository + UseCase + Cards)

**Files:**

- Modify: `src/ui/features/dashboard/abstractions/DashboardGateway.ts` (add sparkline response types + methods)
- Modify: `src/ui/features/dashboard/DashboardGateway.ts` (add sparkline endpoint calls)
- Modify: `src/ui/features/dashboard/abstractions/DashboardRepository.ts` (add sparkline getters/setters)
- Modify: `src/ui/features/dashboard/DashboardRepository.ts` (implement sparkline storage)
- Modify: `src/ui/presentation/dashboard/useCases/LoadDashboardUseCase.ts` (add sparkline fetches to parallel Promise.all)
- Create: `src/ui/presentation/dashboard/Dashboard/components/StalenessSummaryCard.tsx`
- Create: `src/ui/presentation/dashboard/Dashboard/components/LicenseComplianceSummaryCard.tsx`
- Create: `src/ui/presentation/dashboard/Dashboard/components/AutoFixSummaryCard.tsx`
- Modify: `src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts` (add sparkline data to VM)
- Modify: `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts` (add sparkline data to VM getter)
- Modify: `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx` (render sparkline cards)

**Interfaces:**

- Consumes: `dashboardStalenessTrendRoute`, `dashboardLicenseTrendRoute`, `dashboardAutoFixTrendRoute` from shared routes
- Produces: 3 sparkline summary cards rendered on dashboard, trend data accessible via DashboardPresenter VM

- [ ] **Step 1: Add sparkline types and methods to DashboardGateway abstraction**

In `src/ui/features/dashboard/abstractions/DashboardGateway.ts`, add response types:

```typescript
export interface IStalenessTrendPoint {
  date: string;
  patchOutdated: number;
  minorOutdated: number;
  majorOutdated: number;
  totalPackages: number;
}

export interface ILicenseTrendPoint {
  date: string;
  compliantCount: number;
  deniedCount: number;
  warnedCount: number;
  totalPackages: number;
}

export interface IAutoFixTrendPoint {
  date: string;
  pending: number;
  created: number;
  merged: number;
  closed: number;
  failed: number;
}
```

Add named response interfaces:

```typescript
export interface IStalenessTrendResponse {
  points: IStalenessTrendPoint[];
}

export interface ILicenseTrendResponse {
  points: ILicenseTrendPoint[];
}

export interface IAutoFixTrendResponse {
  points: IAutoFixTrendPoint[];
}
```

Add to `IDashboardGateway`:

```typescript
getStalenessTrend(days?: string): Promise<IStalenessTrendResponse>;
getLicenseTrend(days?: string): Promise<ILicenseTrendResponse>;
getAutoFixTrend(days?: string): Promise<IAutoFixTrendResponse>;
```

Add to namespace exports:

```typescript
export type StalenessTrendPoint = IStalenessTrendPoint;
export type LicenseTrendPoint = ILicenseTrendPoint;
export type AutoFixTrendPoint = IAutoFixTrendPoint;
export type StalenessTrendResponse = IStalenessTrendResponse;
export type LicenseTrendResponse = ILicenseTrendResponse;
export type AutoFixTrendResponse = IAutoFixTrendResponse;
```

- [ ] **Step 2: Implement gateway methods**

In `src/ui/features/dashboard/DashboardGateway.ts`, add 3 new methods using `HTTPClient.request()` with the new shared route definitions. Import the route definitions from `#shared/routes/index.js`.

- [ ] **Step 3: Add sparkline storage to DashboardRepository**

In `src/ui/features/dashboard/abstractions/DashboardRepository.ts`, add:

```typescript
getStalenessTrend(): DashboardGateway.StalenessTrendPoint[];
setStalenessTrend(points: DashboardGateway.StalenessTrendPoint[]): void;
getLicenseTrend(): DashboardGateway.LicenseTrendPoint[];
setLicenseTrend(points: DashboardGateway.LicenseTrendPoint[]): void;
getAutoFixTrend(): DashboardGateway.AutoFixTrendPoint[];
setAutoFixTrend(points: DashboardGateway.AutoFixTrendPoint[]): void;
```

Implement in `src/ui/features/dashboard/DashboardRepository.ts` — private arrays with getter/setter pairs, same pattern as existing `vulnerabilityTrend`.

- [ ] **Step 4: Extend LoadDashboardUseCase**

In `src/ui/presentation/dashboard/useCases/LoadDashboardUseCase.ts`, add 3 more calls to the existing `Promise.all`:

```typescript
(this.gateway.getStalenessTrend("7"),
  this.gateway.getLicenseTrend("7"),
  this.gateway.getAutoFixTrend("7"));
```

Store results in repository via the new setter methods.

- [ ] **Step 5: Add sparkline data to DashboardPresenter VM**

In `src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts`, add to the VM interface:

```typescript
stalenessTrend: DashboardGateway.StalenessTrendPoint[];
licenseTrend: DashboardGateway.LicenseTrendPoint[];
autoFixTrend: DashboardGateway.AutoFixTrendPoint[];
```

In `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts`, read from repository in the `vm` getter.

- [ ] **Step 6: Create sparkline card components**

Create 3 sparkline card components in `src/ui/presentation/dashboard/Dashboard/components/`. Each follows the same pattern:

```typescript
// StalenessSummaryCard.tsx
import type React from "react";
import { Card, Text, Group, Stack } from "@mantine/core";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { navigate } from "#ui/shared/router/router.js";
import type { DashboardGateway } from "../../../../features/dashboard/abstractions/DashboardGateway.js";

interface StalenessSummaryCardProps {
    data: DashboardGateway.StalenessTrendPoint[];
}

export function StalenessSummaryCard({ data }: StalenessSummaryCardProps): React.ReactNode {
    return (
        <Card
            withBorder
            padding="md"
            onClick={() => navigate("/trends")}
            style={{ cursor: "pointer" }}
        >
            <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                    <Text size="sm" c="dimmed">Dependency Staleness</Text>
                    <Text size="xs" c="dimmed">major outdated (7d)</Text>
                </Stack>
                <ResponsiveContainer width={120} height={40}>
                    <LineChart data={data}>
                        <Line
                            type="monotone"
                            dataKey="majorOutdated"
                            stroke="#fa5252"
                            dot={false}
                            strokeWidth={2}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </Group>
        </Card>
    );
}
```

`LicenseComplianceSummaryCard` uses `compliantCount` with green stroke. `AutoFixSummaryCard` uses `created` with blue stroke.

- [ ] **Step 7: Add sparkline cards to DashboardPage**

In `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx`, import the 3 new cards and render them in a `SimpleGrid` below existing widgets.

- [ ] **Step 8: Run build and tests**

Run: `yarn build && yarn test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/ui/features/dashboard/ src/ui/presentation/dashboard/
git commit -m "feat(trends): add staleness, license, and auto-fix sparkline cards to dashboard"
```

---

### Task 5: Trends UI Features Layer (Gateway + Repository)

**Files:**

- Create: `src/ui/features/trends/abstractions/TrendsGateway.ts`
- Create: `src/ui/features/trends/abstractions/TrendsRepository.ts`
- Create: `src/ui/features/trends/TrendsGateway.ts`
- Create: `src/ui/features/trends/TrendsRepository.ts`
- Create: `src/ui/features/trends/feature.ts`

**Interfaces:**

- Consumes: `HTTPClient`, shared route definitions (staleness-trend, license-trend, auto-fix-trend, dependency-changes)
- Produces: `TrendsGateway.Interface`, `TrendsRepository.Interface`, `TrendsFeature`

- [ ] **Step 1: Create TrendsGateway abstraction**

Create `src/ui/features/trends/abstractions/TrendsGateway.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { DashboardGateway } from "../../dashboard/abstractions/DashboardGateway.js";

export interface IDependencyChangesFilters {
  projectId?: string;
  limit?: number;
}

export interface IDependencyChangeItem {
  id: string;
  projectId: string;
  packageName: string;
  changeType: "added" | "removed" | "version-changed";
  previousVersion: string | null;
  newVersion: string | null;
  detectedAt: number;
}

export interface IDependencyChangesResponse {
  items: IDependencyChangeItem[];
  total: number;
}

export interface ITrendsGateway {
  getStalenessTrend(days?: string): Promise<DashboardGateway.StalenessTrendResponse>;
  getLicenseTrend(days?: string): Promise<DashboardGateway.LicenseTrendResponse>;
  getAutoFixTrend(days?: string): Promise<DashboardGateway.AutoFixTrendResponse>;
  getDependencyChanges(filters?: IDependencyChangesFilters): Promise<IDependencyChangesResponse>;
}

export const TrendsGateway = createAbstraction<ITrendsGateway>("Ui/TrendsGateway");

export namespace TrendsGateway {
  export type Interface = ITrendsGateway;
  export type DependencyChangesFilters = IDependencyChangesFilters;
  export type DependencyChangeItem = IDependencyChangeItem;
  export type DependencyChangesResponse = IDependencyChangesResponse;
}
```

- [ ] **Step 2: Create TrendsRepository abstraction**

Create `src/ui/features/trends/abstractions/TrendsRepository.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { DashboardGateway } from "../../dashboard/abstractions/DashboardGateway.js";
import type { TrendsGateway } from "./TrendsGateway.js";

export interface ITrendsRepository {
  getStalenessTrend(): DashboardGateway.StalenessTrendPoint[];
  setStalenessTrend(points: DashboardGateway.StalenessTrendPoint[]): void;
  getLicenseTrend(): DashboardGateway.LicenseTrendPoint[];
  setLicenseTrend(points: DashboardGateway.LicenseTrendPoint[]): void;
  getAutoFixTrend(): DashboardGateway.AutoFixTrendPoint[];
  setAutoFixTrend(points: DashboardGateway.AutoFixTrendPoint[]): void;
  getDependencyChanges(): TrendsGateway.DependencyChangeItem[];
  setDependencyChanges(items: TrendsGateway.DependencyChangeItem[], total: number): void;
  getDependencyChangesTotal(): number;
}

export const TrendsRepository = createAbstraction<ITrendsRepository>("Ui/TrendsRepository");

export namespace TrendsRepository {
  export type Interface = ITrendsRepository;
}
```

- [ ] **Step 3: Implement TrendsGateway**

Create `src/ui/features/trends/TrendsGateway.ts` using `HTTPClient.request()` with route definitions. Import `dashboardStalenessTrendRoute`, `dashboardLicenseTrendRoute`, `dashboardAutoFixTrendRoute`, `dashboardDependencyChangesRoute` from `#shared/routes/index.js`.

Build query objects for range/filters, same pattern as existing `DashboardGateway` methods.

- [ ] **Step 4: Implement TrendsRepository**

Create `src/ui/features/trends/TrendsRepository.ts` with private arrays and getter/setter pairs, same pattern as `DashboardRepository`.

- [ ] **Step 5: Create TrendsFeature**

Create `src/ui/features/trends/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { TrendsGateway } from "./TrendsGateway.js";
import { TrendsRepository } from "./TrendsRepository.js";

export const TrendsFeature = createFeature({
  name: "Ui/Trends",
  register(container) {
    container.register(TrendsGateway).inSingletonScope();
    container.register(TrendsRepository).inSingletonScope();
  }
});
```

- [ ] **Step 6: Run build**

Run: `yarn build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/trends/
git commit -m "feat(trends): add trends UI gateway, repository, and feature"
```

---

### Task 6: Trends Presentation Layer (UseCases + Presenter + Page + Charts) + Tests

**Files:**

- Create: `src/ui/presentation/trends/useCases/abstractions/LoadTrendsUseCase.ts`
- Create: `src/ui/presentation/trends/useCases/abstractions/LoadDependencyChangesUseCase.ts`
- Create: `src/ui/presentation/trends/useCases/LoadTrendsUseCase.ts`
- Create: `src/ui/presentation/trends/useCases/LoadDependencyChangesUseCase.ts`
- Create: `src/ui/presentation/trends/useCases/feature.ts`
- Create: `src/ui/presentation/trends/TrendsPage/abstractions/TrendsPresenter.ts`
- Create: `src/ui/presentation/trends/TrendsPage/TrendsPresenter.ts`
- Create: `src/ui/presentation/trends/TrendsPage/TrendsProvider.tsx`
- Create: `src/ui/presentation/trends/TrendsPage/components/TrendsPage.tsx`
- Create: `src/ui/presentation/trends/TrendsPage/components/StalenessTrendChart.tsx`
- Create: `src/ui/presentation/trends/TrendsPage/components/LicenseComplianceTrendChart.tsx`
- Create: `src/ui/presentation/trends/TrendsPage/components/AutoFixTrendChart.tsx`
- Create: `src/ui/presentation/trends/TrendsPage/components/PackageCountTrendChart.tsx`
- Create: `src/ui/presentation/trends/TrendsPage/components/DependencyChangesTable.tsx`
- Create: `src/ui/presentation/trends/TrendsPage/feature.ts`
- Create: `src/ui/presentation/trends/__tests__/TrendsPresenter.test.ts`
- Modify: `src/ui/App.tsx` (add /trends route, nav link, feature imports)

**Interfaces:**

- Consumes: `TrendsGateway.Interface` (Task 5), `TrendsRepository.Interface` (Task 5), `ProjectsRepository`, `LoadProjectsUseCase`
- Produces: `/trends` page with 5 chart sections, `TrendsPresenter.Interface` with VM

- [ ] **Step 1: Create use case abstractions**

Create `LoadTrendsUseCase` abstraction with `execute(ranges: { staleness?: string; license?: string; autoFix?: string }): Promise<void>`.

Create `LoadDependencyChangesUseCase` abstraction with `execute(filters?: TrendsGateway.DependencyChangesFilters): Promise<void>`.

- [ ] **Step 2: Implement use cases**

`LoadTrendsUseCase` — fetches all 3 trend endpoints in parallel, stores in TrendsRepository.
`LoadDependencyChangesUseCase` — fetches dependency changes with filters, stores in TrendsRepository.

- [ ] **Step 3: Create use case feature**

Register both use cases.

- [ ] **Step 4: Create TrendsPresenter abstraction**

Define `ITrendsViewModel` matching the spec exactly:

```typescript
interface ITrendsViewModel {
  loading: boolean;
  error: string | null;
  stalenessPoints: DashboardGateway.StalenessTrendPoint[];
  stalenessRange: string;
  licensePoints: DashboardGateway.LicenseTrendPoint[];
  licenseRange: string;
  autoFixPoints: DashboardGateway.AutoFixTrendPoint[];
  autoFixRange: string;
  packageCountPoints: IPackageCountPoint[];
  dependencyChanges: TrendsGateway.DependencyChangeItem[];
  dependencyChangesTotal: number;
  dependencyChangesProjectFilter: string | null;
  availableProjects: IProjectOption[];
}
```

Define locally in the abstraction file (same pattern as `LicensesPresenter`):

- `IProjectOption` = `{ id: string; name: string }`
- `IPackageCountPoint` = `{ date: string; totalPackages: number }`

Methods: `load()`, `setStalenessRange(range)`, `setLicenseRange(range)`, `setAutoFixRange(range)`, `setDependencyChangesProjectFilter(projectId | null)`.

- [ ] **Step 5: Implement TrendsPresenter**

MobX `makeAutoObservable`, `computed` VM getter. Independent range observables (default `"30"`). Each `set*Range` triggers re-fetch of that specific trend via the gateway through the use case. `packageCountPoints` computed from `stalenessPoints` (extract `date` + `totalPackages`). Inject `ProjectsRepository` + `LoadProjectsUseCase` for project list (same pattern as LicensesPresenter).

- [ ] **Step 6: Create TrendsProvider**

Same pattern as `LicensesProvider` — `useFeature(TrendsPageFeature)`, renders children with presenter.

- [ ] **Step 7: Create chart components**

5 chart components, all following the existing `VulnerabilityTrendChart` pattern:

- `StalenessTrendChart` — `AreaChart` with 3 stacked areas (patch=blue, minor=yellow, major=red), SegmentedControl for range
- `LicenseComplianceTrendChart` — `LineChart` with 3 lines (compliant=green, warned=yellow, denied=red), SegmentedControl
- `AutoFixTrendChart` — `LineChart` with 4 lines (created=blue, merged=green, closed=gray, failed=red), SegmentedControl
- `PackageCountTrendChart` — `LineChart` single line (totalPackages=blue), shares staleness range
- `DependencyChangesTable` — Mantine `Table` with project `Select` filter, `Badge` color by changeType (green=added, red=removed, yellow=version-changed), previousVersion/newVersion display

- [ ] **Step 8: Create TrendsPage component**

Page shell with `Stack` layout, `Title`, all 5 chart sections vertically stacked.

- [ ] **Step 9: Create TrendsPage feature**

Dependencies: `TrendsUseCasesFeature`, `TrendsFeature`, `ProjectsFeature`, `ProjectsUseCasesFeature`.

- [ ] **Step 10: Register in App.tsx**

- Import `TrendsFeature`, `TrendsUseCasesFeature`, `TrendsPageFeature`, `TrendsProvider`, `TrendsPage`
- Add features to `ALL_FEATURES`
- Add route: `if (path === "/trends") { ... }` before packages
- Add nav link after SBOM: `<Anchor component="button" onClick={() => navigate("/trends")}>Trends</Anchor>`

- [ ] **Step 11: Write TrendsPresenter tests**

Test initial state, load, independent range changes, packageCountPoints derivation, dependency changes project filter, error handling.

- [ ] **Step 12: Run full build, test suite, and lint**

Run: `yarn build && yarn test && yarn lint`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add src/ui/presentation/trends/ src/ui/App.tsx
git commit -m "feat(trends): add /trends page with staleness, license, auto-fix, package count charts and dependency changes table"
```
