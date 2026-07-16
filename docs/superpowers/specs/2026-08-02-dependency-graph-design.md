# Dependency Graph Visualization — Design Spec

## Overview

Dependency graph visualization shows why a package is in the dependency tree and allows interactive exploration of the full package relationship graph. Lockfiles are parsed directly (all 4 PMs) during scan to build a stored edge graph. Two views: tree list for focused "why is X here?" lookups, and React Flow interactive graph for full exploration.

## Decisions

- **Use case**: "Why is X here?" path lookup + full graph exploration, both views
- **Data source**: Parse lockfiles directly (package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lock)
- **Parsing architecture**: Separate `LockfileParserService` facade, drivers delegate to it
- **Graph storage**: Built during scan + lazy refresh without full rescan, stored in `dependency_edges` table
- **Visualization**: Tree list (default for "why") + React Flow graph view (toggle)
- **All 4 lockfile formats** supported from day one

## Database Schema

### `dependency_edges` table

Stores the full dependency graph per project. Rebuilt entirely on each scan or manual refresh.

| Column         | Type                           | Notes                                                                 |
| -------------- | ------------------------------ | --------------------------------------------------------------------- |
| id             | text PK                        |                                                                       |
| projectId      | text FK → projects(id) CASCADE |                                                                       |
| parentPackage  | text nullable                  | Null for root dependencies (direct deps of the project)               |
| parentVersion  | text nullable                  |                                                                       |
| childPackage   | text                           |                                                                       |
| childVersion   | text                           |                                                                       |
| dependencyType | text                           | "dependency", "devDependency", "peerDependency", "optionalDependency" |
| depth          | integer                        | 0 for direct deps, 1+ for transitive                                  |
| scannedAt      | integer                        | epoch ms — all edges share same timestamp per scan                    |

No unique constraint — same child can appear multiple times at different depths via different parents. Index on `(projectId, childPackage)` for fast "why" lookups. Index on `(projectId, parentPackage)` for expanding a node's children.

## Backend Services

### LockfileParserService

Abstraction + implementation following DI pattern. Facade that dispatches to format-specific parsers.

- `parse(projectPath: string, packageManager: string): Promise<DependencyEdge[]>`
- Reads the appropriate lockfile from disk, dispatches to format-specific private method
- Each parser: `parsePackageLock()`, `parseYarnLock()`, `parsePnpmLock()`, `parseBunLock()`
- Returns flat array of edges: `{ parentPackage, parentVersion, childPackage, childVersion, dependencyType, depth }`
- Lockfile detection: npm → `package-lock.json`, yarn → `yarn.lock`, pnpm → `pnpm-lock.yaml`, bun → `bun.lock`
- If lockfile missing → returns empty array, logs warning

**Format-specific parsing:**

- **package-lock.json** (v2/v3): `packages` object. Keys are paths (`node_modules/express`, `node_modules/express/node_modules/qs`). Depth from path segment count minus 1 (each `node_modules` nesting adds depth). Parent inferred from path nesting. Dependencies declared in each entry's `dependencies`/`devDependencies` fields.
- **yarn.lock** (v1): `package@version` entries with `dependencies` maps. Cross-reference with `package.json` to determine root (depth 0) vs transitive. Build adjacency from declared dependencies, walk to assign depth.
- **pnpm-lock.yaml**: `importers` section contains workspace roots with direct deps. `packages` section has resolved transitive deps with `dependencies` maps. Walk from importers outward to build edges with depth.
- **bun.lock** (JSONC since bun 1.2): `packages` object with dependency entries. Parse as JSON (strip comments if needed), extract edges from dependency resolution data.

### DependencyGraphService

Abstraction + implementation. Queries and manages the edge data.

- `getGraph(projectId: string): Promise<DependencyGraph>` — returns all edges plus summary stats
- `findPaths(projectId: string, packageName: string): Promise<DependencyPath[]>` — BFS from root edges (depth=0) to target package. Returns all paths (multiple if package reached via different parents). Tracks visited nodes to guard against cycles.
- `refreshGraph(projectId: string, projectPath: string, packageManager: string): Promise<number>` — calls `LockfileParserService.parse()`, deletes old edges for project, inserts new ones. Returns edge count.
- `DependencyGraph = { edges: DependencyEdge[], rootPackages: string[], totalPackages: number, maxDepth: number, edgeCount: number }`
- `DependencyPath = { target: string, chain: Array<{ packageName: string, version: string }> }`

### ScanJobExecutor integration

After scan results are saved (end of `execute()` in `ScanJobExecutor`), call `dependencyGraphService.refreshGraph(projectId, projectPath, packageManager)`. Wrapped in try/catch — graph build failure should not fail the scan. Same pattern as vulnerability scan integration.

## API Routes

### Dependency graph routes (`src/api/routes/dependencyGraph.ts`)

| Method | Path                                       | Purpose                                                                             |
| ------ | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| GET    | `/api/dependency-graph/:projectId`         | Full graph (all edges). Query: `?package=lodash` returns paths to that package only |
| POST   | `/api/dependency-graph/:projectId/refresh` | Trigger lockfile re-parse without full scan                                         |
| GET    | `/api/dependency-graph/:projectId/stats`   | Summary: total packages, max depth, root count, edge count                          |

Shared route definitions in `src/shared/routes/dependencyGraph.ts` with Zod schemas using `defineRoute()`.

No WebSocket events needed — lockfile parsing is fast (sync file read + parse, no network calls).

## UI Architecture

### New page: `/projects/:projectId/graph`

Linked from project detail page via a "Dependency Graph" button/link.

**DependencyGraphPresenter** — computes view model:

- `graph`: full edge data for React Flow rendering
- `paths`: result of "why" search — array of dependency chains
- `stats`: total packages, max depth, root count
- `searchQuery`: current package search string
- `viewMode`: `"tree"` | `"graph"` (default `"tree"`)
- `selectedPackage`: currently highlighted package in graph view
- `loading`, `error` state

**Actions:**

- `load(projectId)` — fetch full graph + stats
- `search(packageName)` — fetch paths via `?package=` query param
- `setViewMode("tree" | "graph")`
- `refresh()` — trigger lockfile re-parse
- `selectPackage(name)` — highlight in graph view

### Tree view (default)

- Search box at top: type package name, see dependency chains
- Each chain shown as indented list: `project → express@4.18.2 → body-parser@1.20.2 → qs@6.11.0`
- Multiple chains shown if package reached via different paths
- Empty state: "Search for a package to see why it's in your dependency tree"

### Graph view (toggle)

- React Flow canvas with hierarchical layout (top-down)
- Nodes = packages, edges = dependency relationships
- Node styling: direct deps (depth 0) highlighted differently from transitive
- Click node to select — shows package info panel (version, type, depth)
- Search highlights matching nodes + paths to them
- Minimap for navigation
- Large graphs: only show first 2 levels by default, expand on click (lazy loading from already-loaded edge data, not new API calls)

### Project detail integration

- "Dependency Graph" link/button on project detail page, navigates to `/projects/:projectId/graph`
- Small stat badge showing total packages + max depth

### Standard UI stack

- Gateway → Repository → UseCase → Presenter → React
- Feature registration in App.tsx
- React Flow as new dependency (`yarn add reactflow`)

## Error Handling & Edge Cases

- **Missing lockfile**: Returns empty array. Graph page shows "No lockfile found — run install to generate one".
- **Corrupted/unparseable lockfile**: Parser catches errors, returns empty array, logs warning via `ErrorReporter`.
- **Very large dependency trees** (1000+ packages): DB handles it (edges are small rows). React Flow lazy-renders with 2-level default expansion. "Why" queries use indexed lookups.
- **Circular dependencies**: BFS in `findPaths()` tracks visited nodes, stops if cycle detected. Returns path up to cycle point.
- **Multiple versions of same package**: Each gets its own edges. Graph view shows both, distinguished by version label.
- **Workspace/monorepo**: pnpm's importers parsed per workspace root. Other PMs: single root.
- **Lockfile changes between scans**: Full delete+insert on each refresh. No incremental diffing.
- **Graph build failure during scan**: Wrapped in try/catch — scan completes, graph stays stale. User can manually refresh.

## Testing Strategy

### Unit tests

- **LockfileParserService** (one test suite per format):
  - **package-lock.json**: v2 and v3, nested transitive deps, devDependencies typed correctly, empty lockfile, malformed JSON
  - **yarn.lock**: v1, multiple versions of same package, peer deps, empty file
  - **pnpm-lock.yaml**: workspace, importers, packages section, hoisted deps
  - **bun.lock**: JSONC format, dependency resolution, empty file
  - **Dispatch**: correct parser called per PM, missing lockfile returns empty array
- **DependencyGraphService**:
  - `getGraph()` returns all edges for project
  - `findPaths()` — single path, multiple paths, not found returns empty, cycle handling
  - `refreshGraph()` — deletes old edges, inserts new, returns count

### Presenter tests

- Initial state: loading true, empty graph
- After load: stats populated, edges available
- Search: paths populated for matching package, empty for unknown
- View mode toggle
- Refresh triggers re-fetch

### Integration tests

- Graph route returns edges after refresh
- Path query returns correct chains
- Refresh endpoint re-parses and updates
- Stats endpoint returns correct aggregates

Lockfile fixtures: each parser test uses a small, realistic lockfile embedded as string constant in the test. No external fixture files.

No mocks for DB — real SQLite in-memory, following project convention.
