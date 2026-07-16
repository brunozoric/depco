# Tests 02 — SecurityService with NPM and PNPM Projects

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend SecurityService tests to cover npm (.npmrc key=value parsing) and pnpm scenarios end-to-end with real DB + real filesystem.

**Architecture:** Extend existing test file. Create 2 new seed helpers following the `seedYarnSecuritySettings` pattern.

**Tech Stack:** Vitest, in-memory SQLite (createTestDb), real filesystem (tmpdir)

## Global Constraints

- TypeScript 7 strict, ESM
- DI via `@webiny/di`
- Follow existing SecurityService test patterns exactly
- Run `yarn full` after last task

---

### Task 1: NPM seed helper + SecurityService npm tests

**Files:**

- Create: `src/testing/helpers/seedNpmSecuritySettings.ts`
- Modify: `src/api/services/__tests__/SecurityService.test.ts`

- [ ] **Step 1: Create seedNpmSecuritySettings helper**

Follow `seedYarnSecuritySettings.ts` pattern exactly:

```typescript
import { generateId } from "@webiny/stdlib";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { pmSecuritySettings } from "#api/db/schema.js";

export async function seedNpmSecuritySettings(db: LibSQLDatabase): Promise<void> {
  await db
    .insert(pmSecuritySettings)
    .values([
      {
        id: generateId(),
        packageManager: "npm",
        configFile: ".npmrc",
        fieldName: "ignore-scripts",
        expectedValue: "true"
      },
      {
        id: generateId(),
        packageManager: "npm",
        configFile: ".npmrc",
        fieldName: "audit",
        expectedValue: "true"
      },
      {
        id: generateId(),
        packageManager: "npm",
        configFile: ".npmrc",
        fieldName: "strict-ssl",
        expectedValue: "true"
      }
    ])
    .run();
}

export const VALID_NPMRC = ["ignore-scripts=true", "audit=true", "strict-ssl=true"].join("\n");
```

- [ ] **Step 2: Add npm describe block to SecurityService.test.ts**

Add `describe("npm projects")` inside the existing top-level describe. Import `seedNpmSecuritySettings` and `VALID_NPMRC`.

Tests (each inserts a project with `packageManager: "npm"`, seeds npm settings):

1. **passes when all 3 npm settings are satisfied** — write VALID_NPMRC to `.npmrc`, assert `result.passes === true`, all 3 checks true
2. **fails when ignore-scripts is missing** — write `.npmrc` with only `audit=true\nstrict-ssl=true`, assert `result.passes === false`, `checks["ignore-scripts"] === false`
3. **fails when ignore-scripts=false** — write `.npmrc` with `ignore-scripts=false\naudit=true\nstrict-ssl=true`, assert `checks["ignore-scripts"] === false`
4. **fails when .npmrc does not exist** — don't write file, assert all 3 checks false
5. **handles comments and extra keys** — write `.npmrc` with `# comment\nregistry=https://registry.npmjs.org\nignore-scripts=true\naudit=true\nstrict-ssl=true`, assert passes
6. **persists npm check to security_checks table** — check DB row after `service.check()`

- [ ] **Step 3: Run SecurityService tests**

Run: `yarn test src/api/services/__tests__/SecurityService.test.ts`
Expected: all PASS (existing yarn tests + new npm tests)

---

### Task 2: PNPM seed helper + SecurityService pnpm tests

**Files:**

- Create: `src/testing/helpers/seedPnpmSecuritySettings.ts`
- Modify: `src/api/services/__tests__/SecurityService.test.ts`

- [ ] **Step 1: Create seedPnpmSecuritySettings helper**

Same pattern. Fields: ignore-scripts, strict-ssl, strict-peer-dependencies. All `.npmrc`, all expected "true".

Export `VALID_PNPM_NPMRC`:

```typescript
export const VALID_PNPM_NPMRC = [
  "ignore-scripts=true",
  "strict-ssl=true",
  "strict-peer-dependencies=true"
].join("\n");
```

- [ ] **Step 2: Add pnpm describe block to SecurityService.test.ts**

Add imports at top of file:

```typescript
import {
  seedPnpmSecuritySettings,
  VALID_PNPM_NPMRC
} from "#testing/helpers/seedPnpmSecuritySettings.js";
```

Tests:

1. **passes when all 3 pnpm settings are satisfied**
2. **fails when strict-peer-dependencies is missing**
3. **fails when .npmrc does not exist**
4. **persists pnpm check to security_checks table**

- [ ] **Step 3: Run full suite**

Run: `yarn full`
Expected: all PASS
