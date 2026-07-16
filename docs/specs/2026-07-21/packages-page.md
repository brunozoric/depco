# Packages Page

Global cross-project packages browser at `/packages`. Lists all unique packages from scan results across all projects with filtering, search, and changelog access.

## API

### Route Definition

```
GET /api/packages?search=X&upgradeType=X&projectId=X&hasChangelog=true
```

All query params optional. `search` is case-insensitive substring match on package name. `upgradeType` is one of `patch`, `minor`, `major` — returns packages where ANY project has that upgrade type (union semantics). `hasChangelog` is `"true"` — filters to packages that have at least one changelog row. `projectId` filters to packages found in that project's scan results.

### Response Types

```typescript
interface IPackageProject {
  projectId: string;
  projectName: string;
  currentVersion: string;
  latestVersion: string;
  upgradeType: string;
}

interface IPackageListItem {
  name: string;
  projects: IPackageProject[];
  changelogCount: number;
}
```

Response shape: `{ items: IPackageListItem[], total: number }`.

### Query Logic

SQL aggregation using SQLite `json_group_array` / `json_object`:

1. Select from `scanResults` joined with `projects` (for project name), applying filters: `search` via `LIKE` on `scanResults.name`, `upgradeType` via `WHERE` on `scanResults.upgradeType`, `projectId` via `WHERE` on `scanResults.projectId`
2. Left-join subquery on `changelogs` grouped by `packageName` with `COUNT(*)` for changelog count
3. Group by `scanResults.name`, aggregate per-project data using `json_group_array(json_object('projectId', ..., 'projectName', ..., 'currentVersion', ..., 'latestVersion', ..., 'upgradeType', ...))`
4. If `hasChangelog` filter active, add `HAVING changelogCount > 0`
5. Order by `scanResults.name ASC`
6. Parse `projects` JSON string back to array in route handler

Route defined in `src/shared/routes/packages.ts`. Handler in `src/api/routes/packages.ts`. Export added to `src/shared/routes/index.ts`.

### Error Handling

Invalid `upgradeType` values return 400. Missing/empty results return empty array (not an error). Standard `sendError`/`sendList` pattern.

## UI

### Navigation

Add "Packages" nav link to `App.tsx` header alongside Jobs and Settings. Route: `/packages`.

### PackagesPage

Top-level page component, observer-wrapped.

**Controls:**

- `TextInput` for search (debounced via presenter, 300ms)
- `SegmentedControl` for upgrade type filter: All / Patch / Minor / Major
- `Select` for project filter (populated from projects list via `LoadProjectsUseCase`)
- `Switch` for "Has changelog" filter

**Table columns:**

- Name — package name, clickable (opens changelog modal)
- Projects — list of project names as comma-separated `Anchor` links (navigate to `/projects/:id`)
- Versions — shows version range per project (e.g. "1.0.0 -> 2.0.0"), or single version if same across projects
- Upgrade Type — badge (patch/minor/major), shows highest across projects
- Changelog — button to open `ChangelogModal` (reuse from ProjectDetail)

**Error handling:** `vm.error` field for API failures, displayed as `Alert` component.

### MVP Layers

Following existing patterns (ProjectList, JobManager). Three separate features matching the codebase convention:

**Feature 1: `src/ui/features/packages/feature.ts`** — registers gateway + repository

**PackagesGateway** (abstraction + impl):

- `list(filters?)` — calls `GET /api/packages` with query params
- `getChangelogs(packageName, from, to)` — calls `GET /api/changelogs/:packageName` (reuses `getChangelogsRoute` from shared routes)
- Dependencies: `[HTTPClient]`

**PackagesRepository** (abstraction + impl):

- `getPackages()` / `setPackages()` — holds in-memory state
- Dependencies: none

**Feature 2: `src/ui/presentation/packages/useCases/feature.ts`** — registers use cases

**LoadPackagesUseCase** (abstraction + impl):

- Calls gateway with filters, stores in repository
- Dependencies: `[PackagesGateway, PackagesRepository]`

**Feature 3: `src/ui/presentation/packages/PackageList/feature.ts`** — registers presenter

**PackagesPresenter** (abstraction + impl):

- MobX `makeAutoObservable`, computed `vm` getter
- Filter state: `search`, `upgradeType`, `projectId`, `hasChangelog`
- Public methods: `load()`, `setSearch(value)`, `setUpgradeType(value)`, `setProjectId(value)`, `setHasChangelog(value)`, `getChangelogs(packageName, from, to)`
- `getChangelogs` delegates to `PackagesGateway.getChangelogs()`
- `vm` exposes: `loading`, `error`, `packages`, `search`, `upgradeType`, `projectId`, `hasChangelog`, `projects` (for filter dropdown)
- Dependencies: `[LoadPackagesUseCase, LoadProjectsUseCase, PackagesRepository, ProjectsRepository, PackagesGateway]`

**PackagesProvider**:

- Render prop pattern, resolves presenter from DI container (same as ProjectListProvider, JobManagerProvider)

### ChangelogModal Reuse

The existing `ChangelogModal` from `ProjectDetail/components/` is reused. It only needs `packageName`, `currentVersion`, `latestVersion`, and a `getChangelogs` callback. The packages page picks the min `currentVersion` and max `latestVersion` across all projects for that package when opening the modal.

## File Structure

```
src/
  api/
    routes/
      packages.ts                  -- GET /api/packages handler
  shared/
    routes/
      packages.ts                  -- route definition
  ui/
    features/
      packages/
        abstractions/
          PackagesGateway.ts       -- IPackagesGateway interface
          PackagesRepository.ts    -- IPackagesRepository interface
        PackagesGateway.ts         -- implementation
        PackagesRepository.ts      -- implementation
        feature.ts                 -- DI registration (gateway + repo)
    presentation/
      packages/
        useCases/
          abstractions/
            LoadPackagesUseCase.ts
          LoadPackagesUseCase.ts
          feature.ts               -- DI registration (use cases)
        PackageList/
          abstractions/
            PackagesPresenter.ts
          PackagesPresenter.ts
          PackagesProvider.tsx
          feature.ts               -- DI registration (presenter)
          components/
            PackagesPage.tsx
```

## Constraints

- Named interfaces only — no inline types
- Follow existing MVP patterns (gateway, repository, use case, presenter, provider)
- Three separate feature files (data, use cases, presentation) — matches ProjectList/JobManager pattern
- Reuse `ChangelogModal` from ProjectDetail — no duplication
- Filters applied server-side via query params (not client-side filtering)
- Package deduplication via JS aggregation of flat SQL rows (not SQL array functions)
- Search debounced in presenter (300ms)
- Default sort: alphabetical by package name
- upgradeType filter uses union semantics (ANY project with that type)
