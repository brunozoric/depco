# PM Settings Part 1: Schema Migration, Install Flag Registry, and FileConfigService

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `securitySettings` to `pmSettings`, build install flag registry, extend FileConfigService schema with install flags / registry URL / upgrade strategy validation.

**Architecture:** `pmSettings` replaces `securitySettings` as a unified per-PM config section. `INSTALL_FLAG_REGISTRY` (like `SECURITY_FIELD_REGISTRY`) provides per-PM flag definitions. FileConfigService Zod schema validates all sub-fields via `superRefine`.

**Tech Stack:** Zod, `@webiny/stdlib/node` JsonFileTool, `@webiny/di`

## Global Constraints

- All interfaces in `abstractions/` directory, one file per token
- Never inline structural types — always named interfaces
- Test with real DI container (`createContainer()`), never `new XxxImpl()`
- `yarn vitest run` for tests, `yarn build` for type checking
- This project uses yarn, not npm
- `fileParallelism: false` in vitest config — tests run sequentially

---

### Task 1: Build install flag registry

**Files:**

- Modify: `src/shared/install/types.ts`
- Create: `src/shared/install/yarn.ts`
- Create: `src/shared/install/npm.ts`
- Create: `src/shared/install/pnpm.ts`
- Create: `src/shared/install/bun.ts`
- Modify: `src/shared/install/index.ts`
- Create: `src/shared/install/__tests__/installFlags.test.ts`

**Interfaces:**

- Consumes: existing `IInstallFlagDefinition` from `src/shared/install/types.ts`
- Produces: `INSTALL_FLAG_REGISTRY: Record<PackageManagerId, IInstallFlagDefinition[]>` exported from `src/shared/install/index.ts`

- [ ] **Step 1: Write failing test — registry has entries for all PMs**

Create `src/shared/install/__tests__/installFlags.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { INSTALL_FLAG_REGISTRY } from "../index.js";

describe("INSTALL_FLAG_REGISTRY", () => {
  it("has entries for all package managers", () => {
    expect(INSTALL_FLAG_REGISTRY.yarn.length).toBeGreaterThan(0);
    expect(INSTALL_FLAG_REGISTRY.npm.length).toBeGreaterThan(0);
    expect(INSTALL_FLAG_REGISTRY.pnpm.length).toBeGreaterThan(0);
    expect(INSTALL_FLAG_REGISTRY.bun.length).toBeGreaterThan(0);
  });

  it("has no duplicate flags per PM", () => {
    for (const [pm, flags] of Object.entries(INSTALL_FLAG_REGISTRY)) {
      const flagNames = flags.map(f => f.flag);
      expect(new Set(flagNames).size).toBe(flagNames.length);
    }
  });

  it("every flag has a defaultEnabled boolean", () => {
    for (const flags of Object.values(INSTALL_FLAG_REGISTRY)) {
      for (const flag of flags) {
        expect(typeof flag.defaultEnabled).toBe("boolean");
      }
    }
  });

  it("pnpm flags match known set", () => {
    const flags = INSTALL_FLAG_REGISTRY.pnpm.map(f => f.flag);
    expect(flags).toContain("--frozen-lockfile");
    expect(flags).toContain("--prod");
    expect(flags).toContain("--force");
    expect(flags).toContain("--ignore-scripts");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/shared/install/__tests__/installFlags.test.ts`
Expected: FAIL — `INSTALL_FLAG_REGISTRY` does not exist

- [ ] **Step 3: Add `defaultEnabled` to `IInstallFlagDefinition`**

In `src/shared/install/types.ts`:

```typescript
export interface IInstallFlagDefinition {
  flag: string;
  label: string;
  description: string;
  exclusive?: string;
  defaultEnabled: boolean;
}
```

- [ ] **Step 4: Create per-PM flag files**

Create `src/shared/install/pnpm.ts` — extract from `PnpmDriver.installFlags()`:

```typescript
import type { IInstallFlagDefinition } from "./types.js";

export const PNPM_INSTALL_FLAGS: IInstallFlagDefinition[] = [
  {
    flag: "--frozen-lockfile",
    label: "Frozen lockfile",
    description: "Fail if lockfile is outdated",
    defaultEnabled: false
  },
  {
    flag: "--prod",
    label: "Production",
    description: "Skip devDependencies",
    defaultEnabled: false
  },
  {
    flag: "--force",
    label: "Force",
    description: "Force reinstall all packages",
    defaultEnabled: false
  },
  {
    flag: "--ignore-scripts",
    label: "Ignore scripts",
    description: "Skip lifecycle scripts",
    defaultEnabled: false
  }
];
```

Create `src/shared/install/yarn.ts` — extract from `YarnDriver.installFlags()`. Read the actual driver file to get exact flags, labels, descriptions, and exclusive values. The yarn driver has `--immutable`, `--production`, `--force`, `--ignore-scripts`.

Create `src/shared/install/npm.ts` — extract from `NpmDriver.installFlags()`. Flags: `--omit=dev`, `--force`, `--legacy-peer-deps`, `--ignore-scripts`.

Create `src/shared/install/bun.ts` — extract from `BunDriver.installFlags()`. Flags: `--frozen-lockfile`, `--production`, `--force`, `--dry-run`, `--ignore-scripts`.

All `defaultEnabled: false` (none are enabled by default — the user selects them in UI or file config).

- [ ] **Step 5: Export registry from index**

In `src/shared/install/index.ts`:

```typescript
export { type IInstallFlagDefinition } from "./types.js";
export { YARN_INSTALL_FLAGS } from "./yarn.js";
export { NPM_INSTALL_FLAGS } from "./npm.js";
export { PNPM_INSTALL_FLAGS } from "./pnpm.js";
export { BUN_INSTALL_FLAGS } from "./bun.js";

import type { PackageManagerId } from "#shared/security/types.js";
import type { IInstallFlagDefinition } from "./types.js";
import { YARN_INSTALL_FLAGS } from "./yarn.js";
import { NPM_INSTALL_FLAGS } from "./npm.js";
import { PNPM_INSTALL_FLAGS } from "./pnpm.js";
import { BUN_INSTALL_FLAGS } from "./bun.js";

export const INSTALL_FLAG_REGISTRY: Record<PackageManagerId, IInstallFlagDefinition[]> = {
  yarn: YARN_INSTALL_FLAGS,
  npm: NPM_INSTALL_FLAGS,
  pnpm: PNPM_INSTALL_FLAGS,
  bun: BUN_INSTALL_FLAGS
};
```

- [ ] **Step 6: Update drivers to use registry**

Each driver's `installFlags()` becomes a thin wrapper. For example in `PnpmDriver.ts`:

```typescript
import { PNPM_INSTALL_FLAGS } from "#shared/install/pnpm.js";

public installFlags(): IInstallFlagDefinition[] {
    return PNPM_INSTALL_FLAGS;
}
```

Same pattern for `YarnDriver` (import `YARN_INSTALL_FLAGS`), `NpmDriver` (`NPM_INSTALL_FLAGS`), `BunDriver` (`BUN_INSTALL_FLAGS`).

- [ ] **Step 7: Update install route schema**

In `src/shared/routes/install.ts`, add `defaultEnabled` to the response schema:

```typescript
response: z.object({
  items: z.array(
    z.object({
      flag: z.string(),
      label: z.string(),
      description: z.string(),
      exclusive: z.string().optional(),
      defaultEnabled: z.boolean()
    })
  ),
  total: z.number()
});
```

- [ ] **Step 8: Run all tests**

Run: `yarn vitest run`
Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add src/shared/install/ src/api/services/packageManagers/YarnDriver.ts src/api/services/packageManagers/NpmDriver.ts src/api/services/packageManagers/PnpmDriver.ts src/api/services/packageManagers/BunDriver.ts src/shared/routes/install.ts
git commit -m "feat: build install flag registry and extract flags from drivers"
```

---

### Task 2: Migrate securitySettings to pmSettings in abstraction and schema

**Files:**

- Modify: `src/api/services/abstractions/FileConfigService.ts`
- Modify: `src/api/services/FileConfigService.ts`
- Test: `src/api/services/__tests__/FileConfigService.test.ts`

**Interfaces:**

- Consumes: `INSTALL_FLAG_REGISTRY` from Task 1, `SECURITY_FIELD_REGISTRY` from `#shared/security/index.js`
- Produces: `IFilePmSettings`, `IFileAllPmSettings` on abstraction; updated `IProjectFileConfig` with `pmSettings?` replacing `securitySettings?`; Zod schema validating all `pmSettings` sub-fields

- [ ] **Step 1: Write failing test — pmSettings with security parsed correctly**

In `src/api/services/__tests__/FileConfigService.test.ts`, find existing tests that use `securitySettings` key and replace with `pmSettings` equivalent:

```typescript
it("returns parsed config with pmSettings security", async () => {
  const config = {
    pmSettings: {
      pnpm: {
        security: {
          ignoreScripts: "true",
          strictSsl: "true"
        }
      }
    }
  };
  await writeFile(join(tempDir, ".dependency-upgrader.json"), JSON.stringify(config), "utf-8");

  const result = await service.readConfig(tempDir);
  expect(result!.pmSettings!.pnpm!.security).toEqual({
    ignoreScripts: "true",
    strictSsl: "true"
  });
});
```

- [ ] **Step 2: Write failing test — pmSettings with installFlags parsed**

```typescript
it("returns parsed config with pmSettings installFlags", async () => {
  const config = {
    pmSettings: {
      pnpm: {
        installFlags: { "--frozen-lockfile": true, "--ignore-scripts": true }
      }
    }
  };
  await writeFile(join(tempDir, ".dependency-upgrader.json"), JSON.stringify(config), "utf-8");

  const result = await service.readConfig(tempDir);
  expect(result!.pmSettings!.pnpm!.installFlags).toEqual({
    "--frozen-lockfile": true,
    "--ignore-scripts": true
  });
});
```

- [ ] **Step 3: Write failing test — unknown install flag rejected**

```typescript
it("throws on unknown install flag for known PM", async () => {
  await writeFile(
    join(tempDir, ".dependency-upgrader.json"),
    JSON.stringify({
      pmSettings: { pnpm: { installFlags: { "--nonexistent": true } } }
    }),
    "utf-8"
  );

  await expect(service.readConfig(tempDir)).rejects.toThrow();
});
```

- [ ] **Step 4: Write failing test — registryUrl and upgradeStrategy parsed**

```typescript
it("returns parsed config with registryUrl and upgradeStrategy", async () => {
  const config = {
    pmSettings: {
      pnpm: {
        registryUrl: "https://registry.npmmirror.com",
        upgradeStrategy: "exact"
      }
    }
  };
  await writeFile(join(tempDir, ".dependency-upgrader.json"), JSON.stringify(config), "utf-8");

  const result = await service.readConfig(tempDir);
  expect(result!.pmSettings!.pnpm!.registryUrl).toBe("https://registry.npmmirror.com");
  expect(result!.pmSettings!.pnpm!.upgradeStrategy).toBe("exact");
});

it("throws on invalid upgradeStrategy", async () => {
  await writeFile(
    join(tempDir, ".dependency-upgrader.json"),
    JSON.stringify({
      pmSettings: { pnpm: { upgradeStrategy: "yolo" } }
    }),
    "utf-8"
  );

  await expect(service.readConfig(tempDir)).rejects.toThrow();
});
```

- [ ] **Step 5: Write failing test — old securitySettings key rejected**

```typescript
it("throws when using old securitySettings key", async () => {
  await writeFile(
    join(tempDir, ".dependency-upgrader.json"),
    JSON.stringify({
      securitySettings: { pnpm: { ignoreScripts: "true" } }
    }),
    "utf-8"
  );

  await expect(service.readConfig(tempDir)).rejects.toThrow();
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `yarn vitest run src/api/services/__tests__/FileConfigService.test.ts`
Expected: FAIL — `pmSettings` not in schema

- [ ] **Step 7: Update abstraction types**

In `src/api/services/abstractions/FileConfigService.ts`:

1. Remove `IFileSecuritySettings` interface
2. Add new interfaces:

```typescript
export interface IFilePmSettings {
  security?: { [fieldName: string]: string };
  installFlags?: { [cliFlag: string]: boolean };
  registryUrl?: string;
  upgradeStrategy?: "caret" | "tilde" | "exact" | "latest";
}

export interface IFileAllPmSettings {
  [packageManager: string]: IFilePmSettings;
}
```

3. Update `IProjectFileConfig`:

```typescript
export interface IProjectFileConfig {
  stepHooks?: IFileStepHook[];
  settings?: IFileSettings;
  pmSettings?: IFileAllPmSettings;
}
```

4. Update namespace — remove `SecuritySettings`, add `PmSettings` and `AllPmSettings`:

```typescript
export namespace FileConfigService {
  export type Interface = IFileConfigService;
  export type FileConfig = IProjectFileConfig;
  export type StepHook = IFileStepHook;
  export type Settings = IFileSettings;
  export type PmSettings = IFilePmSettings;
  export type AllPmSettings = IFileAllPmSettings;
  export type ConfigError = IFileConfigError;
  export type ConfigResult = IFileConfigResult;
  export type SettingsResult = IFileSettingsResult;
}
```

- [ ] **Step 8: Replace securitySettings Zod schema with pmSettings schema**

In `src/api/services/FileConfigService.ts`:

1. Add import for `INSTALL_FLAG_REGISTRY`:

```typescript
import { INSTALL_FLAG_REGISTRY } from "#shared/install/index.js";
```

2. Remove `fileSecuritySettingsSchema` and replace with `filePmSettingsSchema`:

```typescript
const filePmSettingsSchema = z
  .record(
    z.string(),
    z.object({
      security: z.record(z.string(), z.string()).optional(),
      installFlags: z.record(z.string(), z.boolean()).optional(),
      registryUrl: z.string().url().optional(),
      upgradeStrategy: z.enum(["caret", "tilde", "exact", "latest"]).optional()
    })
  )
  .optional()
  .superRefine((value, ctx) => {
    if (!value) {
      return;
    }
    const validPms = ["yarn", "npm", "pnpm", "bun"];
    for (const [pm, pmConfig] of Object.entries(value)) {
      if (!validPms.includes(pm)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown package manager: ${pm}`,
          path: [pm]
        });
        continue;
      }

      // Validate security fields
      if (pmConfig.security) {
        const registry = SECURITY_FIELD_REGISTRY[pm as PackageManagerId];
        for (const [fieldName, fieldValue] of Object.entries(pmConfig.security)) {
          const fieldDef = registry?.find(f => f.fieldName === fieldName);
          if (!fieldDef) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Unknown security field "${fieldName}" for ${pm}`,
              path: [pm, "security", fieldName]
            });
            continue;
          }
          const validation = fieldDef.expectedValueSchema.safeParse(fieldValue);
          if (!validation.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: validation.error.issues[0]?.message ?? `Invalid value for ${fieldName}`,
              path: [pm, "security", fieldName]
            });
          }
        }
      }

      // Validate install flags
      if (pmConfig.installFlags) {
        const flagRegistry = INSTALL_FLAG_REGISTRY[pm as PackageManagerId];
        const knownFlags = new Set(flagRegistry.map(f => f.flag));
        for (const flagKey of Object.keys(pmConfig.installFlags)) {
          if (!knownFlags.has(flagKey)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Unknown install flag "${flagKey}" for ${pm}`,
              path: [pm, "installFlags", flagKey]
            });
          }
        }
      }
    }
  });
```

3. Update `projectFileConfigSchema`:

```typescript
const projectFileConfigSchema = z.object({
  stepHooks: z.array(fileStepHookSchema).optional(),
  settings: fileSettingsSchema.optional(),
  pmSettings: filePmSettingsSchema
});
```

- [ ] **Step 9: Update `toFileConfig` helper**

Replace `securitySettings` handling with `pmSettings`:

```typescript
function toFileConfig(parsed: z.infer<typeof projectFileConfigSchema>): IProjectFileConfig {
  const config: IProjectFileConfig = {};
  if (parsed.stepHooks !== undefined) {
    config.stepHooks = parsed.stepHooks;
  }
  if (parsed.settings !== undefined) {
    config.settings = toFileSettings(parsed.settings);
  }
  if (parsed.pmSettings !== undefined) {
    config.pmSettings = toFilePmSettings(parsed.pmSettings);
  }
  return config;
}
```

Add `toFilePmSettings` helper to handle `exactOptionalPropertyTypes`:

```typescript
function toFilePmSettings(
  parsed: NonNullable<z.infer<typeof filePmSettingsSchema>>
): IFileAllPmSettings {
  const result: IFileAllPmSettings = {};
  for (const [pm, pmConfig] of Object.entries(parsed)) {
    const settings: IFilePmSettings = {};
    if (pmConfig.security !== undefined) {
      settings.security = pmConfig.security;
    }
    if (pmConfig.installFlags !== undefined) {
      settings.installFlags = pmConfig.installFlags;
    }
    if (pmConfig.registryUrl !== undefined) {
      settings.registryUrl = pmConfig.registryUrl;
    }
    if (pmConfig.upgradeStrategy !== undefined) {
      settings.upgradeStrategy = pmConfig.upgradeStrategy;
    }
    result[pm] = settings;
  }
  return result;
}
```

- [ ] **Step 10: Update existing tests**

All tests that used `securitySettings: { pnpm: { ... } }` must change to `pmSettings: { pnpm: { security: { ... } } }`. Find all occurrences in `FileConfigService.test.ts` and update.

Also update the `readGlobalConfig` tests that reference `config.securitySettings` to use `config.pmSettings`.

- [ ] **Step 11: Run all tests**

Run: `yarn vitest run`
Expected: build errors in `settings.ts` route (references `config.securitySettings`) — expected, fixed in Plan 2. FileConfigService tests should pass.

Run just FileConfigService tests: `yarn vitest run src/api/services/__tests__/FileConfigService.test.ts`
Expected: all pass

- [ ] **Step 12: Commit**

```bash
git add src/api/services/abstractions/FileConfigService.ts src/api/services/FileConfigService.ts src/api/services/__tests__/FileConfigService.test.ts
git commit -m "feat: migrate securitySettings to pmSettings with install flags, registry URL, and upgrade strategy"
```
