# Security Field Types — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make security field definitions type-aware with per-field comparison logic, duration parsing, and input-type-driven UI rendering.

**Architecture:** Extend `SecurityFieldDefinition` with `inputType`, `helperText`, and `compare()`. Each PM's field definitions own their comparison logic. SecurityService delegates to `compare()` instead of hardcoded string checks. UI renders different inputs per `inputType`.

**Tech Stack:** TypeScript, Zod, Vitest, React, Mantine UI, MobX, `@webiny/stdlib` (toBoolean)

## Global Constraints

- oxfmt formatting: 4-space indent for .ts/.tsx, double quotes, no trailing comma
- oxlint with `--deny-warnings`
- All DI abstractions in `abstractions/` directory, one file per token
- `Impl` suffix only on class declaration, never on exports
- Arrow method properties on presenter/use-case public methods
- Run `yarn test` after each task to verify green
- `toBoolean` imported from `@webiny/stdlib`
- `FieldInputType` exported from `src/shared/security/types.ts`

---

## Task 1: Add `parseDuration` utility + tests

**Files:**

- Create: `src/shared/security/duration.ts`
- Create: `src/shared/security/__tests__/duration.test.ts`
- Modify: `src/shared/security/index.ts`

**Interfaces:**

- Consumes: nothing
- Produces: `parseDuration(value: string): number` — returns seconds. Used by yarn field definitions (Task 3) and SecurityService (Task 4)

- [ ] **Step 1: Write failing tests**

Create `src/shared/security/__tests__/duration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseDuration } from "#shared/security/index.js";

describe("parseDuration", () => {
  it("parses days to seconds", () => {
    expect(parseDuration("3d")).toBe(259200);
    expect(parseDuration("1d")).toBe(86400);
  });

  it("parses hours to seconds", () => {
    expect(parseDuration("72h")).toBe(259200);
    expect(parseDuration("1h")).toBe(3600);
  });

  it("parses minutes to seconds", () => {
    expect(parseDuration("60m")).toBe(3600);
    expect(parseDuration("1m")).toBe(60);
  });

  it("parses seconds", () => {
    expect(parseDuration("30s")).toBe(30);
    expect(parseDuration("1s")).toBe(1);
  });

  it("handles zero", () => {
    expect(parseDuration("0d")).toBe(0);
    expect(parseDuration("0h")).toBe(0);
  });

  it("throws on invalid format", () => {
    expect(() => parseDuration("abc")).toThrow('Invalid duration: "abc"');
    expect(() => parseDuration("3x")).toThrow('Invalid duration: "3x"');
    expect(() => parseDuration("")).toThrow('Invalid duration: ""');
    expect(() => parseDuration("d3")).toThrow('Invalid duration: "d3"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/shared/security/__tests__/duration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `parseDuration` implementation**

Create `src/shared/security/duration.ts`:

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

- [ ] **Step 4: Export from index**

In `src/shared/security/index.ts`, add after line 1:

```typescript
export { parseDuration } from "./duration.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn test src/shared/security/__tests__/duration.test.ts`
Expected: All 7 tests pass.

- [ ] **Step 6: Run full suite**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/shared/security/duration.ts src/shared/security/__tests__/duration.test.ts src/shared/security/index.ts
git commit -m "feat: add parseDuration utility for security field comparison"
```

---

## Task 2: Extend `SecurityFieldDefinition` type with `inputType`, `helperText`, `compare`

**Files:**

- Modify: `src/shared/security/types.ts`
- Modify: `src/shared/security/index.ts`

**Interfaces:**

- Consumes: nothing
- Produces: `FieldInputType` type (`"exists" | "duration" | "boolean"`), updated `SecurityFieldDefinition` interface with `helperText: string`, `inputType: FieldInputType`, `compare(actual: unknown, expected: string): boolean`

- [ ] **Step 1: Update types**

Replace the contents of `src/shared/security/types.ts`:

```typescript
import type { z } from "zod";

export type PackageManagerId = "yarn" | "npm" | "pnpm";

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

- [ ] **Step 2: Export `FieldInputType` from index**

In `src/shared/security/index.ts`, update line 1 to also export `FieldInputType`:

```typescript
export {
  type PackageManagerId,
  type SecurityFieldDefinition,
  type FieldInputType
} from "./types.js";
```

- [ ] **Step 3: Run tests — expect failures**

Run: `yarn test`
Expected: TypeScript compilation errors in `yarn.ts` (missing `helperText`, `inputType`, `compare` on field definitions). This is correct — Task 3 will fix them.

Build will also fail: `yarn build` will report the same errors in `yarn.ts`.

At this point, verify the types file itself compiles: `npx tsc --noEmit src/shared/security/types.ts` — should pass.

- [ ] **Step 4: Commit**

```bash
git add src/shared/security/types.ts src/shared/security/index.ts
git commit -m "feat: extend SecurityFieldDefinition with inputType, helperText, compare"
```

---

## Task 3: Update yarn field definitions with new types and comparison logic

**Files:**

- Modify: `src/shared/security/yarn.ts`

**Interfaces:**

- Consumes: `SecurityFieldDefinition` with `helperText`, `inputType`, `compare` from Task 2. `parseDuration` from Task 1. `toBoolean` from `@webiny/stdlib`.
- Produces: Updated `YARN_SECURITY_FIELDS` array — used by SecurityService (Task 4), settings routes, and settings UI

- [ ] **Step 1: Replace yarn.ts contents**

Replace the full contents of `src/shared/security/yarn.ts`:

```typescript
import { z } from "zod";
import { toBoolean } from "@webiny/stdlib";
import type { SecurityFieldDefinition } from "./types.js";
import { parseDuration } from "./duration.js";

export const YARN_SECURITY_FIELDS: SecurityFieldDefinition[] = [
  {
    fieldName: "npmPreapprovedPackages",
    configFile: ".yarnrc.yml",
    description: "Pre-approved packages that skip audit checks",
    helperText:
      "Field must exist in .yarnrc.yml. Array of package descriptors or name glob patterns excluded from all package gates.",
    inputType: "exists",
    expectedValueSchema: z.literal("exists"),
    defaultExpectedValue: "exists",
    compare(actual: unknown, _expected: string): boolean {
      return actual != null && Array.isArray(actual);
    }
  },
  {
    fieldName: "npmMinimalAgeGate",
    configFile: ".yarnrc.yml",
    description: "Minimum age a package version must have before install",
    helperText:
      "Duration format: number + unit (d=days, h=hours, m=minutes, s=seconds). Example: 3d, 72h",
    inputType: "duration",
    expectedValueSchema: z.string().regex(/^\d+[dhms]$/, "Must be a duration like 3d, 72h, 30m"),
    defaultExpectedValue: "3d",
    compare(actual: unknown, expected: string): boolean {
      if (actual == null) {
        return false;
      }
      try {
        return parseDuration(String(actual)) >= parseDuration(expected);
      } catch {
        return false;
      }
    }
  },
  {
    fieldName: "enableScripts",
    configFile: ".yarnrc.yml",
    description: "Whether lifecycle scripts are allowed to run during install",
    helperText: "Set to false to prevent lifecycle scripts from running. More secure.",
    inputType: "boolean",
    expectedValueSchema: z.enum(["true", "false"]),
    defaultExpectedValue: "false",
    compare(actual: unknown, expected: string): boolean {
      if (actual == null) {
        return false;
      }
      return toBoolean(actual) === toBoolean(expected);
    }
  },
  {
    fieldName: "approvedGitRepositories",
    configFile: ".yarnrc.yml",
    description: "Approved git repositories for git: dependencies",
    helperText: "Field must exist in .yarnrc.yml. List of approved git repository patterns.",
    inputType: "exists",
    expectedValueSchema: z.literal("exists"),
    defaultExpectedValue: "exists",
    compare(actual: unknown, _expected: string): boolean {
      return actual != null && Array.isArray(actual);
    }
  }
];
```

- [ ] **Step 2: Run tests**

Run: `yarn test`
Expected: Some tests may fail because `seedYarnSecuritySettings` still seeds old defaults (`"*"` for npmPreapprovedPackages, `"0d"` for npmMinimalAgeGate). The reset route test also expects old defaults. These will be fixed in Task 5. The field definition itself is correct.

Check that at least the duration and type tests pass: `yarn test src/shared/security/__tests__/duration.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/shared/security/yarn.ts
git commit -m "feat: update yarn field definitions with compare, inputType, helperText"
```

---

## Task 4: Update SecurityService to use `fieldDef.compare()`

**Files:**

- Modify: `src/api/services/SecurityService.ts`

**Interfaces:**

- Consumes: `SECURITY_FIELD_REGISTRY` from `#shared/security/index.js`, `SecurityFieldDefinition.compare()` from Task 2, updated field definitions from Task 3
- Produces: `SecurityService.check()` now uses `fieldDef.compare()` for known fields, falls back to legacy string comparison for orphaned settings

- [ ] **Step 1: Update imports**

In `src/api/services/SecurityService.ts`, add import after line 8:

```typescript
import { SECURITY_FIELD_REGISTRY, type PackageManagerId } from "#shared/security/index.js";
```

- [ ] **Step 2: Remove EXISTS constant**

Delete line 12:

```typescript
const EXISTS = "exists";
```

- [ ] **Step 3: Replace comparison logic**

Replace lines 70-78 (the `checks` loop body):

```typescript
const checks: Record<string, boolean> = {};
for (const setting of settings) {
    const config = configs.get(setting.configFile) ?? {};
    const fieldPresent = setting.fieldName in config;
```

with:

```typescript
const registry =
    SECURITY_FIELD_REGISTRY[project!.packageManager as PackageManagerId] ?? [];
const checks: Record<string, boolean> = {};
for (const setting of settings) {
    const config = configs.get(setting.configFile) ?? {};
    const fieldDef = registry.find(f => f.fieldName === setting.fieldName);
```

And replace lines 75-78:

```typescript
checks[setting.fieldName] =
  setting.expectedValue === EXISTS
    ? fieldPresent
    : fieldPresent && String(config[setting.fieldName]) === setting.expectedValue;
```

with:

```typescript
if (fieldDef) {
  checks[setting.fieldName] = fieldDef.compare(config[setting.fieldName], setting.expectedValue);
} else {
  const fieldPresent = setting.fieldName in config;
  checks[setting.fieldName] =
    setting.expectedValue === "exists"
      ? fieldPresent
      : fieldPresent && String(config[setting.fieldName]) === setting.expectedValue;
}
```

- [ ] **Step 4: Run tests**

Run: `yarn test`
Expected: Some SecurityService tests may fail because `VALID_YARNRC` and `seedYarnSecuritySettings` use old defaults. Task 5 fixes these.

- [ ] **Step 5: Commit**

```bash
git add src/api/services/SecurityService.ts
git commit -m "feat: use fieldDef.compare() in SecurityService"
```

---

## Task 5: Update seed helper, VALID_YARNRC, and fix all tests

**Files:**

- Modify: `src/testing/helpers/seedYarnSecuritySettings.ts`
- Modify: `src/api/services/__tests__/SecurityService.test.ts`
- Modify: `src/api/routes/__tests__/settings.test.ts`
- Modify: `src/api/routes/__tests__/projects.test.ts`
- Verify: `src/api/services/__tests__/JobWorker.test.ts` (uses seedYarnSecuritySettings/VALID_YARNRC — no hardcoded assertions to update, but verify tests still pass)
- Verify: `src/api/routes/__tests__/jobs.test.ts` (same)
- Verify: `src/api/routes/__tests__/packageManager.test.ts` (same)

**Interfaces:**

- Consumes: new field defaults from Task 3 (`"exists"` for array fields, `"3d"` for duration, `"false"` for boolean)
- Produces: updated test fixtures that match new defaults — all tests green

- [ ] **Step 1: Update `seedYarnSecuritySettings` and `VALID_YARNRC`**

Replace contents of `src/testing/helpers/seedYarnSecuritySettings.ts`:

```typescript
import { generateId } from "@webiny/stdlib";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { pmSecuritySettings } from "#api/db/schema.js";

export async function seedYarnSecuritySettings(db: LibSQLDatabase): Promise<void> {
  await db
    .insert(pmSecuritySettings)
    .values([
      {
        id: generateId(),
        packageManager: "yarn",
        configFile: ".yarnrc.yml",
        fieldName: "npmPreapprovedPackages",
        expectedValue: "exists"
      },
      {
        id: generateId(),
        packageManager: "yarn",
        configFile: ".yarnrc.yml",
        fieldName: "npmMinimalAgeGate",
        expectedValue: "3d"
      },
      {
        id: generateId(),
        packageManager: "yarn",
        configFile: ".yarnrc.yml",
        fieldName: "enableScripts",
        expectedValue: "false"
      },
      {
        id: generateId(),
        packageManager: "yarn",
        configFile: ".yarnrc.yml",
        fieldName: "approvedGitRepositories",
        expectedValue: "exists"
      }
    ])
    .run();
}

export const VALID_YARNRC = [
  "npmPreapprovedPackages: []",
  "npmMinimalAgeGate: 3d",
  "enableScripts: false",
  "approvedGitRepositories: []"
].join("\n");
```

- [ ] **Step 2: Update SecurityService test — fix inline YARNRC strings**

In `src/api/services/__tests__/SecurityService.test.ts`:

Line 100-105 (missing field test) — update to use new values. The YARNRC written is missing `approvedGitRepositories`. Update the other fields to match new defaults:

```typescript
writeFileSync(
  join(testDir, ".yarnrc.yml"),
  ["npmPreapprovedPackages: []", "npmMinimalAgeGate: 3d", "enableScripts: false"].join("\n")
);
```

Line 124-131 (wrong value test) — `enableScripts: true` should still fail. Update the other fields to new defaults:

```typescript
writeFileSync(
  join(testDir, ".yarnrc.yml"),
  [
    "npmPreapprovedPackages: []",
    "npmMinimalAgeGate: 3d",
    "enableScripts: true",
    "approvedGitRepositories: []"
  ].join("\n")
);
```

Line 234 (stale result test) — update the "bad" config to still fail:

```typescript
writeFileSync(join(testDir, ".yarnrc.yml"), "enableScripts: true\n");
```

This line stays the same — it already fails because all other fields are missing.

- [ ] **Step 3: Update settings route test — fix reset expectations**

In `src/api/routes/__tests__/settings.test.ts`, find the reset test (around line 211). The assertion checks that reset creates 4 items with the correct `expectedValue`s. Update the assertion to check new defaults:

Find the line checking `enableScripts` expectedValue:

```typescript
expect(
  body.items.find((i: { fieldName: string }) => i.fieldName === "enableScripts").expectedValue
).toBe("false");
```

This stays the same. But also verify the `npmPreapprovedPackages` has `"exists"` and `npmMinimalAgeGate` has `"3d"`. Add after the enableScripts assertion:

```typescript
expect(
  body.items.find((i: { fieldName: string }) => i.fieldName === "npmPreapprovedPackages")
    .expectedValue
).toBe("exists");
expect(
  body.items.find((i: { fieldName: string }) => i.fieldName === "npmMinimalAgeGate").expectedValue
).toBe("3d");
```

- [ ] **Step 4: Update settings route test — fix POST create test**

The POST create test at line 53 creates a setting with `expectedValue: "false"` for `enableScripts`. This still works with `z.enum(["true", "false"])`.

But there's also a test for `npmPreapprovedPackages` — the schema changed from `z.string().min(1)` to `z.literal("exists")`. If any test POSTs with `fieldName: "npmPreapprovedPackages"` and a non-`"exists"` value, it will now 400. Check and fix if needed.

The "invalid expected value" test at line 101 uses `enableScripts` with `"maybe"` — still fails correctly.

- [ ] **Step 5: Update projects.test.ts VALID_YARNRC**

In `src/api/routes/__tests__/projects.test.ts`, lines 29-34 already have:

```typescript
const VALID_YARNRC = [
  "npmPreapprovedPackages: []",
  "npmMinimalAgeGate: 3d",
  "enableScripts: false",
  "approvedGitRepositories: []"
].join("\n");
```

Verify this matches. If it does, no change needed. If it differs, update to match.

- [ ] **Step 6: Run full test suite**

Run: `yarn test`
Expected: ALL tests pass.

- [ ] **Step 7: Run full pipeline**

Run: `yarn full`
Expected: adio + lint + format + build + all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/testing/helpers/seedYarnSecuritySettings.ts src/api/services/__tests__/SecurityService.test.ts src/api/routes/__tests__/settings.test.ts src/api/routes/__tests__/projects.test.ts
git commit -m "fix: update test fixtures for new yarn security field defaults"
```

---

## Task 6: Thread `helperText` and `inputType` through presenter VM

**Files:**

- Modify: `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts`
- Modify: `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts`
- Modify: `src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts`

**Interfaces:**

- Consumes: `FieldInputType` from `#shared/security/index.js`, registry field definitions with `helperText` and `inputType` from Task 3
- Produces: `ISecuritySettingViewModel.helperText: string`, `ISecuritySettingViewModel.inputType: FieldInputType`, `IAvailableFieldViewModel.inputType: FieldInputType`

- [ ] **Step 1: Update presenter abstraction**

In `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts`:

Add import at top:

```typescript
import type { PackageManagerId, FieldInputType } from "#shared/security/index.js";
```

(Replace the existing `import type { PackageManagerId } from "#shared/security/index.js";` line.)

Add to `ISecuritySettingViewModel` (after `isOrphaned: boolean;`):

```typescript
helperText: string;
inputType: FieldInputType;
```

Add to `IAvailableFieldViewModel` (after `defaultExpectedValue: string;`):

```typescript
inputType: FieldInputType;
```

- [ ] **Step 2: Map new fields in presenter**

In `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts`:

In the `vm` getter's settings mapping (the `pmSettings.map` block), add after `isOrphaned: !def`:

```typescript
helperText: def?.helperText ?? "",
inputType: def?.inputType ?? "duration",
```

In the `availableFields` mapping, add after `defaultExpectedValue: f.defaultExpectedValue`:

```typescript
inputType: f.inputType,
```

- [ ] **Step 3: Update existing resetToDefaults test mock data**

In `src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts`, find the `resetToDefaults` test (the one with `resetResult = [...]`). Update the mock data to use new defaults:

- Change `npmPreapprovedPackages` `expectedValue` from `"*"` to `"exists"`
- Change `npmMinimalAgeGate` `expectedValue` from `"0d"` to `"3d"`

The `enableScripts` (`"false"`) and `approvedGitRepositories` (`"exists"`) entries stay the same.

- [ ] **Step 4: Write new tests**

In `src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts`, add test:

```typescript
it("exposes helperText and inputType from registry", async () => {
  listResult = [
    {
      id: "s1",
      packageManager: "yarn",
      configFile: ".yarnrc.yml",
      fieldName: "enableScripts",
      expectedValue: "false"
    }
  ];

  const presenter = createPresenter();
  await presenter.load();

  const setting = presenter.vm.settings[0];
  expect(setting?.inputType).toBe("boolean");
  expect(setting?.helperText).toBe(
    "Set to false to prevent lifecycle scripts from running. More secure."
  );
});

it("exposes inputType on available fields", () => {
  const presenter = createPresenter();

  const existsField = presenter.vm.availableFields.find(
    f => f.fieldName === "npmPreapprovedPackages"
  );
  expect(existsField?.inputType).toBe("exists");

  const durationField = presenter.vm.availableFields.find(f => f.fieldName === "npmMinimalAgeGate");
  expect(durationField?.inputType).toBe("duration");
});
```

- [ ] **Step 5: Run tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/settings/SecuritySettings/
git commit -m "feat: thread helperText and inputType through presenter VM"
```

---

## Task 7: Update SecuritySettingsPage for input-type-driven rendering

**Files:**

- Modify: `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx`

**Interfaces:**

- Consumes: `setting.inputType`, `setting.helperText` from Task 6

- [ ] **Step 1: Add Switch import**

In `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx`, add `Switch` to the Mantine import (alongside existing Badge, Tooltip, etc.):

```tsx
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  SegmentedControl,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip
} from "@mantine/core";
```

- [ ] **Step 2: Update Expected Value column for exists fields**

In the settings table body, find the Expected Value cell (the `vm.editingId === setting.id` conditional). Wrap the entire cell content in an inputType check:

Replace the Expected Value `<Table.Td>` block (lines ~114-138) with:

```tsx
<Table.Td>
  {setting.inputType === "exists" ? (
    <Text size="sm" c="dimmed" fs="italic">
      Field must exist
    </Text>
  ) : setting.inputType === "boolean" ? (
    <Switch
      size="sm"
      checked={setting.expectedValue === "true"}
      onChange={event => {
        presenter.startEdit(setting.id);
        presenter.confirmEdit(event.currentTarget.checked ? "true" : "false");
      }}
    />
  ) : vm.editingId === setting.id ? (
    <Stack gap={2}>
      <Group gap="xs">
        <TextInput
          size="xs"
          value={editValue}
          onChange={e => setEditValue(e.currentTarget.value)}
        />
        <Button size="xs" onClick={() => presenter.confirmEdit(editValue)}>
          Save
        </Button>
        <Button size="xs" variant="subtle" onClick={() => presenter.cancelEdit()}>
          Cancel
        </Button>
      </Group>
      {setting.helperText && (
        <Text size="xs" c="dimmed">
          {setting.helperText}
        </Text>
      )}
    </Stack>
  ) : (
    <Text size="sm">{setting.expectedValue}</Text>
  )}
</Table.Td>
```

- [ ] **Step 3: Hide edit icon for exists and boolean fields**

In the Actions `<Table.Td>`, update the condition for showing the edit icon. Currently it shows when `vm.editingId !== setting.id`. Add inputType check:

Replace the Actions cell:

```tsx
<Table.Td>
  {vm.editingId !== setting.id && (
    <Group gap="xs">
      {setting.inputType !== "exists" && setting.inputType !== "boolean" && (
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={() => handleStartEdit(setting.id, setting.expectedValue)}
        >
          &#9998;
        </ActionIcon>
      )}
      <ActionIcon
        variant="subtle"
        size="sm"
        color="red"
        onClick={() => presenter.remove(setting.id)}
      >
        &#10005;
      </ActionIcon>
    </Group>
  )}
</Table.Td>
```

- [ ] **Step 4: Update Add Setting dropdown for exists fields**

In the `handleStartAdd` function and the menu item click handler, update to auto-commit exists fields. Replace the `Menu.Item` `onClick`:

```tsx
{
  vm.availableFields.map(field => (
    <Menu.Item
      key={field.fieldName}
      onClick={() => {
        if (field.inputType === "exists") {
          presenter.startAdd(field.fieldName);
          presenter.confirmAdd("exists");
        } else {
          handleStartAdd(field.fieldName, field.defaultExpectedValue);
        }
      }}
    >
      {field.description}
    </Menu.Item>
  ));
}
```

- [ ] **Step 5: Show helperText in add row for duration fields**

In the `vm.addingField` inline row, find the TextInput and add helperText below it. Find the available field definition to get helperText:

The add row only appears for non-exists fields (exists fields auto-commit in Step 4). Boolean fields get a Switch; duration fields get a TextInput with helperText. Look up the adding field's definition from `vm.availableFields`. Replace the add row's Expected Value cell:

```tsx
<Table.Td>
  {(() => {
    const addingDef = vm.availableFields.find(f => f.fieldName === vm.addingField);
    if (addingDef?.inputType === "boolean") {
      return (
        <Group gap="xs">
          <Switch
            size="sm"
            checked={addValue === "true"}
            onChange={event => presenter.confirmAdd(event.currentTarget.checked ? "true" : "false")}
          />
          <Button size="xs" variant="subtle" onClick={() => presenter.cancelAdd()}>
            Cancel
          </Button>
        </Group>
      );
    }
    return (
      <Stack gap={2}>
        <Group gap="xs">
          <TextInput
            size="xs"
            value={addValue}
            onChange={e => setAddValue(e.currentTarget.value)}
          />
          <Button size="xs" onClick={() => presenter.confirmAdd(addValue)}>
            Save
          </Button>
          <Button size="xs" variant="subtle" onClick={() => presenter.cancelAdd()}>
            Cancel
          </Button>
        </Group>
        {addingDef?.helperText && (
          <Text size="xs" c="dimmed">
            {addingDef.helperText}
          </Text>
        )}
      </Stack>
    );
  })()}
</Table.Td>
```

- [ ] **Step 6: Run tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 7: Run full pipeline**

Run: `yarn full`
Expected: adio + lint + format + build + all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx
git commit -m "feat: render inputs per field inputType in SecuritySettingsPage"
```

---

## Task Dependency Map

```
Task 1 (parseDuration) ─┐
                         ├─→ Task 3 (yarn fields) ─→ Task 4 (SecurityService) ─→ Task 5 (fix tests)
Task 2 (types)     ─────┘

Task 6 (presenter VM) ─→ Task 7 (page UI)

Task 6 depends on Task 3 (needs real field definitions with helperText/inputType in registry).
Task 5 must run after Task 4 (SecurityService uses new compare logic).
Tasks 1 and 2 are independent of each other and can run in parallel.
```

## Final Verification

After all tasks:

```bash
yarn full
```

Expected: adio + lint + format + build + all tests pass.
