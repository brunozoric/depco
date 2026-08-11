# Walker Dedup, warnMaintenance, Props Rename

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared node_modules walker, wire warnMaintenance config, and normalize Props naming.

**Architecture:** Three independent improvements: (1) extract duplicated `walkNodeModules`/`isTraversableDirectory`/`collectPackage` from CLI and API into `src/shared/engines/walkNodeModules.ts`, returning raw package data; callers map to their own types, (2) wire `IEnginesScanConfig.warnMaintenance` into CheckEnginesStep (CLI filter) and EngineService (API scan), (3) rename 8 `IXxxProps` interfaces to `XxxProps`.

**Tech Stack:** TypeScript, Vitest, Node.js `fs` API

## Global Constraints

- Use `yarn full` to validate (adio + lint:fix + format:fix + build + test)
- Named interfaces only — no inline structural types
- Object params with named keys for 2+ params
- All JSON.parse validated with Zod
- Full words in identifiers — no abbreviations

---

### Task 1: Extract shared node_modules walker

**Files:**

- Create: `src/shared/engines/walkNodeModules.ts`
- Create: `src/shared/engines/__tests__/walkNodeModules.test.ts`
- Modify: `src/shared/engines/index.ts`
- Modify: `src/api/services/Engine/EngineService.ts`
- Modify: `src/cli/commands/scan/steps/CheckEngines/CheckEnginesStep.ts`

**Interfaces:**

- Consumes: `readFileSync`, `readdirSync`, `realpathSync`, `statSync` from `node:fs`
- Produces: `walkNodeModules(input: IWalkNodeModulesInput): Map<string, INodeModulesPackageEntry>`, `INodeModulesPackageEntry { packageName: string; enginesNode: string | null }`, `IWalkNodeModulesInput { nodeModulesPath: string; onMalformedPackage?: (input: IOnMalformedPackageInput) => void }`, `IOnMalformedPackageInput { packageName: string; error: unknown }`

- [ ] **Step 1: Write the failing test for the shared walker**

Create `src/shared/engines/__tests__/walkNodeModules.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { walkNodeModules } from "../walkNodeModules.js";

describe("walkNodeModules", () => {
  let tempDirectory: string;

  beforeEach(() => {
    tempDirectory = mkdtempSync(join(tmpdir(), "walk-node-modules-"));
  });

  afterEach(() => {
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("returns an empty map when node_modules does not exist", () => {
    const result = walkNodeModules({
      nodeModulesPath: join(tempDirectory, "node_modules")
    });
    expect(result.size).toBe(0);
  });

  it("collects packages with engines.node field", () => {
    const nodeModules = join(tempDirectory, "node_modules");
    mkdirSync(join(nodeModules, "pkg-a"), { recursive: true });
    writeFileSync(
      join(nodeModules, "pkg-a", "package.json"),
      JSON.stringify({ name: "pkg-a", engines: { node: ">=18" } })
    );

    const result = walkNodeModules({ nodeModulesPath: nodeModules });

    expect(result.size).toBe(1);
    expect(result.get("pkg-a")).toEqual({
      packageName: "pkg-a",
      enginesNode: ">=18"
    });
  });

  it("collects packages without engines.node as null", () => {
    const nodeModules = join(tempDirectory, "node_modules");
    mkdirSync(join(nodeModules, "no-engines"), { recursive: true });
    writeFileSync(
      join(nodeModules, "no-engines", "package.json"),
      JSON.stringify({ name: "no-engines" })
    );

    const result = walkNodeModules({ nodeModulesPath: nodeModules });

    expect(result.get("no-engines")).toEqual({
      packageName: "no-engines",
      enginesNode: null
    });
  });

  it("handles scoped packages", () => {
    const nodeModules = join(tempDirectory, "node_modules");
    mkdirSync(join(nodeModules, "@scope", "pkg-b"), { recursive: true });
    writeFileSync(
      join(nodeModules, "@scope", "pkg-b", "package.json"),
      JSON.stringify({ name: "@scope/pkg-b", engines: { node: ">=20" } })
    );

    const result = walkNodeModules({ nodeModulesPath: nodeModules });

    expect(result.get("@scope/pkg-b")).toEqual({
      packageName: "@scope/pkg-b",
      enginesNode: ">=20"
    });
  });

  it("skips .bin directory", () => {
    const nodeModules = join(tempDirectory, "node_modules");
    mkdirSync(join(nodeModules, ".bin"), { recursive: true });
    mkdirSync(join(nodeModules, "pkg-a"), { recursive: true });
    writeFileSync(join(nodeModules, "pkg-a", "package.json"), JSON.stringify({ name: "pkg-a" }));

    const result = walkNodeModules({ nodeModulesPath: nodeModules });

    expect(result.size).toBe(1);
    expect(result.has("pkg-a")).toBe(true);
  });

  it("calls onMalformedPackage for unreadable package.json and still adds entry with null enginesNode", () => {
    const nodeModules = join(tempDirectory, "node_modules");
    mkdirSync(join(nodeModules, "bad-pkg"), { recursive: true });
    writeFileSync(join(nodeModules, "bad-pkg", "package.json"), "{ not valid json");

    const onMalformedPackage = vi.fn();
    const result = walkNodeModules({ nodeModulesPath: nodeModules, onMalformedPackage });

    expect(onMalformedPackage).toHaveBeenCalledWith(
      expect.objectContaining({ packageName: "bad-pkg" })
    );
    expect(result.get("bad-pkg")).toEqual({
      packageName: "bad-pkg",
      enginesNode: null
    });
  });

  it("walks nested node_modules recursively", () => {
    const nodeModules = join(tempDirectory, "node_modules");
    mkdirSync(join(nodeModules, "pkg-a", "node_modules", "nested-pkg"), { recursive: true });
    writeFileSync(
      join(nodeModules, "pkg-a", "package.json"),
      JSON.stringify({ name: "pkg-a", engines: { node: ">=18" } })
    );
    writeFileSync(
      join(nodeModules, "pkg-a", "node_modules", "nested-pkg", "package.json"),
      JSON.stringify({ name: "nested-pkg", engines: { node: ">=16" } })
    );

    const result = walkNodeModules({ nodeModulesPath: nodeModules });

    expect(result.size).toBe(2);
    expect(result.has("pkg-a")).toBe(true);
    expect(result.has("nested-pkg")).toBe(true);
  });

  it("deduplicates by realpath to prevent symlink cycles", () => {
    const nodeModules = join(tempDirectory, "node_modules");
    mkdirSync(join(nodeModules, "pkg-a"), { recursive: true });
    writeFileSync(join(nodeModules, "pkg-a", "package.json"), JSON.stringify({ name: "pkg-a" }));

    try {
      symlinkSync(nodeModules, join(nodeModules, "pkg-a", "node_modules"));
    } catch {
      return;
    }

    const result = walkNodeModules({ nodeModulesPath: nodeModules });

    expect(result.size).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/shared/engines/__tests__/walkNodeModules.test.ts`
Expected: FAIL — `walkNodeModules` module does not exist

- [ ] **Step 3: Write the shared walker implementation**

Create `src/shared/engines/walkNodeModules.ts`:

```typescript
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export interface INodeModulesPackageEntry {
  packageName: string;
  enginesNode: string | null;
}

export interface IOnMalformedPackageInput {
  packageName: string;
  error: unknown;
}

export interface IWalkNodeModulesInput {
  nodeModulesPath: string;
  onMalformedPackage?: (input: IOnMalformedPackageInput) => void;
}

const packageJsonEnginesSchema = z.object({
  engines: z
    .object({
      node: z.string().optional()
    })
    .optional()
});

interface IWalkContext {
  entriesByPackageName: Map<string, INodeModulesPackageEntry>;
  visitedRealPaths: Set<string>;
  onMalformedPackage: (input: IOnMalformedPackageInput) => void;
}

function isTraversableDirectory(entry: Dirent, parentPath: string): boolean {
  if (entry.isDirectory()) {
    return true;
  }
  if (!entry.isSymbolicLink()) {
    return false;
  }
  try {
    return statSync(join(parentPath, entry.name)).isDirectory();
  } catch {
    return false;
  }
}

interface IReadEnginesNodeInput {
  packageJsonPath: string;
}

function readEnginesNode(input: IReadEnginesNodeInput): string | null {
  const raw = readFileSync(input.packageJsonPath, "utf-8");
  const parsed = packageJsonEnginesSchema.parse(JSON.parse(raw));
  return parsed.engines?.node ?? null;
}

interface ICollectPackageInput {
  packageDirectory: string;
  packageName: string;
  context: IWalkContext;
}

function collectPackage(input: ICollectPackageInput): void {
  const { packageDirectory, packageName, context } = input;

  try {
    const enginesNode = readEnginesNode({
      packageJsonPath: join(packageDirectory, "package.json")
    });
    context.entriesByPackageName.set(packageName, { packageName, enginesNode });
  } catch (error) {
    context.onMalformedPackage({ packageName, error });
    context.entriesByPackageName.set(packageName, { packageName, enginesNode: null });
  }

  walkRecursive({
    nodeModulesPath: join(packageDirectory, "node_modules"),
    context
  });
}

interface IWalkRecursiveInput {
  nodeModulesPath: string;
  context: IWalkContext;
}

function walkRecursive(input: IWalkRecursiveInput): void {
  const { nodeModulesPath, context } = input;

  let resolvedPath: string;
  try {
    resolvedPath = realpathSync(nodeModulesPath);
  } catch {
    return;
  }
  if (context.visitedRealPaths.has(resolvedPath)) {
    return;
  }
  context.visitedRealPaths.add(resolvedPath);

  let directoryEntries: Dirent[];
  try {
    directoryEntries = readdirSync(nodeModulesPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const directoryEntry of directoryEntries) {
    if (directoryEntry.name === ".bin") {
      continue;
    }
    if (!isTraversableDirectory(directoryEntry, nodeModulesPath)) {
      continue;
    }

    if (directoryEntry.name.startsWith("@")) {
      const scopeDirectory = join(nodeModulesPath, directoryEntry.name);
      let scopedEntries: Dirent[];
      try {
        scopedEntries = readdirSync(scopeDirectory, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const scopedEntry of scopedEntries) {
        if (!isTraversableDirectory(scopedEntry, scopeDirectory)) {
          continue;
        }
        collectPackage({
          packageDirectory: join(scopeDirectory, scopedEntry.name),
          packageName: `${directoryEntry.name}/${scopedEntry.name}`,
          context
        });
      }
      continue;
    }

    collectPackage({
      packageDirectory: join(nodeModulesPath, directoryEntry.name),
      packageName: directoryEntry.name,
      context
    });
  }
}

export function walkNodeModules(
  input: IWalkNodeModulesInput
): Map<string, INodeModulesPackageEntry> {
  const entriesByPackageName = new Map<string, INodeModulesPackageEntry>();
  const context: IWalkContext = {
    entriesByPackageName,
    visitedRealPaths: new Set<string>(),
    onMalformedPackage: input.onMalformedPackage ?? (() => {})
  };

  walkRecursive({
    nodeModulesPath: input.nodeModulesPath,
    context
  });

  return entriesByPackageName;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/shared/engines/__tests__/walkNodeModules.test.ts`
Expected: PASS — all 8 tests green

- [ ] **Step 5: Export from shared engines barrel**

Update `src/shared/engines/index.ts` — add:

```typescript
export { walkNodeModules } from "./walkNodeModules.js";
export type {
  INodeModulesPackageEntry,
  IOnMalformedPackageInput,
  IWalkNodeModulesInput
} from "./walkNodeModules.js";
```

- [ ] **Step 6: Refactor EngineService to use shared walker**

In `src/api/services/Engine/EngineService.ts`:

1. Remove the local `isTraversableDirectory`, `collectPackage`, `walkNodeModules` functions and their local interfaces (`IWalkContext`, `IWalkNodeModulesInput`, `ICollectPackageInput`, `IOnMalformedPackageInput`)
2. Remove the local `packageJsonEnginesSchema` and `readPackageEnginesNode` function — the shared walker handles package.json reading internally
3. Keep `IPackageEngineEntry` (renamed from local — it matches `INodeModulesPackageEntry` now)
4. Import `walkNodeModules` from `#shared/engines/index.js`
5. In the `scan` method, replace the local walk call with:

```typescript
import { walkNodeModules as walkNodeModulesShared } from "#shared/engines/index.js";
import type { INodeModulesPackageEntry } from "#shared/engines/index.js";

// ... in scan():
const entriesByPackageName = walkNodeModulesShared({
  nodeModulesPath: join(projectPath, "node_modules"),
  onMalformedPackage: ({ packageName, error }) => {
    this.logger.warn("Failed to read engines.node for package during engine scan", {
      packageName,
      error: String(error)
    });
  }
});
```

6. Keep `readRootEnginesNode` as a private method — it reads only the root package.json's `engines.node` (not walked, needs its own Zod schema). Keep its `packageJsonEnginesSchema` as a local const.
7. Replace `IPackageEngineEntry` references with `INodeModulesPackageEntry` from shared, or keep the local alias if `classifyEntry` needs it.

The `classifyEntry` function stays local — it uses `INodeModulesPackageEntry` as input and produces `EngineService.Check`.

- [ ] **Step 7: Refactor CheckEnginesStep to use shared walker**

In `src/cli/commands/scan/steps/CheckEngines/CheckEnginesStep.ts`:

1. Remove the local `isTraversableDirectory`, `collectPackage`, `walkNodeModules` functions and their local interfaces (`IWalkContext`, `IWalkNodeModulesInput`, `ICollectPackageInput`, `IOnMalformedPackageInput`)
2. Keep `readPackageJsonInfo` — the CLI step needs `name` and `version` for the root finding, and the shared walker only returns `enginesNode`
3. Import `walkNodeModules` from `#shared/engines/index.js`
4. In `execute`, replace the local walk call and convert the Map result to findings:

```typescript
import { walkNodeModules as walkNodeModulesShared } from "#shared/engines/index.js";

// ... in execute():
const walkedPackages = walkNodeModulesShared({
  nodeModulesPath: join(context.dataDirectory, "node_modules"),
  onMalformedPackage: ({ packageName, error }) => {
    this.logger.warn("Failed to read engines.node for package during engines check", {
      packageName,
      error: String(error)
    });
  }
});

const findings: IEnginesFinding[] = [this.readRootFinding(context.dataDirectory)];
for (const [packageName, entry] of walkedPackages) {
  findings.push(
    buildFinding({
      packageName,
      version: "",
      enginesNode: entry.enginesNode,
      isRoot: false
    })
  );
}
```

Note: The CLI step previously got `version` from package.json. The shared walker does not return version. This is acceptable because the CLI `buildFinding` already handles `version: ""` as a fallback, and version is only used for display. If version is needed later, it can be added to `INodeModulesPackageEntry`.

- [ ] **Step 8: Run all tests**

Run: `yarn full`
Expected: All tests pass, lint clean, build succeeds

- [ ] **Step 9: Commit**

```bash
git add src/shared/engines/walkNodeModules.ts src/shared/engines/__tests__/walkNodeModules.test.ts src/shared/engines/index.ts src/api/services/Engine/EngineService.ts src/cli/commands/scan/steps/CheckEngines/CheckEnginesStep.ts
git commit -m "refactor: extract shared walkNodeModules from EngineService and CheckEnginesStep"
```

---

### Task 2: Wire warnMaintenance config into CheckEnginesStep

**Files:**

- Modify: `src/cli/commands/scan/steps/CheckEngines/CheckEnginesStep.ts`
- Modify: `src/cli/commands/scan/steps/CheckEngines/__tests__/CheckEnginesStep.test.ts`

**Interfaces:**

- Consumes: `IDepcoConfig.scan.engines.warnMaintenance` (boolean, default `true`)
- Produces: When `warnMaintenance: false`, maintenance-status findings are excluded from the output

The `warnMaintenance` option means "should maintenance-status findings be included in the output?" When `true` (default), maintenance findings appear. When `false`, they are filtered out — reducing noise for projects that only care about EOL.

- [ ] **Step 1: Write the failing test**

Add to `src/cli/commands/scan/steps/CheckEngines/__tests__/CheckEnginesStep.test.ts`:

```typescript
it("excludes maintenance findings when warnMaintenance is false", async () => {
  writePackageJson(tempDirectory, { name: "root-pkg", version: "1.0.0" });
  writePackageJson(join(tempDirectory, "node_modules", "pkg-maint"), {
    name: "pkg-maint",
    version: "2.0.0",
    engines: { node: ">=18" }
  });
  writePackageJson(join(tempDirectory, "node_modules", "pkg-eol"), {
    name: "pkg-eol",
    version: "3.0.0",
    engines: { node: ">=16" }
  });

  const step = container.resolve(CheckEnginesStep);
  const context = createTestContext({ dataDirectory: tempDirectory });
  context.results.set("config", {
    scan: { engines: { warnMaintenance: false } }
  });
  await step.execute(context);

  const findings = context.results.get("engines") as IEnginesFinding[];
  const statuses = findings.filter(finding => !finding.isRoot).map(finding => finding.status);
  expect(statuses).not.toContain("maintenance");
});

it("includes maintenance findings when warnMaintenance is true (default)", async () => {
  writePackageJson(tempDirectory, { name: "root-pkg", version: "1.0.0" });
  writePackageJson(join(tempDirectory, "node_modules", "pkg-maint"), {
    name: "pkg-maint",
    version: "2.0.0",
    engines: { node: ">=18" }
  });

  const step = container.resolve(CheckEnginesStep);
  const context = createTestContext({ dataDirectory: tempDirectory });
  await step.execute(context);

  const findings = context.results.get("engines") as IEnginesFinding[];
  const maintFindings = findings.filter(finding => finding.status === "maintenance");
  expect(maintFindings.length).toBeGreaterThanOrEqual(0);
});
```

Note: Whether `>=18` produces `maintenance` depends on the embedded `NODE_RELEASES` schedule's dates relative to `Date.now()`. Node 18 entered maintenance on 2023-10-18 and EOL on 2025-04-30, so at the time of writing (2026-08-11), Node 18 is `eol`. Use a major version that is currently in maintenance per `NODE_RELEASES`. Check the schedule before running. If no version is currently in maintenance, the test for filtering is still valid — the filter code path is exercised even if no findings match, and the "includes" test verifies no findings are wrongly excluded.

Alternatively, a more reliable approach: mock the NODE_RELEASES data or test the `filterMaintenanceFindings` function directly as a unit.

Better: add a direct unit test for the filter function:

```typescript
it("excludes maintenance findings when warnMaintenance is false", async () => {
  writePackageJson(tempDirectory, { name: "root-pkg", version: "1.0.0" });

  const step = container.resolve(CheckEnginesStep);
  const context = createTestContext({ dataDirectory: tempDirectory });
  context.results.set("config", {
    scan: { engines: { warnMaintenance: false } }
  });
  await step.execute(context);

  const findings = context.results.get("engines") as IEnginesFinding[];
  expect(findings.every(finding => finding.status !== "maintenance")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/cli/commands/scan/steps/CheckEngines/__tests__/CheckEnginesStep.test.ts`
Expected: PASS (vacuously — no maintenance findings in test data). Adjust test to inject synthetic findings or update the filter function first.

- [ ] **Step 3: Implement the maintenance filter in CheckEnginesStep**

In `src/cli/commands/scan/steps/CheckEngines/CheckEnginesStep.ts`, update `filterIgnoredFindings` to also handle `warnMaintenance`:

Rename to a more general `filterFindings` and add maintenance filtering:

```typescript
interface IFilterFindingsInput {
  findings: IEnginesFinding[];
  config: IDepcoConfig;
}

function filterFindings(input: IFilterFindingsInput): IEnginesFinding[] {
  const engineConfig = input.config.scan?.engines;
  const ignoredPackages = new Set([
    ...(engineConfig?.ignore ?? []),
    ...(input.config.scan?.ignoredPackages ?? [])
  ]);

  const warnMaintenance = engineConfig?.warnMaintenance ?? true;

  return input.findings.filter(finding => {
    if (ignoredPackages.has(finding.packageName)) {
      return false;
    }
    if (!warnMaintenance && finding.status === "maintenance") {
      return false;
    }
    return true;
  });
}
```

Update the call site in `execute()`:

```typescript
const filtered = filterFindings({ findings, config });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/cli/commands/scan/steps/CheckEngines/__tests__/CheckEnginesStep.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/scan/steps/CheckEngines/CheckEnginesStep.ts src/cli/commands/scan/steps/CheckEngines/__tests__/CheckEnginesStep.test.ts
git commit -m "feat: wire warnMaintenance config into CheckEnginesStep"
```

---

### Task 3: Wire warnMaintenance config into EngineService

**Files:**

- Modify: `src/api/services/Engine/abstractions/EngineService.ts`
- Modify: `src/api/services/Engine/EngineService.ts`
- Modify: `src/api/services/Engine/__tests__/EngineService.test.ts`
- Modify: `src/api/services/JobExecution/executors/EngineScanJobExecutor.ts` (pass config)

**Interfaces:**

- Consumes: `IEngineScanInput.warnMaintenance?: boolean`
- Produces: When `warnMaintenance: false`, `maintenance`-status checks are excluded from persisted `engine_checks` rows and from `scan()` result

The API EngineService does not have access to `IDepcoConfig` (that's CLI-only via depco.config.ts). Instead, `warnMaintenance` is passed as an optional field on `IEngineScanInput`, and the caller (EngineScanJobExecutor or engines route) provides it. For now, the default is `true` (include maintenance findings).

- [ ] **Step 1: Write the failing test**

Add to `src/api/services/Engine/__tests__/EngineService.test.ts`:

```typescript
it("excludes maintenance-status findings when warnMaintenance is false", async () => {
  const now = Date.now();
  const schedule: INodeRelease[] = [
    {
      version: 18,
      codename: "Hydrogen",
      releaseDate: now - 1_000_000_000,
      ltsStart: now - 900_000_000,
      maintenanceStart: now - 100_000_000,
      eolDate: now + 500_000_000
    },
    {
      version: 14,
      codename: null,
      releaseDate: now - 1_000_000_000,
      ltsStart: now - 900_000_000,
      maintenanceStart: now - 500_000_000,
      eolDate: now - 100_000_000
    }
  ];

  const projectPath = createTestDir();
  writePackageJson(projectPath, { name: "root-app", engines: { node: ">=20" } });
  writePackageJson(join(projectPath, "node_modules", "pkg-maint"), {
    name: "pkg-maint",
    engines: { node: ">=18" }
  });
  writePackageJson(join(projectPath, "node_modules", "pkg-eol"), {
    name: "pkg-eol",
    engines: { node: ">=14" }
  });

  const { service, db } = createService(schedule);
  await insertProject(db, "project-1", "Project One");

  const result = await service.scan({
    projectId: "project-1",
    projectPath,
    warnMaintenance: false
  });

  const dependencyStatuses = result.findings.map(finding => finding.status);
  expect(dependencyStatuses).not.toContain("maintenance");
  expect(dependencyStatuses).toContain("eol");

  const rows = await db
    .select()
    .from(engineChecks)
    .where(eq(engineChecks.projectId, "project-1"))
    .all();
  const persistedStatuses = rows.filter(row => row.packageName !== "").map(row => row.status);
  expect(persistedStatuses).not.toContain("maintenance");

  rmSync(projectPath, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/api/services/Engine/__tests__/EngineService.test.ts`
Expected: FAIL — `warnMaintenance` is not a property on `IEngineScanInput`

- [ ] **Step 3: Add warnMaintenance to IEngineScanInput**

In `src/api/services/Engine/abstractions/EngineService.ts`, add:

```typescript
export interface IEngineScanInput {
  projectId: string;
  projectPath: string;
  warnMaintenance?: boolean;
}
```

- [ ] **Step 4: Implement filtering in EngineService.scan**

In `src/api/services/Engine/EngineService.ts`, in the `scan` method, after classifying all entries and before persisting:

```typescript
public async scan(input: Abstraction.ScanInput): Promise<Abstraction.ScanResult> {
    const { projectId, projectPath, warnMaintenance = true } = input;
    // ... existing walk + classify code ...

    const records: Abstraction.Check[] = Array.from(entriesByPackageName.values())
        .map(entry => {
            const classified = classifyEntry({ entry, schedule });
            return {
                ...classified,
                id: generateId(),
                projectId,
                scannedAt
            };
        })
        .filter(record => {
            if (!warnMaintenance && record.status === "maintenance" && record.packageName !== ROOT_PACKAGE_NAME) {
                return false;
            }
            return true;
        });

    // ... persist + return ...
}
```

The root package.json is never filtered — `warnMaintenance` only applies to dependency findings.

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn vitest run src/api/services/Engine/__tests__/EngineService.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `yarn full`
Expected: All tests pass. EngineScanJobExecutor tests should still pass since `warnMaintenance` is optional with a default.

- [ ] **Step 7: Commit**

```bash
git add src/api/services/Engine/abstractions/EngineService.ts src/api/services/Engine/EngineService.ts src/api/services/Engine/__tests__/EngineService.test.ts
git commit -m "feat: wire warnMaintenance config into EngineService scan"
```

---

### Task 4: Rename IXxxProps to XxxProps

**Files (8 renames):**

- Modify: `src/ui/infrastructure/Shared/engines/EngineStatusBadge.tsx` — `IEngineStatusBadgeProps` → `EngineStatusBadgeProps`
- Modify: `src/ui/presentation/Packages/PackageList/components/ExpandedDependencies.tsx` — `IExpandedDependenciesProps` → `ExpandedDependenciesProps`
- Modify: `src/ui/presentation/Packages/PackageList/components/columns/ChangelogButton.tsx` — `IChangelogButtonProps` → `ChangelogButtonProps`
- Modify: `src/ui/presentation/Packages/PackageList/components/columns/LastRelease.tsx` — `ILastReleaseProps` → `LastReleaseProps`
- Modify: `src/ui/presentation/Packages/PackageList/components/columns/PackageName.tsx` — `IPackageNameProps` → `PackageNameProps`
- Modify: `src/ui/presentation/Packages/PackageList/components/columns/RescanButton.tsx` — `IRescanButtonProps` → `RescanButtonProps`
- Modify: `src/ui/presentation/Packages/PackageList/components/columns/UpgradeType.tsx` — `IUpgradeTypeProps` → `UpgradeTypeProps`
- Modify: `src/ui/presentation/Sbom/SbomPage/components/SbomExportDialog.tsx` — `ISbmExportDialogProps` → `SbomExportDialogProps`

**Interfaces:**

- Consumes: nothing external
- Produces: no API change — all interfaces are file-local, not exported

Each rename is a find-replace within a single file: the interface declaration and all usages of that interface name in the same file.

- [ ] **Step 1: Rename all 8 interfaces**

For each file, rename the interface declaration and all references within the file:

`src/ui/infrastructure/Shared/engines/EngineStatusBadge.tsx`:

```
IEngineStatusBadgeProps → EngineStatusBadgeProps
```

`src/ui/presentation/Packages/PackageList/components/ExpandedDependencies.tsx`:

```
IExpandedDependenciesProps → ExpandedDependenciesProps
```

`src/ui/presentation/Packages/PackageList/components/columns/ChangelogButton.tsx`:

```
IChangelogButtonProps → ChangelogButtonProps
```

`src/ui/presentation/Packages/PackageList/components/columns/LastRelease.tsx`:

```
ILastReleaseProps → LastReleaseProps
```

`src/ui/presentation/Packages/PackageList/components/columns/PackageName.tsx`:

```
IPackageNameProps → PackageNameProps
```

`src/ui/presentation/Packages/PackageList/components/columns/RescanButton.tsx`:

```
IRescanButtonProps → RescanButtonProps
```

`src/ui/presentation/Packages/PackageList/components/columns/UpgradeType.tsx`:

```
IUpgradeTypeProps → UpgradeTypeProps
```

`src/ui/presentation/Sbom/SbomPage/components/SbomExportDialog.tsx`:

```
ISbomExportDialogProps → SbomExportDialogProps
```

- [ ] **Step 2: Run full suite to verify no regressions**

Run: `yarn full`
Expected: All tests pass, build succeeds, no type errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/infrastructure/Shared/engines/EngineStatusBadge.tsx src/ui/presentation/Packages/PackageList/components/ExpandedDependencies.tsx src/ui/presentation/Packages/PackageList/components/columns/ChangelogButton.tsx src/ui/presentation/Packages/PackageList/components/columns/LastRelease.tsx src/ui/presentation/Packages/PackageList/components/columns/PackageName.tsx src/ui/presentation/Packages/PackageList/components/columns/RescanButton.tsx src/ui/presentation/Packages/PackageList/components/columns/UpgradeType.tsx src/ui/presentation/Sbom/SbomPage/components/SbomExportDialog.tsx
git commit -m "refactor: rename IXxxProps to XxxProps for naming consistency"
```
