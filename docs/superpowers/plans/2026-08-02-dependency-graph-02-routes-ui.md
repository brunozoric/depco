# Dependency Graph Part 2: API Routes & UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create API routes for graph data, shared route definitions, and the full UI layer — gateway, repository, use cases, presenter, tree view, and React Flow graph view.

**Architecture:** Three API routes (graph data, refresh, stats) served from DependencyGraphService. UI follows Gateway → Repository → UseCase → Presenter → React. Two view modes: tree list for "why" lookups, React Flow for interactive graph exploration.

**Tech Stack:** TypeScript, Fastify, Zod, React 19, MobX, Mantine, React Flow, vitest

## Global Constraints

- Use full words in identifiers — no abbreviations
- Named interfaces only — no inline structural types
- Presenter-driven UI: compute in presenter, render conditionally in page
- No dev server start — user manages that
- Tests in `src/**/__tests__/**/*.test.ts`
- Yarn for package management

---

### Task 6: Shared route definitions and API routes

**Files:**

- Create: `src/shared/routes/dependencyGraph.ts`
- Modify: `src/shared/routes/index.ts`
- Create: `src/api/routes/dependencyGraph.ts`
- Modify: `src/api/routes/index.ts`
- Modify: `src/api/server.ts` (register routes)
- Create: `src/api/routes/__tests__/dependencyGraph.test.ts`

**Interfaces:**

- Consumes: `DependencyGraphService.Interface` (Task 4), `DatabaseClient.Interface`
- Produces: Route constants `getDependencyGraphRoute`, `refreshDependencyGraphRoute`, `getDependencyGraphStatsRoute`

- [ ] **Step 1: Create shared route definitions**

Create `src/shared/routes/dependencyGraph.ts` with Zod schemas:

```typescript
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const edgeSchema = z.object({
  parentPackage: z.string().nullable(),
  parentVersion: z.string().nullable(),
  childPackage: z.string(),
  childVersion: z.string(),
  dependencyType: z.string(),
  depth: z.number()
});

const pathNodeSchema = z.object({
  packageName: z.string(),
  version: z.string()
});

const pathSchema = z.object({
  target: z.string(),
  chain: z.array(pathNodeSchema)
});

export const getDependencyGraphRoute = defineRoute({
  method: "GET",
  path: "/api/dependency-graph/:projectId",
  description: "Get dependency graph or paths to a specific package",
  params: z.object({ projectId: z.string() }),
  querystring: z.object({
    package: z.string().optional()
  }),
  response: z.union([
    z.object({
      edges: z.array(edgeSchema),
      rootPackages: z.array(z.string()),
      totalPackages: z.number(),
      maxDepth: z.number(),
      edgeCount: z.number()
    }),
    z.object({
      paths: z.array(pathSchema)
    })
  ])
});

export const refreshDependencyGraphRoute = defineRoute({
  method: "POST",
  path: "/api/dependency-graph/:projectId/refresh",
  description: "Trigger lockfile re-parse without full scan",
  params: z.object({ projectId: z.string() }),
  response: z.object({ edgeCount: z.number() })
});

export const getDependencyGraphStatsRoute = defineRoute({
  method: "GET",
  path: "/api/dependency-graph/:projectId/stats",
  description: "Get dependency graph summary stats",
  params: z.object({ projectId: z.string() }),
  response: z.object({
    totalPackages: z.number(),
    maxDepth: z.number(),
    rootCount: z.number(),
    edgeCount: z.number()
  })
});
```

- [ ] **Step 2: Add re-export and create route handlers**

Add to `src/shared/routes/index.ts`: `export * from "./dependencyGraph.js";`

Create `src/api/routes/dependencyGraph.ts` implementing all 3 routes:

- GET graph: if `?package=X`, call `findPaths(projectId, X)` and return `{ paths }`. Otherwise call `getGraph(projectId)` and return the full graph.
- POST refresh: look up project's packageManager, call `refreshGraph()`, return `{ edgeCount }`
- GET stats: call `getGraph()`, return `{ totalPackages, maxDepth, rootCount: rootPackages.length, edgeCount }`

Register in server.ts after auto-fix routes.

- [ ] **Step 3: Write integration tests**

Create `src/api/routes/__tests__/dependencyGraph.test.ts`:

1. GET graph returns empty edges when no graph built
2. POST refresh parses lockfile and returns edge count
3. GET graph with `?package=X` returns paths
4. GET stats returns correct aggregates

- [ ] **Step 4: Run tests**

Run: `yarn build && yarn test`

- [ ] **Step 5: Commit**

```bash
git add src/shared/routes/dependencyGraph.ts src/shared/routes/index.ts src/api/routes/dependencyGraph.ts src/api/routes/index.ts src/api/server.ts src/api/routes/__tests__/dependencyGraph.test.ts
git commit -m "feat(graph): add dependency graph API routes and shared definitions"
```

---

### Task 7: UI Gateway, Repository, UseCases, and Feature

**Files:**

- Create: `src/ui/features/dependencyGraph/abstractions/DependencyGraphGateway.ts`
- Create: `src/ui/features/dependencyGraph/DependencyGraphGateway.ts`
- Create: `src/ui/features/dependencyGraph/abstractions/DependencyGraphRepository.ts`
- Create: `src/ui/features/dependencyGraph/DependencyGraphRepository.ts`
- Create: `src/ui/features/dependencyGraph/feature.ts`
- Create: `src/ui/presentation/dependencyGraph/useCases/abstractions/LoadDependencyGraphUseCase.ts`
- Create: `src/ui/presentation/dependencyGraph/useCases/LoadDependencyGraphUseCase.ts`
- Create: `src/ui/presentation/dependencyGraph/useCases/abstractions/RefreshDependencyGraphUseCase.ts`
- Create: `src/ui/presentation/dependencyGraph/useCases/RefreshDependencyGraphUseCase.ts`
- Create: `src/ui/presentation/dependencyGraph/useCases/feature.ts`

**Interfaces:**

- Consumes: Route constants from `#shared/routes/dependencyGraph.js`, `HttpClient`
- Produces: `DependencyGraphGateway.Interface`, `DependencyGraphRepository.Interface`, `LoadDependencyGraphUseCase.Interface`, `RefreshDependencyGraphUseCase.Interface`

Follow `LicensesGateway`/`LicensesRepository`/use case patterns exactly.

Gateway methods:

- `getGraph(projectId)` — full graph
- `findPaths(projectId, packageName)` — path query
- `getStats(projectId)` — summary stats
- `refresh(projectId)` — trigger re-parse

Repository stores: graph, paths, stats.

Use cases:

- `LoadDependencyGraphUseCase.execute(projectId)` — fetches graph + stats
- `RefreshDependencyGraphUseCase.execute(projectId)` — triggers refresh, reloads graph + stats

- [ ] **Step 1-6: Create all files following established patterns**
- [ ] **Step 7: Verify build**

Run: `yarn build`

- [ ] **Step 8: Commit**

```bash
git add src/ui/features/dependencyGraph/ src/ui/presentation/dependencyGraph/
git commit -m "feat(graph): add UI gateway, repository, and use cases for dependency graph"
```

---

### Task 8: DependencyGraphPresenter and tests

**Files:**

- Create: `src/ui/presentation/dependencyGraph/GraphPage/abstractions/DependencyGraphPresenter.ts`
- Create: `src/ui/presentation/dependencyGraph/GraphPage/DependencyGraphPresenter.ts`
- Create: `src/ui/presentation/dependencyGraph/GraphPage/feature.ts`
- Create: `src/ui/presentation/dependencyGraph/__tests__/DependencyGraphPresenter.test.ts`

**Interfaces:**

- Consumes: `DependencyGraphGateway.Interface`, `DependencyGraphRepository.Interface`, use cases
- Produces: `DependencyGraphPresenter.Interface` with computed `vm` and action methods

Presenter VM:

```typescript
export interface IDependencyGraphViewModel {
  loading: boolean;
  error: string | null;
  edges: IDependencyGraphEdgeViewModel[];
  paths: IDependencyPathViewModel[];
  stats: IDependencyGraphStatsViewModel | null;
  searchQuery: string;
  viewMode: "tree" | "graph";
  selectedPackage: string | null;
}
```

Actions: `load(projectId)`, `search(packageName)`, `setViewMode()`, `refresh()`, `selectPackage()`

Tests (7):

1. Initial state: loading true, empty
2. After load: stats populated, edges available
3. Search: paths populated for matching package
4. Search: empty for unknown package
5. View mode toggle
6. Refresh triggers re-fetch
7. Select package updates selectedPackage

- [ ] **Steps 1-5: Create abstraction, tests, implementation, feature**
- [ ] **Step 6: Run tests**

Run: `yarn test src/ui/presentation/dependencyGraph/__tests__/`

- [ ] **Step 7: Commit**

```bash
git add src/ui/presentation/dependencyGraph/
git commit -m "feat(graph): add DependencyGraphPresenter with search and view mode"
```

---

### Task 9: React components — Tree view, Graph view, page

**Files:**

- Create: `src/ui/presentation/dependencyGraph/GraphPage/DependencyGraphProvider.tsx`
- Create: `src/ui/presentation/dependencyGraph/GraphPage/components/DependencyGraphPage.tsx`
- Create: `src/ui/presentation/dependencyGraph/GraphPage/components/DependencyTreeView.tsx`
- Create: `src/ui/presentation/dependencyGraph/GraphPage/components/DependencyGraphView.tsx`
- Modify: `src/ui/App.tsx` (add features, route, project detail link)

**Interfaces:**

- Consumes: `DependencyGraphPresenter.Interface`

- [ ] **Step 1: Install React Flow**

Run: `yarn add @xyflow/react` (the current React Flow package — `reactflow` is the legacy name)

- [ ] **Step 2: Create Provider**

`DependencyGraphProvider.tsx` — render-prop pattern, resolves `DependencyGraphFeature`.

- [ ] **Step 3: Create DependencyTreeView**

Tree view component:

- Search box (TextInput) at top
- Results: each path rendered as a Mantine `List` with `List.Item` per node, using `Text` components with `→` character between package entries (e.g., `project → express@4.18.2 → qs@6.11.0`)
- Package name + version at each node, styled with `Code` component
- "No results" state when search returns empty
- "Search for a package" empty state before any search

- [ ] **Step 4: Create DependencyGraphView**

React Flow graph component:

- Convert edges to React Flow nodes + edges
- Hierarchical layout (top-down) using dagre or manual positioning
- Node styling: depth-0 nodes in primary color, deeper nodes in lighter shades
- Click node → calls `presenter.selectPackage(name)`
- Search highlight: when `searchQuery` is set, highlight matching nodes + their paths
- Minimap enabled
- Large graphs: component-local `expandedDepth` state (default 1). Initially render only depth 0-1. Clicking a node increments visible depth for that subtree. All data already loaded — filtering is purely client-side, no API calls. Not tracked in presenter VM (transient UI state).

- [ ] **Step 5: Create DependencyGraphPage**

Page component combining:

- Stats header (total packages, max depth, edge count)
- SegmentedControl for view mode toggle (Tree / Graph)
- Refresh button
- Conditional render: tree view or graph view based on viewMode
- Loading/error states

- [ ] **Step 6: Integrate into App.tsx**

1. Import `DependencyGraphFeature`, `DependencyGraphUseCasesFeature`, `DependencyGraphPageFeature`
2. Add all to `ALL_FEATURES`
3. Add route: `/projects/:projectId/graph` renders the graph page
4. Add "Dependency Graph" link on project detail page (button navigating to the graph route)

- [ ] **Step 7: Verify build**

Run: `yarn build`

- [ ] **Step 8: Commit**

```bash
git add src/ui/presentation/dependencyGraph/ src/ui/App.tsx package.json yarn.lock
git commit -m "feat(graph): add dependency graph page with tree and React Flow views"
```

---

### Task 10: Update AGENTS.md

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Document dependency graph feature**

Add sections for:

- `dependency_edges` table
- `LockfileParserService` (4 format parsers)
- `DependencyGraphService` (graph queries, BFS path finding)
- API routes (graph, refresh, stats)
- UI features (gateway, repository, use cases, presenter)
- Graph page with tree + React Flow views
- Scan integration (auto-refresh after scan)

- [ ] **Step 2: Run full suite**

Run: `yarn build && yarn test`

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add dependency graph feature to AGENTS.md"
```
