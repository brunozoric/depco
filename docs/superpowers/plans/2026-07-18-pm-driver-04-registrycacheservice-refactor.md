# PM Driver 04 — RegistryCacheService Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor RegistryCacheService to use drivers for registry CLI commands and parsing instead of hardcoded `yarn npm info`. Add `packageManager` param to `getPackageInfo`.

**Architecture:** Breaking interface change — `getPackageInfo(name, force?)` becomes `getPackageInfo(name, packageManager, force?)`. ScanService (only caller) already has `packageManager` available.

**Tech Stack:** TypeScript, @webiny/di, Vitest

## Global Constraints

- TypeScript 7 strict, ESM
- DI via `@webiny/di`
- `PackageManagerDriverRegistry` is available as a DI singleton
- Run `yarn full` after last task

---

### Task 1: Update RegistryCacheService interface + implementation + tests

**Files:**

- Modify: `src/api/services/abstractions/RegistryCacheService.ts`
- Modify: `src/api/services/RegistryCacheService.ts`
- Modify: `src/api/services/__tests__/RegistryCacheService.test.ts`

**Interfaces:**

- Consumes: `PackageManagerDriverRegistry`, `CommandRunner`, `DatabaseClient`
- Produces: Updated `RegistryCacheService.Interface` with `packageManager` param on `getPackageInfo`

- [ ] **Step 1: Update RegistryCacheService abstraction**

In `src/api/services/abstractions/RegistryCacheService.ts`, change `getPackageInfo` signature:

```typescript
export interface IRegistryCacheService {
  getPackageInfo(
    packageName: string,
    packageManager: string,
    force?: boolean
  ): Promise<IRegistryCachePackageInfo>;
  clearAll(): Promise<void>;
  clearPackage(packageName: string): Promise<void>;
}
```

- [ ] **Step 2: Update RegistryCacheService implementation**

Replace `src/api/services/RegistryCacheService.ts`:

```typescript
import { eq } from "drizzle-orm";
import { RegistryCacheService as Abstraction } from "./abstractions/RegistryCacheService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";
import { PackageManagerDriverRegistry } from "./packageManagers/abstractions/PackageManagerDriverRegistry.js";
import { registryCache } from "#api/db/schema.js";

const TTL_MS = 30 * 60 * 1000;

class RegistryCacheServiceImpl implements Abstraction.Interface {
  private readonly inFlight = new Map<string, Promise<Abstraction.PackageInfo>>();

  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly commandRunner: CommandRunner.Interface,
    private readonly registry: PackageManagerDriverRegistry.Interface
  ) {}

  public async getPackageInfo(
    packageName: string,
    packageManager: string,
    force?: boolean
  ): Promise<Abstraction.PackageInfo> {
    const existing = this.inFlight.get(packageName);
    if (existing) {
      return existing;
    }

    const promise = this.fetchPackageInfo(packageName, packageManager, force).finally(() => {
      this.inFlight.delete(packageName);
    });

    this.inFlight.set(packageName, promise);
    return promise;
  }

  private async fetchPackageInfo(
    packageName: string,
    packageManager: string,
    force?: boolean
  ): Promise<Abstraction.PackageInfo> {
    if (!force) {
      const cached = await this.databaseClient.db
        .select()
        .from(registryCache)
        .where(eq(registryCache.packageName, packageName))
        .get();

      if (cached && Date.now() - cached.cachedAt < TTL_MS) {
        return JSON.parse(cached.data) as Abstraction.PackageInfo;
      }
    }

    if (packageName.startsWith("-")) {
      throw new Error(`Invalid package name: ${packageName}`);
    }

    const driver = this.registry.getDriver(packageManager);
    const { command, args } = driver.registryInfoCommand(packageName);
    const result = await this.commandRunner.run(command, args, {
      cwd: process.cwd()
    });

    const parsed = driver.parseRegistryInfo(result.stdout);
    const info: Abstraction.PackageInfo = {
      name: packageName,
      latestVersion: parsed.latestVersion,
      distTags: parsed.distTags,
      versions: parsed.versions
    };

    await this.databaseClient.db
      .insert(registryCache)
      .values({
        packageName,
        data: JSON.stringify(info),
        cachedAt: Date.now()
      })
      .onConflictDoUpdate({
        target: registryCache.packageName,
        set: {
          data: JSON.stringify(info),
          cachedAt: Date.now()
        }
      })
      .run();

    return info;
  }

  public async clearAll(): Promise<void> {
    await this.databaseClient.db.delete(registryCache).run();
  }

  public async clearPackage(packageName: string): Promise<void> {
    await this.databaseClient.db
      .delete(registryCache)
      .where(eq(registryCache.packageName, packageName))
      .run();
  }
}

export const RegistryCacheService = Abstraction.createImplementation({
  implementation: RegistryCacheServiceImpl,
  dependencies: [DatabaseClient, CommandRunner, PackageManagerDriverRegistry]
});
```

- [ ] **Step 3: Update RegistryCacheService tests**

In `src/api/services/__tests__/RegistryCacheService.test.ts`:

Add import:

```typescript
import { PackageManagerDriverRegistry as RegistryRegistration } from "../packageManagers/PackageManagerDriverRegistry.js";
```

In `beforeEach`, add after CommandRunner registration:

```typescript
container.register(RegistryRegistration).inSingletonScope();
```

Update all `getPackageInfo` calls to pass `"yarn"` as second argument:

- `service.getPackageInfo("react")` becomes `service.getPackageInfo("react", "yarn")`
- `service.getPackageInfo("react", true)` becomes `service.getPackageInfo("react", "yarn", true)`
- `service.getPackageInfo("-malicious")` becomes `service.getPackageInfo("-malicious", "yarn")`

The existing mock CommandRunner returns `yarn npm info` compatible output, so tests pass with `"yarn"` driver.

- [ ] **Step 4: Run RegistryCacheService tests**

Run: `yarn test src/api/services/__tests__/RegistryCacheService.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

Note: `yarn full` will fail because ScanService still calls with old signature. That's fixed in Plan 05. Commit this change alone.

```bash
git add src/api/services/abstractions/RegistryCacheService.ts src/api/services/RegistryCacheService.ts src/api/services/__tests__/RegistryCacheService.test.ts
git commit -m "refactor: RegistryCacheService delegates to driver registry, adds packageManager param"
```
