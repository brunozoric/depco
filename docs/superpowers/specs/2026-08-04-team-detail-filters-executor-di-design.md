# Team Detail, Filters, and Executor DI Conversion

**Date**: 2026-08-04
**Scope**: 4 features — team detail page, team filter on project list, vulnerability transitive/direct filter, job executor DI conversion

## Feature 1: Team Detail Page (`/teams/:id`)

### Overview

Drill-down dashboard for a single team. Reuses existing dashboard infrastructure — `DashboardGateway` already accepts `teamId` on every method, and `DashboardPresenter` already reacts to `TeamFilterService.selectedTeamId` changes.

### Architecture

New route `/teams/:id` renders a `TeamDetailPage` that:

1. Sets `TeamFilterService.selectedTeamId` from route param on mount
2. Restores previous team filter value on unmount
3. Shows team header (name, color swatch, project count)
4. Renders `DashboardPage` content scoped to team's projects

### Layer Breakdown

- **TeamDetailPresenter** (abstraction + implementation) — loads team detail via `TeamsGateway.getDetail()`, manages team filter lifecycle, delegates dashboard loading to `DashboardPresenter`
- **TeamDetailProvider** — creates scoped container, resolves presenter
- **TeamDetailPage** — team header + wraps `DashboardProvider` > `DashboardPage` as child. The existing `DashboardPresenter` picks up the team ID from `TeamFilterService` automatically.

### Data Flow

1. Route match extracts team ID
2. `TeamDetailPresenter.load(teamId)` calls `TeamsGateway.getDetail(id)` for header data
3. Presenter sets `TeamFilterService.selectedTeamId = teamId`
4. `DashboardPresenter` reacts via existing MobX reaction, reloads all dashboard data with team scope
5. On unmount, presenter restores previous `selectedTeamId`

### Files

| Action | Path                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------ |
| Create | `src/ui/presentation/teams/TeamDetail/abstractions/TeamDetailPresenter.ts`                       |
| Create | `src/ui/presentation/teams/TeamDetail/TeamDetailPresenter.ts`                                    |
| Create | `src/ui/presentation/teams/TeamDetail/TeamDetailProvider.tsx`                                    |
| Create | `src/ui/presentation/teams/TeamDetail/components/TeamDetailPage.tsx`                             |
| Create | `src/ui/presentation/teams/TeamDetail/feature.ts`                                                |
| Modify | `src/ui/App.tsx` — add route pattern `/teams/:id`, add feature, add route match                  |
| Modify | `src/ui/presentation/teams/TeamsPage/components/TeamsPage.tsx` — team name links to `/teams/:id` |

### Tests

- TeamDetailPresenter: sets/restores team filter, loads team detail, delegates dashboard
- Integration: route renders dashboard scoped to team

---

## Feature 2: Team Filter on Project List

### Overview

Project list filters by selected team from global `TeamFilterSelect` in header. Client-side filtering since all projects are already loaded with team data.

### Architecture

Add `TeamFilterService` as dependency to `ProjectListPresenter`. In the `vm` getter, filter `projectsRepository.getProjects()` by `selectedTeamId` when set. Add MobX reaction to re-render when team selection changes.

### Changes

| Action | Path                                                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Modify | `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts` — add TeamFilterService dependency, filter in vm getter, add reaction |

### Behavior

- Team selected in header: project list shows only projects with that team in their `teams` array
- "All Teams" (cleared): shows all projects
- Reaction triggers re-render automatically via MobX

### Tests

- ProjectListPresenter: filters projects by selected team, shows all when no team selected

---

## Feature 3: Vulnerability Transitive/Direct Filter

### Overview

Add `dependencyType` filter (All/Direct/Transitive) to vulnerability list. Client-side filtering since `isTransitive` is derived at API response time, not stored in DB.

### Architecture

Add filter state to presenter, Select dropdown to UI. Filter applied in presenter's computed VM before returning items.

### Changes

| Action | Path                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modify | `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts` — add `dependencyType` to `IVulnerabilityListFilters`                                            |
| Modify | `src/ui/presentation/vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts` — add `dependencyType` to VM, `setDependencyType` to presenter interface |
| Modify | `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts` — add filter state, setter, apply in computed VM                                      |
| Modify | `src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx` — add Select dropdown                                                          |

### Filter Type

```typescript
type DependencyTypeFilter = "all" | "direct" | "transitive";
```

### Filter Logic (in presenter)

- `"all"` — no filtering (default)
- `"direct"` — exclude items where `isTransitive === true`
- `"transitive"` — include only items where `isTransitive === true`

### Tests

- VulnerabilitiesPresenter: filters by dependency type correctly for each option

---

## Feature 4: Convert Remaining Job Executors to DI

### Overview

Convert 7 remaining job executors from plain classes (manually `new`-ed in JobExecutorRegistry) to DI pattern using `createAbstraction`/`createImplementation`, matching the ChangelogJobExecutor reference.

### Executors to Convert

| Executor                    | Dependencies                                                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DependencyJobExecutor`     | UpgradeService                                                                                                                                                                                                                         |
| `TransientJobExecutor`      | UpgradeService                                                                                                                                                                                                                         |
| `PackageManagerJobExecutor` | PackageManagerService                                                                                                                                                                                                                  |
| `InstallJobExecutor`        | PackageManagerDriverRegistry, CommandRunner, WebSocketBroadcaster, FileConfigService                                                                                                                                                   |
| `CloneJobExecutor`          | CommandRunner, PackageManagerService, SecurityService, DatabaseClient                                                                                                                                                                  |
| `AutoFixPrJobExecutor`      | AutoFixPrService, GitService, ForgeService, UpgradeService, DatabaseClient, WebSocketBroadcaster                                                                                                                                       |
| `ScanJobExecutor`           | ScanService, SecurityService, PackageManagerService, DatabaseClient, WebSocketBroadcaster, ErrorReporter, EventBus, VulnerabilityService, DependencyGraphService, DependencyChangeService, LicenseCheckerService, LicensePolicyService |

### Per-Executor Pattern

1. **Create abstraction**: `src/api/services/jobExecutors/abstractions/XxxJobExecutor.ts`
   ```typescript
   export const XxxJobExecutor = createAbstraction<IJobExecutor>("Api/XxxJobExecutor");
   export namespace XxxJobExecutor {
     export type Interface = IJobExecutor;
   }
   ```
2. **Rename class** to `XxxJobExecutorImpl`, add `createImplementation` export
3. **Register** in `src/api/feature.ts`
4. **Update imports** — registry imports from abstractions

### JobExecutorRegistry After Conversion

Constructor receives 8 executor abstractions instead of 19 individual services. Dependencies array becomes:

```typescript
dependencies: [
  DependencyJobExecutor,
  TransientJobExecutor,
  PackageManagerJobExecutor,
  ScanJobExecutor,
  CloneJobExecutor,
  InstallJobExecutor,
  ChangelogJobExecutor,
  AutoFixPrJobExecutor
];
```

### Files Per Executor

| Action | Path                                                                                         |
| ------ | -------------------------------------------------------------------------------------------- |
| Create | `src/api/services/jobExecutors/abstractions/XxxJobExecutor.ts`                               |
| Modify | `src/api/services/jobExecutors/XxxJobExecutor.ts` — rename to Impl, add createImplementation |
| Modify | `src/api/feature.ts` — register abstraction                                                  |

### Shared Files

| Action | Path                                                                                       |
| ------ | ------------------------------------------------------------------------------------------ |
| Modify | `src/api/services/jobExecutors/JobExecutorRegistry.ts` — receive executors as abstractions |
| Modify | `src/api/feature.ts` — register all 7 new abstractions                                     |

### Tests

- Existing executor tests should continue passing (implementation unchanged, only wiring changes)
- JobExecutorRegistry tests may need DI setup updates

---

## Implementation Order

1. **Feature 4** (executor DI) — pure backend, no UI dependencies, mechanical conversion
2. **Feature 3** (vulnerability filter) — isolated UI change, small scope
3. **Feature 2** (project list team filter) — small change, depends on existing TeamFilterService
4. **Feature 1** (team detail page) — largest scope, builds on team filter infrastructure
