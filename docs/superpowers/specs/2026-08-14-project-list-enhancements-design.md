# Project List Enhancements — Sorting, Filtering, Rename, Page Size

## Overview

Four enhancements to the project list: API-side sorting with sortable column headers, multi-select engine status filtering, editable project names, and a page size selector dropdown. All filtering and sorting is API-side via query params for shareable URLs.

**Implementation sequencing:** Database migration (Feature 2 columns) must land first, then `ListProjectsUseCase` changes (sort + filter), then engine scan executor update, then UI.

## Feature 1: API-Side Sorting

### Route Changes

Add `sortBy` and `sortOrder` to `listProjectsRoute` querystring:

```typescript
sortBy: z.enum(["name", "addedAt", "lastScannedAt", "engineStatus"]).optional(),
sortOrder: z.enum(["asc", "desc"]).optional()
```

Default: `sortBy: "name"`, `sortOrder: "asc"`.

### Engine Status Sort

Engine status must be sortable at the API level. This requires denormalizing `engineStatus` and `rootEnginesNode` into the `projects` table (see Feature 2 — they share the same migration).

Sort priority for engine status (ascending = worst first):

- `eol` = 0
- `maintenance` = 1
- `unknown` = 2
- `active-lts` = 3
- `current` = 4

Drizzle syntax for CASE-based sort:

```typescript
const engineStatusOrder = sql`CASE ${projects.engineStatus}
    WHEN 'eol' THEN 0
    WHEN 'maintenance' THEN 1
    WHEN 'unknown' THEN 2
    WHEN 'active-lts' THEN 3
    WHEN 'current' THEN 4
    ELSE 5
END`;
```

### Use Case Changes

`ListProjectsUseCase.execute` adds `.orderBy()` to the drizzle query based on `params.sortBy` and `params.sortOrder`.

For `lastScannedAt`, null values sort last using a two-expression orderBy:

```typescript
sql`CASE WHEN ${projects.lastScannedAt} IS NULL THEN 1 ELSE 0 END`;
```

followed by the actual column in the requested direction.

For `engineStatus`, nulls (never scanned) also sort last via the CASE expression (ELSE 5).

### UI — Column Headers

Each sortable column header (`Name`, `Added`, `Last Scanned`, `Engine Status`) becomes clickable with a sort indicator icon (arrow up, arrow down, or neutral dash).

Three-state cycle per column:

1. Click unsorted column: sort ascending
2. Click ascending column: sort descending
3. Click descending column: remove sort (back to default: name asc)

State persisted via `urlFilterService` with `sortBy` and `sortOrder` params in `FILTER_SCHEMA`.

### `addedAt` Column

`addedAt` is sortable but not currently shown in the table. Add a new "Added" column between "Last Scanned" and the actions column. Display as relative time ("3 days ago", "2 weeks ago").

### Abstraction Changes

`IListProjectsUseCaseParams` gets:

```typescript
sortBy?: "name" | "addedAt" | "lastScannedAt" | "engineStatus";
sortOrder?: "asc" | "desc";
```

## Feature 2: Engine Status Filter + Denormalization

### Database Migration

Generate via `drizzle-kit generate`. Add two columns to `projects` table:

```typescript
engineStatus: text("engine_status"),       // "eol" | "maintenance" | "active-lts" | "current" | "unknown" | null
rootEnginesNode: text("root_engines_node") // e.g. ">=18" | null
```

Both nullable — null means "never scanned".

### Updating Engine Status on Projects

After each engine scan completes in `EngineScanJobExecutor.execute` (`src/api/services/JobExecution/executors/EngineScanJobExecutor.ts`), update the project row. Concrete hook point: after `this.engineService.scan()` returns `result`, before the WebSocket broadcast:

```typescript
// In EngineScanJobExecutor.execute, after line 24 (const result = await this.engineService.scan(...))
await this.databaseClient.db
  .update(projects)
  .set({
    engineStatus: result.rootStatus,
    rootEnginesNode: result.rootEnginesNode
  })
  .where(eq(projects.id, projectId))
  .run();
```

This requires adding `DatabaseClient` as a dependency of `EngineScanJobExecutor`.

### Backfill

On server boot or migration, backfill existing projects from engine scan data (the `nodeReleaseData` / engine check results tables). If no scan data exists for a project, columns stay null.

### Route Changes

Add `engineStatus` to `listProjectsRoute` querystring:

```typescript
engineStatus: z.string().optional(); // comma-separated: "eol,maintenance"
```

Comma-separated to support multi-select. Parse in use case: `params.engineStatus?.split(",")`.

### Use Case Changes

`ListProjectsUseCase` adds a `WHERE engine_status IN (...)` condition when `engineStatus` param is present. Uses drizzle `inArray(projects.engineStatus, statuses)`.

`IListProjectsUseCaseParams` gets:

```typescript
engineStatus?: string; // comma-separated, parsed in use case
```

### UI — Filter Bar

Add a `MultiSelect` (Mantine) component in a filter bar above the project table. Options:

- EOL
- Maintenance
- Active LTS
- Current
- Unknown

Selected values joined with comma, written to URL via `urlFilterService`.

Filter bar layout (horizontal): `[Search input] [Engine Status MultiSelect] [Page Size Select]`

### Presenter Changes

- Remove the in-memory `engineInfoByProjectId` mapping — engine status and `rootEnginesNode` now come from the project record returned by `ListProjectsUseCase`
- `IProjectListItem.engineStatus` and `engineVersion` populated directly from project data
- `FILTER_SCHEMA` updated to include `engineStatus`, `sortBy`, and `sortOrder`
- `ListProjectsUseCase` response must include `engineStatus` and `rootEnginesNode` fields on each item (add to `IProjectListItem` in use case abstraction and to the response schema)

### Response Schema Update

`listProjectsResponseSchema` in `src/shared/responses/projects.ts` needs `engineStatus` and `rootEnginesNode` fields on each project item. The gateway's `toProject` mapper and `IProject` interface also need these fields.

## Feature 3: Editable Project Name

### Route

New route in `src/shared/routes/projects.ts`:

```typescript
export const updateProjectRoute = defineRoute({
  method: "PATCH",
  path: "/api/projects/:id",
  description: "Update a project",
  params: z.object({ id: z.string() }),
  body: z.object({ name: z.string().trim().min(1).max(100) }),
  response: updateProjectResponseSchema
});
```

### Response Schema

Add to `src/shared/responses/projects.ts`:

```typescript
export const updateProjectResponseSchema = z.object({
  item: projectItemSchema // reuse existing project item schema shape
});
```

### Use Case

`UpdateProjectUseCase`:

1. Trim the name
2. Check uniqueness — query `projects` where `name = trimmedName AND id != params.id`
3. If duplicate, return error `{ code: "NAME_ALREADY_EXISTS", statusCode: 409 }`
4. If project not found, return error `{ code: "NOT_FOUND", statusCode: 404 }`
5. Update the row
6. Return updated project

### Abstraction

File: `src/api/routes/useCases/projects/abstractions/UpdateProjectUseCase.ts`

```typescript
interface IUpdateProjectUseCaseParams {
  id: string; // matches route param name convention (not "projectId")
  name: string;
}

interface IUpdateProjectUseCaseError {
  code: "NOT_FOUND" | "NAME_ALREADY_EXISTS" | "UNEXPECTED_ERROR";
  statusCode: number;
  message: string;
}
```

With standard namespace exports:

```typescript
export namespace UpdateProjectUseCase {
  export type Interface = IUpdateProjectUseCase;
  export type Params = IUpdateProjectUseCaseParams;
  export type Data = IUpdateProjectUseCaseData;
  export type Error = IUpdateProjectUseCaseError;
}
```

### DI Registration

Register in `src/api/routes/useCases/projects/feature.ts`:

```typescript
import { UpdateProjectUseCase } from "./UpdateProjectUseCase.js";
// ...
container.register(UpdateProjectUseCase);
```

### Route Handler Registration

Register PATCH handler in `src/api/routes/projects/projectCrudRoutes.ts` (grouped with other CRUD operations — create, get, list, delete).

### UI — Context Menu (List)

Add "Rename" option to the existing `...` dropdown menu in `ProjectRow`. Opens a small modal with:

- Text input prefilled with current name
- Save + Cancel buttons
- Validation: non-empty, max 100 chars
- Error display for "name already exists" (409 response)

### UI — Project Detail View

On the project detail page, make the project name editable. Click-to-edit: click the name heading, it becomes an input, Enter/blur saves, Escape cancels.

### Gateway

Add `update` method to `ProjectsGateway` (follows existing naming: `list`, `get`, `create`, `remove`, not `listProjects`, `getProject`):

```typescript
// In ProjectsGateway abstraction
update(id: string, params: { name: string }): Promise<Abstraction.Project>;

// Implementation follows same pattern as create():
public async update(id: string, params: { name: string }): Promise<Abstraction.Project> {
    const response = await this.httpClient.request(updateProjectRoute, {
        params: { id },
        body: { name: params.name }
    });
    return toProject(response.item);
}
```

Returns `Project` directly (not `Result<Project, HTTPError>`) — matches existing gateway pattern where HTTP errors propagate as exceptions.

## Feature 4: Page Size Selector

### UI

Add a `Select` (Mantine) dropdown in the filter bar, right side. Options: 10, 25, 50, 100.

Default: 25. `DEFAULT_PAGE_SIZE` is already 25 in `ProjectListPresenter.ts:22` — no change needed.

### State

`pageSize` already exists in `listProjectsRoute` querystring and in the presenter's `FILTER_SCHEMA`. Needs:

1. UI control in filter bar that reads current value from `urlFilterService` and writes on change
2. When pageSize changes, reset page to 1

### Presenter

`pageSize` is already managed via `urlFilterService` — no `setPageSize` method needed. The UI control writes directly through `urlFilterService.update(FILTER_SCHEMA, { pageSize: value, page: null })`, same pattern as `setSearchQuery` and `setPage`. The `FILTER_SCHEMA` already includes `pageSize`.

## File Inventory

### Shared (routes + responses)

- `src/shared/routes/projects.ts` — add `updateProjectRoute`, update `listProjectsRoute` querystring with `sortBy`, `sortOrder`, `engineStatus`
- `src/shared/responses/projects.ts` — add `updateProjectResponseSchema`, add `engineStatus` + `rootEnginesNode` fields to list response item schema

### Database

- New migration via `drizzle-kit generate` — add `engine_status` + `root_engines_node` columns to projects table

### API — Use Cases

- `src/api/routes/useCases/projects/abstractions/ListProjectsUseCase.ts` — add sort/filter params, add `engineStatus` + `rootEnginesNode` to `IProjectListItem`
- `src/api/routes/useCases/projects/ListProjectsUseCase.ts` — implement sort + engine filter
- `src/api/routes/useCases/projects/abstractions/UpdateProjectUseCase.ts` — new abstraction
- `src/api/routes/useCases/projects/UpdateProjectUseCase.ts` — new implementation
- `src/api/routes/useCases/projects/feature.ts` — register `UpdateProjectUseCase`
- `src/api/routes/projects/projectCrudRoutes.ts` — register PATCH handler

### API — Engine Scan

- `src/api/services/JobExecution/executors/EngineScanJobExecutor.ts` — after scan, update `projects.engineStatus` and `projects.rootEnginesNode`. Add `DatabaseClient` dependency.

### UI — Presentation

- `src/ui/presentation/Projects/ProjectList/abstractions/ProjectListPresenter.ts` — add `engineVersion` to view model item (already done), add sort-related types
- `src/ui/presentation/Projects/ProjectList/ProjectListPresenter.ts` — read sort/filter from URL, pass to gateway, remove in-memory engine mapping, update `FILTER_SCHEMA`
- `src/ui/presentation/Projects/ProjectList/components/ProjectRow.tsx` — rename menu item, "Added" column
- `src/ui/presentation/Projects/ProjectList/components/ProjectListPage.tsx` — filter bar with MultiSelect + Select + sortable column headers
- `src/ui/presentation/Projects/ProjectDetail/` — editable project name

### UI — Features (Gateway + Repository)

- `src/ui/features/Projects/abstractions/ProjectsGateway.ts` — add `update` method, add `engineStatus` + `rootEnginesNode` to `IProject`
- `src/ui/features/Projects/ProjectsGateway.ts` — implement `update` method

### Tests

- `ListProjectsUseCase` — sort by name/addedAt/lastScannedAt/engineStatus, filter by engineStatus, null handling
- `UpdateProjectUseCase` — rename success, uniqueness conflict (409), not found (404), trimming, max length
- `ProjectListPresenter` — sort state cycling, filter state, page size from URL
- `EngineScanJobExecutor` — verify projects table gets updated with engineStatus + rootEnginesNode after scan
