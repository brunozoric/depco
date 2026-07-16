# Tests 01 — Security Field Compare Functions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test all compare() functions and expectedValueSchema validations for yarn, npm, and pnpm security field definitions.

**Architecture:** Single test file with one describe block per PM. No DB, no mocking — pure function tests against the exported field arrays.

**Tech Stack:** Vitest

## Global Constraints

- TypeScript 7 strict, ESM
- Run `yarn full` after last task

---

### Task 1: Yarn field compare tests

**Files:**

- Create: `src/shared/security/__tests__/securityFields.test.ts`

- [ ] **Step 1: Create test file with yarn describe block**

Import `YARN_SECURITY_FIELDS` from `../yarn.js`. Helper to find field by name:

```typescript
function yarnField(name: string) {
  return YARN_SECURITY_FIELDS.find(f => f.fieldName === name)!;
}
```

- [ ] **Step 2: npmPreapprovedPackages tests**

```
describe("npmPreapprovedPackages")
- compare returns true when value is an empty array
- compare returns true when value is a non-empty array
- compare returns false when value is null
- compare returns false when value is undefined
- compare returns false when value is a string
```

- [ ] **Step 3: npmMinimalAgeGate tests**

```
describe("npmMinimalAgeGate")
- compare returns true when actual "3d" >= expected "3d"
- compare returns true when actual "7d" >= expected "3d"
- compare returns false when actual "1d" < expected "3d"
- compare returns false when actual is null
- compare returns false when actual is invalid string "abc"
- expectedValueSchema rejects "3x"
- expectedValueSchema rejects ""
- expectedValueSchema accepts "72h"
```

- [ ] **Step 4: enableScripts tests**

```
describe("enableScripts")
- compare returns true when actual false matches expected "false"
- compare returns true when actual is string "false" and expected is "false"
- compare returns false when actual is true and expected is "false"
- compare returns false when actual is null
- expectedValueSchema rejects "maybe"
- expectedValueSchema accepts "true"
- expectedValueSchema accepts "false"
```

- [ ] **Step 5: approvedGitRepositories tests**

```
describe("approvedGitRepositories")
- compare returns true when value is an empty array
- compare returns false when value is null
- compare returns false when value is undefined
```

---

### Task 2: NPM and PNPM field compare tests + registry structure

**Files:**

- Modify: `src/shared/security/__tests__/securityFields.test.ts`

- [ ] **Step 1: Add npm describe block**

Import `NPM_SECURITY_FIELDS` from `../npm.js`. Helper:

```typescript
function npmField(name: string) {
  return NPM_SECURITY_FIELDS.find(f => f.fieldName === name)!;
}
```

For each of the 3 fields (ignore-scripts, audit, strict-ssl):

- compare returns true when actual is "true" and expected is "true"
- compare returns false when actual is "false" and expected is "true"
- compare returns false when actual is null

For ignore-scripts additionally:

- expectedValueSchema rejects "maybe"

- [ ] **Step 2: Add pnpm describe block**

Import `PNPM_SECURITY_FIELDS` from `../pnpm.js`. Same pattern as npm.

For each of the 3 fields (ignore-scripts, strict-ssl, strict-peer-dependencies):

- compare returns true when actual is "true" and expected is "true"
- compare returns false when actual is "false" and expected is "true"
- compare returns false when actual is null

For strict-peer-dependencies additionally:

- expectedValueSchema rejects "maybe"

- [ ] **Step 3: Add registry structure tests**

Import `SECURITY_FIELD_REGISTRY` from `../index.js`.

```
describe("SECURITY_FIELD_REGISTRY")
- maps yarn to 4 fields
- maps npm to 3 fields
- maps pnpm to 3 fields
- every field has required shape properties
```

Each field must have: fieldName (string), configFile (string), description (string), helperText (string), inputType (string), expectedValueSchema (object with parse), defaultExpectedValue (string), compare (function).

- [ ] **Step 4: Run tests**

Run: `yarn test src/shared/security/__tests__/securityFields.test.ts`
Expected: all PASS

- [ ] **Step 5: Run full suite**

Run: `yarn full`
Expected: all PASS
