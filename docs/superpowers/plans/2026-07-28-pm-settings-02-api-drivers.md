# PM Settings Part 2: API Routes and Driver Consumption

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update security settings route to read from `pmSettings`, wire install flags from file config through InstallJobExecutor, add registry URL to drivers, and consume upgrade strategy in upgrade flow.

**Architecture:** Security route reads `config.pmSettings?.{pm}?.security`. InstallJobExecutor merges file config flags with registry defaults. Drivers accept registry URL override. UpgradeService applies version prefix from strategy.

**Tech Stack:** Fastify, Zod, Drizzle ORM

## Global Constraints

- Response helpers: `sendOne`, `sendList`, `sendNone`, `sendError` from `#shared/routing/index.js`
- Route definitions in `src/shared/routes/` with Zod schemas
- API tests use in-memory SQLite via `createTestDb()`, real services, only mock `CommandRunner`
- `yarn vitest run` for tests, `yarn build` for type checking
- This project uses yarn, not npm

---

### Task 3: Update security settings route to read from pmSettings

**Files:**

- Modify: `src/api/routes/settings.ts`
- Test: `src/api/routes/__tests__/settings.test.ts`

**Interfaces:**

- Consumes: `FileConfigService.readGlobalConfig()` returning `IFileConfigResult` where `config.pmSettings?.{pm}?.security` replaces `config.securitySettings?.{pm}`
- Produces: same `listSecuritySettingsRoute` response, just reads from new path

- [ ] **Step 1: Update route handler**

In `src/api/routes/settings.ts`, change line 65:

```typescript
// OLD:
const fileSecuritySettings = fileConfigResult.config?.securitySettings;
// NEW:
const allPmSettings = fileConfigResult.config?.pmSettings;
```

Then update the block starting at line 67 — build `fileSecuritySettings` from the new structure:

```typescript
const fileSecuritySettings: Record<string, Record<string, string>> = {};
if (allPmSettings) {
  for (const [pm, pmConfig] of Object.entries(allPmSettings)) {
    if (pmConfig.security && Object.keys(pmConfig.security).length > 0) {
      fileSecuritySettings[pm] = pmConfig.security;
    }
  }
}

if (Object.keys(fileSecuritySettings).length === 0) {
  const items = dbRows.map(toResponse);
  reply.send({
    items,
    total: items.length,
    configSource: "db" as const,
    fileManagedPms: []
  });
  return;
}
```

The rest of the handler (fileManagedPms, dbItems, fileItems synthesis) stays the same — it already iterates `fileSecuritySettings` as `Record<string, Record<string, string>>`.

- [ ] **Step 2: Update test data from securitySettings to pmSettings**

In `src/api/routes/__tests__/settings.test.ts`, find all test configs that write `securitySettings`:

```typescript
// OLD:
JSON.stringify({ securitySettings: { pnpm: { ignoreScripts: "true" } } });
// NEW:
JSON.stringify({ pmSettings: { pnpm: { security: { ignoreScripts: "true" } } } });
```

Update all occurrences — the tests for file-managed PM, non-file-managed PM, and error should all use `pmSettings` format.

- [ ] **Step 3: Run tests**

Run: `yarn vitest run src/api/routes/__tests__/settings.test.ts`
Expected: all pass

- [ ] **Step 4: Run full suite**

Run: `yarn vitest run`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/settings.ts src/api/routes/__tests__/settings.test.ts
git commit -m "feat: update security settings route to read from pmSettings"
```

---

### Task 4: Wire install flags from file config through InstallJobExecutor

**Files:**

- Modify: `src/api/services/jobExecutors/InstallJobExecutor.ts`
- Test: `src/api/services/jobExecutors/__tests__/InstallJobExecutor.test.ts` (extend or create)

**Interfaces:**

- Consumes: `FileConfigService.readGlobalConfig()`, `INSTALL_FLAG_REGISTRY`, `driver.installFlags()`, `driver.installCommand(flags)`
- Produces: install command uses file-config-resolved flags merged with registry defaults

- [ ] **Step 1: Write failing test — install uses file config flags**

Check if `src/api/services/jobExecutors/__tests__/InstallJobExecutor.test.ts` exists. If not, create it. Write a test that verifies when file config has `pmSettings.pnpm.installFlags`, those flags are passed to `installCommand()`.

The test needs to:

1. Set up a container with a mock CommandRunner, a real FileConfigService, and a mock driver registry
2. Write a `.dependency-upgrader.json` with `pmSettings.pnpm.installFlags: { "--frozen-lockfile": true, "--ignore-scripts": true }`
3. Execute the install job
4. Verify `commandRunner.runStreaming` was called with args containing `--frozen-lockfile` and `--ignore-scripts`

```typescript
it("uses install flags from file config when present", async () => {
  const configPath = join(process.cwd(), ".dependency-upgrader.json");
  await writeFile(
    configPath,
    JSON.stringify({
      pmSettings: {
        pnpm: {
          installFlags: { "--frozen-lockfile": true, "--ignore-scripts": true }
        }
      }
    }),
    "utf-8"
  );

  try {
    await executor.execute(
      createContext({
        packageManager: "pnpm",
        packagesJson: JSON.stringify({ flags: [] })
      })
    );

    expect(commandRunner.runStreaming).toHaveBeenCalledWith(
      "pnpm",
      expect.arrayContaining(["install", "--frozen-lockfile", "--ignore-scripts"]),
      expect.any(Object)
    );
  } finally {
    await rm(configPath, { force: true });
  }
});
```

- [ ] **Step 2: Write failing test — install uses defaults when no file config**

```typescript
it("uses user-selected flags when no file config", async () => {
  await executor.execute(
    createContext({
      packageManager: "pnpm",
      packagesJson: JSON.stringify({ flags: ["--force"] })
    })
  );

  expect(commandRunner.runStreaming).toHaveBeenCalledWith(
    "pnpm",
    ["install", "--force"],
    expect.any(Object)
  );
});
```

- [ ] **Step 3: Add FileConfigService dependency to InstallJobExecutor**

In `src/api/services/jobExecutors/InstallJobExecutor.ts`:

1. Add import:

```typescript
import { FileConfigService } from "../abstractions/FileConfigService.js";
import { INSTALL_FLAG_REGISTRY } from "#shared/install/index.js";
import type { PackageManagerId } from "#shared/security/types.js";
```

2. Add constructor parameter:

```typescript
public constructor(
    private readonly driverRegistry: PackageManagerDriverRegistry.Interface,
    private readonly commandRunner: CommandRunner.Interface,
    private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
    private readonly fileConfigService: FileConfigService.Interface
) {}
```

3. Update `execute()` to check file config first:

```typescript
public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    const driver = this.driverRegistry.getDriver(context.packageManager);

    // Check if file config has install flags for this PM
    const fileConfigResult = await this.fileConfigService.readGlobalConfig();
    const pmConfig = fileConfigResult.config?.pmSettings?.[context.packageManager];
    const fileFlags = pmConfig?.installFlags;

    let flags: string[];

    if (fileFlags) {
        // File config present — use file flags (true = include, false = exclude)
        flags = Object.entries(fileFlags)
            .filter(([, enabled]) => enabled)
            .map(([flag]) => flag);
    } else {
        // No file config — use user-selected flags from request (existing behavior)
        const allowedFlags = driver.installFlags().map(f => f.flag);
        const schema = z.object({
            flags: z
                .array(
                    allowedFlags.length > 0
                        ? z.enum(allowedFlags as [string, ...string[]])
                        : z.never()
                )
                .default([])
        });
        const parsed = schema.parse(JSON.parse(context.packagesJson ?? "{}"));
        flags = parsed.flags;
    }

    try {
        await this.commandRunner.run(context.packageManager, ["--version"], {
            cwd: context.projectPath
        });
    } catch {
        throw new Error(
            `Package manager "${context.packageManager}" is not installed. Install it first.`
        );
    }

    const { command, args } = driver.installCommand(flags);
    await this.commandRunner.runStreaming(command, args, {
        cwd: context.projectPath,
        onStdout: context.appendLog,
        onStderr: context.appendLog,
        signal: context.signal
    });

    this.webSocketBroadcaster.broadcast("install:complete", {
        projectId: context.projectId
    });
}
```

4. Update the registration in `JobExecutorRegistry` to pass `FileConfigService` — check how `InstallJobExecutor` is constructed in the registry.

- [ ] **Step 4: Run tests**

Run: `yarn vitest run`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/api/services/jobExecutors/InstallJobExecutor.ts src/api/services/jobExecutors/__tests__/InstallJobExecutor.test.ts
git commit -m "feat: wire install flags from file config through InstallJobExecutor"
```

---

### Task 5: Add registry URL support to drivers

**Files:**

- Modify: `src/api/services/packageManagers/abstractions/PackageManagerDriver.ts`
- Modify: all 4 driver implementations
- Test: extend existing driver tests

**Interfaces:**

- Consumes: `registryUrl?: string` passed to `registryInfoCommand()`
- Produces: drivers accept optional registry URL override

- [ ] **Step 1: Update driver interface**

In `src/api/services/packageManagers/abstractions/PackageManagerDriver.ts`, update `registryInfoCommand` signature:

```typescript
registryInfoCommand(packageName: string, registryUrl?: string): ICommandSpec;
```

- [ ] **Step 2: Update each driver**

Each driver's `registryInfoCommand()` adds registry flag when URL provided:

**PnpmDriver** (`pnpm view [name] --json --registry [url]`):

```typescript
public registryInfoCommand(packageName: string, registryUrl?: string): Abstraction.CommandSpec {
    const args = ["view", packageName, "--json"];
    if (registryUrl) {
        args.push("--registry", registryUrl);
    }
    return { command: "pnpm", args };
}
```

**NpmDriver** (`npm view [name] --json --registry [url]`):
Same pattern with `npm`.

**YarnDriver** (`yarn npm info [name] --json`):
Yarn uses `--registry` on `yarn npm info`:

```typescript
public registryInfoCommand(packageName: string, registryUrl?: string): Abstraction.CommandSpec {
    const args = ["npm", "info", packageName, "--json"];
    if (registryUrl) {
        args.push("--registry", registryUrl);
    }
    return { command: "yarn", args };
}
```

**BunDriver** (`npm view [name] --json --registry [url]`):
Bun uses npm for registry info, same as npm driver.

- [ ] **Step 3: Update callers to pass registryUrl**

Find where `registryInfoCommand()` is called (likely `RegistryCacheService` or `ScanService`). Add file config lookup to pass `registryUrl`:

```typescript
const fileConfig = await this.fileConfigService.readGlobalConfig();
const registryUrl = fileConfig.config?.pmSettings?.[pm]?.registryUrl;
const { command, args } = driver.registryInfoCommand(packageName, registryUrl);
```

- [ ] **Step 4: Write tests**

Test that registry URL is included in command args when configured.

- [ ] **Step 5: Run all tests**

Run: `yarn vitest run`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/api/services/packageManagers/ src/shared/routes/ src/api/services/
git commit -m "feat: add registry URL support to driver registryInfoCommand"
```

---

### Task 6: Consume upgrade strategy in upgrade flow

**Files:**

- Modify: `src/api/services/UpgradeService.ts` (or `stepResolvers/UpgradeResolver.ts`)
- Test: extend existing tests

**Interfaces:**

- Consumes: `FileConfigService.readGlobalConfig()`, `pmSettings.{pm}.upgradeStrategy`
- Produces: version string gets appropriate prefix (`^`, `~`, none, `*`)

- [ ] **Step 1: Understand current version format**

The `targetVersion` string is passed from the UI to the API via `createUpgradeJobRoute`. It's a bare version like `4.17.21`. Drivers use it as `packageName@targetVersion`.

The upgrade strategy adds a prefix to this version:

- `caret` (default): `^4.17.21`
- `tilde`: `~4.17.21`
- `exact`: `4.17.21` (no prefix)
- `latest`: `*`

- [ ] **Step 2: Write failing test**

```typescript
it("applies caret prefix when upgradeStrategy is caret", async () => {
  // Write file config with caret strategy
  // Call upgradePackage
  // Verify driver.upgradePackageCommand called with "^4.17.21"
});

it("applies exact (no prefix) when upgradeStrategy is exact", async () => {
  // Similar
});

it("defaults to caret prefix when no upgradeStrategy configured", async () => {
  // Default behavior per spec — caret (^) prefix
});
```

- [ ] **Step 3: Add FileConfigService to UpgradeService**

Add `FileConfigService` as a constructor dependency. In `upgradePackage()`, read file config and apply strategy:

```typescript
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

    const fileConfig = await this.fileConfigService.readGlobalConfig();
    const strategy = fileConfig.config?.pmSettings?.[packageManager]?.upgradeStrategy;
    const prefixedVersion = applyVersionStrategy(targetVersion, strategy);

    const { command, args } = this.registry
        .getDriver(packageManager)
        .upgradePackageCommand(packageName, prefixedVersion);
    await this.commandRunner.runStreaming(command, args, {
        cwd: projectPath,
        onStdout: onLog,
        onStderr: onLog,
        ...(signal ? { signal } : {})
    });
}
```

Add helper:

```typescript
function applyVersionStrategy(
  version: string,
  strategy?: "caret" | "tilde" | "exact" | "latest"
): string {
  switch (strategy) {
    case "caret":
      return `^${version}`;
    case "tilde":
      return `~${version}`;
    case "latest":
      return "*";
    case "exact":
      return version;
    default:
      return `^${version}`;
  }
}
```

- [ ] **Step 4: Update DI registration**

Add `FileConfigService` to `UpgradeService` dependencies array.

- [ ] **Step 5: Run all tests**

Run: `yarn vitest run`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/api/services/UpgradeService.ts src/api/services/__tests__/
git commit -m "feat: apply upgrade strategy prefix from file config"
```
