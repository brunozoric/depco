# Team Detail Tests, Vulnerability Export Filter, Project Search

**Date**: 2026-08-04
**Scope**: 3 features — team detail presenter tests, server-side dependencyType filter for vulnerability export, project list search bar

## Feature 1: Team Detail Presenter Tests

### Overview

Unit tests for `TeamDetailPresenter` covering load/dispose/filter lifecycle.

### Test File

`src/ui/presentation/teams/TeamDetail/__tests__/TeamDetailPresenter.test.ts`

### Test Cases

1. `load(teamId)` calls `TeamsGateway.getDetail(teamId)` and populates vm (`teamName`, `teamColor`, `projectCount`)
2. `load(teamId)` sets `TeamFilterService.selectedTeamId` to the given team ID
3. `load(teamId)` saves previous `selectedTeamId` before overwriting
4. `dispose()` restores previous `selectedTeamId`
5. `load(teamId)` handles gateway error — sets `vm.error`
6. `dashboardPresenter` getter returns `DashboardPresenter` instance
7. `vm.loading` is true during load, false after

### Setup

Mock `TeamsGateway`, `TeamFilterService`, and `DashboardPresenter` via DI container. Follow same pattern as `VulnerabilitiesPresenter.test.ts`.

---

## Feature 2: Vulnerability Export Server-Side dependencyType Filter

### Overview

Move `dependencyType` filtering from client-side ID pass-through to proper server-side filtering. The API already derives `isTransitive` at response time — add a post-enrichment filter step so both list and export endpoints support `dependencyType` natively.

### Changes

| Action | Path                                                                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modify | `src/shared/routes/vulnerabilities.ts` — add `dependencyType` query param to `listVulnerabilitiesRoute` and `exportVulnerabilitiesRoute` schemas                                                                         |
| Modify | `src/api/routes/vulnerabilities.ts` — `buildFilters` passes `dependencyType` through; after `enrichWithProjectNames` computes `isTransitive`, apply post-enrichment filter to remove non-matching items                  |
| Modify | `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts` — re-add `dependencyType` to `IVulnerabilityListFilters`                                                                                        |
| Modify | `src/ui/features/vulnerabilities/VulnerabilitiesGateway.ts` — `buildListQuery` and `getExportUrl` include `dependencyType` param when not `"all"`                                                                        |
| Modify | `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts` — add `dependencyType` to `currentFilters()`, remove `getFilteredIdsByDependencyType()` helper, simplify `exportAll` to not pass IDs |

### Filter Logic (server-side, in API route)

After `enrichWithProjectNames` computes `isTransitive` for each item:

- `"all"` or absent — no filtering (default)
- `"direct"` — exclude items where `isTransitive === true`
- `"transitive"` — include only items where `isTransitive === true`

### No DB Changes

Filtering happens at API layer after enrichment, not in SQL query.

---

## Feature 3: Project List Search Bar

### Overview

Client-side debounced text search on project list page. Matches against project name, path, and package manager. Follows vulnerability page TextInput pattern.

### Changes

| Action | Path                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modify | `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts` — add `searchQuery: string` to `IProjectListViewModel`, add `setSearchQuery(value: string): void` to `IProjectListPresenter` |
| Modify | `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts` — add `searchQuery` state, setter, case-insensitive filter in `vm` getter after team filter                                               |
| Modify | `src/ui/presentation/projects/ProjectList/components/ProjectListPage.tsx` — add `TextInput` with placeholder "Search projects..." between title bar and table                                                |

### Filter Logic (client-side, in presenter vm getter)

After team filter, apply search filter:

- Case-insensitive match against `project.name`, `project.path`, `project.packageManager`
- Any field containing the search string qualifies the project
- Empty search shows all projects (no filtering)
- No debounce needed — pure client-side computed property, no API call

### No API Changes

All filtering is client-side on already-loaded data.

---

## Implementation Order

1. **Feature 1** (team detail tests) — pure test addition, no code changes
2. **Feature 2** (export filter) — API + UI changes, but isolated to vulnerability system
3. **Feature 3** (project search) — isolated UI change
