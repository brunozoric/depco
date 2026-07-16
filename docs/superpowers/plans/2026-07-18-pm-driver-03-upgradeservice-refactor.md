# PM Driver 03 — UpgradeService Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor UpgradeService to use drivers for upgrade/refresh commands instead of hardcoded yarn. Add `packageManager` param to both methods.

**Architecture:** Breaking interface change — `upgradePackage` and `refreshTransient` gain a `packageManager` param. JobWorker is the only caller and already has `project.packageManager` available.

**Tech Stack:** TypeScript, @webiny/di, Vitest

## Global Constraints

- TypeScript 7 strict, ESM
- DI via `@webiny/di`
- `PackageManagerDriverRegistry` is available as a DI singleton
- Run `yarn full` after last task

---

### Task 1: Update UpgradeService interface + implementation

**Files:**

- Modify: `src/api/services/abstractions/UpgradeService.ts`
- Modify: `src/api/services/UpgradeService.ts`
- Modify: `src/api/services/__tests__/UpgradeService.test.ts`

**Interfaces:**

- Consumes: `PackageManagerDriverRegistry`, `CommandRunner`
- Produces: Updated `UpgradeService.Interface` with `packageManager` param on both methods

- [ ] **Step 1: Update UpgradeService abstraction**

Replace `src/api/services/abstractions/UpgradeService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IUpgradeService {
  upgradePackage(
    projectPath: string,
    packageName: string,
    targetVersion: string,
    packageManager: string,
    onLog: (line: string) => void,
    signal?: AbortSignal
  ): Promise<void>;
  refreshTransient(
    projectPath: string,
    packageManager: string,
    onLog: (line: string) => void,
    signal?: AbortSignal
  ): Promise<void>;
}

export const UpgradeService = createAbstraction<IUpgradeService>("Api/UpgradeService");

export namespace UpgradeService {
  export type Interface = IUpgradeService;
}
```

- [ ] **Step 2: Update UpgradeService implementation**

Replace `src/api/services/UpgradeService.ts`:

```typescript
import { UpgradeService as Abstraction } from "./abstractions/UpgradeService.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";
import { PackageManagerDriverRegistry } from "./packageManagers/abstractions/PackageManagerDriverRegistry.js";

class UpgradeServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly commandRunner: CommandRunner.Interface,
    private readonly registry: PackageManagerDriverRegistry.Interface
  ) {}

  public async upgradePackage(
    projectPath: string,
    packageName: string,
    targetVersion: string,
    packageManager: string,
    onLog: (line: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (packageName.startsWith("-")) {
      throw new Error(`Invalid package name: ${packageName}`);
    }

    const { command, args } = this.registry
      .getDriver(packageManager)
      .upgradePackageCommand(packageName, targetVersion);
    await this.commandRunner.runStreaming(command, args, {
      cwd: projectPath,
      onStdout: onLog,
      onStderr: onLog,
      ...(signal ? { signal } : {})
    });
  }

  public async refreshTransient(
    projectPath: string,
    packageManager: string,
    onLog: (line: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const { command, args } = this.registry.getDriver(packageManager).refreshTransientCommand();
    await this.commandRunner.runStreaming(command, args, {
      cwd: projectPath,
      onStdout: onLog,
      onStderr: onLog,
      ...(signal ? { signal } : {})
    });
  }
}

export const UpgradeService = Abstraction.createImplementation({
  implementation: UpgradeServiceImpl,
  dependencies: [CommandRunner, PackageManagerDriverRegistry]
});
```

- [ ] **Step 3: Update UpgradeService tests**

In `src/api/services/__tests__/UpgradeService.test.ts`:

Add import:

```typescript
import { PackageManagerDriverRegistry as RegistryRegistration } from "../packageManagers/PackageManagerDriverRegistry.js";
```

In `beforeEach`, add after CommandRunner registration:

```typescript
container.register(RegistryRegistration).inSingletonScope();
```

Update existing test calls to pass `packageManager` as the 4th argument:

- `service.upgradePackage("/project", "react", "19.0.0", onLog)` becomes `service.upgradePackage("/project", "react", "19.0.0", "yarn", onLog)`
- `service.upgradePackage("/project", "-malicious", "1.0.0", onLog)` becomes `service.upgradePackage("/project", "-malicious", "1.0.0", "yarn", onLog)`
- `service.refreshTransient("/project", onLog)` becomes `service.refreshTransient("/project", "yarn", onLog)`

Update assertions that check `runStreaming` call args — the commands should still be `yarn up react@19.0.0`, `yarn up ** -R` etc. when `"yarn"` is passed.

Add new tests for npm and pnpm:

```typescript
it("uses npm install for npm package manager", async () => {
  const onLog = vi.fn();
  await service.upgradePackage("/project", "react", "19.0.0", "npm", onLog);
  expect(commandRunner.runStreaming).toHaveBeenCalledWith(
    "npm",
    ["install", "react@19.0.0"],
    expect.objectContaining({ cwd: "/project" })
  );
});

it("uses pnpm update for pnpm package manager", async () => {
  const onLog = vi.fn();
  await service.upgradePackage("/project", "react", "19.0.0", "pnpm", onLog);
  expect(commandRunner.runStreaming).toHaveBeenCalledWith(
    "pnpm",
    ["update", "react@19.0.0"],
    expect.objectContaining({ cwd: "/project" })
  );
});

it("uses npm update for npm refreshTransient", async () => {
  const onLog = vi.fn();
  await service.refreshTransient("/project", "npm", onLog);
  expect(commandRunner.runStreaming).toHaveBeenCalledWith(
    "npm",
    ["update"],
    expect.objectContaining({ cwd: "/project" })
  );
});
```

- [ ] **Step 4: Run UpgradeService tests**

Run: `yarn test src/api/services/__tests__/UpgradeService.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

Note: `yarn full` will fail because JobWorker still calls with old signature. That's fixed in Plan 05. Commit this change alone.

```bash
git add src/api/services/abstractions/UpgradeService.ts src/api/services/UpgradeService.ts src/api/services/__tests__/UpgradeService.test.ts
git commit -m "refactor: UpgradeService delegates to driver registry, adds packageManager param"
```
