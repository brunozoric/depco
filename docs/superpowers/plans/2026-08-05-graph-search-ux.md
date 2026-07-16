# Graph Search UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side package autocomplete, debounced search, dim/matches-only display modes, client-side kind/depth filters, and keyboard navigation to the GraphPage dependency tree visualization.

**Architecture:** New `searchPackages` API endpoint on `DependencyGraphService`. Presenter manages debounce, autocomplete state, display mode, and filters. Graph view applies display modes and filters client-side on loaded edges. `findPaths` refactored to object params.

**Tech Stack:** TypeScript, Drizzle ORM (SQLite), Vitest, MobX, React/Mantine, @xyflow/react

## Global Constraints

- Use `yarn full` for all verification (lint, format, typecheck, build, tests)
- Named interfaces only — no inline structural types
- Object params with named keys when function has 2+ parameters
- Full words in identifiers
- Commit all files after each task

---

### Task 1: Backend — searchPackages Endpoint + findPaths Refactor

Add `searchPackages` method to `DependencyGraphService`, create shared route definition, wire route handler, and refactor `findPaths` to object params.

**Files:**

- Modify: `src/api/services/abstractions/DependencyGraphService.ts`
- Modify: `src/api/services/DependencyGraphService.ts`
- Modify: `src/api/routes/dependencyGraph.ts`
- Modify: `src/shared/routes/dependencyGraph.ts`
- Modify: `src/api/services/__tests__/DependencyGraphService.test.ts`
- Modify: `src/api/routes/__tests__/dependencyGraph.test.ts`

**Interfaces:**

- Consumes: `dependencyEdges` table (columns: `projectId`, `childPackage`)
- Produces: `searchPackages(params: ISearchPackagesParams): Promise<string[]>`, `findPaths(params: IFindPathsParams): Promise<Path[]>`

- [ ] **Step 1: Add interfaces and method to service abstraction**

In `src/api/services/abstractions/DependencyGraphService.ts`, add:

```typescript
export interface ISearchPackagesParams {
  projectId: string;
  query: string;
  limit?: number;
}

export interface IFindPathsParams {
  projectId: string;
  packageName: string;
}
```

Update `IDependencyGraphService`:

```typescript
export interface IDependencyGraphService {
  getGraph(projectId: string): Promise<IDependencyGraph>;
  findPaths(params: IFindPathsParams): Promise<IDependencyPath[]>;
  searchPackages(params: ISearchPackagesParams): Promise<string[]>;
  refreshGraph(projectId: string, projectPath: string, packageManager: string): Promise<number>;
}
```

Add to namespace:

```typescript
export namespace DependencyGraphService {
  // ... existing exports ...
  export type SearchPackagesParams = ISearchPackagesParams;
  export type FindPathsParams = IFindPathsParams;
}
```

- [ ] **Step 2: Implement searchPackages in service**

In `src/api/services/DependencyGraphService.ts`, add:

```typescript
public async searchPackages(params: DependencyGraphService.SearchPackagesParams): Promise<string[]> {
    const { projectId, query, limit = 20 } = params;

    if (!query.trim()) {
        return [];
    }

    const rows = await this.databaseClient.db
        .selectDistinct({ name: dependencyEdges.childPackage })
        .from(dependencyEdges)
        .where(
            and(
                eq(dependencyEdges.projectId, projectId),
                like(dependencyEdges.childPackage, `%${query}%`)
            )
        )
        .orderBy(dependencyEdges.childPackage)
        .limit(limit)
        .all();

    return rows.map(row => row.name);
}
```

Import `like` from `drizzle-orm` and `dependencyEdges` from schema.

- [ ] **Step 3: Refactor findPaths to object params**

In `src/api/services/DependencyGraphService.ts`, change the `findPaths` signature from `findPaths(projectId: string, packageName: string)` to:

```typescript
public async findPaths(params: DependencyGraphService.FindPathsParams): Promise<DependencyGraphService.Path[]> {
    const { projectId, packageName } = params;
    // ... rest of existing implementation unchanged
}
```

- [ ] **Step 4: Add shared route definition**

In `src/shared/routes/dependencyGraph.ts`, add:

```typescript
export const searchDependencyPackagesRoute = defineRoute({
  method: "GET",
  path: "/api/dependency-graph/:projectId/packages",
  description: "Search package names in dependency graph",
  params: z.object({ projectId: z.string() }),
  querystring: z.object({
    query: z.string().default(""),
    limit: z.coerce.number().optional()
  }),
  response: z.object({
    packages: z.array(z.string())
  })
});
```

- [ ] **Step 5: Wire route handler**

In `src/api/routes/dependencyGraph.ts`, add handler for the new route:

```typescript
registerRoute(app, searchDependencyPackagesRoute, {}, async (request, reply) => {
  const { projectId } = request.params;
  const { query, limit } = request.query;
  const packages = await dependencyGraphService.searchPackages({ projectId, query, limit });
  reply.send({ packages });
});
```

Update the existing `findPaths` call site (line 32) to use object params:

```typescript
const paths = await dependencyGraphService.findPaths({ projectId, packageName });
```

Import `searchDependencyPackagesRoute` from shared routes.

- [ ] **Step 6: Write service tests**

In `src/api/services/__tests__/DependencyGraphService.test.ts`, add tests:

- `searchPackages` returns matching package names (insert edges with "lodash", "lodash.get", "express"; search "lodash" returns both lodash entries)
- `searchPackages` respects limit (insert 25 matching packages, limit 5, verify 5 returned)
- `searchPackages` returns empty for no matches
- `searchPackages` returns empty for blank query

Read existing test file to follow its setup pattern (DB seeding, container creation).

Update any existing `findPaths` tests to use the new object params signature.

- [ ] **Step 7: Write route tests**

In `src/api/routes/__tests__/dependencyGraph.test.ts`, add tests:

- `GET /api/dependency-graph/:projectId/packages?query=lodash` returns matching list
- Empty query returns empty array

Read existing route test file for the request/response pattern.

- [ ] **Step 8: Run tests**

Run: `yarn vitest run src/api/services/__tests__/DependencyGraphService.test.ts src/api/routes/__tests__/dependencyGraph.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/api/ src/shared/
git commit -m "feat(api): add searchPackages endpoint and refactor findPaths to object params"
```

---

### Task 2: UI Gateway + Presenter State

Update gateway to use object params and add `searchPackages`. Add debounce, autocomplete state, display mode, and filters to presenter.

**Files:**

- Modify: `src/ui/features/dependencyGraph/abstractions/DependencyGraphGateway.ts`
- Modify: `src/ui/features/dependencyGraph/DependencyGraphGateway.ts`
- Modify: `src/ui/presentation/dependencyGraph/GraphPage/abstractions/DependencyGraphPresenter.ts`
- Modify: `src/ui/presentation/dependencyGraph/GraphPage/DependencyGraphPresenter.ts`
- Modify: `src/ui/presentation/dependencyGraph/__tests__/DependencyGraphPresenter.test.ts`

**Interfaces:**

- Consumes: `searchDependencyPackagesRoute` from Task 1, `findPaths` object params
- Produces: Presenter with `searchSuggestions`, `searchMode`, `filters`, `showSuggestions` in VM; methods `setSearchQuery`, `selectSuggestion`, `setSearchMode`, `setFilter`, `clearSearch`

- [ ] **Step 1: Update gateway abstraction**

In `src/ui/features/dependencyGraph/abstractions/DependencyGraphGateway.ts`:

Add interface:

```typescript
export interface ISearchPackagesParams {
  projectId: string;
  query: string;
  limit?: number;
}

export interface IFindPathsParams {
  projectId: string;
  packageName: string;
}
```

Update `IDependencyGraphGateway`:

```typescript
export interface IDependencyGraphGateway {
  getGraph(projectId: string): Promise<IDependencyGraph>;
  findPaths(params: IFindPathsParams): Promise<IDependencyPath[]>;
  searchPackages(params: ISearchPackagesParams): Promise<string[]>;
  getStats(projectId: string): Promise<IDependencyGraphStats>;
  refresh(projectId: string): Promise<IRefreshDependencyGraphResult>;
}
```

Add to namespace:

```typescript
export namespace DependencyGraphGateway {
  // ... existing exports ...
  export type SearchPackagesParams = ISearchPackagesParams;
  export type FindPathsParams = IFindPathsParams;
}
```

- [ ] **Step 2: Implement gateway methods**

In `src/ui/features/dependencyGraph/DependencyGraphGateway.ts`:

Update `findPaths` to object params:

```typescript
public async findPaths(params: Abstraction.FindPathsParams): Promise<Abstraction.Path[]> {
    const response = await this.httpClient.request(getDependencyGraphRoute, {
        params: { projectId: params.projectId },
        query: { package: params.packageName }
    });
    if ("paths" in response) {
        return response.paths;
    }
    throw new Error("Unexpected response shape for dependency graph paths");
}
```

Add `searchPackages`:

```typescript
public async searchPackages(params: Abstraction.SearchPackagesParams): Promise<string[]> {
    const response = await this.httpClient.request(searchDependencyPackagesRoute, {
        params: { projectId: params.projectId },
        query: { query: params.query, limit: params.limit }
    });
    return response.packages;
}
```

Import `searchDependencyPackagesRoute` from shared routes.

- [ ] **Step 3: Update presenter abstraction**

In `src/ui/presentation/dependencyGraph/GraphPage/abstractions/DependencyGraphPresenter.ts`:

Add filter interface:

```typescript
export type DependencyGraphSearchMode = "dim" | "matchesOnly";

export interface IDependencyGraphFilters {
  dependencyKind: string | null;
  maxDepth: number | null;
}
```

Extend `IDependencyGraphViewModel`:

```typescript
export interface IDependencyGraphViewModel {
  loading: boolean;
  error: string | null;
  edges: IDependencyGraphEdgeViewModel[];
  paths: IDependencyPathViewModel[];
  stats: IDependencyGraphStatsViewModel | null;
  searchQuery: string;
  viewMode: DependencyGraphViewMode;
  selectedPackage: string | null;
  searchSuggestions: string[];
  searchMode: DependencyGraphSearchMode;
  filters: IDependencyGraphFilters;
  showSuggestions: boolean;
}
```

Extend `IDependencyGraphPresenter`:

```typescript
export interface IDependencyGraphPresenter {
  get vm(): IDependencyGraphViewModel;
  load(projectId: string): Promise<void>;
  search(packageName: string): Promise<void>;
  setSearchQuery(query: string): void;
  selectSuggestion(packageName: string): void;
  setSearchMode(mode: DependencyGraphSearchMode): void;
  setFilter(params: { field: string; value: string | number | null }): void;
  clearSearch(): void;
  setViewMode(mode: DependencyGraphViewMode): void;
  refresh(): Promise<void>;
  selectPackage(packageName: string | null): void;
  dispose(): void;
}
```

Add to namespace:

```typescript
export namespace DependencyGraphPresenter {
  // ... existing exports ...
  export type SearchMode = DependencyGraphSearchMode;
  export type Filters = IDependencyGraphFilters;
}
```

- [ ] **Step 4: Implement presenter methods**

In `src/ui/presentation/dependencyGraph/GraphPage/DependencyGraphPresenter.ts`:

Add new observable fields:

```typescript
private searchSuggestions: string[] = [];
private searchMode: DependencyGraphSearchMode = "dim";
private filterDependencyKind: string | null = null;
private filterMaxDepth: number | null = null;
private showSuggestions = false;
private autocompleteTimer: ReturnType<typeof setTimeout> | null = null;
```

Add to `vm` getter:

```typescript
searchSuggestions: this.searchSuggestions,
searchMode: this.searchMode,
filters: {
    dependencyKind: this.filterDependencyKind,
    maxDepth: this.filterMaxDepth
},
showSuggestions: this.showSuggestions
```

Implement `setSearchQuery` with 300ms debounce for autocomplete:

```typescript
public setSearchQuery = (query: string): void => {
    this.searchQuery = query;

    if (this.autocompleteTimer) {
        clearTimeout(this.autocompleteTimer);
    }

    if (query.trim() === "") {
        this.searchSuggestions = [];
        this.showSuggestions = false;
        runInAction(() => {
            this.repository.setPaths([]);
        });
        return;
    }

    this.showSuggestions = true;
    this.autocompleteTimer = setTimeout(() => {
        void this.loadSuggestions(query);
    }, 300);
};

private loadSuggestions = async (query: string): Promise<void> => {
    if (!this.projectId) return;
    try {
        const suggestions = await this.gateway.searchPackages({
            projectId: this.projectId,
            query
        });
        runInAction(() => {
            this.searchSuggestions = suggestions;
        });
    } catch {
        runInAction(() => {
            this.searchSuggestions = [];
        });
    }
};
```

Implement `selectSuggestion`:

```typescript
public selectSuggestion = (packageName: string): void => {
    this.searchQuery = packageName;
    this.searchSuggestions = [];
    this.showSuggestions = false;
    void this.search(packageName);
};
```

Update `search` to use object params:

```typescript
public search = async (packageName: string): Promise<void> => {
    this.searchQuery = packageName;
    if (!this.projectId) return;
    if (packageName.trim() === "") {
        runInAction(() => { this.repository.setPaths([]); });
        return;
    }
    try {
        const paths = await this.gateway.findPaths({
            projectId: this.projectId,
            packageName
        });
        runInAction(() => { this.repository.setPaths(paths); });
    } catch (err) {
        runInAction(() => {
            this.error = err instanceof Error ? err.message : "Failed to search dependency paths";
        });
    }
};
```

Implement remaining methods:

```typescript
public setSearchMode = (mode: DependencyGraphSearchMode): void => {
    this.searchMode = mode;
};

public setFilter = (params: { field: string; value: string | number | null }): void => {
    switch (params.field) {
        case "dependencyKind":
            this.filterDependencyKind = params.value as string | null;
            break;
        case "maxDepth":
            this.filterMaxDepth = params.value as number | null;
            break;
    }
};

public clearSearch = (): void => {
    this.searchQuery = "";
    this.searchSuggestions = [];
    this.showSuggestions = false;
    this.repository.setPaths([]);
};
```

Clean up timer in `dispose`:

```typescript
public dispose = (): void => {
    if (this.autocompleteTimer) {
        clearTimeout(this.autocompleteTimer);
    }
    this.eventBridge.off("scan:complete", this.handleScanComplete);
    this.eventBridge.off("transitive-resolve:complete", this.handleTransitiveResolveComplete);
};
```

- [ ] **Step 5: Update use case if needed**

Check if `LoadDependencyGraphUseCase` or any use case calls `findPaths` — if so, update to object params. Read `src/ui/presentation/dependencyGraph/useCases/` files.

- [ ] **Step 6: Write presenter tests**

In `src/ui/presentation/dependencyGraph/__tests__/DependencyGraphPresenter.test.ts`, add tests:

- `setSearchQuery` debounces and populates suggestions via gateway mock
- `selectSuggestion` fires `findPaths` and clears suggestions
- `setSearchMode` toggles between "dim" and "matchesOnly"
- `setFilter` updates filter state in VM
- `clearSearch` resets query, suggestions, paths, showSuggestions
- `vm` exposes all new fields with correct defaults

Read existing test file to follow the mock/container setup pattern. The gateway mock needs `searchPackages: vi.fn()` added.

- [ ] **Step 7: Run tests**

Run: `yarn vitest run src/ui/presentation/dependencyGraph/__tests__/DependencyGraphPresenter.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/ui/ src/shared/
git commit -m "feat(ui): add search autocomplete, display modes, and filters to graph presenter"
```

---

### Task 3: Graph View Display Modes + Filters + Search UI

Update `DependencyGraphPage` with autocomplete dropdown, filter controls, and mode toggle. Update `DependencyGraphView` to support dim/matches-only display and edge filtering.

**Files:**

- Modify: `src/ui/presentation/dependencyGraph/GraphPage/components/DependencyGraphPage.tsx`
- Modify: `src/ui/presentation/dependencyGraph/GraphPage/components/DependencyGraphView.tsx`

**Interfaces:**

- Consumes: Presenter VM from Task 2 — `searchSuggestions`, `searchMode`, `filters`, `showSuggestions`, methods `setSearchQuery`, `selectSuggestion`, `setSearchMode`, `setFilter`, `clearSearch`
- Produces: Complete search UX with autocomplete, filters, display modes

- [ ] **Step 1: Update DependencyGraphPage search bar**

In `src/ui/presentation/dependencyGraph/GraphPage/components/DependencyGraphPage.tsx`:

Replace the simple `TextInput` (lines 111-116) with a search bar area containing:

1. A `TextInput` with autocomplete behavior:
   - `value={vm.searchQuery}`
   - `onChange` calls `presenter.setSearchQuery(value)`
   - `onKeyDown` handles Enter (fire search with current query) and Escape (close suggestions)
   - Conditionally render a clear button (X icon) when query is non-empty, clicking calls `presenter.clearSearch()`

2. Autocomplete dropdown (`Popover` or styled `div` below the input):
   - Visible when `vm.showSuggestions && vm.searchSuggestions.length > 0`
   - List of suggestions, each clickable calling `presenter.selectSuggestion(name)`
   - Keyboard navigation: track `highlightedIndex` in local state, arrow up/down changes it, Enter selects

3. Search mode toggle (only visible when search has results):
   - `SegmentedControl` with values "dim" / "matchesOnly", labels "Dim" / "Matches only"
   - `onChange` calls `presenter.setSearchMode(value)`

4. Filter row below:
   - `Select` for dependency kind with options: All, Direct, Dev, Peer, Optional, Transitive
   - `NumberInput` for max depth (placeholder "Max depth", clearable)
   - Both call `presenter.setFilter({ field, value })`

Layout:

```tsx
<Group justify="space-between">
    <SegmentedControl ... viewMode ... />
    <Group>
        <div style={{ position: "relative" }}>
            <TextInput ... search input ... rightSection={clearButton} />
            {vm.showSuggestions && vm.searchSuggestions.length > 0 && (
                <Paper ... dropdown ... >
                    <ScrollArea.Autosize mah={200}>
                        {vm.searchSuggestions.map((name, index) => (
                            <UnstyledButton key={name} ... onClick={() => presenter.selectSuggestion(name)} ... >
                                {name}
                            </UnstyledButton>
                        ))}
                    </ScrollArea.Autosize>
                </Paper>
            )}
        </div>
        {vm.paths.length > 0 && (
            <SegmentedControl ... searchMode ... />
        )}
    </Group>
</Group>
<Group gap="sm">
    <Select ... dependencyKind ... />
    <NumberInput ... maxDepth ... />
</Group>
```

Import needed Mantine components: `Paper`, `ScrollArea`, `UnstyledButton`, `Select`, `NumberInput`, `CloseButton`.

- [ ] **Step 2: Update DependencyGraphView for display modes and filters**

In `src/ui/presentation/dependencyGraph/GraphPage/components/DependencyGraphView.tsx`:

Update `buildGraphElements` signature to accept display mode and filters:

```typescript
function buildGraphElements(
    graphEdges: DependencyGraphPresenter.Edge[],
    paths: DependencyGraphPresenter.Path[],
    searchQuery: string,
    selectedPackage: string | null,
    expandedNodeIds: ReadonlySet<string>,
    displayMode: DependencyGraphPresenter.SearchMode,
    filters: DependencyGraphPresenter.Filters
): BuiltGraphElements {
```

**Filter application** — at the top of the function, filter edges before processing:

```typescript
let filteredEdges = graphEdges;

if (filters.dependencyKind) {
  filteredEdges = filteredEdges.filter(edge => {
    const kind = resolveDependencyKind(edge.dependencyType, edge.depth);
    return kind === filters.dependencyKind;
  });
}

if (filters.maxDepth !== null) {
  filteredEdges = filteredEdges.filter(edge => edge.depth <= filters.maxDepth!);
}

const sortedEdges = [...filteredEdges].sort((a, b) => a.depth - b.depth);
```

**Display mode** — when building nodes, apply opacity:

In the dim mode with active search: nodes NOT in `highlightedNodeIds` get `opacity: 0.3` in their style.

In matches-only mode: nodes NOT in `highlightedNodeIds` are excluded entirely (don't push to `nodes` array) — but only when there IS an active search. If no search, show all nodes normally.

```typescript
const isSearchActive = searchQuery.trim() !== "" && highlightedNodeIds.size > 0;

// In the node-building loop:
if (isSearchActive && displayMode === "matchesOnly" && !highlightedNodeIds.has(info.id)) {
    continue; // skip this node entirely
}

// In style:
const dimmed = isSearchActive && displayMode === "dim" && !isHighlighted && !isSelected;

style: {
    background: depthColor(depth),
    color: depth === 0 ? "#ffffff" : "#1a1b1e",
    border: isSelected ? "3px solid #f08c00" : isHighlighted ? "3px solid #fab005" : "1px solid #ced4da",
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    fontWeight: depth === 0 ? 700 : 500,
    opacity: dimmed ? 0.3 : 1
}
```

Update the `useMemo` call in the component to pass the new params:

```typescript
const { nodes, edges } = useMemo(
  () =>
    buildGraphElements(
      vm.edges,
      vm.paths,
      vm.searchQuery,
      vm.selectedPackage,
      expandedNodeIds,
      vm.searchMode,
      vm.filters
    ),
  [
    vm.edges,
    vm.paths,
    vm.searchQuery,
    vm.selectedPackage,
    expandedNodeIds,
    vm.searchMode,
    vm.filters
  ]
);
```

- [ ] **Step 3: Run full verification**

Run: `yarn full`
Expected: All checks pass.

- [ ] **Step 4: Commit**

```bash
git add src/ui/
git commit -m "feat(ui): add search autocomplete, display modes, and filters to graph page

Autocomplete dropdown with keyboard navigation. Dim/matches-only toggle.
Dependency kind and max depth filters. All filters apply to graph view."
```

---

### Task 4: Final Verification

- [ ] **Step 1: Verify all new features work together**

Run: `yarn full`
Expected: All checks pass — lint, format, typecheck, build, all tests green.

- [ ] **Step 2: Verify no regressions**

Check that existing search behavior (type package name, see paths in tree view) still works with the new presenter methods. The old `search()` method is still called by `selectSuggestion`.

- [ ] **Step 3: Commit if any cleanup needed**

```bash
git add -A
git commit -m "refactor: graph search UX cleanup"
```
