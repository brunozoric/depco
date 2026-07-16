# Team Detail Tests, Vulnerability Export Filter, Project Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add team detail presenter tests, move vulnerability dependencyType filter to server-side for correct export behavior, and add a project list search bar.

**Architecture:** Feature 1 is pure test addition. Feature 2 threads a `dependencyType` query parameter from shared route schemas through the API route (post-enrichment filter), UI gateway, and presenter. Feature 3 adds client-side text search to the project list presenter with a TextInput in the UI.

**Tech Stack:** TypeScript, Vitest, MobX, Mantine UI, Fastify, Zod

## Global Constraints

- Use yarn for all package operations
- Named interfaces only — no inline structural types
- Use full words — "Vulnerability" not "Vuln", "Dependency" not "Dep"
- Never import `*Impl` outside its own file
- Do NOT amend commits — always create new commits
- Work directly on main — no feature branches, no worktrees

---

### Task 1: Team Detail Presenter Tests

**Files:**

- Create: `src/ui/presentation/teams/TeamDetail/__tests__/TeamDetailPresenter.test.ts`

**Interfaces:**

- Consumes: `TeamDetailPresenter.Interface` (load, dispose, vm, dashboardPresenter), `TeamsGateway.Interface` (getDetail), `TeamFilterService.Interface` (selectedTeamId, setSelectedTeamId), `DashboardPresenter.Interface`
- Produces: Test coverage for TeamDetailPresenter — no code consumed by later tasks

- [ ] **Step 1: Write test file with setup and first test**

```typescript
// src/ui/presentation/teams/TeamDetail/__tests__/TeamDetailPresenter.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { TeamsGateway } from "../../../../features/teams/abstractions/TeamsGateway.js";
import { TeamFilterService } from "../../../../features/teamFilter/abstractions/TeamFilterService.js";
import { DashboardPresenter } from "../../../dashboard/Dashboard/abstractions/DashboardPresenter.js";
import { TeamDetailPresenter } from "../abstractions/TeamDetailPresenter.js";
import { TeamDetailPresenter as TeamDetailPresenterRegistration } from "../TeamDetailPresenter.js";

describe("TeamDetailPresenter", () => {
  let mockGateway: TeamsGateway.Interface;
  let mockFilterService: TeamFilterService.Interface;
  let mockDashboardPresenter: DashboardPresenter.Interface;

  function createPresenter(): TeamDetailPresenter.Interface {
    const container = createContainer();
    container.registerInstance(TeamsGateway, mockGateway);
    container.registerInstance(TeamFilterService, mockFilterService);
    container.registerInstance(DashboardPresenter, mockDashboardPresenter);
    container.register(TeamDetailPresenterRegistration);
    return container.resolve(TeamDetailPresenter);
  }

  beforeEach(() => {
    mockGateway = {
      list: vi.fn(),
      getDetail: vi.fn(async () => ({
        id: "team-1",
        name: "Frontend",
        color: "#ff0000",
        createdAt: Date.now(),
        projects: [
          { id: "p1", name: "App", path: "/app" },
          { id: "p2", name: "Lib", path: "/lib" }
        ]
      })),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      getProjectTeams: vi.fn(),
      setProjectTeams: vi.fn(),
      setTeamProjects: vi.fn()
    };

    mockFilterService = {
      get selectedTeamId() {
        return null;
      },
      setSelectedTeamId: vi.fn()
    };

    mockDashboardPresenter = {
      get vm() {
        return {
          loading: false,
          error: null,
          trendRange: "30d",
          summary: null,
          projects: [],
          trendData: [],
          activity: [],
          staleness: [],
          security: [],
          vulnerabilitySummary: null,
          vulnerabilityTrend: [],
          vulnerabilityTrendRange: "30d",
          licenseCompliance: null,
          openAutoFixPrCount: 0,
          stalenessTrend: [],
          licenseTrend: [],
          autoFixTrend: []
        };
      },
      load: vi.fn(),
      setTrendRange: vi.fn(),
      setVulnerabilityTrendRange: vi.fn(),
      dispose: vi.fn()
    };
  });

  it("loads team detail and populates vm", async () => {
    const presenter = createPresenter();
    await presenter.load("team-1");

    expect(mockGateway.getDetail).toHaveBeenCalledWith("team-1");
    expect(presenter.vm.teamName).toBe("Frontend");
    expect(presenter.vm.teamColor).toBe("#ff0000");
    expect(presenter.vm.projectCount).toBe(2);
    expect(presenter.vm.loading).toBe(false);
    expect(presenter.vm.error).toBeNull();
  });

  it("sets team filter on load", async () => {
    const presenter = createPresenter();
    await presenter.load("team-1");

    expect(mockFilterService.setSelectedTeamId).toHaveBeenCalledWith("team-1");
  });

  it("saves previous team id before overwriting", async () => {
    let currentId: string | null = "previous-team";
    mockFilterService = {
      get selectedTeamId() {
        return currentId;
      },
      setSelectedTeamId: vi.fn(id => {
        currentId = id;
      })
    };

    const presenter = createPresenter();
    await presenter.load("team-1");

    expect(mockFilterService.setSelectedTeamId).toHaveBeenCalledWith("team-1");

    presenter.dispose();
    expect(mockFilterService.setSelectedTeamId).toHaveBeenCalledWith("previous-team");
  });

  it("restores previous team id on dispose", async () => {
    const presenter = createPresenter();
    await presenter.load("team-1");
    presenter.dispose();

    expect(mockFilterService.setSelectedTeamId).toHaveBeenLastCalledWith(null);
  });

  it("sets vm.error on gateway failure", async () => {
    mockGateway.getDetail = vi.fn(async () => {
      throw new Error("Network error");
    });

    const presenter = createPresenter();
    await presenter.load("team-1");

    expect(presenter.vm.error).toBe("Network error");
    expect(presenter.vm.loading).toBe(false);
  });

  it("exposes dashboardPresenter", () => {
    const presenter = createPresenter();
    expect(presenter.dashboardPresenter).toBe(mockDashboardPresenter);
  });

  it("sets loading true during load", async () => {
    let loadingDuringFetch = false;
    mockGateway.getDetail = vi.fn(async () => {
      loadingDuringFetch = presenter.vm.loading;
      return {
        id: "team-1",
        name: "Frontend",
        color: "#ff0000",
        createdAt: Date.now(),
        projects: []
      };
    });

    const presenter = createPresenter();
    const promise = presenter.load("team-1");
    expect(presenter.vm.loading).toBe(true);
    await promise;
    expect(loadingDuringFetch).toBe(true);
    expect(presenter.vm.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/ui/presentation/teams/TeamDetail/__tests__/TeamDetailPresenter.test.ts`
Expected: All 7 tests pass.

- [ ] **Step 3: Run full suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/teams/TeamDetail/__tests__/TeamDetailPresenter.test.ts
git commit -m "test(teams): add TeamDetailPresenter unit tests"
```

---

### Task 2: Server-Side dependencyType Filter — API Layer

**Files:**

- Modify: `src/shared/routes/vulnerabilities.ts` — add `dependencyType` to list and export route schemas
- Modify: `src/api/routes/vulnerabilities.ts` — add `dependencyType` to `IVulnerabilityQuerystring`, `buildFilters`, and post-enrichment filtering

**Interfaces:**

- Consumes: `enrichWithProjectNames` returns `IEnrichedVulnerability[]` with `isTransitive: boolean`
- Produces: API routes accept `dependencyType` query param and filter enriched results accordingly

- [ ] **Step 1: Add dependencyType to shared route schemas**

In `src/shared/routes/vulnerabilities.ts`, add `dependencyType` to the `querystring` of `listVulnerabilitiesRoute` (after `teamId`):

```typescript
dependencyType: z.enum(["all", "direct", "transitive"]).optional();
```

Add the same field to `exportVulnerabilitiesRoute` querystring (after `teamId`):

```typescript
dependencyType: z.enum(["all", "direct", "transitive"]).optional();
```

- [ ] **Step 2: Add dependencyType to API route query interface and buildFilters**

In `src/api/routes/vulnerabilities.ts`, add to `IVulnerabilityQuerystring`:

```typescript
interface IVulnerabilityQuerystring {
  severity?: string | undefined;
  packageName?: string | undefined;
  source?: string | undefined;
  projectIds?: string | undefined;
  includeDismissed?: "true" | "false" | undefined;
  scannedDate?: string | undefined;
  dependencyType?: "all" | "direct" | "transitive" | undefined;
}
```

No change to `buildFilters` — `dependencyType` is handled after enrichment, not as a DB filter.

- [ ] **Step 3: Add post-enrichment filter helper**

In `src/api/routes/vulnerabilities.ts`, add after the `enrichWithProjectNames` function:

```typescript
function filterByDependencyType(
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
```

- [ ] **Step 4: Apply filter in list route handler**

In the `listVulnerabilitiesRoute` handler, after `enrichWithProjectNames`, apply the filter:

```typescript
registerRoute(app, listVulnerabilitiesRoute, {}, async (request, reply) => {
  const filters = buildFilters(request.query);
  if (request.query.teamId) {
    const teamProjectIds = await resolveTeamProjectIds(db, request.query.teamId);
    mergeTeamProjectIds(filters, teamProjectIds);
    if (filters.projectIds && filters.projectIds.length === 0) {
      sendList(reply, [], 0);
      return;
    }
  }
  const items = await vulnerabilityService.getAll(filters);
  const enriched = await enrichWithProjectNames(items, db);
  const filtered = filterByDependencyType(enriched, request.query.dependencyType);
  sendList(reply, filtered, filtered.length);
});
```

- [ ] **Step 5: Apply filter in export route handler**

In the `exportVulnerabilitiesRoute` handler, destructure `dependencyType` from query, and apply after enrichment:

Change the destructure line:

```typescript
const { format, ids: idsParam, teamId, dependencyType, ...filterParams } = request.query;
```

After `const enriched = await enrichWithProjectNames(items, db);`, add:

```typescript
const filtered = filterByDependencyType(enriched, dependencyType);
```

Then use `filtered` instead of `enriched` in the JSON/CSV output below it.

- [ ] **Step 6: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/shared/routes/vulnerabilities.ts src/api/routes/vulnerabilities.ts
git commit -m "feat(vulnerabilities): add server-side dependencyType filter to API"
```

---

### Task 3: Server-Side dependencyType Filter — UI Layer

**Files:**

- Modify: `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts` — re-add `dependencyType` to `IVulnerabilityListFilters`
- Modify: `src/ui/features/vulnerabilities/VulnerabilitiesGateway.ts` — add `dependencyType` to `buildListQuery` and `getExportUrl`
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts` — add `dependencyType` to `currentFilters()`, remove `getFilteredIdsByDependencyType()`, simplify `exportAll`

**Interfaces:**

- Consumes: API `dependencyType` query param from Task 2
- Produces: `dependencyType` flows through gateway to API for both list and export

- [ ] **Step 1: Re-add dependencyType to gateway filter interface**

In `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts`, add to `IVulnerabilityListFilters`:

```typescript
export interface IVulnerabilityListFilters {
  severity?: string;
  packageName?: string;
  source?: string;
  projectIds?: string[];
  includeDismissed?: boolean;
  scannedDate?: string;
  teamId?: string;
  dependencyType?: "all" | "direct" | "transitive";
}
```

- [ ] **Step 2: Add dependencyType to buildListQuery**

In `src/ui/features/vulnerabilities/VulnerabilitiesGateway.ts`, add to `buildListQuery` after the `teamId` block:

```typescript
if (filters?.dependencyType && filters.dependencyType !== "all") {
  query["dependencyType"] = filters.dependencyType;
}
```

- [ ] **Step 3: Add dependencyType to getExportUrl**

In `getExportUrl`, add after the `teamId` block:

```typescript
if (filters.dependencyType && filters.dependencyType !== "all") {
  params.set("dependencyType", filters.dependencyType);
}
```

- [ ] **Step 4: Add dependencyType to presenter currentFilters**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts`, add to `currentFilters()`:

```typescript
...(this.dependencyType !== "all" ? { dependencyType: this.dependencyType } : {}),
```

- [ ] **Step 5: Remove getFilteredIdsByDependencyType and simplify exportAll**

Remove the entire `getFilteredIdsByDependencyType` method.

Simplify `exportAll` — remove the `filteredIds` logic:

```typescript
public exportAll = (format: "csv" | "json"): void => {
    const teamId = this.teamFilterService.selectedTeamId ?? undefined;
    this.exportUseCase.execute({
        filters: this.currentFilters(),
        format,
        ...(teamId ? { teamId } : {}),
    });
};
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts \
       src/ui/features/vulnerabilities/VulnerabilitiesGateway.ts \
       src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts
git commit -m "feat(vulnerabilities): wire dependencyType filter through gateway to API"
```

---

### Task 4: Project List Search Bar

**Files:**

- Modify: `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts` — add `searchQuery` to VM, `setSearchQuery` to presenter interface
- Modify: `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts` — add search state, setter, filter in vm getter
- Modify: `src/ui/presentation/projects/ProjectList/components/ProjectListPage.tsx` — add TextInput

**Interfaces:**

- Consumes: `IProjectListViewModel`, `IProjectListPresenter`
- Produces: `searchQuery` field on VM, `setSearchQuery` method on presenter

- [ ] **Step 1: Add searchQuery to presenter abstraction**

In `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`:

Add `searchQuery: string;` to `IProjectListViewModel`.

Add `setSearchQuery: (value: string) => void;` to `IProjectListPresenter`.

- [ ] **Step 2: Add search state and filter to presenter implementation**

In `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`:

Add private field after `scanDepth`:

```typescript
private searchQuery = "";
```

Add setter after `setScanDepth`:

```typescript
public setSearchQuery = (value: string): void => {
    this.searchQuery = value;
};
```

Add `searchQuery` to the vm return object:

```typescript
searchQuery: this.searchQuery,
```

Modify the vm getter — after the team filter, apply search filter:

```typescript
public get vm(): Abstraction.ViewModel {
    const allProjects = this.projectsRepository.getProjects();
    const selectedTeamId = this.teamFilterService.selectedTeamId;
    const teamFiltered = selectedTeamId
        ? allProjects.filter((project) =>
            (project.teams ?? []).some((team) => team.id === selectedTeamId),
        )
        : allProjects;

    const query = this.searchQuery.toLowerCase();
    const filteredProjects = query
        ? teamFiltered.filter(
            (project) =>
                project.name.toLowerCase().includes(query) ||
                project.path.toLowerCase().includes(query) ||
                (project.packageManager ?? "").toLowerCase().includes(query),
        )
        : teamFiltered;

    return {
        loading: this.loading,
        // ... rest unchanged, uses filteredProjects.map(...)
```

- [ ] **Step 3: Add TextInput to ProjectListPage**

In `src/ui/presentation/projects/ProjectList/components/ProjectListPage.tsx`:

Add `TextInput` import from Mantine:

```typescript
import {
  ActionIcon,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core";
```

Add the search input between the title Group and the loading/table section (after the closing `</Group>` of the title bar, before the `{vm.loading ? (` ternary):

```tsx
<TextInput
  placeholder="Search projects..."
  value={vm.searchQuery}
  onChange={event => presenter.setSearchQuery(event.currentTarget.value)}
/>
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts \
       src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts \
       src/ui/presentation/projects/ProjectList/components/ProjectListPage.tsx
git commit -m "feat(projects): add search bar to project list page"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run type check**

Run: `npx tsc -b`
Expected: No type errors.

- [ ] **Step 3: Run prettier**

Run: `npx prettier --write "src/**/*.{ts,tsx}"`

- [ ] **Step 4: Commit docs and formatting**

```bash
git add docs/superpowers/specs/2026-08-04-tests-export-filter-search-design.md \
       docs/superpowers/plans/2026-08-04-tests-export-filter-search.md
git commit -m "docs: spec and plan for tests, export filter, project search"
```

If formatting changed source files:

```bash
git add -u
git commit -m "style: format changed files with prettier"
```
