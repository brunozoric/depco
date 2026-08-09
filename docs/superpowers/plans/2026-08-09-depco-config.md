# depco.config.ts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `depco.config.ts` support with `defineConfig()` for type-safe scan configuration — license risk tiers, vulnerability severity, ignored packages, registry URL.

**Architecture:** Config types + Zod schema in `src/shared/config/`. `defineConfig()` identity function exported via package.json `exports` subpath. New `LoadConfig` DI step in scan pipeline. CheckLicenses modified to read config from context.

**Tech Stack:** Zod (validation), tsx (TS config loading), existing DI pattern (Step abstraction)

## Global Constraints

- All DI follows existing pattern: `createAbstraction<T>(name)` + `Abstraction.createImplementation({implementation, dependencies})` + `createFeature({name, register(container)})` + index.ts exports abstractions+feature only
- Namespace pattern: `export namespace X { export type Interface = IX; }`
- Named interfaces (never inline structural types)
- Object params with named keys when function has 2+ params
- `yarn full` must pass after every task
- Format with `yarn format:fix` + `yarn lint:fix` before committing
- Config is external user input — validate with Zod
- `RISK_TIER_VALUES` from `#shared/licenses/types.js` — `["permissive", "weak-copyleft", "copyleft", "proprietary", "unknown"] as const`
- `VULNERABILITY_SEVERITIES` from `#shared/vulnerabilities/types.js` — `["critical", "high", "moderate", "low", "info"] as const`

---

### Task 1: Config types + defineConfig + Zod schema + package.json exports

**Files:**
- Create: `src/shared/config/types.ts`
- Create: `src/shared/config/defineConfig.ts`
- Create: `src/shared/config/schema.ts`
- Create: `src/shared/config/index.ts`
- Create: `src/shared/config/__tests__/schema.test.ts`
- Modify: `package.json` (add `exports` field)

**Interfaces:**
- Consumes: `RISK_TIER_VALUES`, `LicenseRiskTier` from `#shared/licenses/types.js`, `VULNERABILITY_SEVERITIES`, `VulnerabilitySeverity` from `#shared/vulnerabilities/types.js`, `z` from `zod`
- Produces: `IDepcoConfig`, `IScanConfig`, `ILicenseScanConfig`, `IVulnerabilityScanConfig` interfaces, `defineConfig(config: IDepcoConfig): IDepcoConfig` function, `depcoConfigSchema` Zod schema

- [ ] **Step 1: Write Zod schema tests**

```typescript
// src/shared/config/__tests__/schema.test.ts
import { describe, it, expect } from "vitest";
import { depcoConfigSchema } from "../schema.js";

describe("depcoConfigSchema", () => {
    it("accepts empty config", () => {
        const result = depcoConfigSchema.parse({});
        expect(result).toEqual({});
    });

    it("accepts full config", () => {
        const result = depcoConfigSchema.parse({
            scan: {
                license: {
                    allowedRiskTiers: ["permissive", "weak-copyleft"],
                    ignoredPackages: ["some-pkg"]
                },
                vulnerability: {
                    maxSeverity: "moderate",
                    ignoredPackages: ["old-pkg"]
                },
                ignoredPackages: ["internal"],
                registryUrl: "https://custom.registry.com"
            }
        });
        expect(result.scan?.license?.allowedRiskTiers).toEqual(["permissive", "weak-copyleft"]);
        expect(result.scan?.vulnerability?.maxSeverity).toBe("moderate");
    });

    it("accepts config with only scan.license", () => {
        const result = depcoConfigSchema.parse({
            scan: { license: { allowedRiskTiers: ["permissive"] } }
        });
        expect(result.scan?.license?.allowedRiskTiers).toEqual(["permissive"]);
    });

    it("rejects invalid risk tier", () => {
        expect(() =>
            depcoConfigSchema.parse({
                scan: { license: { allowedRiskTiers: ["invalid-tier"] } }
            })
        ).toThrow();
    });

    it("rejects invalid severity", () => {
        expect(() =>
            depcoConfigSchema.parse({
                scan: { vulnerability: { maxSeverity: "invalid" } }
            })
        ).toThrow();
    });

    it("rejects invalid registry URL", () => {
        expect(() =>
            depcoConfigSchema.parse({
                scan: { registryUrl: "not-a-url" }
            })
        ).toThrow();
    });
});
```

- [ ] **Step 2: Run tests — verify failure**

```bash
yarn test src/shared/config/__tests__/schema.test.ts
```

- [ ] **Step 3: Create config types**

```typescript
// src/shared/config/types.ts
import type { LicenseRiskTier } from "../licenses/types.js";
import type { VulnerabilitySeverity } from "../vulnerabilities/types.js";

export interface ILicenseScanConfig {
    allowedRiskTiers?: LicenseRiskTier[];
    ignoredPackages?: string[];
}

export interface IVulnerabilityScanConfig {
    maxSeverity?: VulnerabilitySeverity;
    ignoredPackages?: string[];
}

export interface IScanConfig {
    license?: ILicenseScanConfig;
    vulnerability?: IVulnerabilityScanConfig;
    ignoredPackages?: string[];
    registryUrl?: string;
}

export interface IDepcoConfig {
    scan?: IScanConfig;
}
```

- [ ] **Step 4: Create Zod schema**

```typescript
// src/shared/config/schema.ts
import { z } from "zod";
import { RISK_TIER_VALUES } from "../licenses/types.js";
import { VULNERABILITY_SEVERITIES } from "../vulnerabilities/types.js";

const licenseScanConfigSchema = z.object({
    allowedRiskTiers: z.array(z.enum(RISK_TIER_VALUES)).optional(),
    ignoredPackages: z.array(z.string()).optional()
});

const vulnerabilityScanConfigSchema = z.object({
    maxSeverity: z.enum(VULNERABILITY_SEVERITIES).optional(),
    ignoredPackages: z.array(z.string()).optional()
});

const scanConfigSchema = z.object({
    license: licenseScanConfigSchema.optional(),
    vulnerability: vulnerabilityScanConfigSchema.optional(),
    ignoredPackages: z.array(z.string()).optional(),
    registryUrl: z.string().url().optional()
});

export const depcoConfigSchema = z.object({
    scan: scanConfigSchema.optional()
});
```

- [ ] **Step 5: Create defineConfig**

```typescript
// src/shared/config/defineConfig.ts
import type { IDepcoConfig } from "./types.js";

export function defineConfig(config: IDepcoConfig): IDepcoConfig {
    return config;
}
```

- [ ] **Step 6: Create barrel export**

```typescript
// src/shared/config/index.ts
export { defineConfig } from "./defineConfig.js";
export { depcoConfigSchema } from "./schema.js";
export type {
    IDepcoConfig,
    IScanConfig,
    ILicenseScanConfig,
    IVulnerabilityScanConfig
} from "./types.js";
```

- [ ] **Step 7: Add package.json exports**

Add an `exports` field to the top-level `package.json`. Place it after the `types` field (around line 8):

```json
"exports": {
    "./config": {
        "source": "./src/shared/config/index.ts",
        "default": "./dist/shared/config/index.js"
    }
}
```

- [ ] **Step 8: Run tests — verify pass + yarn full**

```bash
yarn test src/shared/config/__tests__/schema.test.ts
yarn full
```

- [ ] **Step 9: Commit**

```bash
git add src/shared/config/ package.json
git commit -m "feat(config): add depco.config.ts types, Zod schema, and defineConfig"
```

---

### Task 2: LoadConfig step

**Files:**
- Create: `src/cli/commands/scan/steps/LoadConfig/abstractions/LoadConfigStep.ts`
- Create: `src/cli/commands/scan/steps/LoadConfig/abstractions/index.ts`
- Create: `src/cli/commands/scan/steps/LoadConfig/LoadConfigStep.ts`
- Create: `src/cli/commands/scan/steps/LoadConfig/feature.ts`
- Create: `src/cli/commands/scan/steps/LoadConfig/index.ts`
- Create: `src/cli/commands/scan/steps/LoadConfig/__tests__/LoadConfigStep.test.ts`

**Interfaces:**
- Consumes: `Step` from `src/cli/runner/abstractions/Step.ts`, `depcoConfigSchema` from `#shared/config/schema.js`, `IDepcoConfig` from `#shared/config/types.js`
- Produces: `LoadConfigStep` abstraction, `LoadConfigStepFeature`. Stores `context.results.set("config", validatedConfig)` as `IDepcoConfig`.

- [ ] **Step 1: Write failing tests**

```typescript
// src/cli/commands/scan/steps/LoadConfig/__tests__/LoadConfigStep.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createContainer } from "#shared/index.js";
import { LoadConfigStepFeature } from "../feature.js";
import { LoadConfigStep } from "../abstractions/LoadConfigStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";
import type { IDepcoConfig } from "#shared/config/types.js";

function createTestContext(dataDirectory: string): IStepContext {
    return {
        dataDirectory,
        envFilePath: "./.env",
        options: {},
        results: new Map()
    };
}

describe("LoadConfigStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "load-config-"));
        container = createContainer();
        LoadConfigStepFeature.register(container);
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("loads config from depco.config.ts", async () => {
        writeFileSync(
            join(workDir, "depco.config.ts"),
            `export default { scan: { license: { allowedRiskTiers: ["permissive", "weak-copyleft"] } } };`
        );
        const step = container.resolve(LoadConfigStep);
        const context = createTestContext(workDir);
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        const config = context.results.get("config") as IDepcoConfig;
        expect(config.scan?.license?.allowedRiskTiers).toEqual(["permissive", "weak-copyleft"]);
    });

    it("returns empty config when no file exists", async () => {
        const step = container.resolve(LoadConfigStep);
        const context = createTestContext(workDir);
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        const config = context.results.get("config") as IDepcoConfig;
        expect(config).toEqual({});
    });

    it("fails on invalid config", async () => {
        writeFileSync(
            join(workDir, "depco.config.ts"),
            `export default { scan: { license: { allowedRiskTiers: ["invalid-tier"] } } };`
        );
        const step = container.resolve(LoadConfigStep);
        const context = createTestContext(workDir);
        const result = await step.execute(context);
        expect(result.success).toBe(false);
    });
});
```

- [ ] **Step 2: Run tests — verify failure**

- [ ] **Step 3: Create abstraction**

```typescript
// src/cli/commands/scan/steps/LoadConfig/abstractions/LoadConfigStep.ts
import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const LoadConfigStep = createAbstraction<IStep>("Cli/LoadConfigStep");

export namespace LoadConfigStep {
    export type Interface = IStep;
}
```

```typescript
// src/cli/commands/scan/steps/LoadConfig/abstractions/index.ts
export { LoadConfigStep } from "./LoadConfigStep.js";
```

- [ ] **Step 4: Implement**

```typescript
// src/cli/commands/scan/steps/LoadConfig/LoadConfigStep.ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { LoadConfigStep as Abstraction } from "./abstractions/LoadConfigStep.js";
import { depcoConfigSchema } from "#shared/config/schema.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class LoadConfigStepImpl implements Abstraction.Interface {
    public name = "load-config";
    public description = "Load depco.config.ts";

    public async execute(context: IStepContext): Promise<IStepResult> {
        const configPath = join(context.dataDirectory, "depco.config.ts");

        if (!existsSync(configPath)) {
            context.results.set("config", {});
            return { success: true, skipped: true, message: "no depco.config.ts found, using defaults" };
        }

        try {
            const module = (await import(pathToFileURL(configPath).href)) as Record<string, unknown>;
            const raw = module["default"];
            const config = depcoConfigSchema.parse(raw);
            context.results.set("config", config);
            return { success: true, message: "loaded depco.config.ts" };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, message: `Invalid depco.config.ts: ${message}` };
        }
    }
}

export const LoadConfigStep = Abstraction.createImplementation({
    implementation: LoadConfigStepImpl,
    dependencies: []
});
```

- [ ] **Step 5: Create feature + barrel**

```typescript
// src/cli/commands/scan/steps/LoadConfig/feature.ts
import { createFeature } from "#shared/index.js";
import { LoadConfigStep } from "./LoadConfigStep.js";

export const LoadConfigStepFeature = createFeature({
    name: "Cli/LoadConfigStep",
    register(container) {
        container.register(LoadConfigStep).inSingletonScope();
    }
});
```

```typescript
// src/cli/commands/scan/steps/LoadConfig/index.ts
export { LoadConfigStep } from "./abstractions/LoadConfigStep.js";
export { LoadConfigStepFeature } from "./feature.js";
```

- [ ] **Step 6: Run tests — verify pass + yarn full**

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/scan/steps/LoadConfig/
git commit -m "feat(config): add LoadConfig step for scan command"
```

---

### Task 3: Wire LoadConfig into ScanCommand + update CheckLicenses

**Files:**
- Modify: `src/cli/commands/scan/ScanCommand.ts` (add LoadConfig as step 2)
- Modify: `src/cli/commands/scan/feature.ts` (add LoadConfigStepFeature dependency)
- Modify: `src/cli/commands/scan/steps/CheckLicenses/CheckLicensesStep.ts` (read config from context)
- Modify: `src/cli/commands/scan/steps/CheckLicenses/__tests__/CheckLicensesStep.test.ts` (add config tests)
- Modify: `src/cli/commands/scan/__tests__/ScanCommand.test.ts` (update to 4 steps)
- Modify: `AGENTS.md` (document config)

**Interfaces:**
- Consumes: `LoadConfigStep` from `./steps/LoadConfig/index.js`, `IDepcoConfig` from `#shared/config/types.js`
- Produces: Updated ScanCommand (4 steps), config-aware CheckLicenses

- [ ] **Step 1: Update ScanCommand to include LoadConfig**

Modify `src/cli/commands/scan/ScanCommand.ts`:
- Add import: `import { LoadConfigStep } from "./steps/LoadConfig/index.js";`
- Add constructor param: `private loadConfig: Step.Interface` (between detectPackageManager and parseLockfile)
- Update `steps()`: return `[this.detectPackageManager, this.loadConfig, this.parseLockfile, this.checkLicenses]`
- Update `dependencies` array: add `LoadConfigStep` between `DetectPackageManagerStep` and `ParseLockfileStep`

- [ ] **Step 2: Update ScanCommandFeature dependencies**

Modify `src/cli/commands/scan/feature.ts`:
- Add import: `import { LoadConfigStepFeature } from "./steps/LoadConfig/index.js";`
- Add `LoadConfigStepFeature` to dependencies array (between DetectPackageManager and ParseLockfile)

- [ ] **Step 3: Update ScanCommand test**

Modify `src/cli/commands/scan/__tests__/ScanCommand.test.ts`:
- Change step count expectation from 3 to 4
- Update expected step names: `["detect-package-manager", "load-config", "parse-lockfile", "check-licenses"]`

- [ ] **Step 4: Update CheckLicenses to read config**

Modify `src/cli/commands/scan/steps/CheckLicenses/CheckLicensesStep.ts`:

Replace the hardcoded `REGISTRY_URL` constant and violation filter. Add import:
```typescript
import type { IDepcoConfig } from "#shared/config/types.js";
```

In `execute()`, read config from context and use it:
```typescript
const config = (context.results.get("config") as IDepcoConfig | undefined) ?? {};
const allowedTiers = config.scan?.license?.allowedRiskTiers ?? ["permissive"];
const licenseIgnored = config.scan?.license?.ignoredPackages ?? [];
const globalIgnored = config.scan?.ignoredPackages ?? [];
const allIgnored = new Set([...licenseIgnored, ...globalIgnored]);
const registryUrl = config.scan?.registryUrl ?? "https://registry.npmjs.org";
```

Update `fetchLicense` to accept registryUrl as parameter (instead of module-level constant):
```typescript
async function fetchLicense(args: { packageEntry: IPackageEntry; registryUrl: string }): Promise<ILicenseResult> {
```

Update `fetchInBatches` similarly:
```typescript
async function fetchInBatches(args: { packages: IPackageEntry[]; registryUrl: string }): Promise<ILicenseResult[]> {
```

Update violation filter:
```typescript
const violations = results.filter(
    result => !allIgnored.has(result.packageName) && !allowedTiers.includes(result.riskTier)
);
```

Remove the module-level `const REGISTRY_URL = "https://registry.npmjs.org";`.

- [ ] **Step 5: Add config-aware CheckLicenses tests**

Add tests to `src/cli/commands/scan/steps/CheckLicenses/__tests__/CheckLicensesStep.test.ts`:

```typescript
it("respects allowedRiskTiers from config", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ license: "LGPL-2.1" })
    }) as unknown as typeof fetch;

    const step = container.resolve(CheckLicensesStep);
    const context = createTestContext([{ name: "lgpl-pkg", version: "1.0.0" }]);
    context.results.set("config", {
        scan: { license: { allowedRiskTiers: ["permissive", "weak-copyleft"] } }
    });
    const result = await step.execute(context);
    expect(result.success).toBe(true);
});

it("filters ignored packages from violations", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ license: "GPL-3.0" })
    }) as unknown as typeof fetch;

    const step = container.resolve(CheckLicensesStep);
    const context = createTestContext([{ name: "gpl-pkg", version: "1.0.0" }]);
    context.results.set("config", {
        scan: { license: { ignoredPackages: ["gpl-pkg"] } }
    });
    const result = await step.execute(context);
    expect(result.success).toBe(true);
});

it("filters global ignored packages", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ license: "GPL-3.0" })
    }) as unknown as typeof fetch;

    const step = container.resolve(CheckLicensesStep);
    const context = createTestContext([{ name: "gpl-pkg", version: "1.0.0" }]);
    context.results.set("config", {
        scan: { ignoredPackages: ["gpl-pkg"] }
    });
    const result = await step.execute(context);
    expect(result.success).toBe(true);
});
```

Update existing tests to set `context.results.set("config", {})` so they use defaults (no config = all defaults = only permissive allowed).

- [ ] **Step 6: Run all tests — verify pass + yarn full**

```bash
yarn test src/cli/commands/scan/
yarn full
```

- [ ] **Step 7: Update AGENTS.md**

Add to CLI scan section:
```
      scan/           — ScanCommand (composes scan steps), steps/ subfolder, feature.ts. Standalone — no server, no DB. Supports depco.config.ts for configuration.
        steps/          — DetectPackageManager, LoadConfig, ParseLockfile, CheckLicenses
```

Add to shared section or create new entry:
```
    config/           — defineConfig() + IDepcoConfig types + Zod schema. Exported via package.json "exports" as @fundus/depco/config.
```

- [ ] **Step 8: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/cli/commands/scan/ AGENTS.md
git commit -m "feat(config): wire LoadConfig into scan pipeline, config-aware CheckLicenses"
```

---

Self-review complete. All spec requirements covered: types (Task 1), Zod schema (Task 1), defineConfig (Task 1), package.json exports (Task 1), LoadConfig step (Task 2), CheckLicenses integration (Task 3), AGENTS.md (Task 3). Types consistent across all tasks (IDepcoConfig, IScanConfig). Import paths verified.
