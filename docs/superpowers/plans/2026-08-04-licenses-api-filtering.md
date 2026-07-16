# Licenses API-Side Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the licenses page from client-side filtering to API-side filtering with URL query param sync, enabling shareable filtered views.

**Architecture:** Create a reusable `UrlFilterService` DI abstraction that reads/writes URL search params with Zod schema type safety. Add `violationAction` server-side filter to the licenses API. Rewire `LicensesPresenter` to read filters from URL, pass them through the existing gateway pipeline to the API, and remove client-side `applyFilters()`.

**Tech Stack:** Zod (schema validation + type inference), MobX (presenter state), Vitest (tests), existing DI framework (`createAbstraction`, `createFeature`, `createImplementation`).

## Global Constraints

- Use named interfaces, never inline structural types
- Use object params with named keys when function has 2+ params
- Use full words (e.g. "Vulnerability" not "Vuln") in new code identifiers
- Never import `*Impl` outside its own file — use abstractions + DI container
- Run `yarn full` for validation (type-check + tests + lint)
- Commit after each task

---

### Task 1: Create UrlFilterService Abstraction, Implementation, Feature, and Tests

**Files:**

- Create: `src/ui/features/urlFilter/abstractions/UrlFilterService.ts`
- Create: `src/ui/features/urlFilter/UrlFilterService.ts`
- Create: `src/ui/features/urlFilter/feature.ts`
- Create: `src/ui/features/urlFilter/__tests__/UrlFilterService.test.ts`

**Interfaces:**

- Consumes: `z` from `zod`
- Produces: `IUrlFilterService` with methods `read<TSchema>(schema): Partial<z.infer<TSchema>>`, `update<TSchema>(schema, params): void`, `onChange(callback): () => void`. DI token: `UrlFilterService` via `createAbstraction<IUrlFilterService>("Ui/UrlFilterService")`. Feature: `UrlFilterFeature` registered as singleton.

- [ ] **Step 1: Write the abstraction**

Create `src/ui/features/urlFilter/abstractions/UrlFilterService.ts`:

```typescript
import type { z } from "zod";
import { createAbstraction } from "#shared/index.js";

export interface IUrlFilterService {
  read<TSchema extends z.ZodObject<z.ZodRawShape>>(schema: TSchema): Partial<z.infer<TSchema>>;
  update<TSchema extends z.ZodObject<z.ZodRawShape>>(
    schema: TSchema,
    params: Partial<Record<keyof z.infer<TSchema>, string | null>>
  ): void;
  onChange(callback: () => void): () => void;
}

export const UrlFilterService = createAbstraction<IUrlFilterService>("Ui/UrlFilterService");

export namespace UrlFilterService {
  export type Interface = IUrlFilterService;
}
```

- [ ] **Step 2: Write the tests**

Create `src/ui/features/urlFilter/__tests__/UrlFilterService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import { createContainer } from "#shared/index.js";
import { UrlFilterService as UrlFilterServiceAbstraction } from "../abstractions/UrlFilterService.js";
import { UrlFilterService } from "../UrlFilterService.js";

const testSchema = z.object({
  projectId: z.string().optional(),
  riskTier: z.string().optional(),
  packageName: z.string().optional()
});

describe("UrlFilterService", () => {
  let service: UrlFilterServiceAbstraction.Interface;
  let originalLocation: Location;

  beforeEach(() => {
    const container = createContainer();
    container.register(UrlFilterService).inSingletonScope();
    service = container.resolve(UrlFilterServiceAbstraction);

    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        pathname: "/licenses",
        search: "",
        href: "http://localhost/licenses"
      }
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation
    });
    vi.restoreAllMocks();
  });

  describe("read", () => {
    it("returns empty object when URL has no search params", () => {
      const result = service.read(testSchema);
      expect(result).toEqual({});
    });

    it("returns only keys defined in schema", () => {
      window.location.search = "?projectId=p1&unknown=foo";
      const result = service.read(testSchema);
      expect(result).toEqual({ projectId: "p1" });
      expect(result).not.toHaveProperty("unknown");
    });

    it("returns multiple matching params", () => {
      window.location.search = "?projectId=p1&riskTier=copyleft";
      const result = service.read(testSchema);
      expect(result).toEqual({ projectId: "p1", riskTier: "copyleft" });
    });

    it("ignores params that fail schema validation", () => {
      const strictSchema = z.object({
        count: z.coerce.number().optional()
      });
      window.location.search = "?count=notanumber";
      const result = service.read(strictSchema);
      expect(result).toEqual({});
    });
  });

  describe("update", () => {
    it("adds params to URL", () => {
      const pushStateSpy = vi.spyOn(window.history, "pushState");
      service.update(testSchema, { projectId: "p1" });
      expect(pushStateSpy).toHaveBeenCalledWith(null, "", expect.stringContaining("projectId=p1"));
    });

    it("removes params when value is null", () => {
      window.location.search = "?projectId=p1&riskTier=copyleft";
      const pushStateSpy = vi.spyOn(window.history, "pushState");
      service.update(testSchema, { projectId: null });
      const url = pushStateSpy.mock.calls[0]![2] as string;
      expect(url).not.toContain("projectId");
      expect(url).toContain("riskTier=copyleft");
    });

    it("preserves params not in schema", () => {
      window.location.search = "?other=keep";
      const pushStateSpy = vi.spyOn(window.history, "pushState");
      service.update(testSchema, { projectId: "p1" });
      const url = pushStateSpy.mock.calls[0]![2] as string;
      expect(url).toContain("other=keep");
      expect(url).toContain("projectId=p1");
    });

    it("dispatches popstate event after update", () => {
      const listener = vi.fn();
      window.addEventListener("popstate", listener);
      service.update(testSchema, { projectId: "p1" });
      window.removeEventListener("popstate", listener);
      expect(listener).toHaveBeenCalled();
    });
  });

  describe("onChange", () => {
    it("calls callback on popstate event", () => {
      const callback = vi.fn();
      const dispose = service.onChange(callback);
      window.dispatchEvent(new PopStateEvent("popstate"));
      expect(callback).toHaveBeenCalledTimes(1);
      dispose();
    });

    it("stops calling callback after dispose", () => {
      const callback = vi.fn();
      const dispose = service.onChange(callback);
      dispose();
      window.dispatchEvent(new PopStateEvent("popstate"));
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn full`
Expected: FAIL — UrlFilterService implementation does not exist.

- [ ] **Step 4: Write the implementation**

Create `src/ui/features/urlFilter/UrlFilterService.ts`:

```typescript
import type { z } from "zod";
import { UrlFilterService as Abstraction } from "./abstractions/UrlFilterService.js";

class UrlFilterServiceImpl implements Abstraction.Interface {
  public read<TSchema extends z.ZodObject<z.ZodRawShape>>(
    schema: TSchema
  ): Partial<z.infer<TSchema>> {
    const searchParams = new URLSearchParams(window.location.search);
    const raw: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      raw[key] = value;
    }

    const result = schema.partial().safeParse(raw);
    if (!result.success) {
      return {};
    }

    const parsed = result.data as Record<string, unknown>;
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }
    return filtered as Partial<z.infer<TSchema>>;
  }

  public update<TSchema extends z.ZodObject<z.ZodRawShape>>(
    schema: TSchema,
    params: Partial<Record<keyof z.infer<TSchema>, string | null>>
  ): void {
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
  }

  public onChange(callback: () => void): () => void {
    window.addEventListener("popstate", callback);
    return () => {
      window.removeEventListener("popstate", callback);
    };
  }
}

export const UrlFilterService = Abstraction.createImplementation({
  implementation: UrlFilterServiceImpl,
  dependencies: []
});
```

- [ ] **Step 5: Create the feature**

Create `src/ui/features/urlFilter/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { UrlFilterService } from "./UrlFilterService.js";

export const UrlFilterFeature = createFeature({
  name: "Ui/UrlFilter",
  register(container) {
    container.register(UrlFilterService).inSingletonScope();
  }
});
```

- [ ] **Step 6: Run validation**

Run: `yarn full`
Expected: PASS — all tests green.

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/urlFilter/
git commit -m "feat: add UrlFilterService with Zod schema type safety"
```

---

### Task 2: Add violationAction Server-Side Filter

**Files:**

- Modify: `src/shared/routes/licenses.ts:39-52` — add `violationAction` to `listLicensesRoute` querystring
- Modify: `src/api/routes/licenses.ts:22-50` — add `violationAction` to `ILicenseQuerystring` and `buildLicenseConditions()`
- Modify: `src/ui/features/licenses/abstractions/LicensesGateway.ts:67-73` — add `violationAction` to `ILicenseListFilters`
- Modify: `src/ui/features/licenses/LicensesGateway.ts:16-34` — add `violationAction` to `buildLicenseListQuery()`

**Interfaces:**

- Consumes: `license_violations` table (`license_id`, `action` columns), `licenses` table (`id` column)
- Produces: `violationAction` query param on `listLicensesRoute` (`z.enum(["warn", "deny"]).optional()`), `violationAction?: string` on `ILicenseListFilters`

- [ ] **Step 1: Add violationAction to shared route schema**

In `src/shared/routes/licenses.ts`, add to `listLicensesRoute` querystring:

```typescript
querystring: z.object({
    projectId: z.string().optional(),
    riskTier: z.string().optional(),
    spdxId: z.string().optional(),
    packageName: z.string().optional(),
    teamId: z.string().optional(),
    violationAction: z.enum(["warn", "deny"]).optional()
}),
```

- [ ] **Step 2: Add violationAction to gateway filter types**

In `src/ui/features/licenses/abstractions/LicensesGateway.ts`, add to `ILicenseListFilters`:

```typescript
export interface ILicenseListFilters {
  projectId?: string;
  riskTier?: string;
  packageName?: string;
  spdxId?: string;
  teamId?: string;
  violationAction?: string;
}
```

- [ ] **Step 3: Add violationAction to gateway query builder**

In `src/ui/features/licenses/LicensesGateway.ts`, add to `buildLicenseListQuery()`:

```typescript
if (filters?.violationAction) {
  query["violationAction"] = filters.violationAction;
}
```

- [ ] **Step 4: Add violationAction to API route handler**

In `src/api/routes/licenses.ts`, add `violationAction` to `ILicenseQuerystring`:

```typescript
interface ILicenseQuerystring {
  projectId?: string | undefined;
  riskTier?: string | undefined;
  spdxId?: string | undefined;
  packageName?: string | undefined;
  teamId?: string | undefined;
  violationAction?: string | undefined;
}
```

Add the SQL condition to `buildLicenseConditions()`. This uses a subquery that computes the primary action per license (deny takes priority over warn):

```typescript
if (query.violationAction) {
  conditions.push(
    sql`${licenses.id} IN (
            SELECT lv.license_id FROM license_violations lv
            WHERE lv.license_id = ${licenses.id}
            GROUP BY lv.license_id
            HAVING MAX(CASE WHEN lv.action = 'deny' THEN 2 WHEN lv.action = 'warn' THEN 1 ELSE 0 END)
                = ${query.violationAction === "deny" ? 2 : 1}
        )`
  );
}
```

- [ ] **Step 5: Run validation**

Run: `yarn full`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/routes/licenses.ts src/api/routes/licenses.ts src/ui/features/licenses/abstractions/LicensesGateway.ts src/ui/features/licenses/LicensesGateway.ts
git commit -m "feat(licenses): add violationAction server-side filter"
```

---

### Task 3: Migrate LicensesPresenter to API-Side Filtering with URL Sync

**Files:**

- Modify: `src/ui/presentation/licenses/LicensesList/LicensesPresenter.ts` — inject UrlFilterService, remove client-side filtering, read/write URL params
- Modify: `src/ui/presentation/licenses/LicensesList/feature.ts` — add UrlFilterFeature dependency
- Modify: `src/ui/presentation/licenses/__tests__/LicensesPresenter.test.ts` — update tests for API-side filtering behavior
- Possibly modify: other test files that mock `LicensesPresenter` interface (check after implementation)

**Interfaces:**

- Consumes: `UrlFilterService.Interface` from Task 1 (`read`, `update`, `onChange`), `listLicensesRoute.querystring` from Task 2 (schema with `violationAction`), `LoadLicensesUseCase.execute(filters)` (already accepts `LicensesGateway.ListFilters`)
- Produces: Same `LicensesPresenter.Interface` (no interface change — `setRiskTierFilter`, `setPackageNameFilter`, `setProjectIdFilter`, `setViolationFilter` signatures stay identical), but internally they update URL params and reload from API instead of filtering client-side

- [ ] **Step 1: Add UrlFilterFeature to LicenseListFeature dependencies**

In `src/ui/presentation/licenses/LicensesList/feature.ts`, add import and dependency:

```typescript
import { UrlFilterFeature } from "../../../features/urlFilter/feature.js";
```

Add `UrlFilterFeature` to the `dependencies` array.

- [ ] **Step 2: Rewrite LicensesPresenter to use URL filters**

In `src/ui/presentation/licenses/LicensesList/LicensesPresenter.ts`:

1. Add import for `UrlFilterService`:

```typescript
import { UrlFilterService } from "../../../features/urlFilter/abstractions/UrlFilterService.js";
```

2. Add import for the route schema:

```typescript
import { listLicensesRoute } from "#shared/routes/index.js";
```

3. Store the route's querystring schema in a module-level constant:

```typescript
const FILTER_SCHEMA = listLicensesRoute.querystring;
```

4. Remove the 4 private filter state fields (`riskTierFilter`, `packageNameFilter`, `projectIdFilter`, `violationFilter`).

5. Add `UrlFilterService.Interface` as the last constructor parameter. Add `urlFilterService` to the DI dependencies array.

6. In the constructor, register a popstate listener for URL changes:

```typescript
private readonly disposeUrlListener: () => void;
// in constructor:
this.disposeUrlListener = this.urlFilterService.onChange(() => {
    void this.load();
});
```

7. In `dispose()`, call `this.disposeUrlListener()`.

8. Replace `load()` to read filters from URL and pass to use case:

```typescript
public load = async (): Promise<void> => {
    this.loading = true;
    this.error = null;
    try {
        const teamId = this.teamFilterService.selectedTeamId;
        const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
        const filters: LicensesGateway.ListFilters = {
            ...urlFilters,
            ...(teamId ? { teamId } : {})
        };
        const tasks: Promise<unknown>[] = [
            this.loadLicensesUseCase.execute(filters),
            this.gateway.listPolicies()
        ];
        if (this.projectsRepository.getProjects().length === 0) {
            tasks.push(this.loadProjectsUseCase.execute());
        }
        const [, policyListResponse] = (await Promise.all(tasks)) as [
            void,
            { items: LicensesGateway.PolicyRule[] }
        ];
        runInAction(() => {
            this.repository.setPolicies(policyListResponse.items);
        });
    } catch (err) {
        runInAction(() => {
            this.error = err instanceof Error ? err.message : "Failed to load licenses";
        });
    } finally {
        runInAction(() => {
            this.loading = false;
        });
    }
};
```

9. Replace filter setters to update URL instead of local state:

```typescript
public setRiskTierFilter = (tier: string | null): void => {
    this.urlFilterService.update(FILTER_SCHEMA, { riskTier: tier });
};

public setPackageNameFilter = (name: string): void => {
    this.urlFilterService.update(FILTER_SCHEMA, { packageName: name || null });
};

public setProjectIdFilter = (projectId: string | null): void => {
    this.urlFilterService.update(FILTER_SCHEMA, { projectId });
};

public setViolationFilter = (action: string | null): void => {
    this.urlFilterService.update(FILTER_SCHEMA, { violationAction: action });
};
```

Note: `setViolationFilter` maps to the `violationAction` URL param.

10. In the `vm` getter, read filter values from URL for the ViewModel, and change the licenses source from `this.applyFilters(this.buildRows())` to `this.buildRows()`:

```typescript
const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
const rows = this.buildRows();
// in return:
licenses: rows,
totalCount: rows.length,
riskTierFilter: urlFilters.riskTier ?? null,
packageNameFilter: urlFilters.packageName ?? "",
projectIdFilter: urlFilters.projectId ?? null,
violationFilter: urlFilters.violationAction ?? null,
```

11. Remove `applyFilters()` method entirely.

12. In the `vm` getter, change `this.applyFilters(this.buildRows())` to just `this.buildRows()` — server already filtered them.

13. Update the DI registration to include `UrlFilterService`:

```typescript
export const LicensesPresenter = Abstraction.createImplementation({
  implementation: LicensesPresenterImpl,
  dependencies: [
    LoadLicensesUseCase,
    ManagePolicyRulesUseCase,
    ScanLicensesUseCase,
    LicensesRepository,
    LicensesGateway,
    WebSocketListener,
    LoadProjectsUseCase,
    ProjectsRepository,
    TeamFilterService,
    UrlFilterService
  ]
});
```

- [ ] **Step 3: Update tests**

In `src/ui/presentation/licenses/__tests__/LicensesPresenter.test.ts`:

1. Add imports:

```typescript
import { UrlFilterService as UrlFilterServiceAbstraction } from "../../../features/urlFilter/abstractions/UrlFilterService.js";
import { UrlFilterFeature } from "../../../features/urlFilter/feature.js";
```

2. In `createPresenter()`, register `UrlFilterFeature`:

```typescript
UrlFilterFeature.register(container);
```

3. Add a helper to set URL search params before creating/loading the presenter:

```typescript
function setUrlParams(params: Record<string, string>): void {
  const search = new URLSearchParams(params).toString();
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, search: search ? `?${search}` : "", pathname: "/licenses" }
  });
}
```

4. Update filter tests to set URL params BEFORE calling `load()`, and verify that the gateway `list` mock received the filter values. The mock gateway's `list` method should record its arguments:

Update the mock gateway `list` to capture filters:

```typescript
list: async (filters?: LicensesGateway.ListFilters) => {
    calls.push({ method: "list", args: filters });
    return { items: state.licenses, total: state.licensesTotal };
},
```

5. Update the "risk tier filter" test:

```typescript
it("risk tier filter passes riskTier to gateway", async () => {
  mockGateway.state.licenses = [
    license({ id: "lic-2", packageName: "axios", riskTier: "copyleft" }),
    license({ id: "lic-3", packageName: "left-pad", riskTier: "copyleft" })
  ];
  mockGateway.state.licensesTotal = 2;
  setUrlParams({ riskTier: "copyleft" });
  const presenter = createPresenter(mockGateway);
  await presenter.load();

  expect(presenter.vm.riskTierFilter).toBe("copyleft");
  const listCall = mockGateway.calls.find(c => c.method === "list");
  expect((listCall?.args as Record<string, unknown>)?.riskTier).toBe("copyleft");
});
```

6. Update the "package name filter" test similarly — set `packageName` in URL params.

7. Update the "violation filter" test — set `violationAction` in URL params.

8. Update the "project id filter" test — set `projectId` in URL params.

9. Update the initial state test — `riskTierFilter` should be `null`, `packageNameFilter` should be `""`, etc. (same expectations, now derived from empty URL).

10. Add `afterEach` to clean up URL:

```typescript
afterEach(() => {
  setUrlParams({});
});
```

- [ ] **Step 4: Run validation**

Run: `yarn full`
Expected: PASS — all tests green, types check.

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/licenses/ src/ui/features/urlFilter/
git commit -m "feat(licenses): migrate filtering to API-side with URL sync"
```
