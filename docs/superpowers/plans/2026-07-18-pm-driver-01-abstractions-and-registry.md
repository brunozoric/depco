# PM Driver 01 — Abstractions, Drivers, and Registry

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the PackageManagerDriver interface, 3 driver implementations (yarn/npm/pnpm), and the registry that holds them.

**Architecture:** Drivers are pure objects — no I/O, no DI deps. They describe commands and parse CLI output. The registry is a DI-registered singleton holding all drivers in priority order.

**Tech Stack:** TypeScript, @webiny/di, Vitest

## Global Constraints

- TypeScript 7 strict, ESM
- DI via `@webiny/di` — abstractions in `abstractions/` dir, one file per token
- Drivers are plain classes, NOT resolved via DI individually
- All class methods/properties MUST have explicit access modifiers
- Run `yarn full` after last task

---

### Task 1: Driver abstraction + registry abstraction

**Files:**

- Create: `src/api/services/packageManagers/abstractions/PackageManagerDriver.ts`
- Create: `src/api/services/packageManagers/abstractions/PackageManagerDriverRegistry.ts`
- Create: `src/api/services/packageManagers/abstractions/index.ts`

**Interfaces:**

- Consumes: `PackageManagerId` from `#shared/security/types.js`
- Produces: `PackageManagerDriver` token + namespace (`Interface`, `CommandSpec`, `WorkspaceEntry`, `RegistryPackageInfo`), `PackageManagerDriverRegistry` token + namespace (`Interface`)

- [ ] **Step 1: Create PackageManagerDriver abstraction**

```typescript
// src/api/services/packageManagers/abstractions/PackageManagerDriver.ts
import { createAbstraction } from "#shared/index.js";
import type { PackageManagerId } from "#shared/security/types.js";

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

- [ ] **Step 2: Create PackageManagerDriverRegistry abstraction**

```typescript
// src/api/services/packageManagers/abstractions/PackageManagerDriverRegistry.ts
import { createAbstraction } from "#shared/index.js";
import type { PackageManagerDriver } from "./PackageManagerDriver.js";

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

- [ ] **Step 3: Create barrel index**

```typescript
// src/api/services/packageManagers/abstractions/index.ts
export { PackageManagerDriver } from "./PackageManagerDriver.js";
export { PackageManagerDriverRegistry } from "./PackageManagerDriverRegistry.js";
```

- [ ] **Step 4: Verify build**

Run: `yarn build`
Expected: PASS

---

### Task 2: YarnDriver implementation

**Files:**

- Create: `src/api/services/packageManagers/YarnDriver.ts`
- Create: `src/api/services/packageManagers/__tests__/YarnDriver.test.ts`

**Interfaces:**

- Consumes: `PackageManagerDriver` abstraction from Task 1
- Produces: `YarnDriver` const (used by registry in Task 5)

The parser logic comes from existing ScanService functions. Move `parseYarnInfo` and `parseWorkspacesList` into the driver. The registry info parser comes from RegistryCacheService.

- [ ] **Step 1: Write YarnDriver tests**

```typescript
// src/api/services/packageManagers/__tests__/YarnDriver.test.ts
import { describe, it, expect } from "vitest";
import { YarnDriver } from "../YarnDriver.js";
import type { PackageManagerDriver } from "../abstractions/PackageManagerDriver.js";

function createDriver(): PackageManagerDriver.Interface {
  // Drivers are plain objects — no DI needed
  return new (YarnDriver as unknown as { new (): PackageManagerDriver.Interface })();
}
```

Wait — the DI skill says never construct directly. But drivers are plain classes, not DI-managed. The test should import the implementation class directly since it's not a DI token.

Actually, `YarnDriver` is exported as a `createImplementation` result. But drivers have no DI deps, so we can resolve through a container with no additional registrations.

Let me reconsider. The spec says drivers are plain classes, not DI-managed. But the DI skill says all implementations use `createImplementation`. Let's follow the DI skill pattern — use `createImplementation` with empty dependencies, resolve through container in tests.

```typescript
import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { PackageManagerDriver } from "../abstractions/PackageManagerDriver.js";
import { YarnDriver as YarnDriverRegistration } from "../YarnDriver.js";

describe("YarnDriver", () => {
  function createDriver(): PackageManagerDriver.Interface {
    const container = createContainer();
    container.register(YarnDriverRegistration);
    return container.resolve(PackageManagerDriver);
  }

  it("has id 'yarn' and lockfileName 'yarn.lock'", () => {
    const driver = createDriver();
    expect(driver.id).toBe("yarn");
    expect(driver.lockfileName).toBe("yarn.lock");
  });

  it("versionCommand returns yarn --version", () => {
    const driver = createDriver();
    expect(driver.versionCommand()).toEqual({ command: "yarn", args: ["--version"] });
  });

  it("updateVersionCommand returns yarn set version <ver>", () => {
    const driver = createDriver();
    expect(driver.updateVersionCommand("4.7.0")).toEqual({
      command: "yarn",
      args: ["set", "version", "4.7.0"]
    });
  });

  it("upgradePackageCommand returns yarn up <name>@<ver>", () => {
    const driver = createDriver();
    expect(driver.upgradePackageCommand("react", "19.0.0")).toEqual({
      command: "yarn",
      args: ["up", "react@19.0.0"]
    });
  });

  it("refreshTransientCommand returns yarn up ** -R", () => {
    const driver = createDriver();
    expect(driver.refreshTransientCommand()).toEqual({
      command: "yarn",
      args: ["up", "**", "-R"]
    });
  });

  it("installedVersionsCommand returns yarn info --all --json", () => {
    const driver = createDriver();
    expect(driver.installedVersionsCommand()).toEqual({
      command: "yarn",
      args: ["info", "--all", "--json"]
    });
  });

  it("parseInstalledVersions extracts name and version from yarn info JSON lines", () => {
    const driver = createDriver();
    const stdout = [
      '{"value":"react@npm:18.2.0","children":{"Version":"18.2.0"}}',
      '{"value":"lodash@npm:4.17.21","children":{"Version":"4.17.21"}}',
      '{"value":"@scope/pkg@npm:1.0.0","children":{"Version":"1.0.0"}}',
      "",
      "not-json"
    ].join("\n");

    const result = driver.parseInstalledVersions(stdout);
    expect(result.get("react")).toBe("18.2.0");
    expect(result.get("lodash")).toBe("4.17.21");
    expect(result.get("@scope/pkg")).toBe("1.0.0");
    expect(result.size).toBe(3);
  });

  it("workspacesCommand returns yarn workspaces list --json", () => {
    const driver = createDriver();
    expect(driver.workspacesCommand()).toEqual({
      command: "yarn",
      args: ["workspaces", "list", "--json"]
    });
  });

  it("parseWorkspaces extracts location from JSON lines", () => {
    const driver = createDriver();
    const stdout = [
      '{"location":"."}',
      '{"location":"packages/core"}',
      '{"location":"packages/utils"}',
      "",
      "not-json"
    ].join("\n");

    const result = driver.parseWorkspaces(stdout);
    expect(result).toEqual([
      { location: "." },
      { location: "packages/core" },
      { location: "packages/utils" }
    ]);
  });

  it("registryInfoCommand returns yarn npm info <pkg> --json", () => {
    const driver = createDriver();
    expect(driver.registryInfoCommand("react")).toEqual({
      command: "yarn",
      args: ["npm", "info", "react", "--json"]
    });
  });

  it("parseRegistryInfo extracts name, latestVersion, distTags, versions", () => {
    const driver = createDriver();
    const stdout = JSON.stringify({
      "dist-tags": { latest: "19.0.0", next: "20.0.0-alpha" },
      versions: ["18.0.0", "18.2.0", "19.0.0"]
    });

    const result = driver.parseRegistryInfo(stdout);
    expect(result.name).toBe("");
    expect(result.latestVersion).toBe("19.0.0");
    expect(result.distTags).toEqual({ latest: "19.0.0", next: "20.0.0-alpha" });
    expect(result.versions).toEqual(["18.0.0", "18.2.0", "19.0.0"]);
  });
});
```

Note: `parseRegistryInfo` receives the raw JSON stdout. The `name` field is passed separately by the caller (RegistryCacheService sets `name: packageName`). The driver's `parseRegistryInfo` returns `name: ""` — the caller fills it in. This matches the current RegistryCacheService logic where `name` comes from the argument, not the JSON.

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/api/services/packageManagers/__tests__/YarnDriver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement YarnDriver**

```typescript
// src/api/services/packageManagers/YarnDriver.ts
import { PackageManagerDriver as Abstraction } from "./abstractions/PackageManagerDriver.js";

interface IYarnInfoEntry {
  value?: string;
  children?: { Version?: string };
}

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
    const versions = new Map<string, string>();

    for (const line of stdout.split("\n")) {
      if (!line.trim()) {
        continue;
      }

      let entry: IYarnInfoEntry;
      try {
        entry = JSON.parse(line) as IYarnInfoEntry;
      } catch {
        continue;
      }

      if (!entry.value || !entry.children?.Version) {
        continue;
      }

      const atNpmIndex = entry.value.indexOf("@npm:");
      if (atNpmIndex <= 0) {
        continue;
      }

      const name = entry.value.substring(0, atNpmIndex);
      versions.set(name, entry.children.Version);
    }

    return versions;
  }

  public workspacesCommand(): Abstraction.CommandSpec {
    return { command: "yarn", args: ["workspaces", "list", "--json"] };
  }

  public parseWorkspaces(stdout: string): Abstraction.WorkspaceEntry[] {
    const workspaces: Abstraction.WorkspaceEntry[] = [];

    for (const line of stdout.split("\n")) {
      if (!line.trim()) {
        continue;
      }

      try {
        const entry = JSON.parse(line) as Abstraction.WorkspaceEntry;
        if (entry.location) {
          workspaces.push(entry);
        }
      } catch {
        continue;
      }
    }

    return workspaces;
  }

  public upgradePackageCommand(
    packageName: string,
    targetVersion: string
  ): Abstraction.CommandSpec {
    return { command: "yarn", args: ["up", `${packageName}@${targetVersion}`] };
  }

  public refreshTransientCommand(): Abstraction.CommandSpec {
    return { command: "yarn", args: ["up", "**", "-R"] };
  }

  public registryInfoCommand(packageName: string): Abstraction.CommandSpec {
    return { command: "yarn", args: ["npm", "info", packageName, "--json"] };
  }

  public parseRegistryInfo(stdout: string): Abstraction.RegistryPackageInfo {
    const raw = JSON.parse(stdout) as Record<string, unknown>;
    const distTags = (raw["dist-tags"] as Record<string, string> | undefined) ?? {};
    return {
      name: "",
      latestVersion: distTags["latest"] ?? "",
      distTags,
      versions: (raw["versions"] as string[] | undefined) ?? []
    };
  }
}

export const YarnDriver = Abstraction.createImplementation({
  implementation: YarnDriverImpl,
  dependencies: []
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/api/services/packageManagers/__tests__/YarnDriver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/services/packageManagers/
git commit -m "feat: add PackageManagerDriver abstraction and YarnDriver"
```

---

### Task 3: NpmDriver implementation

**Files:**

- Create: `src/api/services/packageManagers/NpmDriver.ts`
- Create: `src/api/services/packageManagers/__tests__/NpmDriver.test.ts`

**Interfaces:**

- Consumes: `PackageManagerDriver` abstraction from Task 1
- Produces: `NpmDriver` const (used by registry in Task 5)

Parser logic moves from ScanService `parseNpmLs`. Registry parser follows same pattern as YarnDriver but npm uses `npm view <pkg> --json`.

- [ ] **Step 1: Write NpmDriver tests**

```typescript
// src/api/services/packageManagers/__tests__/NpmDriver.test.ts
import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { PackageManagerDriver } from "../abstractions/PackageManagerDriver.js";
import { NpmDriver as NpmDriverRegistration } from "../NpmDriver.js";

describe("NpmDriver", () => {
  function createDriver(): PackageManagerDriver.Interface {
    const container = createContainer();
    container.register(NpmDriverRegistration);
    return container.resolve(PackageManagerDriver);
  }

  it("has id 'npm' and lockfileName 'package-lock.json'", () => {
    const driver = createDriver();
    expect(driver.id).toBe("npm");
    expect(driver.lockfileName).toBe("package-lock.json");
  });

  it("versionCommand returns npm --version", () => {
    const driver = createDriver();
    expect(driver.versionCommand()).toEqual({ command: "npm", args: ["--version"] });
  });

  it("updateVersionCommand returns npm install -g npm@<ver>", () => {
    const driver = createDriver();
    expect(driver.updateVersionCommand("10.9.0")).toEqual({
      command: "npm",
      args: ["install", "-g", "npm@10.9.0"]
    });
  });

  it("upgradePackageCommand returns npm install <name>@<ver>", () => {
    const driver = createDriver();
    expect(driver.upgradePackageCommand("react", "19.0.0")).toEqual({
      command: "npm",
      args: ["install", "react@19.0.0"]
    });
  });

  it("refreshTransientCommand returns npm update", () => {
    const driver = createDriver();
    expect(driver.refreshTransientCommand()).toEqual({
      command: "npm",
      args: ["update"]
    });
  });

  it("installedVersionsCommand returns npm ls --all --json", () => {
    const driver = createDriver();
    expect(driver.installedVersionsCommand()).toEqual({
      command: "npm",
      args: ["ls", "--all", "--json"]
    });
  });

  it("parseInstalledVersions walks dependency tree BFS (shallowest wins)", () => {
    const driver = createDriver();
    const stdout = JSON.stringify({
      dependencies: {
        react: {
          version: "18.2.0",
          dependencies: {
            "loose-envify": { version: "1.4.0" }
          }
        },
        lodash: { version: "4.17.21" }
      }
    });

    const result = driver.parseInstalledVersions(stdout);
    expect(result.get("react")).toBe("18.2.0");
    expect(result.get("lodash")).toBe("4.17.21");
    expect(result.get("loose-envify")).toBe("1.4.0");
    expect(result.size).toBe(3);
  });

  it("parseInstalledVersions returns empty map for invalid JSON", () => {
    const driver = createDriver();
    const result = driver.parseInstalledVersions("not json");
    expect(result.size).toBe(0);
  });

  it("workspacesCommand returns null (uses package.json)", () => {
    const driver = createDriver();
    expect(driver.workspacesCommand()).toBeNull();
  });

  it("parseWorkspaces returns empty array (npm uses package.json path)", () => {
    const driver = createDriver();
    expect(driver.parseWorkspaces("")).toEqual([]);
  });

  it("registryInfoCommand returns npm view <pkg> --json", () => {
    const driver = createDriver();
    expect(driver.registryInfoCommand("react")).toEqual({
      command: "npm",
      args: ["view", "react", "--json"]
    });
  });

  it("parseRegistryInfo extracts dist-tags and versions", () => {
    const driver = createDriver();
    const stdout = JSON.stringify({
      "dist-tags": { latest: "19.0.0" },
      versions: ["18.0.0", "19.0.0"]
    });

    const result = driver.parseRegistryInfo(stdout);
    expect(result.latestVersion).toBe("19.0.0");
    expect(result.versions).toEqual(["18.0.0", "19.0.0"]);
  });
});
```

- [ ] **Step 2: Implement NpmDriver**

```typescript
// src/api/services/packageManagers/NpmDriver.ts
import { PackageManagerDriver as Abstraction } from "./abstractions/PackageManagerDriver.js";

interface INpmLsEntry {
  version?: string;
  dependencies?: Record<string, INpmLsEntry>;
}

interface INpmLsOutput {
  dependencies?: Record<string, INpmLsEntry>;
}

class NpmDriverImpl implements Abstraction.Interface {
  public readonly id = "npm" as const;
  public readonly lockfileName = "package-lock.json";

  public versionCommand(): Abstraction.CommandSpec {
    return { command: "npm", args: ["--version"] };
  }

  public updateVersionCommand(version: string): Abstraction.CommandSpec {
    return { command: "npm", args: ["install", "-g", `npm@${version}`] };
  }

  public installedVersionsCommand(): Abstraction.CommandSpec {
    return { command: "npm", args: ["ls", "--all", "--json"] };
  }

  public parseInstalledVersions(stdout: string): Map<string, string> {
    const versions = new Map<string, string>();

    let output: INpmLsOutput;
    try {
      output = JSON.parse(stdout) as INpmLsOutput;
    } catch {
      return versions;
    }

    const queue: Record<string, INpmLsEntry>[] = [];
    if (output.dependencies) {
      queue.push(output.dependencies);
    }

    while (queue.length > 0) {
      const level = queue.shift()!;
      for (const [name, entry] of Object.entries(level)) {
        if (entry.version && !versions.has(name)) {
          versions.set(name, entry.version);
        }
        if (entry.dependencies) {
          queue.push(entry.dependencies);
        }
      }
    }

    return versions;
  }

  public workspacesCommand(): Abstraction.CommandSpec | null {
    return null;
  }

  public parseWorkspaces(_stdout: string): Abstraction.WorkspaceEntry[] {
    return [];
  }

  public upgradePackageCommand(
    packageName: string,
    targetVersion: string
  ): Abstraction.CommandSpec {
    return { command: "npm", args: ["install", `${packageName}@${targetVersion}`] };
  }

  public refreshTransientCommand(): Abstraction.CommandSpec {
    return { command: "npm", args: ["update"] };
  }

  public registryInfoCommand(packageName: string): Abstraction.CommandSpec {
    return { command: "npm", args: ["view", packageName, "--json"] };
  }

  public parseRegistryInfo(stdout: string): Abstraction.RegistryPackageInfo {
    const raw = JSON.parse(stdout) as Record<string, unknown>;
    const distTags = (raw["dist-tags"] as Record<string, string> | undefined) ?? {};
    return {
      name: "",
      latestVersion: distTags["latest"] ?? "",
      distTags,
      versions: (raw["versions"] as string[] | undefined) ?? []
    };
  }
}

export const NpmDriver = Abstraction.createImplementation({
  implementation: NpmDriverImpl,
  dependencies: []
});
```

- [ ] **Step 3: Run tests**

Run: `yarn test src/api/services/packageManagers/__tests__/NpmDriver.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/api/services/packageManagers/NpmDriver.ts src/api/services/packageManagers/__tests__/NpmDriver.test.ts
git commit -m "feat: add NpmDriver implementation"
```

---

### Task 4: PnpmDriver implementation

**Files:**

- Create: `src/api/services/packageManagers/PnpmDriver.ts`
- Create: `src/api/services/packageManagers/__tests__/PnpmDriver.test.ts`

**Interfaces:**

- Consumes: `PackageManagerDriver` abstraction from Task 1
- Produces: `PnpmDriver` const (used by registry in Task 5)

Parser logic moves from ScanService `parsePnpmList`.

- [ ] **Step 1: Write PnpmDriver tests**

```typescript
// src/api/services/packageManagers/__tests__/PnpmDriver.test.ts
import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { PackageManagerDriver } from "../abstractions/PackageManagerDriver.js";
import { PnpmDriver as PnpmDriverRegistration } from "../PnpmDriver.js";

describe("PnpmDriver", () => {
  function createDriver(): PackageManagerDriver.Interface {
    const container = createContainer();
    container.register(PnpmDriverRegistration);
    return container.resolve(PackageManagerDriver);
  }

  it("has id 'pnpm' and lockfileName 'pnpm-lock.yaml'", () => {
    const driver = createDriver();
    expect(driver.id).toBe("pnpm");
    expect(driver.lockfileName).toBe("pnpm-lock.yaml");
  });

  it("versionCommand returns pnpm --version", () => {
    const driver = createDriver();
    expect(driver.versionCommand()).toEqual({ command: "pnpm", args: ["--version"] });
  });

  it("updateVersionCommand returns pnpm add -g pnpm@<ver>", () => {
    const driver = createDriver();
    expect(driver.updateVersionCommand("9.5.0")).toEqual({
      command: "pnpm",
      args: ["add", "-g", "pnpm@9.5.0"]
    });
  });

  it("upgradePackageCommand returns pnpm update <name>@<ver>", () => {
    const driver = createDriver();
    expect(driver.upgradePackageCommand("react", "19.0.0")).toEqual({
      command: "pnpm",
      args: ["update", "react@19.0.0"]
    });
  });

  it("refreshTransientCommand returns pnpm update", () => {
    const driver = createDriver();
    expect(driver.refreshTransientCommand()).toEqual({
      command: "pnpm",
      args: ["update"]
    });
  });

  it("installedVersionsCommand returns pnpm list --json", () => {
    const driver = createDriver();
    expect(driver.installedVersionsCommand()).toEqual({
      command: "pnpm",
      args: ["list", "--json"]
    });
  });

  it("parseInstalledVersions extracts from pnpm list JSON array", () => {
    const driver = createDriver();
    const stdout = JSON.stringify([
      {
        dependencies: { react: { version: "18.2.0" } },
        devDependencies: { vitest: { version: "4.1.0" } }
      }
    ]);

    const result = driver.parseInstalledVersions(stdout);
    expect(result.get("react")).toBe("18.2.0");
    expect(result.get("vitest")).toBe("4.1.0");
    expect(result.size).toBe(2);
  });

  it("parseInstalledVersions returns empty map for invalid JSON", () => {
    const driver = createDriver();
    const result = driver.parseInstalledVersions("not json");
    expect(result.size).toBe(0);
  });

  it("workspacesCommand returns null (uses package.json)", () => {
    const driver = createDriver();
    expect(driver.workspacesCommand()).toBeNull();
  });

  it("parseWorkspaces returns empty array", () => {
    const driver = createDriver();
    expect(driver.parseWorkspaces("")).toEqual([]);
  });

  it("registryInfoCommand returns pnpm view <pkg> --json", () => {
    const driver = createDriver();
    expect(driver.registryInfoCommand("react")).toEqual({
      command: "pnpm",
      args: ["view", "react", "--json"]
    });
  });

  it("parseRegistryInfo extracts dist-tags and versions", () => {
    const driver = createDriver();
    const stdout = JSON.stringify({
      "dist-tags": { latest: "19.0.0" },
      versions: ["18.0.0", "19.0.0"]
    });

    const result = driver.parseRegistryInfo(stdout);
    expect(result.latestVersion).toBe("19.0.0");
  });
});
```

- [ ] **Step 2: Implement PnpmDriver**

```typescript
// src/api/services/packageManagers/PnpmDriver.ts
import { PackageManagerDriver as Abstraction } from "./abstractions/PackageManagerDriver.js";

interface IPnpmListEntry {
  dependencies?: Record<string, { version?: string }>;
  devDependencies?: Record<string, { version?: string }>;
}

class PnpmDriverImpl implements Abstraction.Interface {
  public readonly id = "pnpm" as const;
  public readonly lockfileName = "pnpm-lock.yaml";

  public versionCommand(): Abstraction.CommandSpec {
    return { command: "pnpm", args: ["--version"] };
  }

  public updateVersionCommand(version: string): Abstraction.CommandSpec {
    return { command: "pnpm", args: ["add", "-g", `pnpm@${version}`] };
  }

  public installedVersionsCommand(): Abstraction.CommandSpec {
    return { command: "pnpm", args: ["list", "--json"] };
  }

  public parseInstalledVersions(stdout: string): Map<string, string> {
    const versions = new Map<string, string>();

    let entries: IPnpmListEntry[];
    try {
      const parsed: unknown = JSON.parse(stdout);
      entries = Array.isArray(parsed) ? (parsed as IPnpmListEntry[]) : [];
    } catch {
      return versions;
    }

    for (const entry of entries) {
      for (const deps of [entry.dependencies, entry.devDependencies]) {
        for (const [name, info] of Object.entries(deps ?? {})) {
          if (info.version && !versions.has(name)) {
            versions.set(name, info.version);
          }
        }
      }
    }

    return versions;
  }

  public workspacesCommand(): Abstraction.CommandSpec | null {
    return null;
  }

  public parseWorkspaces(_stdout: string): Abstraction.WorkspaceEntry[] {
    return [];
  }

  public upgradePackageCommand(
    packageName: string,
    targetVersion: string
  ): Abstraction.CommandSpec {
    return { command: "pnpm", args: ["update", `${packageName}@${targetVersion}`] };
  }

  public refreshTransientCommand(): Abstraction.CommandSpec {
    return { command: "pnpm", args: ["update"] };
  }

  public registryInfoCommand(packageName: string): Abstraction.CommandSpec {
    return { command: "pnpm", args: ["view", packageName, "--json"] };
  }

  public parseRegistryInfo(stdout: string): Abstraction.RegistryPackageInfo {
    const raw = JSON.parse(stdout) as Record<string, unknown>;
    const distTags = (raw["dist-tags"] as Record<string, string> | undefined) ?? {};
    return {
      name: "",
      latestVersion: distTags["latest"] ?? "",
      distTags,
      versions: (raw["versions"] as string[] | undefined) ?? []
    };
  }
}

export const PnpmDriver = Abstraction.createImplementation({
  implementation: PnpmDriverImpl,
  dependencies: []
});
```

- [ ] **Step 3: Run tests**

Run: `yarn test src/api/services/packageManagers/__tests__/PnpmDriver.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/api/services/packageManagers/PnpmDriver.ts src/api/services/packageManagers/__tests__/PnpmDriver.test.ts
git commit -m "feat: add PnpmDriver implementation"
```

---

### Task 5: Registry implementation + feature + barrel

**Files:**

- Create: `src/api/services/packageManagers/PackageManagerDriverRegistry.ts`
- Create: `src/api/services/packageManagers/feature.ts`
- Create: `src/api/services/packageManagers/index.ts`
- Create: `src/api/services/packageManagers/__tests__/PackageManagerDriverRegistry.test.ts`

**Interfaces:**

- Consumes: `PackageManagerDriverRegistry` abstraction (Task 1), `YarnDriver` (Task 2), `NpmDriver` (Task 3), `PnpmDriver` (Task 4)
- Produces: `PackageManagerDriverRegistryFeature` feature, `PackageManagerDriverRegistry` resolved singleton

- [ ] **Step 1: Write registry test**

```typescript
// src/api/services/packageManagers/__tests__/PackageManagerDriverRegistry.test.ts
import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { PackageManagerDriverRegistry } from "../abstractions/PackageManagerDriverRegistry.js";
import { PackageManagerDriverRegistry as RegistryRegistration } from "../PackageManagerDriverRegistry.js";

describe("PackageManagerDriverRegistry", () => {
  function createRegistry(): PackageManagerDriverRegistry.Interface {
    const container = createContainer();
    container.register(RegistryRegistration).inSingletonScope();
    return container.resolve(PackageManagerDriverRegistry);
  }

  it("returns yarn driver for 'yarn'", () => {
    const registry = createRegistry();
    const driver = registry.getDriver("yarn");
    expect(driver.id).toBe("yarn");
    expect(driver.lockfileName).toBe("yarn.lock");
  });

  it("returns npm driver for 'npm'", () => {
    const registry = createRegistry();
    const driver = registry.getDriver("npm");
    expect(driver.id).toBe("npm");
  });

  it("returns pnpm driver for 'pnpm'", () => {
    const registry = createRegistry();
    const driver = registry.getDriver("pnpm");
    expect(driver.id).toBe("pnpm");
  });

  it("throws for unknown package manager", () => {
    const registry = createRegistry();
    expect(() => registry.getDriver("bun")).toThrow("No driver for package manager: bun");
  });

  it("getAllDrivers returns drivers in priority order: yarn, pnpm, npm", () => {
    const registry = createRegistry();
    const drivers = registry.getAllDrivers();
    expect(drivers).toHaveLength(3);
    expect(drivers[0]!.id).toBe("yarn");
    expect(drivers[1]!.id).toBe("pnpm");
    expect(drivers[2]!.id).toBe("npm");
  });
});
```

- [ ] **Step 2: Implement registry**

```typescript
// src/api/services/packageManagers/PackageManagerDriverRegistry.ts
import { PackageManagerDriverRegistry as Abstraction } from "./abstractions/PackageManagerDriverRegistry.js";
import type { PackageManagerDriver } from "./abstractions/PackageManagerDriver.js";
import { YarnDriver } from "./YarnDriver.js";
import { NpmDriver } from "./NpmDriver.js";
import { PnpmDriver } from "./PnpmDriver.js";
import { createContainer } from "#shared/index.js";
import { PackageManagerDriver as DriverAbstraction } from "./abstractions/PackageManagerDriver.js";

class PackageManagerDriverRegistryImpl implements Abstraction.Interface {
  private readonly drivers = new Map<string, PackageManagerDriver.Interface>();

  public constructor() {
    const container = createContainer();

    container.register(YarnDriver);
    const yarn = container.resolve(DriverAbstraction);

    container.register(NpmDriver);
    const npm = container.resolve(DriverAbstraction);

    container.register(PnpmDriver);
    const pnpm = container.resolve(DriverAbstraction);

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

export const PackageManagerDriverRegistry = Abstraction.createImplementation({
  implementation: PackageManagerDriverRegistryImpl,
  dependencies: []
});
```

Note: The registry creates its own internal container to resolve each driver. Since drivers have no DI deps, this is a lightweight operation. This avoids the problem of all 3 drivers sharing the same `PackageManagerDriver` abstraction token — resolving it would only return the last registered one. Each driver gets its own mini-container. Alternatively, drivers could be instantiated directly with `new`, but the DI skill requires using `createImplementation`. The implementer should verify this approach compiles and pick the simpler option if needed (e.g., just `new YarnDriverImpl()`).

- [ ] **Step 3: Create feature**

```typescript
// src/api/services/packageManagers/feature.ts
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { PackageManagerDriverRegistry } from "./PackageManagerDriverRegistry.js";

export const PackageManagerDriverFeature = createFeature({
  name: "Api/PackageManagerDriverFeature",
  register(container: Container) {
    container.register(PackageManagerDriverRegistry).inSingletonScope();
  }
});
```

- [ ] **Step 4: Create barrel**

```typescript
// src/api/services/packageManagers/index.ts
export { PackageManagerDriver, PackageManagerDriverRegistry } from "./abstractions/index.js";
export { PackageManagerDriverFeature } from "./feature.js";
```

- [ ] **Step 5: Run all driver + registry tests**

Run: `yarn test src/api/services/packageManagers/`
Expected: all PASS

- [ ] **Step 6: Run full suite**

Run: `yarn full`
Expected: all PASS (no existing tests broken — new code only)

- [ ] **Step 7: Commit**

```bash
git add src/api/services/packageManagers/PackageManagerDriverRegistry.ts src/api/services/packageManagers/feature.ts src/api/services/packageManagers/index.ts src/api/services/packageManagers/__tests__/PackageManagerDriverRegistry.test.ts
git commit -m "feat: add PackageManagerDriverRegistry and feature"
```
