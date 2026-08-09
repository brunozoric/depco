# depco.config.ts Design

## Overview

Add TypeScript config file support for the CLI scan command. Users create `depco.config.ts` in their project root with a `defineConfig()` helper for type-safe autocomplete. Config controls license risk tiers, vulnerability severity thresholds, ignored packages, and registry URL.

## User-Facing API

```typescript
// depco.config.ts (in user's project root)
import { defineConfig } from "@fundus/depco/config";

export default defineConfig({
    scan: {
        license: {
            allowedRiskTiers: ["permissive", "weak-copyleft"],
            ignoredPackages: ["legacy-gpl-thing"]
        },
        vulnerability: {
            maxSeverity: "moderate",
            ignoredPackages: ["old-but-safe"]
        },
        ignoredPackages: ["internal-pkg"],
        registryUrl: "https://registry.npmjs.org"
    }
});
```

## Config Types

```typescript
// src/shared/config/types.ts
interface IDepcoConfig {
    scan?: IScanConfig;
}

interface IScanConfig {
    license?: ILicenseScanConfig;
    vulnerability?: IVulnerabilityScanConfig;
    ignoredPackages?: string[];
    registryUrl?: string;
}

interface ILicenseScanConfig {
    allowedRiskTiers?: LicenseRiskTier[];
    ignoredPackages?: string[];
}

interface IVulnerabilityScanConfig {
    maxSeverity?: VulnerabilitySeverity;
    ignoredPackages?: string[];
}
```

All fields optional — empty config or missing file means defaults.

## Defaults

| Field | Default |
|-------|---------|
| `scan.license.allowedRiskTiers` | `["permissive"]` |
| `scan.license.ignoredPackages` | `[]` |
| `scan.vulnerability.maxSeverity` | `"low"` (fail on anything moderate+) |
| `scan.vulnerability.ignoredPackages` | `[]` |
| `scan.ignoredPackages` | `[]` |
| `scan.registryUrl` | `"https://registry.npmjs.org"` |

## defineConfig

Identity function with type narrowing. Located at `src/shared/config/defineConfig.ts`:

```typescript
export function defineConfig(config: IDepcoConfig): IDepcoConfig {
    return config;
}
```

Exported via package.json `exports` so users import from `@fundus/depco/config`.

## Package.json Exports

Add conditional export for the config subpath:

```json
{
    "exports": {
        "./config": {
            "source": "./src/shared/config/index.ts",
            "default": "./dist/shared/config/index.js"
        }
    }
}
```

This enables `import { defineConfig } from "@fundus/depco/config"`.

## Config Loading

New DI step: `LoadConfig` — runs first in the scan command pipeline.

### Loading Strategy

1. Check for `depco.config.ts` in cwd (context.dataDirectory)
2. If found: dynamically import via `tsx` — the CLI entry already registers tsx (`import "tsx/esm/api"` or runs under `--import tsx`)
3. If not found: use empty config (all defaults)
4. Validate with Zod schema
5. Store in `context.results.set("config", validatedConfig)`

### Zod Validation

Config is external user input — validate with Zod per project convention (all JSON.parse must be validated unless internal system data).

```typescript
const depcoConfigSchema = z.object({
    scan: z.object({
        license: z.object({
            allowedRiskTiers: z.array(z.enum(RISK_TIER_VALUES)).optional(),
            ignoredPackages: z.array(z.string()).optional()
        }).optional(),
        vulnerability: z.object({
            maxSeverity: z.enum(VULNERABILITY_SEVERITIES).optional(),
            ignoredPackages: z.array(z.string()).optional()
        }).optional(),
        ignoredPackages: z.array(z.string()).optional(),
        registryUrl: z.string().url().optional()
    }).optional()
});
```

### Loading Implementation

```typescript
async function loadConfigFile(projectPath: string): Promise<IDepcoConfig> {
    const configPath = join(projectPath, "depco.config.ts");
    if (!existsSync(configPath)) {
        return {};
    }
    const module = await import(pathToFileURL(configPath).href);
    const raw = module.default;
    return depcoConfigSchema.parse(raw);
}
```

tsx is already registered in the CLI entry point (`src/cli/index.ts` has the shebang + runs under tsx via `dev:api` script pattern). If not, LoadConfig registers tsx before importing.

## Integration with Scan Steps

### Updated Scan Pipeline

```
DetectPackageManager → LoadConfig → ParseLockfile → CheckLicenses
```

LoadConfig is step 2 (after PM detection, before lockfile parsing — config might affect future parsing options).

### CheckLicenses Changes

Currently hardcoded: violations = anything not "permissive". After config:

```typescript
const config = context.results.get("config") as IDepcoConfig;
const allowedTiers = config.scan?.license?.allowedRiskTiers ?? ["permissive"];
const licenseIgnored = config.scan?.license?.ignoredPackages ?? [];
const globalIgnored = config.scan?.ignoredPackages ?? [];
const allIgnored = new Set([...licenseIgnored, ...globalIgnored]);

// Filter: skip ignored packages, flag non-allowed tiers
const violations = results.filter(
    r => !allIgnored.has(r.packageName) && !allowedTiers.includes(r.riskTier)
);
```

### CheckLicenses Registry URL

Currently hardcoded `https://registry.npmjs.org`. After config:

```typescript
const registryUrl = config.scan?.registryUrl ?? "https://registry.npmjs.org";
```

## Directory Structure

```
src/shared/config/
    types.ts              — IDepcoConfig, IScanConfig, ILicenseScanConfig, IVulnerabilityScanConfig
    defineConfig.ts       — defineConfig() identity function
    schema.ts             — Zod validation schema
    index.ts              — barrel exports

src/cli/commands/scan/steps/LoadConfig/
    abstractions/
        LoadConfigStep.ts — createAbstraction<Step.Interface>("Cli/LoadConfigStep")
        index.ts
    LoadConfigStep.ts     — LoadConfigStepImpl + createImplementation
    feature.ts            — LoadConfigStepFeature
    index.ts
    __tests__/
        LoadConfigStep.test.ts
```

## Testing

- LoadConfig step: temp dir with depco.config.ts, verify config loaded and validated. Temp dir without config, verify defaults. Invalid config, verify Zod error.
- CheckLicenses: test with config overriding allowed tiers. Test ignored packages filtered out.
- defineConfig: identity function, just type-checks.

## Migration

- ScanCommand adds LoadConfig as step 2 (between DetectPackageManager and ParseLockfile)
- CheckLicenses reads config from context instead of hardcoded values
- AGENTS.md updated with config documentation
