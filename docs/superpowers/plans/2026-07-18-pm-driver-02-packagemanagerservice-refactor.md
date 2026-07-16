# PM Driver 02 — PackageManagerService Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor PackageManagerService to dispatch to drivers via the registry instead of hardcoded PM logic.

**Architecture:** Replace lockfile checks, `buildUpdateCommand`, and direct `<pm> --version` calls with `registry.getDriver(pm)` delegation.

**Tech Stack:** TypeScript, @webiny/di, Vitest

## Global Constraints

- TypeScript 7 strict, ESM
- DI via `@webiny/di`
- `PackageManagerDriverRegistry` is available as a DI singleton (from Plan 01)
- Detection priority preserved: yarn → pnpm → npm (via `getAllDrivers()` iteration order)
- Run `yarn full` after last task

---

### Task 1: Refactor PackageManagerService + update tests

**Files:**

- Modify: `src/api/services/PackageManagerService.ts`
- Modify: `src/api/services/__tests__/PackageManagerService.test.ts`
- Modify: `src/api/feature.ts` (add PackageManagerDriverFeature registration)

**Interfaces:**

- Consumes: `PackageManagerDriverRegistry` from `src/api/services/packageManagers/abstractions/PackageManagerDriverRegistry.js`, `CommandRunner` abstraction
- Produces: Same `PackageManagerService.Interface` (no breaking changes to callers)

- [ ] **Step 1: Update PackageManagerService implementation**

Replace `src/api/services/PackageManagerService.ts` with:

```typescript
import { existsSync } from "fs";
import { join } from "path";
import { PackageManagerService as Abstraction } from "./abstractions/PackageManagerService.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";
import { PackageManagerDriverRegistry } from "./packageManagers/abstractions/PackageManagerDriverRegistry.js";

class PackageManagerServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly commandRunner: CommandRunner.Interface,
    private readonly registry: PackageManagerDriverRegistry.Interface
  ) {}

  public async detect(projectPath: string): Promise<Abstraction.PackageManager> {
    for (const driver of this.registry.getAllDrivers()) {
      if (existsSync(join(projectPath, driver.lockfileName))) {
        return driver.id;
      }
    }
    return "npm";
  }

  public async getVersion(projectPath: string, packageManager: string): Promise<string> {
    const { command, args } = this.registry.getDriver(packageManager).versionCommand();
    const result = await this.commandRunner.run(command, args, { cwd: projectPath });
    return result.stdout.trim();
  }

  public async updateVersion(
    projectPath: string,
    packageManager: string,
    version: string,
    onLog: (line: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const { command, args } = this.registry.getDriver(packageManager).updateVersionCommand(version);
    await this.commandRunner.runStreaming(command, args, {
      cwd: projectPath,
      onStdout: onLog,
      onStderr: onLog,
      ...(signal ? { signal } : {})
    });
  }
}

export const PackageManagerService = Abstraction.createImplementation({
  implementation: PackageManagerServiceImpl,
  dependencies: [CommandRunner, PackageManagerDriverRegistry]
});
```

- [ ] **Step 2: Add PackageManagerDriverFeature to api feature.ts**

In `src/api/feature.ts`, add import and registration:

```typescript
import { PackageManagerDriverFeature } from "./services/packageManagers/feature.js";
```

Inside `register()`, add before PackageManagerService registration:

```typescript
PackageManagerDriverFeature.register(container);
```

- [ ] **Step 3: Update PackageManagerService tests**

In `src/api/services/__tests__/PackageManagerService.test.ts`, add registry registration to `beforeEach`:

```typescript
import { PackageManagerDriverRegistry as RegistryRegistration } from "../packageManagers/PackageManagerDriverRegistry.js";
```

In the `beforeEach` block, after `container.registerInstance(CommandRunner, commandRunner)`, add:

```typescript
container.register(RegistryRegistration).inSingletonScope();
```

No test logic changes needed — the interface is unchanged.

- [ ] **Step 4: Run PackageManagerService tests**

Run: `yarn test src/api/services/__tests__/PackageManagerService.test.ts`
Expected: all PASS (12 tests)

- [ ] **Step 5: Run full suite**

Run: `yarn full`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/services/PackageManagerService.ts src/api/services/__tests__/PackageManagerService.test.ts src/api/feature.ts
git commit -m "refactor: PackageManagerService dispatches to driver registry"
```
