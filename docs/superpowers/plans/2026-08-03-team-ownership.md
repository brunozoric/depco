# Team Ownership & Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add team ownership to the dependency manager — teams own projects (many-to-many) with a dedicated /teams page for CRUD, a global team filter in the header that scopes all pages, and team assignment on project detail.

**Architecture:** Two new DB tables (`teams`, `team_projects` join). Teams CRUD API + `teamId` filter added to 9 existing endpoints. UI: `TeamFilterService` (MobX + localStorage via `@webiny/stdlib` Cache) persists global filter selection. `/teams` page with full MVP stack. Project detail gains team MultiSelect. Existing presenters inject `TeamFilterService` and react to changes.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, SQLite, Zod, React, Mantine UI, MobX, @webiny/stdlib (Cache/LocalStorageCacheFeature)

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
- Import `LocalStorageCacheFeature` from `@webiny/stdlib/browser`
- Import `Cache` from `@webiny/stdlib`

---

### Task 1: DB Schema + Teams CRUD API + Tests

**Files:**

- Modify: `src/api/db/schema.ts` (add `teams` + `teamProjects` tables)
- Modify: `src/testing/helpers/createTestDb.ts` (add CREATE TABLE statements)
- Create: `src/shared/routes/teams.ts` (route definitions)
- Modify: `src/shared/routes/index.ts` (add export)
- Create: `src/api/routes/teams.ts` (route handlers)
- Modify: `src/api/routes/index.ts` (add export)
- Modify: `src/api/server.ts` (register teamsRoutes)
- Create: `src/api/routes/__tests__/teams.test.ts`

**Interfaces:**

- Consumes: `DatabaseClient`, DB schema (`projects`, `vulnerabilities`, `healthSnapshots`, `licenseSnapshots`)
- Produces:
  - `teams` and `teamProjects` Drizzle table exports
  - 5 route definitions: `listTeamsRoute`, `createTeamRoute`, `updateTeamRoute`, `deleteTeamRoute`, `getTeamDetailRoute`
  - `teamsRoutes` Fastify plugin

- [ ] **Step 1: Add DB tables to Drizzle schema**

In `src/api/db/schema.ts`, add after the `dependencyChanges` table:

```typescript
export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(),
  createdAt: integer("created_at").notNull()
});

export const teamProjects = sqliteTable(
  "team_projects",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" })
  },
  table => ({
    uniqueTeamProject: unique().on(table.teamId, table.projectId)
  })
);
```

- [ ] **Step 2: Add CREATE TABLE to createTestDb.ts**

In `src/testing/helpers/createTestDb.ts`, add inside the `CREATE_TABLES` template string (after the `dependency_changes` table):

```sql
CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE TABLE team_projects (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(team_id, project_id)
);
```

- [ ] **Step 3: Create shared route definitions**

Create `src/shared/routes/teams.ts`:

```typescript
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const teamWithStatsSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  createdAt: z.number(),
  projectCount: z.number(),
  vulnerabilityCount: z.number(),
  compliantPercent: z.number(),
  averageHealthScore: z.number()
});

export const listTeamsRoute = defineRoute({
  method: "GET",
  path: "/api/teams",
  description: "List all teams with aggregate stats",
  params: z.object({}),
  response: z.object({ items: z.array(teamWithStatsSchema), total: z.number() })
});

export const createTeamRoute = defineRoute({
  method: "POST",
  path: "/api/teams",
  description: "Create a new team",
  params: z.object({}),
  body: z.object({ name: z.string(), color: z.string() }),
  response: z.object({ item: teamWithStatsSchema })
});

export const getTeamDetailRoute = defineRoute({
  method: "GET",
  path: "/api/teams/:id",
  description: "Get team detail with projects",
  params: z.object({ id: z.string() }),
  response: z.object({
    item: z.object({
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
    })
  })
});

export const updateTeamRoute = defineRoute({
  method: "PUT",
  path: "/api/teams/:id",
  description: "Update a team",
  params: z.object({ id: z.string() }),
  body: z.object({ name: z.string().optional(), color: z.string().optional() }),
  response: z.object({ item: teamWithStatsSchema })
});

export const deleteTeamRoute = defineRoute({
  method: "DELETE",
  path: "/api/teams/:id",
  description: "Delete a team",
  params: z.object({ id: z.string() })
});
```

Add to `src/shared/routes/index.ts`: `export * from "./teams.js";`

- [ ] **Step 4: Create route handlers**

Create `src/api/routes/teams.ts` with `teamsRoutes` Fastify plugin. Read existing `src/api/routes/dashboard.ts` and `src/api/routes/projects.ts` for pattern reference.

Teams list handler computes stats via SQL joins:

- `projectCount`: COUNT from `team_projects`
- `vulnerabilityCount`: COUNT from `vulnerabilities` joined through `team_projects`, using the same active-dismiss condition as `VulnerabilityService` (`dismissedAt IS NULL OR (dismissedUntil IS NOT NULL AND dismissedUntil <= :now)`) — read `src/api/services/VulnerabilityService.ts` for the exact `activeDismissCondition()` helper and reuse or replicate it
- `compliantPercent`: from latest `license_snapshots` per project (grouped by projectId, MAX date), then averaged across team's projects. When no snapshots exist, defaults to 100.
- `averageHealthScore`: from latest `health_snapshots` per project (grouped by projectId, MAX date), averaged. When no snapshots exist, defaults to 0.

Create handler: validate unique name (409 on conflict), insert, return with zero stats. Update handler: merge partial body, validate unique name on rename (409 if another team already has that name). Delete handler: `sendNone`. Detail handler: join `team_projects` + `projects` for project list.

Add to `src/api/routes/index.ts`: `export { teamsRoutes } from "./teams.js";`

Register in `src/api/server.ts`: add `teamsRoutes` to import destructure and `await app.register(teamsRoutes, { container })`.

- [ ] **Step 5: Write route tests**

Create `src/api/routes/__tests__/teams.test.ts`:

Test cases:

- Create team, verify response shape with zero stats
- List teams returns created teams
- Create team with duplicate name returns 409
- Update team name and color
- Update team 404
- Delete team, verify cascade removes team_projects rows
- Get team detail with project list
- Get team detail 404
- List teams with stats: seed 2 projects, assign to team, seed vulnerabilities + health_snapshots + license_snapshots, verify projectCount/vulnerabilityCount/compliantPercent/averageHealthScore

- [ ] **Step 6: Run tests and build**

Run: `yarn build && yarn test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/api/db/schema.ts src/testing/helpers/createTestDb.ts src/shared/routes/teams.ts src/shared/routes/index.ts src/api/routes/teams.ts src/api/routes/index.ts src/api/server.ts src/api/routes/__tests__/teams.test.ts
git commit -m "feat(teams): add teams CRUD API with aggregate stats"
```

---

### Task 2: Project Team Assignment API + teamId Filter on Existing Endpoints

**Files:**

- Modify: `src/api/routes/projects.ts` (add team assignment endpoints)
- Modify: `src/shared/routes/projects.ts` (add route definitions)
- Modify: `src/shared/routes/dashboard.ts` (add teamId to trend route querystrings)
- Modify: `src/shared/routes/vulnerabilities.ts` (add teamId to querystring)
- Modify: `src/shared/routes/licenses.ts` (add teamId to querystring)
- Modify: `src/shared/routes/packages.ts` (add teamId to querystring)
- Modify: `src/api/routes/dashboard.ts` (add teamId filter to handlers)
- Modify: `src/api/routes/vulnerabilities.ts` (add teamId filter)
- Modify: `src/api/routes/licenses.ts` (add teamId filter)
- Modify: `src/api/routes/packages.ts` (add teamId filter)
- Modify: `src/api/routes/__tests__/teams.test.ts` (add assignment + filter tests)

**Interfaces:**

- Consumes: `teams`, `teamProjects` tables (Task 1), existing route handlers
- Produces: `setProjectTeamsRoute`, `getProjectTeamsRoute` route definitions, teamId filtering on 9 endpoints

- [ ] **Step 1: Add project team assignment route definitions**

In `src/shared/routes/projects.ts`, add:

```typescript
export const getProjectTeamsRoute = defineRoute({
  method: "GET",
  path: "/api/projects/:id/teams",
  description: "Get teams for a project",
  params: z.object({ id: z.string() }),
  response: z.object({
    items: z.array(z.object({ id: z.string(), name: z.string(), color: z.string() })),
    total: z.number()
  })
});

export const setProjectTeamsRoute = defineRoute({
  method: "PUT",
  path: "/api/projects/:id/teams",
  description: "Set team assignments for a project",
  params: z.object({ id: z.string() }),
  body: z.object({ teamIds: z.array(z.string()) })
});
```

- [ ] **Step 2: Implement project team assignment handlers**

In `src/api/routes/projects.ts`, add handlers:

GET handler: join `team_projects` + `teams` where `projectId = params.id`, return via `sendList`.

PUT handler: validate project exists (404), deduplicate `teamIds` via `[...new Set(body.teamIds)]`, transaction: delete existing `team_projects` for this project, insert new rows, return `sendNone`.

- [ ] **Step 3: Add teamId query param to shared route definitions**

Add `teamId: z.string().optional()` to the querystring schemas of these existing routes:

- `src/shared/routes/dashboard.ts`: `dashboardHealthRoute`, `dashboardStalenessTrendRoute`, `dashboardLicenseTrendRoute`, `dashboardAutoFixTrendRoute`, `dashboardDependencyChangesRoute`, `dashboardVulnerabilityTrendRoute`
- `src/shared/routes/vulnerabilities.ts`: `listVulnerabilitiesRoute`
- `src/shared/routes/licenses.ts`: `listLicensesRoute`
- `src/shared/routes/packages.ts`: `listPackagesRoute`

- [ ] **Step 4: Add teamId filter to existing route handlers**

For each handler, when `teamId` is present in query, add a SQL condition:

```sql
projects.id IN (SELECT project_id FROM team_projects WHERE team_id = :teamId)
```

- Dashboard health/staleness-trend/license-trend/auto-fix-trend/vulnerability-trend: add `WHERE project_id IN (SELECT project_id FROM team_projects WHERE team_id = :teamId)` to the raw SQL queries
- Vulnerabilities: resolve `teamId` → project IDs via `SELECT project_id FROM team_projects WHERE team_id = :teamId`, then merge into `filters.projectIds` (existing supported filter). If both `teamId` and `projectIds` are provided, intersect them.
- Licenses: add IN subquery to `buildLicenseConditions` (Drizzle `inArray` or raw SQL)
- Packages: add to conditions array in the raw SQL builder
- Dependency-changes: add IN subquery condition on `dependency_changes.project_id`

Each endpoint handler checks `request.query.teamId` and applies the appropriate filter.

**Important for vulnerabilities:** Do NOT modify `VulnerabilityService`. Instead, resolve teamId→projectIds at the route handler level and pass the merged `projectIds` into `buildFilters()`. This keeps VulnerabilityService unchanged.

- [ ] **Step 5: Write tests for assignment + filtering**

Extend `src/api/routes/__tests__/teams.test.ts`:

- Assign 2 teams to a project, verify `GET /api/projects/:id/teams` returns both
- Replace teams (PUT with different teamIds), verify old assignments removed
- Empty teamIds array removes all assignments
- 404 when project not found

Add filter tests:

- Seed 2 teams with different projects, seed vulnerabilities for each
- `GET /api/vulnerabilities?teamId=team1` returns only team1's project vulns
- `GET /api/licenses?teamId=team1` returns only team1's project licenses
- `GET /api/dashboard/health?teamId=team1` returns only team1's project health data

- [ ] **Step 6: Run build and full test suite**

Run: `yarn build && yarn test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/shared/routes/ src/api/routes/
git commit -m "feat(teams): add project team assignment and teamId filter on existing endpoints"
```

---

### Task 3: TeamFilterService + TeamListService (MobX + localStorage)

**Files:**

- Create: `src/ui/features/teamFilter/abstractions/TeamFilterService.ts`
- Create: `src/ui/features/teamFilter/abstractions/TeamListService.ts`
- Create: `src/ui/features/teamFilter/TeamFilterService.ts`
- Create: `src/ui/features/teamFilter/TeamListService.ts`
- Create: `src/ui/features/teamFilter/feature.ts`
- Create: `src/ui/features/teamFilter/__tests__/TeamFilterService.test.ts`

**Interfaces:**

- Consumes: `Cache` from `@webiny/stdlib`, `HTTPClient`, `listTeamsRoute`
- Produces: `TeamFilterService.Interface` (selectedTeamId observable), `TeamListService.Interface` (loadTeams/getTeams), `TeamFilterFeature`

- [ ] **Step 1: Create TeamFilterService abstraction**

Create `src/ui/features/teamFilter/abstractions/TeamFilterService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface ITeamFilterService {
  get selectedTeamId(): string | null;
  setSelectedTeamId(teamId: string | null): void;
}

export const TeamFilterService = createAbstraction<ITeamFilterService>("Ui/TeamFilterService");

export namespace TeamFilterService {
  export type Interface = ITeamFilterService;
}
```

- [ ] **Step 2: Create TeamListService abstraction**

Create `src/ui/features/teamFilter/abstractions/TeamListService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface ITeamListItem {
  id: string;
  name: string;
  color: string;
}

export interface ITeamListService {
  loadTeams(): Promise<void>;
  getTeams(): ITeamListItem[];
}

export const TeamListService = createAbstraction<ITeamListService>("Ui/TeamListService");

export namespace TeamListService {
  export type Interface = ITeamListService;
  export type TeamListItem = ITeamListItem;
}
```

- [ ] **Step 3: Implement TeamFilterService**

Create `src/ui/features/teamFilter/TeamFilterService.ts`:

```typescript
import { makeAutoObservable } from "mobx";
import { TeamFilterService as Abstraction } from "./abstractions/TeamFilterService.js";
import { Cache } from "@webiny/stdlib";

const CACHE_KEY = "team-filter:selectedTeamId";

class TeamFilterServiceImpl implements Abstraction.Interface {
  private teamId: string | null = null;

  public constructor(private readonly cache: Cache.Interface) {
    makeAutoObservable(this);
    const result = this.cache.get<string>(CACHE_KEY);
    if (result.isOk() && result.value !== null) {
      this.teamId = result.value;
    }
  }

  public get selectedTeamId(): string | null {
    return this.teamId;
  }

  public setSelectedTeamId(teamId: string | null): void {
    this.teamId = teamId;
    if (teamId === null) {
      this.cache.remove(CACHE_KEY);
    } else {
      this.cache.set(CACHE_KEY, teamId);
    }
  }
}

export const TeamFilterService = Abstraction.createImplementation({
  implementation: TeamFilterServiceImpl,
  dependencies: [Cache]
});
```

- [ ] **Step 4: Implement TeamListService**

Create `src/ui/features/teamFilter/TeamListService.ts`:

```typescript
import { TeamListService as Abstraction } from "./abstractions/TeamListService.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import { listTeamsRoute } from "#shared/routes/index.js";

class TeamListServiceImpl implements Abstraction.Interface {
  private teams: Abstraction.TeamListItem[] = [];

  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async loadTeams(): Promise<void> {
    const response = await this.httpClient.request(listTeamsRoute, { params: {} });
    this.teams = response.items.map(team => ({
      id: team.id,
      name: team.name,
      color: team.color
    }));
  }

  public getTeams(): Abstraction.TeamListItem[] {
    return this.teams;
  }
}

export const TeamListService = Abstraction.createImplementation({
  implementation: TeamListServiceImpl,
  dependencies: [HTTPClient]
});
```

- [ ] **Step 5: Create TeamFilterFeature**

Create `src/ui/features/teamFilter/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { TeamFilterService } from "./TeamFilterService.js";
import { TeamListService } from "./TeamListService.js";
import { LocalStorageCacheFeature } from "@webiny/stdlib/browser";

export const TeamFilterFeature = createFeature({
  name: "Ui/TeamFilter",
  dependencies: [LocalStorageCacheFeature],
  register(container) {
    container.register(TeamFilterService).inSingletonScope();
    container.register(TeamListService).inSingletonScope();
  }
});
```

- [ ] **Step 6: Write TeamFilterService tests**

Create `src/ui/features/teamFilter/__tests__/TeamFilterService.test.ts`:

Test cases:

- Initial selectedTeamId is null when cache is empty
- Restores selectedTeamId from cache on construction
- setSelectedTeamId updates observable and persists to cache
- setSelectedTeamId(null) clears cache entry
- Multiple set calls persist the latest value

Mock `Cache.Interface` with an in-memory `Map<string, unknown>` returning `Result` objects.

- [ ] **Step 7: Run build and tests**

Run: `yarn build && yarn test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/ui/features/teamFilter/
git commit -m "feat(teams): add TeamFilterService and TeamListService with localStorage persistence"
```

---

### Task 4: Teams UI Features Layer (Gateway + Repository) + /teams Page

**Files:**

- Create: `src/ui/features/teams/abstractions/TeamsGateway.ts`
- Create: `src/ui/features/teams/abstractions/TeamsRepository.ts`
- Create: `src/ui/features/teams/TeamsGateway.ts`
- Create: `src/ui/features/teams/TeamsRepository.ts`
- Create: `src/ui/features/teams/feature.ts`
- Create: `src/ui/presentation/teams/useCases/abstractions/LoadTeamsUseCase.ts`
- Create: `src/ui/presentation/teams/useCases/abstractions/ManageTeamUseCase.ts`
- Create: `src/ui/presentation/teams/useCases/LoadTeamsUseCase.ts`
- Create: `src/ui/presentation/teams/useCases/ManageTeamUseCase.ts`
- Create: `src/ui/presentation/teams/useCases/feature.ts`
- Create: `src/ui/presentation/teams/TeamsPage/abstractions/TeamsPresenter.ts`
- Create: `src/ui/presentation/teams/TeamsPage/TeamsPresenter.ts`
- Create: `src/ui/presentation/teams/TeamsPage/TeamsProvider.tsx`
- Create: `src/ui/presentation/teams/TeamsPage/components/TeamsPage.tsx`
- Create: `src/ui/presentation/teams/TeamsPage/feature.ts`
- Create: `src/ui/presentation/teams/__tests__/TeamsPresenter.test.ts`
- Modify: `src/ui/App.tsx` (add /teams route, nav link, features)

**Interfaces:**

- Consumes: `HTTPClient`, shared route definitions, `TeamsGateway`, `TeamsRepository`
- Produces: Full /teams page with CRUD, `TeamsFeature`, `TeamsPageFeature`

- [ ] **Step 1: Create TeamsGateway abstraction**

Define `ITeamsGateway` matching the spec exactly — `list()`, `getDetail()`, `create()`, `update()`, `remove()`, `getProjectTeams()`, `setProjectTeams()`. Include all named response/input interfaces: `ITeamWithStats`, `ITeamDetail`, `ITeamProjectSummary`, `ITeamItem`, `ICreateTeamInput`, `IUpdateTeamInput`, `ITeamListResponse`, `IProjectTeamsResponse`.

- [ ] **Step 2: Create TeamsRepository abstraction + implementation**

Simple: `getTeams(): ITeamWithStats[]`, `setTeams(teams): void`.

- [ ] **Step 3: Implement TeamsGateway**

Use `HTTPClient.request()` with shared route definitions.

- [ ] **Step 4: Create TeamsFeature**

Register gateway + repository as singletons.

- [ ] **Step 5: Create use case abstractions + implementations**

`LoadTeamsUseCase.execute()` — fetches teams, stores in repository.
`ManageTeamUseCase.create(input)` / `.update(id, input)` / `.remove(id)` — calls gateway, reloads list after mutation.

- [ ] **Step 6: Create use case feature**

Register both use cases.

- [ ] **Step 7: Create TeamsPresenter abstraction**

Define VM matching spec:

```typescript
interface ITeamsViewModel {
  loading: boolean;
  error: string | null;
  teams: ITeamWithStats[];
  editingTeam: ITeamFormState | null;
  deletingTeamId: string | null;
}

interface ITeamFormState {
  id: string | null;
  name: string;
  color: string;
}
```

Methods: `load()`, `openCreateModal()`, `openEditModal(team)`, `closeModal()`, `saveTeam()`, `confirmDelete(id)`, `cancelDelete()`, `deleteTeam()`.

- [ ] **Step 8: Implement TeamsPresenter**

MobX `makeAutoObservable`, `computed` VM. Modal state management for create/edit/delete.

- [ ] **Step 9: Create TeamsProvider + TeamsPage component**

Table with columns: color dot (small colored `Badge` or div), name, project count, vulnerability count, compliance %, avg health score, actions (edit `ActionIcon`, delete `ActionIcon`).

Create/Edit modal: `TextInput` for name, `ColorInput` for color (Mantine `ColorInput` component).

Delete via `ConfirmDialog`.

- [ ] **Step 10: Create TeamsPage feature**

Dependencies: `TeamsUseCasesFeature`, `TeamsFeature`.

- [ ] **Step 11: Register in App.tsx**

- Import features, provider, page
- Add `TeamFilterFeature`, `TeamsFeature`, `TeamsUseCasesFeature`, `TeamsPageFeature` to `ALL_FEATURES`
- Add route: `if (path === "/teams") { ... }` before settings
- Add nav link: `<Anchor component="button" onClick={() => navigate("/teams")}>Teams</Anchor>` after Trends

- [ ] **Step 12: Write TeamsPresenter tests**

Test: initial state, load, openCreateModal/closeModal, saveTeam (create), openEditModal/saveTeam (update), confirmDelete/deleteTeam, error handling.

- [ ] **Step 13: Run build, tests, lint**

Run: `yarn build && yarn test && yarn lint`
Expected: PASS

- [ ] **Step 14: Commit**

```bash
git add src/ui/features/teams/ src/ui/presentation/teams/ src/ui/App.tsx
git commit -m "feat(teams): add /teams page with CRUD and aggregate stats"
```

---

### Task 5: Global Team Filter Header + App.tsx Integration

**Files:**

- Modify: `src/ui/App.tsx` (add team Select to header, add TeamListService loading on mount)

**Interfaces:**

- Consumes: `TeamFilterService.Interface` (Task 3), `TeamListService.Interface` (Task 3), `TeamFilterFeature` (already registered in Task 4)
- Produces: Global team Select in header, team list loaded on app mount

- [ ] **Step 1: Add team loading on app mount**

In `src/ui/App.tsx`, create a new render-less component (same pattern as `WebSocketConnector`, `JobNotificationListener`):

```typescript
function TeamListLoader(): null {
  const container = useContainer();

  useEffect(() => {
    const teamListService = container.resolve(TeamListService);
    void teamListService.loadTeams();
  }, [container]);

  return null;
}
```

Add to `App` component body, before `MantineProvider`.

- [ ] **Step 2: Add team Select to header**

Create a new `observer`-wrapped component `TeamFilterSelect` that:

- Resolves `TeamFilterService` and `TeamListService` from container
- Renders a Mantine `Select` with:
  - `placeholder="All Teams"`, `clearable`, `searchable`
  - `value={teamFilterService.selectedTeamId}`
  - `onChange={value => teamFilterService.setSelectedTeamId(value)}`
  - `data` from `teamListService.getTeams()` mapped to `{ value: team.id, label: team.name }`
  - `size="xs"` to fit in header
  - Optional: render option with color dot via `renderOption` prop

Place the `TeamFilterSelect` in the header `Group`, before the nav links.

- [ ] **Step 3: Run build and tests**

Run: `yarn build && yarn test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/ui/App.tsx
git commit -m "feat(teams): add global team filter Select to header"
```

---

### Task 6: Project Detail Team Assignment

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts` (add teams to VM)
- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts` (add team assignment)
- Modify: `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx` (add MultiSelect)
- Modify: `src/ui/presentation/projects/ProjectDetail/feature.ts` (add TeamsFeature dep)

**Interfaces:**

- Consumes: `TeamsGateway.Interface` (Task 4), `TeamListService.Interface` (Task 3)
- Produces: Team assignment UI on project detail page

- [ ] **Step 1: Add teams to ProjectDetailPresenter abstraction VM**

Add to the VM interface:

```typescript
projectTeamIds: string[];
availableTeams: Array<{ id: string; name: string; color: string }>;
```

Add method: `setProjectTeams(teamIds: string[]): Promise<void>`

- [ ] **Step 2: Implement team assignment in ProjectDetailPresenter**

- Inject `TeamsGateway.Interface` and `TeamListService.Interface`
- On project load, also fetch `getProjectTeams(projectId)` and store team IDs
- Load available teams from `TeamListService` (call `loadTeams()` if empty)
- `setProjectTeams`: call `teamsGateway.setProjectTeams(projectId, teamIds)`, re-fetch project teams
- Add `projectTeamIds` and `availableTeams` to VM getter

- [ ] **Step 3: Add MultiSelect to ProjectDetailPage**

Add Mantine `MultiSelect` component:

```tsx
<MultiSelect
  label="Teams"
  placeholder="Assign teams"
  value={vm.projectTeamIds}
  onChange={teamIds => void presenter.setProjectTeams(teamIds)}
  data={vm.availableTeams.map(team => ({
    value: team.id,
    label: team.name
  }))}
/>
```

- [ ] **Step 4: Update feature dependencies**

Add `TeamsFeature` and `TeamFilterFeature` to `ProjectDetailFeature` dependencies.

- [ ] **Step 5: Run build and tests**

Run: `yarn build && yarn test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/projects/ProjectDetail/
git commit -m "feat(teams): add team assignment MultiSelect to project detail page"
```

---

### Task 7: Existing Presenter Team Filter Integration

**Files:**

- Modify: `src/ui/features/dashboard/abstractions/DashboardGateway.ts` (add teamId param to gateway methods)
- Modify: `src/ui/features/dashboard/DashboardGateway.ts` (thread teamId through to query params)
- Modify: `src/ui/presentation/dashboard/useCases/LoadDashboardUseCase.ts` (accept teamId, pass to gateway)
- Modify: `src/ui/presentation/dashboard/useCases/abstractions/LoadDashboardUseCase.ts` (update execute signature)
- Modify: `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts` (inject TeamFilterService)
- Modify: `src/ui/presentation/dashboard/Dashboard/feature.ts` (add TeamFilterFeature dep)
- Modify: `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts` (add teamId to list filters)
- Modify: `src/ui/features/vulnerabilities/VulnerabilitiesGateway.ts` (thread teamId)
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts` (inject TeamFilterService)
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/feature.ts` (add dep)
- Modify: `src/ui/features/licenses/abstractions/LicensesGateway.ts` (add teamId to list filters)
- Modify: `src/ui/features/licenses/LicensesGateway.ts` (thread teamId)
- Modify: `src/ui/presentation/licenses/LicensesList/LicensesPresenter.ts` (inject TeamFilterService)
- Modify: `src/ui/presentation/licenses/LicensesList/feature.ts` (add dep)
- Modify: `src/ui/features/packages/abstractions/PackagesGateway.ts` (add teamId to list filters)
- Modify: `src/ui/features/packages/PackagesGateway.ts` (thread teamId)
- Modify: `src/ui/presentation/packages/PackageList/PackagesPresenter.ts` (inject TeamFilterService)
- Modify: `src/ui/presentation/packages/PackageList/feature.ts` (add dep)
- Modify: `src/ui/features/trends/abstractions/TrendsGateway.ts` (add teamId to trend methods)
- Modify: `src/ui/features/trends/TrendsGateway.ts` (thread teamId)
- Modify: `src/ui/presentation/trends/TrendsPage/TrendsPresenter.ts` (inject TeamFilterService)
- Modify: `src/ui/presentation/trends/TrendsPage/feature.ts` (add dep)
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx` (add dispose cleanup)
- Modify: `src/ui/presentation/licenses/LicensesList/components/LicensesPage.tsx` (add dispose cleanup)
- Modify: `src/ui/presentation/packages/PackageList/components/PackagesPage.tsx` (add dispose cleanup)
- Modify: `src/ui/presentation/trends/TrendsPage/components/TrendsPage.tsx` (add dispose cleanup)

**Interfaces:**

- Consumes: `TeamFilterService.Interface` (Task 3)
- Produces: All page presenters react to global team filter changes

- [ ] **Step 1: Pattern for each presenter**

For each presenter, apply this pattern:

1. Add `TeamFilterService` import and constructor parameter
2. Add `TeamFilterService` to `createImplementation` dependencies array
3. In `load()` method or filter building, read `this.teamFilterService.selectedTeamId` and pass as `teamId` to gateway calls
4. Add a MobX `reaction` in constructor that re-loads data when `selectedTeamId` changes. **Store the disposer** and expose a `dispose()` method so the provider/component can clean up on unmount (prevents orphaned reactions firing on destroyed presenter instances):

```typescript
private readonly disposeTeamReaction: () => void;

// In constructor:
this.disposeTeamReaction = reaction(
    () => this.teamFilterService.selectedTeamId,
    () => { void this.load(); }
);

// Add dispose method:
public dispose = (): void => {
    this.disposeTeamReaction();
};
```

The Provider component or page `useEffect` cleanup calls `presenter.dispose()` on unmount.

5. Add `TeamFilterFeature` to the presentation feature's dependencies array

- [ ] **Step 2: Apply to DashboardPresenter**

Read `selectedTeamId`, pass to `LoadDashboardUseCase` (the use case needs to accept `teamId` and thread it through gateway calls). Alternatively, pass `teamId` to each gateway method individually.

Simpler approach: the gateway methods already accept query params. Update `LoadDashboardUseCase.execute()` to accept an optional `teamId` parameter and pass it through to each gateway call. Then the presenter calls `this.loadDashboardUseCase.execute(trendRange, this.teamFilterService.selectedTeamId)`.

- [ ] **Step 3: Apply to VulnerabilitiesPresenter**

Add `teamId` to the filters object built by `currentFilters()`. The gateway already passes filters as query params.

- [ ] **Step 4: Apply to LicensesPresenter**

Similar pattern — add `teamId` to the load call. The `LoadLicensesUseCase` or direct gateway call needs to pass `teamId` as a query param.

- [ ] **Step 5: Apply to PackagesPresenter**

Has existing `projectId` filter. Add `teamId` alongside it.

- [ ] **Step 6: Apply to TrendsPresenter**

Pass `teamId` to `LoadTrendsUseCase` and `LoadDependencyChangesUseCase`.

- [ ] **Step 7: Update all related feature.ts files**

Each presentation feature needs `TeamFilterFeature` in its dependencies array.

- [ ] **Step 8: Run build and full test suite**

Run: `yarn build && yarn test`
Expected: PASS — existing tests pass because TeamFilterService is registered with `selectedTeamId: null` by default (no filter = existing behavior)

- [ ] **Step 9: Commit**

```bash
git add src/ui/presentation/dashboard/ src/ui/presentation/vulnerabilities/ src/ui/presentation/licenses/ src/ui/presentation/packages/ src/ui/presentation/trends/
git commit -m "feat(teams): integrate global team filter into all page presenters"
```
