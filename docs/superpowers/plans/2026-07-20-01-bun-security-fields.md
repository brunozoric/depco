# Bun Security Fields Expansion + Bugfix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 new Bun TOML security fields and fix missing "Bun" tab in SecuritySettingsPage.

**Architecture:** Extend `BUN_SECURITY_FIELDS` array in `src/shared/security/bun.ts`, add tests, fix SegmentedControl in UI. `seedSecurityDefaults` auto-seeds new fields on startup.

**Tech Stack:** TypeScript, Zod, Mantine, Vitest

## Global Constraints

- oxfmt formatting (4-space indent for .ts files)
- oxlint linting
- Bun runtime
- All shared code under `src/shared/`
- Run `bun run build` after each task to verify compilation
- 494 tests baseline — all must pass

---

### Task 1: Add new Bun security fields

**Files:**

- Modify: `src/shared/security/bun.ts`
- Test: `src/shared/security/__tests__/securityFields.test.ts`

**Interfaces:**

- Consumes: `SecurityFieldDefinition` from `src/shared/security/types.ts`, `toBoolean` from `@webiny/stdlib`
- Produces: 5 new entries in `BUN_SECURITY_FIELDS` array

- [ ] **Step 1: Write failing tests for new fields**

Add to `src/shared/security/__tests__/securityFields.test.ts`:

```ts
describe("BUN_SECURITY_FIELDS", () => {
  const fields = BUN_SECURITY_FIELDS;

  it("should contain 8 fields total", () => {
    expect(fields).toHaveLength(8);
  });

  describe("install.saveTextLockfile", () => {
    const field = fields.find(f => f.fieldName === "install.saveTextLockfile")!;

    it("should exist", () => {
      expect(field).toBeDefined();
      expect(field.configFile).toBe("bunfig.toml");
      expect(field.inputType).toBe("boolean");
      expect(field.defaultExpectedValue).toBe("true");
    });

    it("should compare boolean values", () => {
      expect(field.compare(true, "true")).toBe(true);
      expect(field.compare(false, "true")).toBe(false);
      expect(field.compare(null, "true")).toBe(false);
    });
  });

  describe("install.production", () => {
    const field = fields.find(f => f.fieldName === "install.production")!;

    it("should exist", () => {
      expect(field).toBeDefined();
      expect(field.configFile).toBe("bunfig.toml");
      expect(field.inputType).toBe("boolean");
      expect(field.defaultExpectedValue).toBe("false");
    });

    it("should compare boolean values", () => {
      expect(field.compare(false, "false")).toBe(true);
      expect(field.compare(true, "false")).toBe(false);
      expect(field.compare(null, "false")).toBe(false);
    });
  });

  describe("install.peer", () => {
    const field = fields.find(f => f.fieldName === "install.peer")!;

    it("should exist with default true", () => {
      expect(field).toBeDefined();
      expect(field.defaultExpectedValue).toBe("true");
    });
  });

  describe("install.optional", () => {
    const field = fields.find(f => f.fieldName === "install.optional")!;

    it("should exist with default true", () => {
      expect(field).toBeDefined();
      expect(field.defaultExpectedValue).toBe("true");
    });
  });

  describe("install.auto", () => {
    const field = fields.find(f => f.fieldName === "install.auto")!;

    it("should exist with default false", () => {
      expect(field).toBeDefined();
      expect(field.defaultExpectedValue).toBe("false");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- --reporter=verbose src/shared/security/__tests__/securityFields.test.ts`
Expected: FAIL — fields not found, length mismatch

- [ ] **Step 3: Add 5 new fields to BUN_SECURITY_FIELDS**

In `src/shared/security/bun.ts`, add after the existing `install.frozen` field:

```ts
    {
        fieldName: "install.saveTextLockfile",
        configFile: "bunfig.toml",
        description: "Save human-readable text lockfile for code review",
        helperText:
            "Set to true to save a text lockfile alongside the binary one. Aids code review and audit of dependency changes.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "true",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            return toBoolean(actual) === toBoolean(expected);
        }
    },
    {
        fieldName: "install.production",
        configFile: "bunfig.toml",
        description: "Skip devDependencies in production",
        helperText:
            "Set to true to exclude devDependencies during install. Reduces attack surface in production environments.",
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
        fieldName: "install.peer",
        configFile: "bunfig.toml",
        description: "Auto-install peer dependencies",
        helperText:
            "Set to true to automatically install peer dependencies. Prevents missing peer runtime errors.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "true",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            return toBoolean(actual) === toBoolean(expected);
        }
    },
    {
        fieldName: "install.optional",
        configFile: "bunfig.toml",
        description: "Install optionalDependencies",
        helperText:
            "Set to true to install optionalDependencies. Set to false to skip them for leaner installs.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "true",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            return toBoolean(actual) === toBoolean(expected);
        }
    },
    {
        fieldName: "install.auto",
        configFile: "bunfig.toml",
        description: "Auto-install dependencies on import",
        helperText:
            "Set to false to disable auto-install on import. Gives stricter control over when dependencies are fetched.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "false",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            return toBoolean(actual) === toBoolean(expected);
        }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- --reporter=verbose src/shared/security/__tests__/securityFields.test.ts`
Expected: PASS

- [ ] **Step 5: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 6: Commit**

```bash
git add src/shared/security/bun.ts src/shared/security/__tests__/securityFields.test.ts
git commit -m "feat: add 5 new Bun security fields (saveTextLockfile, production, peer, optional, auto)"
```

---

### Task 2: Fix SecuritySettingsPage missing Bun tab

**Files:**

- Modify: `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx`

**Interfaces:**

- Consumes: `PackageManagerId` from `#shared/security/index.js`
- Produces: Bun tab visible in SecuritySettings SegmentedControl

- [ ] **Step 1: Add Bun tab and fix type cast**

In `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx`:

1. Add import at top:

```ts
import type { PackageManagerId } from "#shared/security/index.js";
```

2. Update SegmentedControl (around line 67-75):

```tsx
<SegmentedControl
  value={vm.selectedPackageManager}
  onChange={value => presenter.selectPackageManager(value as PackageManagerId)}
  data={[
    { label: "Yarn", value: "yarn" },
    { label: "NPM", value: "npm" },
    { label: "PNPM", value: "pnpm" },
    { label: "Bun", value: "bun" }
  ]}
/>
```

- [ ] **Step 2: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 3: Run full test suite**

Run: `bun run test`
Expected: all tests pass (494 baseline)

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx
git commit -m "fix: add missing Bun tab to SecuritySettingsPage SegmentedControl"
```
