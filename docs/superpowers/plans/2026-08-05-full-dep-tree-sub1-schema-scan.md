# Full Dependency Tree — Sub-project 1: Schema + ScanService Expansion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store ALL installed packages (direct, dev, peer, optional, transitive) in scan_results, not just direct dependencies. Add `dependencyKind` and `registryResolved` columns. Transitive deps stored with null registry data, to be resolved by a background job in sub-project 3.

**Architecture:** Extend scan_results schema with two new columns and make three existing columns nullable. Expand ScanService.collectDependencyTypes() to read peer/optional from package.json. Change ScanJobExecutor to persist all installed packages, not just package.json entries. Dependency graph edges already refresh during scan via DependencyGraphService.refreshGraph().

**Tech Stack:** Drizzle ORM, SQLite, Vitest

## Global Constraints

- Use `yarn full` for all checks (lint, format, typecheck, build, tests)
- Use `drizzle-kit generate` for migrations — never hand-write SQL
- Named interfaces only — no inline structural types
- Object params with named keys when function has 2+ params
- Full words in identifiers (Vulnerability not Vuln)
- Never import *Impl outside its own file — use abstractions + DI container
- Commit all files after tasks — never leave dirty working tree

---

### Task 1: Schema migration — scan_results columns

**Files:**

- Modify: `src/api/db/schema.ts` — add `dependencyKind`, `registryResolved` columns; make `latestVersion`, `latestInRange`, `upgradeType` nullable
- Create: migration file via `drizzle-kit generate`

**Interfaces:**

- Consumes: nothing
- Produces: `scanResults` table with new columns: `dependencyKind: text("dependency_kind").notNull().default("dependency")`, `registryResolved: integer("registry_resolved").notNull().default(1)`, and `latestVersion`/`latestInRange`/`upgradeType` changed from `.notNull()` to nullable

- [ ] **Step 1: Modify scan_results schema**

In `src/api/db/schema.ts`, update the `scanResults` table:

```typescript
export const scanResults = sqliteTable("scan_results", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  currentVersion: text("current_version").notNull(),
  latestVersion: text("latest_version"),
  latestInRange: text("latest_in_range"),
  type: text("type").notNull(),
  upgradeType: text("upgrade_type"),
  dependencyKind: text("dependency_kind").notNull().default("dependency"),
  registryResolved: integer("registry_resolved").notNull().default(1),
  scannedAt: integer("scanned_at").notNull()
});
```

Changes: `latestVersion`, `latestInRange`, `upgradeType` lose `.notNull()`. Two new columns added with defaults so existing rows are valid.

- [ ] **Step 2: Generate migration**

Run: `yarn drizzle-kit generate`

Verify the generated SQL adds columns and alters nullability. SQLite doesn't support ALTER COLUMN — drizzle-kit may generate a table rebuild migration.

- [ ] **Step 3: Fix TypeScript compilation errors**

The nullable columns will break code that assumes non-null values. Run `yarn full` and fix all typecheck errors. Expected locations:

- `src/api/services/jobExecutors/ScanJobExecutor.ts` — insert into scanResults (values now accept null)
- `src/api/routes/projects.ts` — reading latestVersion/upgradeType from query results
- `src/api/routes/packages.ts` — same
- Any test file creating scan_results rows

For existing inserts of direct deps, pass explicit non-null values as before (they're resolved). The nullable columns only accept null for transitive deps (Task 2).

- [ ] **Step 4: Run full checks**

Run: `yarn full`
Expected: all tests pass, build clean

- [ ] **Step 5: Commit**

```bash
git add src/api/db/schema.ts drizzle/
git commit -m "feat(schema): add dependencyKind and registryResolved to scan_results, make registry columns nullable"
```

---

### Task 2: Expand collectDependencyTypes for peer and optional

**Files:**

- Modify: `src/api/services/ScanService.ts` — expand `IPackageJson`, `collectDependencyTypes()`, update `IScanServiceDependency.type`
- Modify: `src/api/services/abstractions/ScanService.ts` — update `IScanServiceDependency` type field
- Test: `src/api/services/__tests__/ScanService.test.ts`

**Interfaces:**

- Consumes: `IPackageJson` in ScanService.ts (private interface)
- Produces: `IScanServiceDependency.type` now includes `"peerDependency" | "optionalDependency"`. `collectDependencyTypes()` returns `Map<string, "dependency" | "devDependency" | "peerDependency" | "optionalDependency">`

- [ ] **Step 1: Write failing test for peer/optional classification**

In `src/api/services/__tests__/ScanService.test.ts`, add a test that verifies peer and optional deps are classified correctly. Need to check existing test patterns first — read the test file to understand how ScanService is tested (may use mocked CommandRunner for PM output).

```typescript
it("classifies peerDependencies from package.json", async () => {
  // Setup: mock package.json with peerDependencies section
  // Setup: mock PM output that includes the peer dep
  // Assert: result.dependencies contains entry with type "peerDependency"
});

it("classifies optionalDependencies from package.json", async () => {
  // Setup: mock package.json with optionalDependencies section
  // Setup: mock PM output that includes the optional dep
  // Assert: result.dependencies contains entry with type "optionalDependency"
});
```

Note: exact test setup depends on existing test patterns — implementer should read the test file to match conventions.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn full`
Expected: fails — peer/optional not classified

- [ ] **Step 3: Update IScanServiceDependency type**

In `src/api/services/abstractions/ScanService.ts`:

```typescript
export interface IScanServiceDependency {
  name: string;
  currentVersion: string;
  latestInRange: string;
  latestVersion: string;
  type: "dependency" | "devDependency" | "peerDependency" | "optionalDependency";
  upgradeType: "patch" | "minor" | "major" | "none";
}
```

- [ ] **Step 4: Expand IPackageJson and collectDependencyTypes**

In `src/api/services/ScanService.ts`, update the private interface:

```typescript
interface IPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}
```

Update `collectDependencyTypes()` to also read peer and optional:

```typescript
private async collectDependencyTypes(
    projectPath: string,
    packageManager: string,
    signal?: AbortSignal
): Promise<Map<string, "dependency" | "devDependency" | "peerDependency" | "optionalDependency">> {
    const types = new Map<string, "dependency" | "devDependency" | "peerDependency" | "optionalDependency">();

    const workspaces = await this.collectWorkspaces(projectPath, packageManager, signal);

    const readResults = await Promise.all(
        workspaces.map(async workspace => {
            const packageJsonPath = join(projectPath, workspace.location, "package.json");
            try {
                const content = await readFile(packageJsonPath, "utf-8");
                return JSON.parse(content) as IPackageJson;
            } catch {
                return null;
            }
        })
    );

    for (const packageJson of readResults) {
        if (!packageJson) {
            continue;
        }

        for (const name of Object.keys(packageJson.dependencies ?? {})) {
            if (!types.has(name)) {
                types.set(name, "dependency");
            }
        }

        for (const name of Object.keys(packageJson.devDependencies ?? {})) {
            if (!types.has(name)) {
                types.set(name, "devDependency");
            }
        }

        for (const name of Object.keys(packageJson.peerDependencies ?? {})) {
            if (!types.has(name)) {
                types.set(name, "peerDependency");
            }
        }

        for (const name of Object.keys(packageJson.optionalDependencies ?? {})) {
            if (!types.has(name)) {
                types.set(name, "optionalDependency");
            }
        }
    }

    return types;
}
```

Priority is maintained by first-write-wins: dependency > devDependency > peerDependency > optionalDependency.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn full`
Expected: all tests pass including new peer/optional tests

- [ ] **Step 6: Commit**

```bash
git add src/api/services/ScanService.ts src/api/services/abstractions/ScanService.ts src/api/services/__tests__/ScanService.test.ts
git commit -m "feat(scan): classify peerDependency and optionalDependency from package.json"
```

---

### Task 3: Persist all installed packages to scan_results

**Files:**

- Modify: `src/api/services/ScanService.ts` — change scan() to return ALL installed packages, not just package.json entries. Transitive deps have null registry data.
- Modify: `src/api/services/abstractions/ScanService.ts` — update `IScanServiceDependency` to allow nullable registry fields
- Modify: `src/api/services/jobExecutors/ScanJobExecutor.ts` — persist `dependencyKind` and `registryResolved` columns
- Test: `src/api/services/__tests__/ScanService.test.ts` — test transitive dep discovery
- Test: `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts` — test new columns persisted

**Interfaces:**

- Consumes: `IScanServiceDependency` with expanded type, `scanResults` schema with new columns
- Produces: `IScanServiceDependency` now has nullable `latestVersion`, `latestInRange`, `upgradeType`. New field `dependencyKind`. `scan()` returns ALL installed packages.

- [ ] **Step 1: Update IScanServiceDependency for nullable registry fields**

In `src/api/services/abstractions/ScanService.ts`:

```typescript
export type DependencyKind =
  "dependency" | "devDependency" | "peerDependency" | "optionalDependency" | "transitive";

export interface IScanServiceDependency {
  name: string;
  currentVersion: string;
  latestInRange: string | null;
  latestVersion: string | null;
  type: "dependency" | "devDependency" | "peerDependency" | "optionalDependency";
  dependencyKind: DependencyKind;
  upgradeType: "patch" | "minor" | "major" | "none" | null;
  registryResolved: boolean;
}
```

Note: `type` stays as the package.json classification (direct/dev/peer/optional only — transitive deps don't have a `type` from package.json). `dependencyKind` is the overall classification including "transitive". For direct/dev/peer/optional deps, `type === dependencyKind`. For transitive, `type` is not applicable — but since it's on the interface, transitive deps should use a sensible value. Better approach: make `type` the same as `dependencyKind`:

```typescript
export interface IScanServiceDependency {
  name: string;
  currentVersion: string;
  latestInRange: string | null;
  latestVersion: string | null;
  dependencyKind: DependencyKind;
  upgradeType: "patch" | "minor" | "major" | "none" | null;
  registryResolved: boolean;
}
```

Remove `type` field entirely — `dependencyKind` supersedes it. The DB `type` column can be kept for backwards compatibility and set to `dependencyKind` value.

Add to namespace:

```typescript
export namespace ScanService {
  // existing...
  export type DependencyKind = import("./ScanService.js").DependencyKind;
}
```

- [ ] **Step 2: Write failing tests for transitive dep discovery**

```typescript
it("includes transitive dependencies in scan results", async () => {
  // Setup: mock PM driver returns installed versions including transitive deps
  //   installedVersions: Map { "direct-pkg" => "1.0.0", "transitive-pkg" => "2.0.0" }
  // Setup: mock package.json only has "direct-pkg" in dependencies
  // Assert: results.dependencies has 2 entries
  // Assert: "direct-pkg" has dependencyKind "dependency", registryResolved true
  // Assert: "transitive-pkg" has dependencyKind "transitive", registryResolved false, null latestVersion
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn full`
Expected: fails — transitive deps not in results

- [ ] **Step 4: Update ScanService.scan() to include transitive deps**

In `src/api/services/ScanService.ts`, after the registry lookup loop for package.json entries (line ~348), add transitive deps:

```typescript
// After existing registry lookup loop...

// Add transitive deps (installed but not in any package.json section)
for (const [name, version] of installedVersions.entries()) {
  if (!dependencyTypes.has(name)) {
    results.push({
      name,
      currentVersion: version,
      latestInRange: null,
      latestVersion: null,
      dependencyKind: "transitive",
      upgradeType: null,
      registryResolved: false
    });
  }
}

// Set dependencyKind on registry-resolved deps
for (const result of results) {
  if (result.dependencyKind === undefined) {
    // These were built in the registry loop above — set their kind
    // (they already have type from dependencyTypes map)
  }
}
```

Actually, cleaner approach: refactor the results-building loop. The existing loop iterates `entries` (package.json deps only). Change it to set `dependencyKind` and `registryResolved` on each result:

```typescript
results.push({
  name,
  currentVersion,
  latestInRange: currentVersion,
  latestVersion,
  dependencyKind: type, // type from dependencyTypes map = "dependency"|"devDependency"|etc.
  upgradeType,
  registryResolved: true
});
```

Then after the loop, add transitive deps as shown above.

Also update the `entries` filter (line 291) — it currently filters to only deps in `dependencyTypes`. Keep this filter for registry lookups only, but still need to collect all installed for the results.

- [ ] **Step 5: Update ScanJobExecutor to persist new columns**

In `src/api/services/jobExecutors/ScanJobExecutor.ts`, update the insert into scanResults (around line 281):

```typescript
await this.databaseClient.db
  .insert(scanResults)
  .values(
    results.map(dependency => ({
      id: generateId(),
      projectId: context.referenceId,
      name: dependency.name,
      currentVersion: dependency.currentVersion,
      latestVersion: dependency.latestVersion,
      latestInRange: dependency.latestInRange,
      type: dependency.dependencyKind,
      upgradeType: dependency.upgradeType,
      dependencyKind: dependency.dependencyKind,
      registryResolved: dependency.registryResolved ? 1 : 0,
      scannedAt
    }))
  )
  .run();
```

- [ ] **Step 6: Fix all typecheck errors from IScanServiceDependency changes**

The `type` field removal and nullable fields will break callers. Key locations:

- `ScanJobExecutor.ts` — `dependency.type` references
- `DependencyChangeService` — `results.map(d => d.name, d.currentVersion)`
- Any test creating `IScanServiceDependency` objects
- UI gateway types that mirror the dependency shape

Run `yarn full` after each fix to track progress.

- [ ] **Step 7: Run full checks**

Run: `yarn full`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/api/services/ScanService.ts src/api/services/abstractions/ScanService.ts src/api/services/jobExecutors/ScanJobExecutor.ts src/api/services/__tests__/ScanService.test.ts src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts
git commit -m "feat(scan): persist all installed packages including transitive to scan_results"
```

---

### Task 4: Add upgrade_jobs progress columns (schema only)

**Files:**

- Modify: `src/api/db/schema.ts` — add `progress` and `progressLabel` columns to upgradeJobs
- Create: migration file via `drizzle-kit generate`

**Interfaces:**

- Consumes: nothing
- Produces: `upgradeJobs` table with `progress: integer("progress")` (nullable) and `progressLabel: text("progress_label")` (nullable)

- [ ] **Step 1: Add columns to upgradeJobs schema**

In `src/api/db/schema.ts`, add to the `upgradeJobs` table definition:

```typescript
progress: integer("progress"),
progressLabel: text("progress_label")
```

Both nullable — null means indeterminate progress (existing behavior).

- [ ] **Step 2: Generate migration**

Run: `yarn drizzle-kit generate`

- [ ] **Step 3: Run full checks**

Run: `yarn full`
Expected: all tests pass — columns are nullable, no code reads them yet

- [ ] **Step 4: Commit**

```bash
git add src/api/db/schema.ts drizzle/
git commit -m "feat(schema): add progress and progressLabel columns to upgrade_jobs"
```
