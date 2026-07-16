# Vulnerability Sort/Page, URL Debounce, Sort Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sort/page to per-project vulnerability route, debounce UrlFilterService updates, and extract sort/enrich logic into VulnerabilityService.

**Architecture:** Three independent changes. Task 1 adds query params + handler logic to existing per-project route. Task 2 wraps UrlFilterService.update() in a 300ms debounce. Task 3 moves free functions from routes into a service method and wires callers.

**Tech Stack:** Fastify, Zod, Vitest, MobX presenters, jsdom

## Global Constraints

- Use `yarn full` for all checks (lint, format, typecheck, build, tests)
- Named interfaces only — no inline structural types
- Object params with named keys when function has 2+ params
- Full words in identifiers (Vulnerability not Vuln)
- Never import *Impl outside its own file — use abstractions + DI container

---

### Task 1: Add sort/page to per-project vulnerability route

**Files:**

- Modify: `src/shared/routes/vulnerabilities.ts:81-98` — add sort/page params to querystring
- Modify: `src/api/routes/vulnerabilities.ts:462-467` — add sort + paginate after enrichment
- Test: `src/api/routes/__tests__/vulnerabilities.test.ts` — add per-project sort/page tests

**Interfaces:**

- Consumes: `sortEnrichedVulnerabilities()` from `src/api/routes/vulnerabilities.ts:194` (existing free function)
- Produces: per-project route now accepts `page`, `pageSize`, `sortBy`, `sortOrder` query params and returns paginated sorted results with `total` count

- [ ] **Step 1: Write failing tests for per-project sort and pagination**

Add to `src/api/routes/__tests__/vulnerabilities.test.ts`, inside a new `describe("GET /api/vulnerabilities/:projectId")` block. Use existing `createTestContext`, `seedVulnerabilities`, `seedScanResult` helpers.

```typescript
describe("GET /api/vulnerabilities/:projectId", () => {
  it("returns paginated results when page and pageSize are provided", async () => {
    const { app, db } = await createTestContext();
    await seedVulnerabilities(db, 5, "proj-page");

    const response = await app.inject({
      method: "GET",
      url: "/api/vulnerabilities/proj-page?page=1&pageSize=2"
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(5);
  });

  it("sorts by packageName ascending", async () => {
    const { app, db } = await createTestContext();
    const projectId = "proj-sort";
    await insertTestProject(db, projectId);
    await db.insert(vulnerabilities).values([
      {
        id: "v-z",
        projectId,
        packageName: "zlib",
        severity: "low",
        title: "Issue Z",
        advisoryUrl: null,
        cveId: null,
        dedupKey: "z-key",
        vulnerableRange: null,
        fixVersion: null,
        source: "audit",
        scannedAt: Date.now()
      },
      {
        id: "v-a",
        projectId,
        packageName: "axios",
        severity: "high",
        title: "Issue A",
        advisoryUrl: null,
        cveId: null,
        dedupKey: "a-key",
        vulnerableRange: null,
        fixVersion: null,
        source: "audit",
        scannedAt: Date.now()
      }
    ]);

    const response = await app.inject({
      method: "GET",
      url: `/api/vulnerabilities/${projectId}?sortBy=packageName&sortOrder=asc`
    });

    const body = JSON.parse(response.body);
    expect(body.items[0].packageName).toBe("axios");
    expect(body.items[1].packageName).toBe("zlib");
  });

  it("defaults to severity desc when no sort params provided", async () => {
    const { app, db } = await createTestContext();
    const projectId = "proj-default-sort";
    await insertTestProject(db, projectId);
    await db.insert(vulnerabilities).values([
      {
        id: "v-low",
        projectId,
        packageName: "low-pkg",
        severity: "low",
        title: "Low issue",
        advisoryUrl: null,
        cveId: null,
        dedupKey: "low-key",
        vulnerableRange: null,
        fixVersion: null,
        source: "audit",
        scannedAt: Date.now()
      },
      {
        id: "v-crit",
        projectId,
        packageName: "crit-pkg",
        severity: "critical",
        title: "Critical issue",
        advisoryUrl: null,
        cveId: null,
        dedupKey: "crit-key",
        vulnerableRange: null,
        fixVersion: null,
        source: "audit",
        scannedAt: Date.now()
      }
    ]);

    const response = await app.inject({
      method: "GET",
      url: `/api/vulnerabilities/${projectId}`
    });

    const body = JSON.parse(response.body);
    expect(body.items[0].severity).toBe("critical");
    expect(body.items[1].severity).toBe("low");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn full`
Expected: tests fail — route doesn't accept sort/page params, returns unsorted unpaginated results

- [ ] **Step 3: Add sort/page params to route definition**

In `src/shared/routes/vulnerabilities.ts`, add params to `getProjectVulnerabilitiesRoute` querystring:

```typescript
export const getProjectVulnerabilitiesRoute = defineRoute({
  method: "GET",
  path: "/api/vulnerabilities/:projectId",
  description: "List vulnerabilities for a specific project",
  params: z.object({ projectId: z.string() }),
  querystring: z.object({
    severity: z.string().optional(),
    packageName: z.string().optional(),
    source: z.string().optional(),
    projectIds: z.string().optional(),
    includeDismissed: z.enum(["true", "false"]).optional(),
    scannedDate: z.string().date().optional(),
    dependencyType: z.enum(["all", "direct", "transitive"]).optional(),
    page: z.coerce.number().optional(),
    pageSize: z.coerce.number().optional(),
    sortBy: z.enum(["severity", "packageName", "projectName"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional()
  }),
  response: z.object({
    items: z.array(vulnerabilitySchema),
    total: z.number()
  })
});
```

Note: also add `dependencyType` which was missing from per-project route for consistency.

- [ ] **Step 4: Update per-project route handler**

In `src/api/routes/vulnerabilities.ts`, replace the handler at line 462-467:

```typescript
registerRoute(app, getProjectVulnerabilitiesRoute, {}, async (request, reply) => {
  const { projectId } = request.params;
  const items = await vulnerabilityService.getLatest(projectId, buildFilters(request.query));
  const enriched = await enrichWithProjectNames(items, db);
  const filtered = filterByDependencyType(enriched, request.query.dependencyType);

  const sorted = sortEnrichedVulnerabilities(
    filtered,
    request.query.sortBy ?? "severity",
    request.query.sortOrder ?? "desc"
  );

  const total = sorted.length;
  const page = request.query.page ?? 1;
  const pageSize = request.query.pageSize ?? 25;
  const start = (page - 1) * pageSize;
  const paged = sorted.slice(start, start + pageSize);
  sendList(reply, paged, total);
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn full`
Expected: all tests pass including new per-project sort/page tests

- [ ] **Step 6: Commit**

```bash
git add src/shared/routes/vulnerabilities.ts src/api/routes/vulnerabilities.ts src/api/routes/__tests__/vulnerabilities.test.ts
git commit -m "feat(vulnerabilities): add sort/page params to per-project route"
```

---

### Task 2: Add debounce to UrlFilterService.update()

**Files:**

- Modify: `src/ui/features/urlFilter/UrlFilterService.ts` — wrap update() body in 300ms debounce
- Test: `src/ui/features/urlFilter/__tests__/UrlFilterService.test.ts` — add debounce tests

**Interfaces:**

- Consumes: nothing new
- Produces: `UrlFilterService.update()` now debounces URL changes by 300ms. Same signature, same behavior, just delayed. No interface change.

- [ ] **Step 1: Write failing debounce tests**

Add to `src/ui/features/urlFilter/__tests__/UrlFilterService.test.ts`, inside a new `describe("debounce")` block:

```typescript
describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not update URL immediately", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    service.update(testSchema, { projectId: "p1" });
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it("updates URL after 300ms", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    service.update(testSchema, { projectId: "p1" });
    vi.advanceTimersByTime(300);
    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).toHaveBeenCalledWith(null, "", expect.stringContaining("projectId=p1"));
  });

  it("coalesces rapid updates into one URL change", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    service.update(testSchema, { projectId: "p1" });
    vi.advanceTimersByTime(100);
    service.update(testSchema, { projectId: "p2" });
    vi.advanceTimersByTime(300);
    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    const url = pushStateSpy.mock.calls[0]![2] as string;
    expect(url).toContain("projectId=p2");
  });

  it("dispatches popstate only after debounce settles", () => {
    const listener = vi.fn();
    window.addEventListener("popstate", listener);
    service.update(testSchema, { projectId: "p1" });
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("popstate", listener);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn full`
Expected: "does not update URL immediately" fails because update() currently fires synchronously

- [ ] **Step 3: Update existing update() tests to use fake timers**

Existing tests in the `describe("update")` block expect synchronous behavior. Update them to use `vi.useFakeTimers()` and `vi.advanceTimersByTime(300)` after calling `service.update()`:

```typescript
describe("update", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds params to URL", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    service.update(testSchema, { projectId: "p1" });
    vi.advanceTimersByTime(300);
    expect(pushStateSpy).toHaveBeenCalledWith(null, "", expect.stringContaining("projectId=p1"));
  });

  it("removes params when value is null", () => {
    window.location.search = "?projectId=p1&riskTier=copyleft";
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    service.update(testSchema, { projectId: null });
    vi.advanceTimersByTime(300);
    const url = pushStateSpy.mock.calls[0]![2] as string;
    expect(url).not.toContain("projectId");
    expect(url).toContain("riskTier=copyleft");
  });

  it("preserves params not in schema", () => {
    window.location.search = "?other=keep";
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    service.update(testSchema, { projectId: "p1" });
    vi.advanceTimersByTime(300);
    const url = pushStateSpy.mock.calls[0]![2] as string;
    expect(url).toContain("other=keep");
    expect(url).toContain("projectId=p1");
  });

  it("dispatches popstate event after update", () => {
    const listener = vi.fn();
    window.addEventListener("popstate", listener);
    service.update(testSchema, { projectId: "p1" });
    vi.advanceTimersByTime(300);
    window.removeEventListener("popstate", listener);
    expect(listener).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Implement debounce in UrlFilterService**

In `src/ui/features/urlFilter/UrlFilterService.ts`, add a debounce timer field and wrap the update body:

```typescript
class UrlFilterServiceImpl implements Abstraction.Interface {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  public read<TSchema extends z.ZodObject<z.ZodRawShape>>(
    schema: TSchema
  ): Partial<z.infer<TSchema>> {
    // unchanged
  }

  public update<TSchema extends z.ZodObject<z.ZodRawShape>>(
    _schema: TSchema,
    params: Partial<Record<keyof z.infer<TSchema>, string | null>>
  ): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      const searchParams = new URLSearchParams(window.location.search);

      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) {
          searchParams.delete(key);
        } else {
          searchParams.set(key, value);
        }
      }

      const search = searchParams.toString();
      const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
      window.history.pushState(null, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, 300);
  }

  public onChange(callback: () => void): () => void {
    // unchanged
  }
}
```

**Important subtlety:** When multiple rapid `update()` calls happen, each call captures its own `params` in the closure. The last call wins because earlier timers are cleared. This is correct — the last keystroke's params reflect the final input value.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn full`
Expected: all UrlFilterService tests pass (both existing updated tests and new debounce tests)

- [ ] **Step 6: Commit**

```bash
git add src/ui/features/urlFilter/UrlFilterService.ts src/ui/features/urlFilter/__tests__/UrlFilterService.test.ts
git commit -m "feat(urlFilter): add 300ms debounce to UrlFilterService.update()"
```

---

### Task 3: Extract enrichAndSort into VulnerabilityService

**Files:**

- Modify: `src/api/services/abstractions/VulnerabilityService.ts` — add `IEnrichedVulnerability`, `IEnrichAndSortOptions`, `IEnrichedVulnerabilityResult`, and `enrichAndSort` method to interface
- Modify: `src/api/services/VulnerabilityService.ts` — implement `enrichAndSort()`, move helper functions from routes
- Modify: `src/api/routes/vulnerabilities.ts` — replace inline calls with `vulnerabilityService.enrichAndSort()`
- Test: `src/api/services/__tests__/VulnerabilityService.test.ts` — add enrichAndSort tests
- Test: `src/api/routes/__tests__/vulnerabilities.test.ts` — update mock to include enrichAndSort

**Interfaces:**

- Consumes: existing `IVulnerability`, `DatabaseClient`, `VULNERABILITY_SEVERITIES`
- Produces: `IEnrichedVulnerability`, `IEnrichAndSortOptions`, `IEnrichedVulnerabilityResult`, `enrichAndSort()` method on `IVulnerabilityService`

- [ ] **Step 1: Add types and method to IVulnerabilityService**

In `src/api/services/abstractions/VulnerabilityService.ts`, add:

```typescript
export interface IEnrichedVulnerability {
  id: string;
  projectId: string;
  projectName: string;
  packageName: string;
  severity: VulnerabilitySeverity;
  title: string;
  advisoryUrl: string | null;
  cveId: string | null;
  vulnerableRange: string | null;
  fixVersion: string | null;
  source: TVulnerabilitySource;
  installedVersion: string | null;
  isTransitive: boolean;
  scannedAt: number;
  dismissedAt: number | null;
  dismissedUntil: number | null;
  dismissedBy: string | null;
}

export interface IEnrichAndSortOptions {
  dependencyType?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
}

export interface IEnrichedVulnerabilityResult {
  items: IEnrichedVulnerability[];
  total: number;
}
```

Add to `IVulnerabilityService`:

```typescript
enrichAndSort(input: {
    items: IVulnerability[];
    options?: IEnrichAndSortOptions;
}): Promise<IEnrichedVulnerabilityResult>;
```

Add to namespace exports:

```typescript
export namespace VulnerabilityService {
  // existing types...
  export type EnrichedVulnerability = IEnrichedVulnerability;
  export type EnrichAndSortOptions = IEnrichAndSortOptions;
  export type EnrichedVulnerabilityResult = IEnrichedVulnerabilityResult;
}
```

- [ ] **Step 2: Write failing tests for enrichAndSort**

Add to `src/api/services/__tests__/VulnerabilityService.test.ts`:

```typescript
describe("enrichAndSort", () => {
  it("enriches vulnerabilities with project names and isTransitive", async () => {
    const stubPm = createStubPackageManagerService(async () => []);
    const stubOsv = createStubOsvCacheService(async () => new Map());
    const { service, db } = await createService(stubPm, stubOsv);

    await insertProject(db, "proj-1", "My Project");
    await insertScanResult(db, "proj-1", "lodash", "4.17.0");

    const items: IVulnerability[] = [
      {
        id: "v1",
        projectId: "proj-1",
        packageName: "lodash",
        severity: "high",
        title: "Proto pollution",
        advisoryUrl: null,
        cveId: null,
        dedupKey: "dk-1",
        vulnerableRange: null,
        fixVersion: null,
        source: "audit",
        installedVersion: "4.17.0",
        scannedAt: Date.now(),
        dismissedAt: null,
        dismissedUntil: null,
        dismissedBy: null
      }
    ];

    const result = await service.enrichAndSort({ items });
    expect(result.items[0].projectName).toBe("My Project");
    expect(result.items[0].isTransitive).toBe(false);
    expect(result.total).toBe(1);
  });

  it("sorts by severity desc by default", async () => {
    const stubPm = createStubPackageManagerService(async () => []);
    const stubOsv = createStubOsvCacheService(async () => new Map());
    const { service, db } = await createService(stubPm, stubOsv);

    await insertProject(db, "proj-1", "My Project");

    const items: IVulnerability[] = [
      {
        id: "v-low",
        projectId: "proj-1",
        packageName: "low-pkg",
        severity: "low",
        title: "Low",
        advisoryUrl: null,
        cveId: null,
        dedupKey: "dk-low",
        vulnerableRange: null,
        fixVersion: null,
        source: "audit",
        installedVersion: null,
        scannedAt: Date.now(),
        dismissedAt: null,
        dismissedUntil: null,
        dismissedBy: null
      },
      {
        id: "v-crit",
        projectId: "proj-1",
        packageName: "crit-pkg",
        severity: "critical",
        title: "Critical",
        advisoryUrl: null,
        cveId: null,
        dedupKey: "dk-crit",
        vulnerableRange: null,
        fixVersion: null,
        source: "audit",
        installedVersion: null,
        scannedAt: Date.now(),
        dismissedAt: null,
        dismissedUntil: null,
        dismissedBy: null
      }
    ];

    const result = await service.enrichAndSort({ items });
    expect(result.items[0].severity).toBe("critical");
    expect(result.items[1].severity).toBe("low");
  });

  it("paginates results and returns total", async () => {
    const stubPm = createStubPackageManagerService(async () => []);
    const stubOsv = createStubOsvCacheService(async () => new Map());
    const { service, db } = await createService(stubPm, stubOsv);

    await insertProject(db, "proj-1", "My Project");

    const items: IVulnerability[] = Array.from({ length: 5 }, (_, i) => ({
      id: `v-${i}`,
      projectId: "proj-1",
      packageName: `pkg-${i}`,
      severity: "high" as const,
      title: `Issue ${i}`,
      advisoryUrl: null,
      cveId: null,
      dedupKey: `dk-${i}`,
      vulnerableRange: null,
      fixVersion: null,
      source: "audit" as const,
      installedVersion: null,
      scannedAt: Date.now(),
      dismissedAt: null,
      dismissedUntil: null,
      dismissedBy: null
    }));

    const result = await service.enrichAndSort({
      items,
      options: { page: 1, pageSize: 2 }
    });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(5);
  });

  it("filters by dependency type", async () => {
    const stubPm = createStubPackageManagerService(async () => []);
    const stubOsv = createStubOsvCacheService(async () => new Map());
    const { service, db } = await createService(stubPm, stubOsv);

    await insertProject(db, "proj-1", "My Project");
    await insertScanResult(db, "proj-1", "direct-pkg", "1.0.0");

    const items: IVulnerability[] = [
      {
        id: "v-direct",
        projectId: "proj-1",
        packageName: "direct-pkg",
        severity: "high",
        title: "Direct dep issue",
        advisoryUrl: null,
        cveId: null,
        dedupKey: "dk-direct",
        vulnerableRange: null,
        fixVersion: null,
        source: "audit",
        installedVersion: null,
        scannedAt: Date.now(),
        dismissedAt: null,
        dismissedUntil: null,
        dismissedBy: null
      },
      {
        id: "v-transitive",
        projectId: "proj-1",
        packageName: "transitive-pkg",
        severity: "high",
        title: "Transitive dep issue",
        advisoryUrl: null,
        cveId: null,
        dedupKey: "dk-transitive",
        vulnerableRange: null,
        fixVersion: null,
        source: "audit",
        installedVersion: null,
        scannedAt: Date.now(),
        dismissedAt: null,
        dismissedUntil: null,
        dismissedBy: null
      }
    ];

    const result = await service.enrichAndSort({
      items,
      options: { dependencyType: "direct" }
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].packageName).toBe("direct-pkg");
    expect(result.total).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn full`
Expected: fails — `enrichAndSort` not yet on service

- [ ] **Step 4: Implement enrichAndSort in VulnerabilityServiceImpl**

In `src/api/services/VulnerabilityService.ts`, add the method. Move the logic from the three free functions in routes:

```typescript
import { VULNERABILITY_SEVERITIES } from "#shared/vulnerabilities/types.js";
import type { VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";
import type {
    IEnrichedVulnerability,
    IEnrichAndSortOptions,
    IEnrichedVulnerabilityResult
} from "./abstractions/VulnerabilityService.js";

// Inside VulnerabilityServiceImpl class:

public async enrichAndSort(input: {
    items: Abstraction.Vulnerability[];
    options?: IEnrichAndSortOptions;
}): Promise<IEnrichedVulnerabilityResult> {
    const { items, options = {} } = input;
    const { db } = this.databaseClient;

    const enriched = await this.enrichWithProjectNames(items, db);
    const filtered = this.filterByDependencyType(enriched, options.dependencyType);
    const sorted = this.sortEnrichedVulnerabilities(
        filtered,
        options.sortBy ?? "severity",
        options.sortOrder ?? "desc"
    );

    const total = sorted.length;
    if (options.page !== undefined && options.pageSize !== undefined) {
        const start = (options.page - 1) * options.pageSize;
        return { items: sorted.slice(start, start + options.pageSize), total };
    }
    return { items: sorted, total };
}

private async enrichWithProjectNames(
    items: Abstraction.Vulnerability[],
    db: DatabaseClient.Interface["db"]
): Promise<IEnrichedVulnerability[]> {
    if (items.length === 0) {
        return [];
    }
    const uniqueProjectIds = [...new Set(items.map(item => item.projectId))];
    const projectRows = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, uniqueProjectIds))
        .all();
    const nameById = new Map(projectRows.map(row => [row.id, row.name]));

    const directDepRows = await db
        .select({ projectId: scanResults.projectId, name: scanResults.name })
        .from(scanResults)
        .where(inArray(scanResults.projectId, uniqueProjectIds))
        .all();
    const directDeps = new Set(directDepRows.map(row => `${row.projectId}:${row.name}`));

    return items.map(item => ({
        id: item.id,
        projectId: item.projectId,
        projectName: nameById.get(item.projectId) ?? "Unknown",
        packageName: item.packageName,
        severity: item.severity,
        title: item.title,
        advisoryUrl: item.advisoryUrl,
        cveId: item.cveId,
        vulnerableRange: item.vulnerableRange,
        fixVersion: item.fixVersion,
        source: item.source,
        installedVersion: item.installedVersion,
        isTransitive: !directDeps.has(`${item.projectId}:${item.packageName}`),
        scannedAt: item.scannedAt,
        dismissedAt: item.dismissedAt,
        dismissedUntil: item.dismissedUntil,
        dismissedBy: item.dismissedBy
    }));
}

private filterByDependencyType(
    items: IEnrichedVulnerability[],
    dependencyType: string | undefined
): IEnrichedVulnerability[] {
    if (!dependencyType || dependencyType === "all") {
        return items;
    }
    if (dependencyType === "transitive") {
        return items.filter(item => item.isTransitive);
    }
    return items.filter(item => !item.isTransitive);
}

private sortEnrichedVulnerabilities(
    items: IEnrichedVulnerability[],
    sortBy: string,
    sortOrder: string
): IEnrichedVulnerability[] {
    const direction = sortOrder === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
        if (sortBy === "severity") {
            return (
                (VULNERABILITY_SEVERITIES.indexOf(a.severity as VulnerabilitySeverity) -
                    VULNERABILITY_SEVERITIES.indexOf(b.severity as VulnerabilitySeverity)) *
                direction
            );
        }
        if (sortBy === "projectName") {
            return a.projectName.localeCompare(b.projectName) * direction;
        }
        return a.packageName.localeCompare(b.packageName) * direction;
    });
}
```

Also add the necessary imports at top of file: `projects`, `scanResults`, `inArray`, `VULNERABILITY_SEVERITIES`, `VulnerabilitySeverity`.

- [ ] **Step 5: Run tests to verify enrichAndSort tests pass**

Run: `yarn full`
Expected: new enrichAndSort tests pass

- [ ] **Step 6: Update route handlers to use service method**

In `src/api/routes/vulnerabilities.ts`:

1. Remove the three free functions: `enrichWithProjectNames`, `filterByDependencyType`, `sortEnrichedVulnerabilities`
2. Remove the `IEnrichedVulnerability` interface (now in abstractions)
3. Remove unused imports (`projects`, `scanResults`, `inArray`, `VULNERABILITY_SEVERITIES`, `VulnerabilitySeverity`)
4. Import `IEnrichedVulnerability` from abstractions (needed for CSV_HEADERS type)

Replace in `listVulnerabilitiesRoute` handler (lines 265-280):

```typescript
const items = await vulnerabilityService.getAll(filters);
const result = await vulnerabilityService.enrichAndSort({
  items,
  options: {
    dependencyType: request.query.dependencyType,
    sortBy: request.query.sortBy,
    sortOrder: request.query.sortOrder,
    page: request.query.page ?? 1,
    pageSize: request.query.pageSize ?? 25
  }
});
sendList(reply, result.items, result.total);
```

Replace in `getProjectVulnerabilitiesRoute` handler:

```typescript
const items = await vulnerabilityService.getLatest(projectId, buildFilters(request.query));
const result = await vulnerabilityService.enrichAndSort({
  items,
  options: {
    dependencyType: request.query.dependencyType,
    sortBy: request.query.sortBy,
    sortOrder: request.query.sortOrder,
    page: request.query.page ?? 1,
    pageSize: request.query.pageSize ?? 25
  }
});
sendList(reply, result.items, result.total);
```

Replace in `exportVulnerabilitiesRoute` handler (lines 395-401). Export returns all results, no pagination:

```typescript
const items = idsParam
  ? await vulnerabilityService.getAll({ ...filters, ids: idsParam.split(",") })
  : await vulnerabilityService.getAll(filters);

const result = await vulnerabilityService.enrichAndSort({
  items,
  options: {
    dependencyType,
    sortBy: exportSortBy,
    sortOrder: exportSortOrder
  }
});
const sorted = result.items;
```

Then `sorted` is used for CSV/JSON output as before. No page/pageSize passed — enrichAndSort returns all items when pagination params are absent.

- [ ] **Step 7: Update mock in route tests**

In `src/api/routes/__tests__/vulnerabilities.test.ts`, add `enrichAndSort` to `createMockVulnerabilityService()`:

```typescript
function createMockVulnerabilityService(): VulnerabilityService.Interface {
  return {
    scan: vi.fn(),
    getLatest: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    getSummary: vi.fn(),
    forceOsvRefresh: vi.fn(),
    bulkDismiss: vi.fn(),
    bulkSnooze: vi.fn(),
    bulkUndismiss: vi.fn(),
    getProjectIdsForVulnerabilityIds: vi.fn(),
    getRecentlyExpiredSnoozes: vi.fn(),
    enrichAndSort: vi.fn()
  };
}
```

Note: route tests that use `createTestContext()` (real services) won't need mock changes — the real `VulnerabilityServiceImpl` will have the method.

- [ ] **Step 8: Run full test suite**

Run: `yarn full`
Expected: all tests pass — existing route behavior preserved, new service tests pass

- [ ] **Step 9: Commit**

```bash
git add src/api/services/abstractions/VulnerabilityService.ts src/api/services/VulnerabilityService.ts src/api/routes/vulnerabilities.ts src/api/routes/__tests__/vulnerabilities.test.ts src/api/services/__tests__/VulnerabilityService.test.ts
git commit -m "refactor(vulnerabilities): extract enrichAndSort into VulnerabilityService"
```
