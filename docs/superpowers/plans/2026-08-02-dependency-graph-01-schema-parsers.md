# Dependency Graph Part 1: Schema, Lockfile Parsers & Graph Service

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the dependency_edges DB table, LockfileParserService with all 4 lockfile format parsers, and DependencyGraphService for graph queries and path finding.

**Architecture:** Migration 0008 adds the dependency_edges table. LockfileParserService reads lockfiles from disk and produces DependencyEdge arrays. DependencyGraphService persists edges and provides BFS path finding. Each lockfile format gets its own private parser method.

**Tech Stack:** TypeScript, Drizzle ORM, SQLite, vitest, js-yaml (for pnpm-lock.yaml)

## Global Constraints

- Use full words in identifiers — no abbreviations
- Named interfaces only — no inline structural types
- Abstraction and implementation in separate files, separate directories
- Real SQLite in-memory for tests — use `createTestDatabaseClient()`
- Yarn for package management
- Tests in `src/**/__tests__/**/*.test.ts`
- Lockfile fixtures embedded as string constants in tests, not external files

---

### Task 1: Database schema and migration

**Files:**

- Modify: `src/api/db/schema.ts` (add `dependencyEdges` table)
- Create: `src/api/db/migrations/0008_add_dependency_edges.sql`
- Modify: `src/api/db/migrations/meta/_journal.json`
- Modify: `src/testing/helpers/createTestDb.ts` (add DDL)

**Interfaces:**

- Produces: `dependencyEdges` Drizzle table definition

- [ ] **Step 1: Add table definition to schema.ts**

Add after `autoFixPullRequests` table:

```typescript
export const dependencyEdges = sqliteTable("dependency_edges", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  parentPackage: text("parent_package"),
  parentVersion: text("parent_version"),
  childPackage: text("child_package").notNull(),
  childVersion: text("child_version").notNull(),
  dependencyType: text("dependency_type").notNull(),
  depth: integer("depth").notNull(),
  scannedAt: integer("scanned_at").notNull()
});
```

- [ ] **Step 2: Create migration SQL**

Create `src/api/db/migrations/0008_add_dependency_edges.sql`:

```sql
CREATE TABLE `dependency_edges` (
    `id` text PRIMARY KEY NOT NULL,
    `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
    `parent_package` text,
    `parent_version` text,
    `child_package` text NOT NULL,
    `child_version` text NOT NULL,
    `dependency_type` text NOT NULL,
    `depth` integer NOT NULL,
    `scanned_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_dependency_edges_project_child` ON `dependency_edges`(`project_id`, `child_package`);
--> statement-breakpoint
CREATE INDEX `idx_dependency_edges_project_parent` ON `dependency_edges`(`project_id`, `parent_package`);
```

- [ ] **Step 3: Add migration to journal**

Add entry with `idx: 8`, `tag: "0008_add_dependency_edges"`, `when: 1786233600000`.

- [ ] **Step 4: Update createTestDb.ts**

Add DDL for the table and both indexes.

- [ ] **Step 5: Verify build and tests**

Run: `yarn build && yarn test`

- [ ] **Step 6: Commit**

```bash
git add src/api/db/schema.ts src/api/db/migrations/0008_add_dependency_edges.sql src/api/db/migrations/meta/_journal.json src/testing/helpers/createTestDb.ts
git commit -m "feat(graph): add dependency_edges DB schema and migration"
```

---

### Task 2: LockfileParserService — abstraction and npm parser

**Files:**

- Create: `src/api/services/abstractions/LockfileParserService.ts`
- Create: `src/api/services/LockfileParserService.ts`
- Create: `src/api/services/__tests__/LockfileParserService.test.ts`

**Interfaces:**

- Produces: `LockfileParserService.Interface` with `parse(projectPath: string, packageManager: string): Promise<LockfileParserService.DependencyEdge[]>` where `DependencyEdge = { parentPackage: string | null, parentVersion: string | null, childPackage: string, childVersion: string, dependencyType: string, depth: number }`

- [ ] **Step 1: Create abstraction**

Create `src/api/services/abstractions/LockfileParserService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IDependencyEdge {
  parentPackage: string | null;
  parentVersion: string | null;
  childPackage: string;
  childVersion: string;
  dependencyType: string;
  depth: number;
}

export interface ILockfileParserService {
  parse(projectPath: string, packageManager: string): Promise<IDependencyEdge[]>;
}

export const LockfileParserService = createAbstraction<ILockfileParserService>(
  "Api/LockfileParserService"
);

export namespace LockfileParserService {
  export type Interface = ILockfileParserService;
  export type DependencyEdge = IDependencyEdge;
}
```

- [ ] **Step 2: Write npm lockfile parser tests**

Create `src/api/services/__tests__/LockfileParserService.test.ts` with tests for npm format:

1. Parses package-lock.json v3 `packages` format — flat entries like `node_modules/express`, `node_modules/express/node_modules/qs`. Depth from path nesting.
2. Identifies root dependencies (depth 0, parentPackage null) vs transitive (depth 1+)
3. Handles devDependencies (dependencyType = "devDependency" when declared in root package.json's devDependencies)
4. Returns empty array for empty packages object
5. Returns empty array when lockfile doesn't exist
6. Returns empty array for malformed JSON

Fixtures: embed small package-lock.json v3 content as string constants. Example:

```json
{
  "name": "test-project",
  "lockfileVersion": 3,
  "packages": {
    "": { "dependencies": { "express": "^4.18.0" }, "devDependencies": { "vitest": "^4.0.0" } },
    "node_modules/express": { "version": "4.18.2", "dependencies": { "body-parser": "1.20.2" } },
    "node_modules/express/node_modules/body-parser": {
      "version": "1.20.2",
      "dependencies": { "qs": "6.11.0" }
    },
    "node_modules/express/node_modules/body-parser/node_modules/qs": { "version": "6.11.0" },
    "node_modules/vitest": { "version": "4.0.0" }
  }
}
```

- [ ] **Step 3: Write npm parser implementation**

In `src/api/services/LockfileParserService.ts`, implement `parsePackageLock(content: string, packageJsonContent: string)`:

- Parse `packages` field from lockfile JSON
- Skip the root entry (key = `""`)
- For each entry, extract package name from the last `node_modules/` segment of the key
- Depth = count of `node_modules/` segments in the key minus 1
- Parent = package name from the second-to-last `node_modules/` segment (null for depth 0)
- Version from entry's `version` field
- dependencyType: check root package.json's `devDependencies` for depth-0 packages

The service reads files using Node.js `fs.readFile`. Dispatches to the correct parser based on `packageManager` parameter. For now, only npm implemented — others return empty array.

- [ ] **Step 4: Run tests**

Run: `yarn test src/api/services/__tests__/LockfileParserService.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/api/services/abstractions/LockfileParserService.ts src/api/services/LockfileParserService.ts src/api/services/__tests__/LockfileParserService.test.ts
git commit -m "feat(graph): add LockfileParserService with npm package-lock.json parser"
```

---

### Task 3: Yarn, pnpm, and bun lockfile parsers

**Files:**

- Modify: `src/api/services/LockfileParserService.ts` (add 3 parsers)
- Modify: `src/api/services/__tests__/LockfileParserService.test.ts` (add tests per format)

**Interfaces:**

- Consumes: `IDependencyEdge` from Task 2
- Produces: Complete parser coverage for all 4 PMs

- [ ] **Step 1: Install js-yaml**

The project already has the `yaml` package (v2.9.0) installed. Use it instead of `js-yaml`: `import { parse as parseYaml } from "yaml";`

- [ ] **Step 2: Write yarn.lock parser tests + implementation**

Tests:

1. Parses yarn.lock v1 format — `"package@version"` entries with `dependencies` maps
2. Cross-references with package.json to identify root (depth 0) vs transitive deps
3. Handles multiple versions of same package
4. Returns empty for empty/missing file

Implementation: `parseYarnLock(content, packageJsonContent)`:

- Parse yarn.lock format (each block: quoted key, indented fields)
- Build adjacency map from each entry's `dependencies`
- Walk from root deps (those in package.json) outward, assigning depth
- Use BFS to avoid infinite loops on potential cycles

- [ ] **Step 3: Write pnpm-lock.yaml parser tests + implementation**

Tests:

1. Parses importers section (workspace roots, direct deps at depth 0)
2. Parses packages section (transitive deps)
3. Handles workspace monorepo structure
4. Returns empty for missing file

Implementation: `parsePnpmLock(content, packageJsonContent)`:

- Use `js-yaml` to parse YAML content
- Extract `importers` for direct deps (depth 0)
- Walk `packages` section for transitive deps
- Build edges with depth from BFS walk

- [ ] **Step 4: Write bun.lock parser tests + implementation**

Tests:

1. Parses bun.lock JSONC format
2. Extracts dependency edges
3. Returns empty for missing/malformed file

Implementation: `parseBunLock(content, packageJsonContent)`:

- Strip JSONC comments, parse as JSON
- Extract `packages` entries and dependency relationships
- Cross-reference with package.json for root deps

- [ ] **Step 5: Run all parser tests**

Run: `yarn test src/api/services/__tests__/LockfileParserService.test.ts`

- [ ] **Step 6: Run full suite**

Run: `yarn build && yarn test`

- [ ] **Step 7: Commit**

```bash
git add src/api/services/LockfileParserService.ts src/api/services/__tests__/LockfileParserService.test.ts package.json yarn.lock
git commit -m "feat(graph): add yarn, pnpm, and bun lockfile parsers"
```

---

### Task 4: DependencyGraphService

**Files:**

- Create: `src/api/services/abstractions/DependencyGraphService.ts`
- Create: `src/api/services/DependencyGraphService.ts`
- Create: `src/api/services/__tests__/DependencyGraphService.test.ts`
- Modify: `src/api/feature.ts` (register both services)

**Interfaces:**

- Consumes: `LockfileParserService.Interface` (Task 2), `DatabaseClient.Interface`, `dependencyEdges` table (Task 1)
- Produces: `DependencyGraphService.Interface` with:
  - `getGraph(projectId: string): Promise<DependencyGraphService.Graph>`
  - `findPaths(projectId: string, packageName: string): Promise<DependencyGraphService.Path[]>`
  - `refreshGraph(projectId: string, projectPath: string, packageManager: string): Promise<number>`
  - `Graph = { edges: DependencyEdge[], rootPackages: string[], totalPackages: number, maxDepth: number, edgeCount: number }`
  - `Path = { target: string, chain: Array<{ packageName: string, version: string }> }`

- [ ] **Step 1: Create abstraction**

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IDependencyGraphEdge {
  parentPackage: string | null;
  parentVersion: string | null;
  childPackage: string;
  childVersion: string;
  dependencyType: string;
  depth: number;
}

export interface IDependencyGraph {
  edges: IDependencyGraphEdge[];
  rootPackages: string[];
  totalPackages: number;
  maxDepth: number;
  edgeCount: number;
}

export interface IDependencyPathNode {
  packageName: string;
  version: string;
}

export interface IDependencyPath {
  target: string;
  chain: IDependencyPathNode[];
}

export interface IDependencyGraphService {
  getGraph(projectId: string): Promise<IDependencyGraph>;
  findPaths(projectId: string, packageName: string): Promise<IDependencyPath[]>;
  refreshGraph(projectId: string, projectPath: string, packageManager: string): Promise<number>;
}

export const DependencyGraphService = createAbstraction<IDependencyGraphService>(
  "Api/DependencyGraphService"
);

export namespace DependencyGraphService {
  export type Interface = IDependencyGraphService;
  export type Graph = IDependencyGraph;
  export type Edge = IDependencyGraphEdge;
  export type Path = IDependencyPath;
  export type PathNode = IDependencyPathNode;
}
```

- [ ] **Step 2: Write tests**

Tests covering:

1. `getGraph()` — returns all edges, correct rootPackages (depth 0), totalPackages (distinct child names), maxDepth, edgeCount
2. `findPaths()` — single path from root to target
3. `findPaths()` — multiple paths (same package via different parents)
4. `findPaths()` — package not found returns empty array
5. `findPaths()` — cycle guard (insert edges that form cycle, BFS terminates)
6. `refreshGraph()` — deletes old edges, inserts new from parser, returns count

Setup: insert edges directly into `dependencyEdges` table for query tests. Mock `LockfileParserService` for `refreshGraph()` tests.

- [ ] **Step 3: Write implementation**

`refreshGraph()`:

1. Call `lockfileParserService.parse(projectPath, packageManager)`
2. Delete all existing edges for projectId
3. Insert new edges with `generateId()` and current timestamp
4. Return edge count

`getGraph()`:

1. Query all edges for projectId
2. Compute rootPackages (distinct childPackage where depth = 0)
3. Compute totalPackages (distinct childPackage across all depths)
4. Compute maxDepth (max depth value)
5. Return graph object

`findPaths()` — BFS from root edges to target:

1. Query all edges for projectId
2. Build adjacency map: parentPackage → array of child edges
3. BFS from null-parent edges (roots), tracking visited to prevent cycles
4. Collect all paths that reach the target packageName
5. Return as Path[] with ordered chain

- [ ] **Step 4: Register both services in DI**

In `src/api/feature.ts`, register `LockfileParserService` and `DependencyGraphService`.

- [ ] **Step 5: Run tests**

Run: `yarn build && yarn test`

- [ ] **Step 6: Commit**

```bash
git add src/api/services/abstractions/DependencyGraphService.ts src/api/services/DependencyGraphService.ts src/api/services/__tests__/DependencyGraphService.test.ts src/api/feature.ts
git commit -m "feat(graph): add DependencyGraphService with BFS path finding and graph refresh"
```

---

### Task 5: ScanJobExecutor integration

**Files:**

- Modify: `src/api/services/jobExecutors/ScanJobExecutor.ts` (add graph refresh call)
- Modify: `src/api/services/jobExecutors/JobExecutorRegistry.ts` (pass DependencyGraphService)

**Interfaces:**

- Consumes: `DependencyGraphService.Interface` (Task 4)

- [ ] **Step 1: Add DependencyGraphService to ScanJobExecutor**

1. Import `DependencyGraphService` type
2. Add as constructor parameter (after `vulnerabilityService`)
3. After `insertChangelogPlaceholders()` (around line 344), add:

```typescript
try {
  await this.dependencyGraphService.refreshGraph(
    context.referenceId,
    context.projectPath,
    context.packageManager
  );
} catch {
  // Graph build failure should not fail the dependency scan
}
```

- [ ] **Step 2: Update JobExecutorRegistry**

Pass `DependencyGraphService` to `ScanJobExecutor` constructor. Add to registry's constructor parameters and `dependencies` array.

- [ ] **Step 3: Fix affected tests**

Update test files that construct `ScanJobExecutor` or `JobExecutorRegistry` manually — add mock/stub for the new dependency.

- [ ] **Step 4: Run all tests**

Run: `yarn build && yarn test`

- [ ] **Step 5: Commit**

```bash
git add src/api/services/jobExecutors/ScanJobExecutor.ts src/api/services/jobExecutors/JobExecutorRegistry.ts
git commit -m "feat(graph): integrate dependency graph refresh into scan pipeline"
```
