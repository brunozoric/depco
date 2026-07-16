# Dependency Graph Search UX Improvements

## Problem

The GraphPage search is minimal — exact match only, no autocomplete, no debounce, no filters, no way to control how search results display in the graph. Users with large dependency trees can't efficiently find packages or understand which parts of the tree are direct vs transitive.

## Goals

1. Server-side package autocomplete with substring matching
2. Debounced search with autocomplete dropdown and keyboard navigation
3. Two display modes for search results: "dim" (default, keeps full graph visible) and "matches only" (hides non-matching nodes), togglable
4. Client-side filters: dependency kind and max depth
5. Object params pattern for all methods with 2+ parameters

## Non-Goals

- Changing the `findPaths` BFS algorithm itself
- Adding new graph layout algorithms
- Full-text search across package metadata (description, license, etc.)

## Design

### Server-Side Package Search Endpoint

New API endpoint: `GET /api/dependency-graph/:projectId/packages?query=foo`

`DependencyGraphService` gains a `searchPackages` method:

```typescript
interface ISearchPackagesParams {
    projectId: string;
    query: string;
    limit?: number;
}

searchPackages(params: ISearchPackagesParams): Promise<string[]>
```

Query: `SELECT DISTINCT child_package FROM dependency_edges WHERE project_id = ? AND child_package LIKE '%query%' ORDER BY child_package LIMIT ?`

Default limit: 20. Returns package names sorted alphabetically.

Shared route definition added to `src/shared/routes/dependencyGraph.ts`.

### findPaths Refactor

Refactor existing `findPaths` to use object params (currently 2 positional args):

```typescript
interface IFindPathsParams {
    projectId: string;
    packageName: string;
}

findPaths(params: IFindPathsParams): Promise<Path[]>
```

All callers updated: service, route handler, gateway, use case.

### Presenter Search State + Debounce

`DependencyGraphPresenter` gains new observable state:

- `searchSuggestions: string[]` — from autocomplete API
- `searchMode: "dim" | "matchesOnly"` — display mode toggle, default `"dim"`
- `filters: { dependencyKind: string | null, maxDepth: number | null }` — client-side edge filters
- `showSuggestions: boolean` — dropdown visibility

Existing `searchQuery` and `search()` are repurposed.

**Debounce behavior (300ms):**

- On each keystroke: update `searchQuery` immediately (controlled input), debounce autocomplete API call by 300ms
- Autocomplete fires `searchPackages` API, populates `searchSuggestions`
- Path search fires only when user selects a suggestion or presses Enter — not on every keystroke

**New methods:**

```typescript
setSearchQuery(query: string): void          // updates input, debounces autocomplete
selectSuggestion(packageName: string): void  // fires findPaths, clears suggestions
setSearchMode(mode: "dim" | "matchesOnly"): void
setFilter(params: { field: string; value: string | number | null }): void
clearSearch(): void                          // resets query, suggestions, paths
```

**VM additions:**

```typescript
searchSuggestions: string[];
searchMode: "dim" | "matchesOnly";
filters: {
    dependencyKind: string | null;
    maxDepth: number | null;
};
showSuggestions: boolean;
```

### Graph View Display Modes

**Dim mode (default):** All nodes visible. Non-matching nodes get 30% opacity via `style.opacity: 0.3`. Matching path nodes and edges highlighted yellow (extends existing highlight behavior).

**Matches-only mode:** Only nodes on matching paths rendered. Non-matching nodes excluded from the `nodes` array entirely.

`buildGraphElements()` receives a new `displayMode: "dim" | "matchesOnly"` parameter. In dim mode, unmatched nodes are included with reduced opacity. In matches-only mode, unmatched nodes are excluded.

### Client-Side Filters

Applied to `vm.edges` before passing to `buildGraphElements()`:

**Dependency kind filter:** Select dropdown — All / Direct / Dev / Peer / Optional / Transitive. Filters edges by `dependencyType` and `depth` fields:

- "Direct": `depth === 0 && dependencyType === "dependency"`
- "Dev": `depth === 0 && dependencyType === "devDependency"`
- "Peer": `depth === 0 && dependencyType === "peerDependency"`
- "Optional": `depth === 0 && dependencyType === "optionalDependency"`
- "Transitive": `depth > 0`
- "All" or null: no filter

**Max depth filter:** Number input. Hides edges with `depth > maxDepth`. Default: null (no limit).

Filters combine with search — search results respect active filters. Filters work without active search too (e.g., "show me only transitive deps").

Filters do NOT apply to tree view — it only shows `findPaths` results.

### Component Layout

**Search bar area** (replaces current simple TextInput):

```
[Tree | Graph]  [Search: _________ X]  [Dim | Matches only]
                [autocomplete dropdown]
[Kind: All ▼]  [Max depth: ___]
```

- Mantine `Autocomplete` or custom `Popover` + `ScrollArea` + `List` for dropdown
- Clear button (X) when query is non-empty
- `SegmentedControl` for dim/matches-only toggle (only visible when search is active)
- Filter row below with kind select and max depth number input

**Keyboard navigation:**

- Arrow up/down moves through autocomplete suggestions
- Enter selects highlighted suggestion (fires `findPaths`)
- Escape closes dropdown

## Files Changed

### Backend

- `src/api/services/DependencyGraphService.ts` — add `searchPackages()`, refactor `findPaths()` to object params
- `src/api/services/abstractions/DependencyGraphService.ts` — add `ISearchPackagesParams`, `IFindPathsParams`, update interface
- `src/api/routes/dependencyGraph.ts` — add packages search route, update `findPaths` call
- `src/shared/routes/dependencyGraph.ts` — add route definition for package search
- `src/api/services/__tests__/DependencyGraphService.test.ts` — new tests
- `src/api/routes/__tests__/dependencyGraph.test.ts` — new route test (if exists)

### UI Features

- `src/ui/features/dependencyGraph/abstractions/DependencyGraphGateway.ts` — add `searchPackages()`, refactor `findPaths()` params
- `src/ui/features/dependencyGraph/DependencyGraphGateway.ts` — implement new method

### UI Presentation

- `src/ui/presentation/dependencyGraph/GraphPage/abstractions/DependencyGraphPresenter.ts` — new VM fields, new methods
- `src/ui/presentation/dependencyGraph/GraphPage/DependencyGraphPresenter.ts` — debounce, autocomplete, filters, search mode
- `src/ui/presentation/dependencyGraph/GraphPage/components/DependencyGraphPage.tsx` — search bar, filter row, mode toggle
- `src/ui/presentation/dependencyGraph/GraphPage/components/DependencyGraphView.tsx` — display mode support, filter application, opacity
- `src/ui/presentation/dependencyGraph/__tests__/DependencyGraphPresenter.test.ts` — new tests

## Testing Strategy

**DependencyGraphService tests:**

- `searchPackages` returns matching package names (substring)
- `searchPackages` respects limit param
- `searchPackages` returns empty array for no matches
- `findPaths` works with object params (existing tests refactored)

**Route tests:**

- Package search endpoint returns filtered list
- Empty query returns empty array

**Presenter tests:**

- `setSearchQuery` debounces and populates suggestions via gateway
- `selectSuggestion` fires `findPaths` and clears suggestions
- `setSearchMode` toggles between "dim" and "matchesOnly"
- `setFilter` updates filter state in VM
- `clearSearch` resets query, suggestions, paths
- `vm` exposes `searchSuggestions`, `searchMode`, `filters`, `showSuggestions`
