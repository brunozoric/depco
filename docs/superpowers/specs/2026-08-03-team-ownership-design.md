# Team Ownership & Mapping — Design Spec

## Overview

Add team ownership to the dependency manager. Teams own projects (many-to-many), enabling accountability ("who owns this?") and filtering ("show me only my team's problems"). A global team filter in the header scopes all pages. A dedicated `/teams` page provides team CRUD with aggregate stats.

## Data Model

### New Table: `teams`

```
teams
  id        TEXT PRIMARY KEY
  name      TEXT NOT NULL UNIQUE
  color     TEXT NOT NULL (hex, e.g. "#4c6ef5")
  createdAt INTEGER NOT NULL
```

### New Table: `team_projects` (join table)

```
team_projects
  id        TEXT PRIMARY KEY
  teamId    TEXT NOT NULL FK(teams.id, CASCADE)
  projectId TEXT NOT NULL FK(projects.id, CASCADE)
  UNIQUE(teamId, projectId)
```

Many-to-many: a project can belong to multiple teams, a team can own multiple projects. Cascading deletes — deleting a team removes its `team_projects` rows; deleting a project removes its `team_projects` rows.

No changes to the `projects` table itself.

## API Endpoints

### Teams CRUD

New file: `src/api/routes/teams.ts`, definitions in `src/shared/routes/teams.ts`.

**`GET /api/teams`** — list all teams with aggregate stats.

```typescript
interface ITeamWithStats {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  projectCount: number;
  vulnerabilityCount: number;
  compliancePercent: number;
  averageHealthScore: number;
}
```

Stats computed via joins: project count from `team_projects`, vulnerability count from `vulnerabilities` (active, not dismissed) joined through `team_projects.projectId`, compliance percent from `license_snapshots` (latest per project, averaged across team's projects), average health score from `health_snapshots` (latest per project). When a team has no projects, all stats are zero.

Response wrapped in `sendList`.

**`POST /api/teams`** — create team `{ name: string; color: string }`. Returns created team via `sendOne`. 409 if name already exists.

**`PUT /api/teams/:id`** — update team `{ name?: string; color?: string }`. Merges partial body over existing row. 404 if not found. Returns updated team via `sendOne`.

**`DELETE /api/teams/:id`** — delete team. Cascades to `team_projects`. Returns `sendNone`. Always succeeds (idempotent).

**`GET /api/teams/:id`** — get team with its projects list.

```typescript
interface ITeamProjectSummary {
  id: string;
  name: string;
  path: string;
}

interface ITeamDetail {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  projects: ITeamProjectSummary[];
}
```

Response via `sendOne`. 404 if not found.

### Project Team Assignment

Added to existing `src/api/routes/projects.ts`.

**`PUT /api/projects/:id/teams`** — set team assignments `{ teamIds: string[] }`. Deduplicates input array before processing. Replaces all `team_projects` rows for this project (delete existing + insert new, in a transaction). Empty array unassigns all teams. 404 if project not found. Returns `sendNone`.

**`GET /api/projects/:id/teams`** — get teams for a project. Returns `sendList` with team objects.

### Team Filtering on Existing Endpoints

Add optional `teamId` query param to these endpoints:

- `GET /api/dashboard/health`
- `GET /api/dashboard/staleness-trend`
- `GET /api/dashboard/license-trend`
- `GET /api/dashboard/auto-fix-trend`
- `GET /api/dashboard/dependency-changes`
- `GET /api/dashboard/vulnerability-trend`
- `GET /api/vulnerabilities`
- `GET /api/licenses`
- `GET /api/packages`

Server-side: when `teamId` present, add `WHERE projects.id IN (SELECT project_id FROM team_projects WHERE team_id = :teamId)` subquery. Existing `projectId` filters still work independently — `teamId` is an additional, orthogonal filter.

For dashboard endpoints that aggregate across all projects (health, trends), the `teamId` filter scopes the aggregation to only that team's projects.

## UI Layer

### A. TeamFilterService (MobX + localStorage)

New DI-wired MobX observable class. Persists selected team to localStorage via `@webiny/stdlib` `Cache` abstraction (`LocalStorageCacheFeature`).

```typescript
interface ITeamFilterService {
  get selectedTeamId(): string | null;
  setSelectedTeamId(teamId: string | null): void;
}
```

Implementation:

- Constructor reads `Cache.get<string>("team-filter:selectedTeamId")` to restore previous selection
- `setSelectedTeamId` updates MobX observable + calls `Cache.set("team-filter:selectedTeamId", teamId)` (or `Cache.delete("team-filter:selectedTeamId")` when null)
- MobX `makeAutoObservable` — all presenters that inject it react to changes automatically
- Cache key prefixed with `team-filter:` to avoid collisions with other localStorage users

Registered as singleton in `TeamFilterFeature`. `LocalStorageCacheFeature` registered as a dependency.

### B. Global Team Filter (Header Dropdown)

Add a `Select` component to `AppShell.Header` in `App.tsx`:

- Options: all teams (fetched once on app mount) + "All Teams" clear option
- Each option shows team color dot + name
- Bound to `TeamFilterService.selectedTeamId`
- Changing selection triggers MobX reactions in all active presenters

Teams list for the header dropdown fetched via a lightweight `GET /api/teams` call (no stats needed — just id/name/color). Stored in a `TeamListRepository` (separate from the `/teams` page's full stats repository).

New `TeamListService` — DI-wired, provides `loadTeams()` + `getTeams()`. Used by both the header dropdown and any presenter needing a team list. Singleton.

### C. `/teams` Page — Full MVP Stack

New route `/teams` in navigation.

**Gateway** (`src/ui/features/teams/`):

```typescript
interface ITeamListResponse {
  items: ITeamWithStats[];
  total: number;
}

interface IProjectTeamsResponse {
  items: ITeamItem[];
  total: number;
}

interface ITeamsGateway {
  list(): Promise<ITeamListResponse>;
  getDetail(teamId: string): Promise<ITeamDetail>;
  create(input: ICreateTeamInput): Promise<ITeamWithStats>;
  update(id: string, input: IUpdateTeamInput): Promise<ITeamWithStats>;
  remove(id: string): Promise<void>;
  getProjectTeams(projectId: string): Promise<IProjectTeamsResponse>;
  setProjectTeams(projectId: string, teamIds: string[]): Promise<void>;
}

interface ICreateTeamInput {
  name: string;
  color: string;
}

interface IUpdateTeamInput {
  name?: string;
  color?: string;
}

interface ITeamItem {
  id: string;
  name: string;
  color: string;
}
```

**Repository** (`src/ui/features/teams/`):

```typescript
interface ITeamsRepository {
  getTeams(): ITeamWithStats[];
  setTeams(teams: ITeamWithStats[]): void;
}
```

**UseCase:**

- `LoadTeamsUseCase` — fetches team list, stores in repository
- `ManageTeamUseCase` — create/update/delete team, reloads list after mutation

**Presenter:**

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

Methods: `load()`, `openCreateModal()`, `openEditModal(team)`, `closeModal()`, `saveTeam(input)`, `confirmDelete(id)`, `cancelDelete()`, `deleteTeam()`.

**React (`TeamsPage.tsx`):**

- Team table with columns: color dot, name, project count, vulnerability count, compliance %, avg health score, actions (edit/delete)
- Create/Edit modal with name TextInput + ColorInput (Mantine)
- Delete via ConfirmDialog

### D. Project Detail — Team Assignment

Add to existing `ProjectDetailPresenter`:

- `projectTeams: ITeamItem[]` in VM
- `availableTeams: ITeamItem[]` in VM (from `TeamListService`)
- `setProjectTeams(teamIds: string[]): Promise<void>` method

React: `MultiSelect` on `ProjectDetailPage` showing team options with color dots. Change triggers `setProjectTeams`.

### E. Existing Presenters — Team Filter Integration

These presenters inject `TeamFilterService` and pass `selectedTeamId` as `teamId` query param to their gateway calls:

- `DashboardPresenter` — passes `teamId` to `LoadDashboardUseCase`
- `VulnerabilitiesPresenter` — adds `teamId` to filters
- `LicensesPresenter` — adds `teamId` to filters
- `PackagesPresenter` — adds `teamId` to filters (check if it already has projectId filter pattern)
- `TrendsPresenter` — passes `teamId` to `LoadTrendsUseCase`

Each presenter sets up a MobX `reaction` on `teamFilterService.selectedTeamId` that triggers a re-load when the team changes.

## Testing

### API Tests

- **Teams CRUD**: create, list with stats (seed projects + vulnerabilities + license_snapshots + health_snapshots), update, delete (verify cascade), 409 on duplicate name, 404 on missing
- **Project team assignment**: assign teams, get project teams, replace teams, empty array unassigns
- **Team filtering**: seed 2 teams with different projects, verify `teamId` filter on dashboard/vulnerabilities/licenses endpoints returns correct subset

### UI Tests

- **TeamFilterService**: mock Cache, verify observable updates, localStorage persistence, restore on construction, null clears
- **TeamsPresenter**: mock HTTPClient, verify CRUD operations, loading states, modal state management
- **Existing presenters NOT modified** — TeamFilterService mocked with `selectedTeamId: null` (default = no filter = existing behavior unchanged)

## File Structure

```
src/
  api/
    db/schema.ts                     — add teams + teamProjects tables
    routes/
      teams.ts                       — teams CRUD routes
      projects.ts                    — add team assignment endpoints
      dashboard.ts                   — add teamId filter to existing endpoints
      vulnerabilities.ts             — add teamId filter
      licenses.ts                    — add teamId filter
      packages.ts                    — add teamId filter
      __tests__/teams.test.ts
    routes/index.ts                  — add teamsRoutes export
    server.ts                        — register teamsRoutes
  shared/
    routes/teams.ts                  — route definitions
    routes/index.ts                  — export teams routes
    routes/dashboard.ts              — add teamId to existing route querystrings
    routes/vulnerabilities.ts        — add teamId to querystring
    routes/licenses.ts               — add teamId to querystring
    routes/packages.ts               — add teamId to querystring
  ui/
    features/
      teams/
        abstractions/TeamsGateway.ts
        abstractions/TeamsRepository.ts
        TeamsGateway.ts
        TeamsRepository.ts
        feature.ts
      teamFilter/
        abstractions/TeamFilterService.ts
        abstractions/TeamListService.ts
        TeamFilterService.ts
        TeamListService.ts
        feature.ts
    presentation/
      teams/
        TeamsPage/
          abstractions/TeamsPresenter.ts
          TeamsPresenter.ts
          TeamsProvider.tsx
          components/TeamsPage.tsx
          feature.ts
        useCases/
          abstractions/LoadTeamsUseCase.ts
          abstractions/ManageTeamUseCase.ts
          LoadTeamsUseCase.ts
          ManageTeamUseCase.ts
          feature.ts
        __tests__/TeamsPresenter.test.ts
      projects/
        ProjectDetail/
          ProjectDetailPresenter.ts  — add team assignment
          abstractions/ProjectDetailPresenter.ts — add teams to VM
          components/ProjectDetailPage.tsx — add MultiSelect
          feature.ts — add TeamsFeature + TeamFilterFeature deps
      dashboard/
        Dashboard/DashboardPresenter.ts — inject TeamFilterService, pass teamId
      vulnerabilities/
        VulnerabilityList/VulnerabilitiesPresenter.ts — inject TeamFilterService
      licenses/
        LicensesList/LicensesPresenter.ts — inject TeamFilterService
      trends/
        TrendsPage/TrendsPresenter.ts — inject TeamFilterService
    App.tsx                           — add /teams route, nav link, features, header team Select
  testing/
    helpers/createTestDb.ts           — add new tables
```
