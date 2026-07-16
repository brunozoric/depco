# Tests 03 — Settings Routes for NPM and PNPM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend settings route tests to cover CRUD and reset-to-defaults for npm and pnpm security settings.

**Architecture:** Extend existing test file. Uses Fastify inject + in-memory SQLite.

**Tech Stack:** Vitest, Fastify, in-memory SQLite (createTestDb)

## Global Constraints

- TypeScript 7 strict, ESM
- Follow existing settings route test patterns exactly
- Run `yarn full` after last task

---

### Task 1: NPM and PNPM settings route tests

**Files:**

- Modify: `src/api/routes/__tests__/settings.test.ts`

- [ ] **Step 1: Add npm create setting test**

In the existing `POST /api/settings/security` describe block, add:

```
it("creates a setting for npm (ignore-scripts)")
```

POST with `{ packageManager: "npm", fieldName: "ignore-scripts", expectedValue: "true" }`. Assert 201, configFile is ".npmrc", fieldName and expectedValue correct.

- [ ] **Step 2: Add pnpm create setting test**

```
it("creates a setting for pnpm (strict-peer-dependencies)")
```

POST with `{ packageManager: "pnpm", fieldName: "strict-peer-dependencies", expectedValue: "true" }`. Assert 201, configFile is ".npmrc".

- [ ] **Step 3: Replace existing npm reset test with full field verification**

In the existing `POST /api/settings/security/reset` describe block, replace the test at line 275 ("returns default items for npm (3 registry fields)") with a more thorough version that verifies field names and default values:

```typescript
it("returns default items for npm (3 registry fields) with correct defaults", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/settings/security/reset",
    payload: { packageManager: "npm" }
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.items).toHaveLength(3);
  expect(body.items.map((i: { fieldName: string }) => i.fieldName).sort()).toEqual([
    "audit",
    "ignore-scripts",
    "strict-ssl"
  ]);
  expect(body.items.every((i: { configFile: string }) => i.configFile === ".npmrc")).toBe(true);
  expect(
    body.items.find((i: { fieldName: string }) => i.fieldName === "ignore-scripts").expectedValue
  ).toBe("true");
});
```

- [ ] **Step 4: Add pnpm reset test**

```typescript
it("returns default items for pnpm (3 registry fields) with correct defaults", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/settings/security/reset",
    payload: { packageManager: "pnpm" }
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.items).toHaveLength(3);
  expect(body.items.map((i: { fieldName: string }) => i.fieldName).sort()).toEqual([
    "ignore-scripts",
    "strict-peer-dependencies",
    "strict-ssl"
  ]);
});
```

- [ ] **Step 5: Add pnpm reset replaces existing settings test**

Create a pnpm setting first, then reset and verify it's replaced:

```typescript
it("replaces existing pnpm settings with defaults on reset", async () => {
  await app.inject({
    method: "POST",
    url: "/api/settings/security",
    payload: { packageManager: "pnpm", fieldName: "ignore-scripts", expectedValue: "false" }
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/settings/security/reset",
    payload: { packageManager: "pnpm" }
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.items).toHaveLength(3);
  expect(
    body.items.find((i: { fieldName: string }) => i.fieldName === "ignore-scripts").expectedValue
  ).toBe("true");
});
```

- [ ] **Step 6: Run full suite**

Run: `yarn full`
Expected: all PASS
