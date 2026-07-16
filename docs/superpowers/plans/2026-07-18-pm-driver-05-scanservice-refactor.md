# PM Driver 05 — ScanService Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor ScanService to use drivers for `collectInstalledVersions` and `collectWorkspaces` instead of hardcoded PM branching. Remove parser functions that moved to drivers. Update `getPackageInfo` call to pass `packageManager`.

**Architecture:** No interface change to ScanService. Internal refactor — `collectInstalledVersions` and `collectWorkspaces` dispatch to `registry.getDriver(pm)`. Parser functions (`parseYarnInfo`, `parseNpmLs`, `parsePnpmList`, `parseWorkspacesList`) are deleted — they now live in driver implementations. `collectWorkspacesFromPackageJson` and `globWorkspacePattern` stay (filesystem utilities, not PM-specific).

**Tech Stack:** TypeScript, @webiny/di, Vitest

## Global Constraints

- TypeScript 7 strict, ESM
- DI via `@webiny/di`
- `PackageManagerDriverRegistry` is available as a DI singleton
- `RegistryCacheService.getPackageInfo` now takes `(name, packageManager, force?)` (from Plan 04)
- Run `yarn full` after last task

---

### Task 1: Refactor ScanService internals + update tests

**Files:**

- Modify: `src/api/services/ScanService.ts`
- Modify: `src/api/services/__tests__/ScanService.test.ts`

**Interfaces:**

- Consumes: `PackageManagerDriverRegistry`, `CommandRunner`, `RegistryCacheService` (updated interface from Plan 04)
- Produces: Same `ScanService.Interface` (no breaking changes)

- [ ] **Step 1: Refactor ScanService.ts**

Major changes:

1. Add `PackageManagerDriverRegistry` as constructor dep
2. Delete interfaces: `IYarnInfoEntry`, `INpmLsEntry`, `INpmLsOutput`, `IPnpmListEntry`
3. Delete functions: `parseYarnInfo`, `parseNpmLs`, `parsePnpmList`, `parseWorkspacesList`
4. Refactor `collectInstalledVersions` to use driver
5. Refactor `collectWorkspaces` to use driver
6. Update `scan()` method's `getPackageInfo` call to pass `packageManager`

Keep: `IWorkspaceEntry`, `IPackageJson`, `classifyUpgrade`, `globWorkspacePattern`, `collectWorkspacesFromPackageJson`, `collectDependencyTypes`, `LOOKUP_CONCURRENCY`

The `collectInstalledVersions` and `collectWorkspaces` functions currently take `commandRunner` as a param (they're module-level, not class methods). After refactor, they should become instance methods of `ScanServiceImpl` to access `this.registry` and `this.commandRunner`, OR take `registry` as an additional param. Making them instance methods is cleaner.

Refactored `ScanServiceImpl`:

```typescript
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { ScanService as Abstraction } from "./abstractions/ScanService.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";
import { RegistryCacheService } from "./abstractions/RegistryCacheService.js";
import { PackageManagerDriverRegistry } from "./packageManagers/abstractions/PackageManagerDriverRegistry.js";

interface IWorkspaceEntry {
  location: string;
}

interface IPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}

const LOOKUP_CONCURRENCY = 10;

function classifyUpgrade(currentVersion: string, latestVersion: string): string {
  // Keep existing implementation exactly as-is
  // (copy from current ScanService.ts lines 38-60)
}

async function globWorkspacePattern(root: string, pattern: string): Promise<string[]> {
  // Keep existing implementation exactly as-is
  // (copy from current ScanService.ts lines 176-236)
}

async function collectWorkspacesFromPackageJson(projectPath: string): Promise<IWorkspaceEntry[]> {
  // Keep existing implementation exactly as-is
  // (copy from current ScanService.ts lines 241-273)
}

class ScanServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly commandRunner: CommandRunner.Interface,
    private readonly registryCacheService: RegistryCacheService.Interface,
    private readonly registry: PackageManagerDriverRegistry.Interface
  ) {}

  private async collectInstalledVersions(
    projectPath: string,
    packageManager: string,
    signal?: AbortSignal
  ): Promise<Map<string, string>> {
    const driver = this.registry.getDriver(packageManager);
    const { command, args } = driver.installedVersionsCommand();
    const result = await this.commandRunner.run(command, args, {
      cwd: projectPath,
      ...(signal ? { signal } : {})
    });
    return driver.parseInstalledVersions(result.stdout);
  }

  private async collectWorkspaces(
    projectPath: string,
    packageManager: string,
    signal?: AbortSignal
  ): Promise<IWorkspaceEntry[]> {
    const driver = this.registry.getDriver(packageManager);
    const cmd = driver.workspacesCommand();
    if (cmd) {
      try {
        const result = await this.commandRunner.run(cmd.command, cmd.args, {
          cwd: projectPath,
          ...(signal ? { signal } : {})
        });
        return driver.parseWorkspaces(result.stdout);
      } catch {
        return [{ location: "." }];
      }
    }
    return collectWorkspacesFromPackageJson(projectPath);
  }

  private async collectDependencyTypes(
    projectPath: string,
    packageManager: string,
    signal?: AbortSignal
  ): Promise<Map<string, "dependency" | "devDependency">> {
    const types = new Map<string, "dependency" | "devDependency">();

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
    }

    return types;
  }

  public async scan(
    projectPath: string,
    packageManager: string,
    force?: boolean,
    onProgress?: (packageName: string, current: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<Abstraction.Dependency[]> {
    const [installedVersions, dependencyTypes] = await Promise.all([
      this.collectInstalledVersions(projectPath, packageManager, signal),
      this.collectDependencyTypes(projectPath, packageManager, signal)
    ]);

    const entries = Array.from(dependencyTypes.entries()).filter(([name]) =>
      installedVersions.has(name)
    );

    const results: Abstraction.Dependency[] = [];
    const total = entries.length;
    let processed = 0;

    for (let i = 0; i < entries.length; i += LOOKUP_CONCURRENCY) {
      const batch = entries.slice(i, i + LOOKUP_CONCURRENCY);
      const infos = await Promise.all(
        batch.map(async ([name]) => {
          const info = await this.registryCacheService.getPackageInfo(name, packageManager, force);
          processed++;
          onProgress?.(name, processed, total);
          return info;
        })
      );

      for (let j = 0; j < batch.length; j++) {
        const [name, type] = batch[j]!;
        const currentVersion = installedVersions.get(name)!;
        const latestVersion = infos[j]!.latestVersion || currentVersion;
        const upgradeType = classifyUpgrade(currentVersion, latestVersion);

        if (upgradeType === "none") {
          continue;
        }

        results.push({
          name,
          currentVersion,
          latestInRange: currentVersion,
          latestVersion,
          type,
          upgradeType
        });
      }
    }

    return results;
  }
}

export const ScanService = Abstraction.createImplementation({
  implementation: ScanServiceImpl,
  dependencies: [CommandRunner, RegistryCacheService, PackageManagerDriverRegistry]
});
```

Important: Copy `classifyUpgrade`, `globWorkspacePattern`, and `collectWorkspacesFromPackageJson` verbatim from the current file. Do NOT modify them.

- [ ] **Step 2: Update ScanService tests**

In `src/api/services/__tests__/ScanService.test.ts`:

Add import:

```typescript
import { PackageManagerDriverRegistry as RegistryRegistration } from "../packageManagers/PackageManagerDriverRegistry.js";
```

In `beforeEach`, add after existing registrations:

```typescript
container.register(RegistryRegistration).inSingletonScope();
```

Update any `registryCacheService.getPackageInfo` mock setup if the test constructs mock directly — it now takes `(name, packageManager, force?)` instead of `(name, force?)`.

- [ ] **Step 3: Run ScanService tests**

Run: `yarn test src/api/services/__tests__/ScanService.test.ts`
Expected: all PASS

- [ ] **Step 4: Commit**

Note: `yarn full` may still fail if JobWorker hasn't been updated yet (Plan 06). Commit this change alone.

```bash
git add src/api/services/ScanService.ts src/api/services/__tests__/ScanService.test.ts
git commit -m "refactor: ScanService delegates to driver registry, removes parser functions"
```
