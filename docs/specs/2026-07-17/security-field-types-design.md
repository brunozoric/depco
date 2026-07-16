# Security Field Types — Type-Driven Definitions and Comparison

Date: 2026-07-17

## Problem

Security field definitions lack type awareness. All fields use string comparison (`String(actual) === expected`), which breaks for duration fields (need `>=` comparison) and boolean fields (should use `toBoolean` from `@webiny/stdlib`). Array fields (`npmPreapprovedPackages`, `approvedGitRepositories`) only need existence checks but currently require users to enter a value. No helper text guides users on expected input format.

## Design

### SecurityFieldDefinition type changes

`src/shared/security/types.ts`:

```typescript
export type FieldInputType = "exists" | "duration" | "boolean";

export interface SecurityFieldDefinition {
  fieldName: string;
  configFile: string;
  description: string;
  helperText: string;
  inputType: FieldInputType;
  expectedValueSchema: z.ZodType<string>;
  defaultExpectedValue: string;
  compare(actual: unknown, expected: string): boolean;
}
```

Each PM's field definitions own their comparison logic via `compare`. SecurityService delegates to it instead of hardcoding string comparison.

- `inputType` drives UI rendering (no input for `"exists"`, TextInput for `"duration"`, Switch for `"boolean"`)
- `helperText` shown below input in settings page
- `compare(actual, expected)` called by SecurityService at check time

### Yarn field definitions

`src/shared/security/yarn.ts` — all four fields updated:

**npmPreapprovedPackages:**

- `inputType: "exists"`
- `description`: "Pre-approved packages that skip audit checks"
- `helperText`: "Field must exist in .yarnrc.yml. Array of package descriptors or name glob patterns excluded from all package gates."
- `defaultExpectedValue`: `"exists"`
- `compare`: returns `actual != null && Array.isArray(actual)`
- `expectedValueSchema`: `z.literal("exists")`

**npmMinimalAgeGate:**

- `inputType: "duration"`
- `description`: "Minimum age a package version must have before install"
- `helperText`: "Duration format: number + unit (d=days, h=hours, m=minutes, s=seconds). Example: 3d, 72h"
- `defaultExpectedValue`: `"3d"`
- `compare`: `parseDuration(String(actual)) >= parseDuration(expected)` — actual config value must be >= expected minimum. Returns false if actual is missing or unparseable.
- `expectedValueSchema`: `z.string().regex(/^\d+[dhms]$/, "Must be a duration like 3d, 72h, 30m")`

**enableScripts:**

- `inputType: "boolean"`
- `description`: "Whether lifecycle scripts are allowed to run during install"
- `helperText`: "Set to false to prevent lifecycle scripts from running. More secure."
- `defaultExpectedValue`: `"false"`
- `compare`: `toBoolean(actual) === toBoolean(expected)` using `toBoolean` from `@webiny/stdlib`
- `expectedValueSchema`: `z.enum(["true", "false"])`

**approvedGitRepositories:**

- `inputType: "exists"`
- `description`: "Approved git repositories for git: dependencies"
- `helperText`: "Field must exist in .yarnrc.yml. List of approved git repository patterns."
- `defaultExpectedValue`: `"exists"`
- `compare`: returns `actual != null && Array.isArray(actual)`
- `expectedValueSchema`: `z.literal("exists")`

### Duration parser

New file: `src/shared/security/duration.ts`

```typescript
const UNITS: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 };

export function parseDuration(value: string): number {
  const match = value.match(/^(\d+)([dhms])$/);
  if (!match) {
    throw new Error(`Invalid duration: "${value}". Expected format: <number><d|h|m|s>`);
  }
  return parseInt(match[1], 10) * UNITS[match[2]];
}
```

Shared module. Reusable by future npm/pnpm field definitions.

### SecurityService changes

`src/api/services/SecurityService.ts` — replace hardcoded comparison (lines 70-78) with field-definition-driven logic:

```typescript
const registry = SECURITY_FIELD_REGISTRY[project.packageManager as PackageManagerId] ?? [];

for (const setting of settings) {
  const config = configs.get(setting.configFile) ?? {};
  const fieldDef = registry.find(f => f.fieldName === setting.fieldName);

  if (fieldDef) {
    checks[setting.fieldName] = fieldDef.compare(config[setting.fieldName], setting.expectedValue);
  } else {
    const fieldPresent = setting.fieldName in config;
    checks[setting.fieldName] =
      setting.expectedValue === "exists"
        ? fieldPresent
        : fieldPresent && String(config[setting.fieldName]) === setting.expectedValue;
  }
}
```

Import `SECURITY_FIELD_REGISTRY` and `PackageManagerId` from `#shared/security/index.js`. Remove the `EXISTS` constant. Orphaned settings (field removed from registry) fall back to legacy string comparison.

### Settings UI changes

**SecuritySettingsPresenter VM** — thread `helperText` and `inputType` into view models:

Add to `ISecuritySettingViewModel`:

```typescript
helperText: string;
inputType: FieldInputType;
```

Add to `IAvailableFieldViewModel`:

```typescript
inputType: FieldInputType;
```

Presenter maps these from the registry lookup (already done for `description`).

**SecuritySettingsPage** — conditional rendering per `inputType`:

- `"exists"` fields in the **available fields dropdown**: clicking adds the setting immediately with `expectedValue: "exists"` — no inline add row needed. Skip the `handleStartAdd` flow; call `presenter.confirmAdd("exists")` directly after `presenter.startAdd(fieldName)`.
- `"exists"` fields in the **settings table**: show "Field must exist" as read-only text in the Expected Value column. No edit icon.
- `"boolean"` fields: Mantine `Switch` component instead of `TextInput`. Checked state from `setting.expectedValue === "true"`. Toggle calls `presenter.confirmEdit(checked ? "true" : "false")` immediately (no save/cancel flow). For add row: same Switch, calls `presenter.confirmAdd(...)`.
- `"duration"` fields: `TextInput` as today. `helperText` shown as `Text size="xs" c="dimmed"` below the input.

### Files touched

1. `src/shared/security/types.ts` — add `FieldInputType`, `helperText`, `inputType`, `compare` to `SecurityFieldDefinition`
2. `src/shared/security/duration.ts` — new, `parseDuration()`
3. `src/shared/security/yarn.ts` — update all 4 field definitions
4. `src/shared/security/index.ts` — export `parseDuration`, `FieldInputType` (SECURITY_FIELD_REGISTRY already exported)
5. `src/api/services/SecurityService.ts` — use `fieldDef.compare()`, import registry
6. `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts` — add `helperText`, `inputType` to VMs
7. `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts` — map new fields
8. `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx` — conditional rendering per inputType
9. `src/testing/helpers/seedYarnSecuritySettings.ts` — update seeded expectedValues and VALID_YARNRC to match new defaults
10. Tests: duration parser, SecurityService comparison, SecuritySettingsPresenter VM, API settings route (defaults changed)

### Testing strategy

- **Duration parser**: unit tests for all four units, invalid input throws, edge cases (0d)
- **SecurityService**: test each comparison type — exists (array present/missing), duration (actual >= expected, actual < expected), boolean (toBoolean matching)
- **SecuritySettingsPresenter**: VM exposes `helperText` and `inputType`, exists fields auto-commit
- **API settings routes**: reset endpoint returns new defaults (`"exists"` for array fields, `"3d"` for duration, `"false"` for boolean)
- **Seed helper** (`seedYarnSecuritySettings`): update to use new default values
