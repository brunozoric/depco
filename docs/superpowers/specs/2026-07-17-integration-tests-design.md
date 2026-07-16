# Integration Test Spec — Security Fields + Service Coverage

## Goal

Fill remaining integration test gaps. In-memory SQLite via `createTestDb()`, minimal mocking (only `CommandRunner` at the shell boundary). No redundant unit tests — if a route test already covers a scenario end-to-end, skip it.

## Existing coverage summary

| Area                     | Covered       | Notes                                      |
| ------------------------ | ------------- | ------------------------------------------ |
| Route tests (5 files)    | Full          | Fastify inject + real DB                   |
| Service tests (7 files)  | Full for yarn | SecurityService only exercises yarn        |
| UI presenters (5)        | Full          | Mock gateway/repository at boundary        |
| Settings routes          | Full CRUD     | But reset only tested for yarn + npm count |
| Jobs routes              | Full          | cancel, list, filter, history              |
| Security field compare() | None          | 0 tests for any PM's compare logic         |

## What to test

### Test Group 1: Security field compare functions

**File:** `src/shared/security/__tests__/securityFields.test.ts`

No DB needed. Pure function tests for all compare() + expectedValueSchema validation across all 3 PMs.

#### Yarn fields (.yarnrc.yml)

**npmPreapprovedPackages** (exists)

- compare returns true when value is an array (even empty)
- compare returns false when value is null
- compare returns false when value is undefined
- compare returns false when value is a string (not array)

**npmMinimalAgeGate** (duration)

- compare returns true when actual duration >= expected ("3d" >= "3d")
- compare returns true when actual exceeds expected ("7d" >= "3d")
- compare returns false when actual is less than expected ("1d" < "3d")
- compare returns false when actual is null
- compare returns false when actual is an invalid string
- expectedValueSchema rejects invalid format ("3x", "abc", "")

**enableScripts** (boolean)

- compare returns true when actual matches expected (false === false)
- compare returns true when actual is string "false" and expected is "false"
- compare returns false when actual is true and expected is "false"
- compare returns false when actual is null
- expectedValueSchema rejects non-boolean string ("maybe")

**approvedGitRepositories** (exists)

- compare returns true when value is an array
- compare returns false when value is null

#### NPM fields (.npmrc)

All 3 npm fields use boolean inputType with `toBoolean()` compare. `.npmrc` values arrive as strings from the key=value parser.

**ignore-scripts** (boolean)

- compare returns true when actual is "true" and expected is "true"
- compare returns false when actual is "false" and expected is "true"
- compare returns false when actual is null
- expectedValueSchema rejects "maybe"

**audit** (boolean)

- compare returns true when actual is "true" and expected is "true"
- compare returns false when actual is "false" and expected is "true"
- compare returns false when actual is null

**strict-ssl** (boolean)

- compare returns true when actual is "true" and expected is "true"
- compare returns false when actual is "false" and expected is "true"
- compare returns false when actual is null

#### PNPM fields (.npmrc)

Same boolean pattern as npm. All values arrive as strings from `.npmrc` parser.

**ignore-scripts** (boolean)

- compare returns true when actual is "true" and expected is "true"
- compare returns false when actual is "false" and expected is "true"
- compare returns false when actual is null

**strict-ssl** (boolean)

- compare returns true when actual is "true" and expected is "true"
- compare returns false when actual is "false" and expected is "true"
- compare returns false when actual is null

**strict-peer-dependencies** (boolean)

- compare returns true when actual is "true" and expected is "true"
- compare returns false when actual is "false" and expected is "true"
- compare returns false when actual is null
- expectedValueSchema rejects "maybe"

#### Registry structure

- YARN_SECURITY_FIELDS has 4 entries
- NPM_SECURITY_FIELDS has 3 entries
- PNPM_SECURITY_FIELDS has 3 entries
- SECURITY_FIELD_REGISTRY maps all 3 PMs
- Each field has required shape (fieldName, configFile, description, helperText, inputType, expectedValueSchema, defaultExpectedValue, compare)

---

### Test Group 2: SecurityService with npm projects

**File:** `src/api/services/__tests__/SecurityService.test.ts` (extend existing)

Real DB + real filesystem. Seed npm security settings, write `.npmrc` files, run `service.check()`.

**New test helper:** `seedNpmSecuritySettings(db)` in `src/testing/helpers/seedNpmSecuritySettings.ts` + `VALID_NPMRC` constant.

#### Scenarios

- passes when all 3 npm settings are satisfied (.npmrc has ignore-scripts=true, audit=true, strict-ssl=true)
- fails when ignore-scripts is missing from .npmrc
- fails when ignore-scripts=false but expected true
- fails when .npmrc does not exist
- passes with extra unrelated keys in .npmrc (regression: parser must handle comments and unknown keys)
- persists npm check result to security_checks table

---

### Test Group 3: SecurityService with pnpm projects

Same file, extend further.

**New test helper:** `seedPnpmSecuritySettings(db)` in `src/testing/helpers/seedPnpmSecuritySettings.ts` + `VALID_PNPM_NPMRC` constant.

#### Scenarios

- passes when all 3 pnpm settings are satisfied
- fails when strict-peer-dependencies is missing
- fails when .npmrc does not exist
- persists pnpm check result to security_checks table

---

### Test Group 4: Settings routes for npm and pnpm

**File:** `src/api/routes/__tests__/settings.test.ts` (extend existing)

Already has yarn CRUD + reset. Add npm/pnpm-specific scenarios.

#### Scenarios

- POST /api/settings/security creates a setting for npm (ignore-scripts)
- POST /api/settings/security creates a setting for pnpm (strict-peer-dependencies)
- POST /api/settings/security/reset for npm returns 3 items with correct field names and default values
- POST /api/settings/security/reset for pnpm returns 3 items with correct field names and default values
- POST /api/settings/security/reset for pnpm replaces existing pnpm settings with defaults

---

### Test Group 5: Jobs routes — cancel edge cases

**File:** `src/api/routes/__tests__/jobs.test.ts` (extend existing)

Currently covers: cancel pending, list all, filter by status, upgrade enqueue, transient enqueue.

#### Scenarios

- cancel on an already-completed job is a no-op (returns 200, status stays "completed") — `cancelJob` silently returns when `status !== "pending"` and no controller exists
- cancel on a running job aborts via AbortController (process job, cancel while running, verify status becomes "cancelled") — tests the `controller.abort()` path at JobWorker.ts:306-308

---

## Out of scope

- UI gateway/repository tests — thin HTTP wrappers, mocking HTTP client adds no integration value
- UI use case tests in isolation — already tested through presenter tests
- WebSocket broadcaster/plugin — infrastructure, not business logic
- Response helpers (sendError, sendList, etc.) — covered by route tests

## Test style

- Use `createTestDb()` for in-memory SQLite
- Use `createContainer()` + DI registration (same pattern as existing tests)
- Mock only `CommandRunner` (shell boundary)
- Real filesystem via `tmpdir()` for config file tests
- Fastify `inject()` for route tests
- Seed helpers for test data

## File count

- 1 new test file: `securityFields.test.ts`
- 2 new seed helpers: `seedNpmSecuritySettings.ts`, `seedPnpmSecuritySettings.ts`
- 3 extended test files: SecurityService, settings routes, jobs routes
