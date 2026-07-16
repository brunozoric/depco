# Package Manager Driver Abstraction

## Goal

Extract all PM-specific logic from PackageManagerService, ScanService, UpgradeService, and RegistryCacheService into per-PM driver implementations behind a shared interface. Adding a new PM = one new driver file + register in registry.

## Current state

PM-specific branching scattered across 4 services:

| Service               | PM-specific logic                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| PackageManagerService | `detect()` lockfile checks, `buildUpdateCommand()` per PM, `getVersion()` runs `<pm> --version`                                         |
| ScanService           | `collectInstalledVersions()` dispatches to `parseYarnInfo`/`parseNpmLs`/`parsePnpmList`, `collectWorkspaces()` yarn CLI vs package.json |
| UpgradeService        | hardcoded `yarn up <pkg>@<ver>`, `yarn up ** -R`                                                                                        |
| RegistryCacheService  | hardcoded `yarn npm info <pkg> --json`                                                                                                  |

## Design

### Driver interface

Pure data — no I/O, no side effects. Drivers describe commands and parse output. Services handle execution.

```typescript
// src/api/services/packageManagers/abstractions/PackageManagerDriver.ts

export interface ICommandSpec {
  command: string;
  args: string[];
}

export interface IWorkspaceEntry {
  location: string;
}

export interface IRegistryPackageInfo {
  name: string;
  latestVersion: string;
  distTags: Record<string, string>;
  versions: string[];
}

export interface IPackageManagerDriver {
  readonly id: PackageManagerId;
  readonly lockfileName: string;

  versionCommand(): ICommandSpec;
  updateVersionCommand(version: string): ICommandSpec;

  installedVersionsCommand(): ICommandSpec;
  parseInstalledVersions(stdout: string): Map<string, string>;
  workspacesCommand(): ICommandSpec | null;
  parseWorkspaces(stdout: string): IWorkspaceEntry[];

  upgradePackageCommand(packageName: string, targetVersion: string): ICommandSpec;
  refreshTransientCommand(): ICommandSpec;

  registryInfoCommand(packageName: string): ICommandSpec;
  parseRegistryInfo(stdout: string): IRegistryPackageInfo;
}
```

Namespace exports all types:

```typescript
export const PackageManagerDriver = createAbstraction<IPackageManagerDriver>(
  "Api/PackageManagerDriver"
);

export namespace PackageManagerDriver {
  export type Interface = IPackageManagerDriver;
  export type CommandSpec = ICommandSpec;
  export type WorkspaceEntry = IWorkspaceEntry;
  export type RegistryPackageInfo = IRegistryPackageInfo;
}
```

Note: `PackageManagerDriver` is an abstraction token for type-safety, but individual drivers aren't resolved via DI — they're registered in the registry.

### Driver registry

```typescript
// src/api/services/packageManagers/abstractions/PackageManagerDriverRegistry.ts

export interface IPackageManagerDriverRegistry {
  getDriver(packageManager: string): PackageManagerDriver.Interface;
  getAllDrivers(): PackageManagerDriver.Interface[];
}

export const PackageManagerDriverRegistry = createAbstraction<IPackageManagerDriverRegistry>(
  "Api/PackageManagerDriverRegistry"
);

export namespace PackageManagerDriverRegistry {
  export type Interface = IPackageManagerDriverRegistry;
}
```

### Driver implementations

```
src/api/services/packageManagers/
    abstractions/
        PackageManagerDriver.ts
        PackageManagerDriverRegistry.ts
        index.ts
    YarnDriver.ts          — implements IPackageManagerDriver
    NpmDriver.ts           — implements IPackageManagerDriver
    PnpmDriver.ts          — implements IPackageManagerDriver
    PackageManagerDriverRegistry.ts  — creates Map, registers all 3
    feature.ts             — registers PackageManagerDriverRegistry
    index.ts
```

Each driver is a plain class (no DI deps — drivers are pure). Example:

```typescript
// YarnDriver.ts
class YarnDriverImpl implements Abstraction.Interface {
  public readonly id = "yarn" as const;
  public readonly lockfileName = "yarn.lock";

  public versionCommand(): Abstraction.CommandSpec {
    return { command: "yarn", args: ["--version"] };
  }

  public updateVersionCommand(version: string): Abstraction.CommandSpec {
    return { command: "yarn", args: ["set", "version", version] };
  }

  public installedVersionsCommand(): Abstraction.CommandSpec {
    return { command: "yarn", args: ["info", "--all", "--json"] };
  }

  public parseInstalledVersions(stdout: string): Map<string, string> {
    // move parseYarnInfo logic here
  }

  public workspacesCommand(): Abstraction.CommandSpec {
    return { command: "yarn", args: ["workspaces", "list", "--json"] };
  }

  public parseWorkspaces(stdout: string): Abstraction.WorkspaceEntry[] {
    // move parseWorkspacesList logic here
  }

  public upgradePackageCommand(name: string, version: string): Abstraction.CommandSpec {
    return { command: "yarn", args: ["up", `${name}@${version}`] };
  }

  public refreshTransientCommand(): Abstraction.CommandSpec {
    return { command: "yarn", args: ["up", "**", "-R"] };
  }

  public registryInfoCommand(packageName: string): Abstraction.CommandSpec {
    return { command: "yarn", args: ["npm", "info", packageName, "--json"] };
  }

  public parseRegistryInfo(stdout: string): Abstraction.RegistryPackageInfo {
    // move registry JSON parsing from RegistryCacheService here
  }
}
```

NpmDriver and PnpmDriver follow the same pattern with their respective commands and parsers.

### Registry implementation

```typescript
// PackageManagerDriverRegistry.ts
class PackageManagerDriverRegistryImpl implements Abstraction.Interface {
  private readonly drivers = new Map<string, PackageManagerDriver.Interface>();

  // Order matters — detect() iterates drivers and returns the first lockfile match.
  // yarn → pnpm → npm preserves current PackageManagerService.detect() priority.
  public constructor() {
    const yarn = new YarnDriverImpl();
    const pnpm = new PnpmDriverImpl();
    const npm = new NpmDriverImpl();
    this.drivers.set(yarn.id, yarn);
    this.drivers.set(pnpm.id, pnpm);
    this.drivers.set(npm.id, npm);
  }

  public getDriver(packageManager: string): PackageManagerDriver.Interface {
    const driver = this.drivers.get(packageManager);
    if (!driver) {
      throw new Error(`No driver for package manager: ${packageManager}`);
    }
    return driver;
  }

  public getAllDrivers(): PackageManagerDriver.Interface[] {
    return Array.from(this.drivers.values());
  }
}
```

No DI dependencies — drivers are pure objects. Registry is singleton.

### Service refactoring

**PackageManagerService** — depends on `PackageManagerDriverRegistry` + `CommandRunner`:

```typescript
public async detect(projectPath: string): Promise<PackageManagerId> {
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

public async updateVersion(...): Promise<void> {
    const { command, args } = this.registry.getDriver(packageManager).updateVersionCommand(version);
    await this.commandRunner.runStreaming(command, args, { ... });
}
```

**ScanService** — depends on `PackageManagerDriverRegistry` + `CommandRunner` + `RegistryCacheService`:

```typescript
// collectInstalledVersions becomes:
const driver = this.registry.getDriver(packageManager);
const { command, args } = driver.installedVersionsCommand();
const result = await this.commandRunner.run(command, args, { cwd, ...(signal ? { signal } : {}) });
return driver.parseInstalledVersions(result.stdout);

// collectWorkspaces becomes:
const driver = this.registry.getDriver(packageManager);
const cmd = driver.workspacesCommand();
if (cmd) {
  try {
    const result = await this.commandRunner.run(cmd.command, cmd.args, {
      cwd,
      ...(signal ? { signal } : {})
    });
    return driver.parseWorkspaces(result.stdout);
  } catch {
    return [{ location: "." }];
  }
}
return collectWorkspacesFromPackageJson(projectPath);

// scan() — getPackageInfo call gains packageManager param:
// Before: this.registryCacheService.getPackageInfo(name, force)
// After:  this.registryCacheService.getPackageInfo(name, packageManager, force)
```

**UpgradeService** — depends on `PackageManagerDriverRegistry` + `CommandRunner`. Needs `packageManager` param added to both methods (currently hardcoded to yarn):

```typescript
public async upgradePackage(projectPath, packageName, targetVersion, packageManager, onLog, signal?): Promise<void> {
    const { command, args } = this.registry.getDriver(packageManager).upgradePackageCommand(packageName, targetVersion);
    await this.commandRunner.runStreaming(command, args, { cwd: projectPath, onStdout: onLog, onStderr: onLog, ... });
}

public async refreshTransient(projectPath, packageManager, onLog, signal?): Promise<void> {
    const { command, args } = this.registry.getDriver(packageManager).refreshTransientCommand();
    await this.commandRunner.runStreaming(command, args, { ... });
}
```

**Breaking change:** UpgradeService interface gains `packageManager` param. JobWorker passes `project.packageManager` through:

```typescript
// JobWorker.executeJob — compute packageManager ONCE at top, before type branches:
const packageManager =
  project.packageManager ?? (await this.packageManagerService.detect(project.path));

if (job.type === "dependency") {
  // ...
  await this.upgradeService.upgradePackage(
    project.path,
    upgradePackage.name,
    upgradePackage.to,
    packageManager,
    appendLog,
    controller.signal
  );
} else if (job.type === "transient") {
  await this.upgradeService.refreshTransient(
    project.path,
    packageManager,
    appendLog,
    controller.signal
  );
} else if (job.type === "packageManager") {
  // packageManager already computed above — replaces inline detect() call
  await this.packageManagerService.updateVersion(
    project.path,
    packageManager,
    packageManagerPackage.to,
    appendLog,
    controller.signal
  );
}
```

**RegistryCacheService** — depends on `PackageManagerDriverRegistry` + `CommandRunner` + `DatabaseClient`. Needs `packageManager` param on `getPackageInfo`/`fetchPackageInfo`:

```typescript
const driver = this.registry.getDriver(packageManager);
const { command, args } = driver.registryInfoCommand(packageName);
const result = await this.commandRunner.run(command, args, { cwd: process.cwd() });
return driver.parseRegistryInfo(result.stdout);
```

**Breaking change:** `getPackageInfo(packageName, force?)` becomes `getPackageInfo(packageName, packageManager, force?)`. ScanService (the only caller) already knows the PM.

### Interface changes summary

| Service               | Change                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PackageManagerService | New dep: `PackageManagerDriverRegistry`. Remove `buildUpdateCommand`. Dispatch to drivers.                                                                             |
| ScanService           | New dep: `PackageManagerDriverRegistry`. Remove `parseYarnInfo`, `parseNpmLs`, `parsePnpmList`, `parseWorkspacesList`. Remove `collectInstalledVersions` PM branching. |
| UpgradeService        | New dep: `PackageManagerDriverRegistry`. Add `packageManager` param to `upgradePackage` and `refreshTransient`.                                                        |
| RegistryCacheService  | New dep: `PackageManagerDriverRegistry`. Add `packageManager` param to `getPackageInfo`. Remove hardcoded JSON parsing.                                                |
| JobWorker             | Pass `packageManager` to UpgradeService and RegistryCacheService calls. No new deps.                                                                                   |

### Test strategy

- **Driver tests:** Pure function tests for each driver — `parseInstalledVersions`, `parseRegistryInfo`, command specs. No mocking needed.
- **Service tests:** Existing tests updated to register `PackageManagerDriverRegistry` in container. CommandRunner still mocked at shell boundary.
- **Integration:** Existing route tests continue working — drivers are transparent to the HTTP layer.

## Out of scope

- `collectWorkspacesFromPackageJson` and `globWorkspacePattern` stay in ScanService — they're filesystem utilities, not PM-specific
- `classifyUpgrade` stays in ScanService — PM-independent version comparison
- Security field definitions — separate concern, already tested
- UI layer — no changes needed, only API service refactor

## File count

New files: 7 (3 drivers, 2 abstractions, 1 registry impl, 1 feature)
Modified files: 5 (PackageManagerService, ScanService, UpgradeService, RegistryCacheService, JobWorker)
Modified test files: 4-5 (service tests + route tests for DI setup)
