# PM Driver 06 — JobWorker Update + Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update JobWorker to pass `packageManager` to UpgradeService and compute it once before type branches. Update all route tests and integration tests to register the driver registry. Verify `yarn full` passes.

**Architecture:** JobWorker computes `packageManager` at the top of `executeJob`, then passes it to `upgradeService.upgradePackage()`, `upgradeService.refreshTransient()`, and through the existing `packageManagerService.updateVersion()`. Route tests and service tests that build DI containers need `PackageManagerDriverRegistry` registered.

**Tech Stack:** TypeScript, @webiny/di, Vitest

## Global Constraints

- TypeScript 7 strict, ESM
- DI via `@webiny/di`
- UpgradeService now requires `packageManager` param (from Plan 03)
- RegistryCacheService now requires `packageManager` param (from Plan 04)
- Run `yarn full` after last task — this is the integration gate

---

### Task 1: Update JobWorker to pass packageManager

**Files:**

- Modify: `src/api/services/JobWorker.ts`
- Modify: `src/api/services/__tests__/JobWorker.test.ts`

**Interfaces:**

- Consumes: `UpgradeService.Interface` (updated), `PackageManagerService.Interface`, `ScanService.Interface`, `SecurityService.Interface`, `DatabaseClient.Interface`, `WebSocketBroadcaster.Interface`
- Produces: Same `JobWorker.Interface` (no breaking changes)

- [ ] **Step 1: Update JobWorker.executeJob**

In `src/api/services/JobWorker.ts`, modify the `executeJob` method. After the project lookup and the `if (!project)` guard, compute `packageManager` once:

```typescript
const packageManager =
  project.packageManager ?? (await this.packageManagerService.detect(project.path));
```

Then update the 3 branches:

**dependency branch** — add `packageManager` as 4th arg:

```typescript
await this.upgradeService.upgradePackage(
  project.path,
  upgradePackage.name,
  upgradePackage.to,
  packageManager,
  appendLog,
  controller.signal
);
```

**transient branch** — add `packageManager` as 2nd arg:

```typescript
await this.upgradeService.refreshTransient(
  project.path,
  packageManager,
  appendLog,
  controller.signal
);
```

**packageManager branch** — replace inline detect with pre-computed value:

```typescript
await this.packageManagerService.updateVersion(
  project.path,
  packageManager,
  packageManagerPackage.to,
  appendLog,
  controller.signal
);
```

Remove the old inline `packageManager` computation that was inside the packageManager branch (lines 165-167 of the current file).

- [ ] **Step 2: Update JobWorker tests**

In `src/api/services/__tests__/JobWorker.test.ts`:

Add import:

```typescript
import { PackageManagerDriverRegistry as RegistryRegistration } from "../packageManagers/PackageManagerDriverRegistry.js";
```

In `beforeEach`, add after existing registrations:

```typescript
container.register(RegistryRegistration).inSingletonScope();
```

No test logic changes needed — the JobWorker interface is unchanged. The UpgradeService mock's `upgradePackage` and `refreshTransient` functions accept any args via `vi.fn()`.

However, verify that the mock UpgradeService's `upgradePackage` signature still matches. If it was typed strictly, update the mock to accept the new `packageManager` param. Since tests use `vi.fn()`, this should work without changes.

- [ ] **Step 3: Run JobWorker tests**

Run: `yarn test src/api/services/__tests__/JobWorker.test.ts`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/api/services/JobWorker.ts src/api/services/__tests__/JobWorker.test.ts
git commit -m "refactor: JobWorker computes packageManager once and passes to services"
```

---

### Task 2: Update all route tests + run yarn full

**Files:**

- Modify: `src/api/routes/__tests__/jobs.test.ts`
- Modify: `src/api/routes/__tests__/projects.test.ts`
- Modify: `src/api/routes/__tests__/packageManager.test.ts`
- Modify: `src/api/routes/__tests__/cache.test.ts` (if it uses RegistryCacheService)

**Interfaces:**

- Consumes: `PackageManagerDriverRegistry` registration
- Produces: All route tests passing with driver registry in DI container

- [ ] **Step 1: Add registry registration to all route test files**

In each route test file that builds a DI container (jobs, projects, packageManager, cache), add:

```typescript
import { PackageManagerDriverRegistry as RegistryRegistration } from "../../services/packageManagers/PackageManagerDriverRegistry.js";
```

In each `beforeEach`, add after existing service registrations:

```typescript
container.register(RegistryRegistration).inSingletonScope();
```

Check each file:

- `jobs.test.ts` — builds full container with all services. Add registry.
- `projects.test.ts` — builds full container. Add registry.
- `packageManager.test.ts` — builds full container. Add registry. Note: tests that create a separate `localContainer` inside `it()` blocks also need registry registration.
- `cache.test.ts` — check if it uses RegistryCacheService. If it only uses the route which uses RegistryCacheService, the route needs the registry.

Read each file to verify which containers need the registration.

- [ ] **Step 2: Update SecurityService test if needed**

`src/api/services/__tests__/SecurityService.test.ts` — SecurityService doesn't depend on the registry. No changes needed.

- [ ] **Step 3: Run full suite**

Run: `yarn full`
Expected: all PASS — lint, format, build, all tests green

This is the integration gate. If any test fails:

1. Check the error — likely a missing registry registration in a test container
2. Add `container.register(RegistryRegistration).inSingletonScope()` to the failing test's setup
3. Re-run

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/__tests__/
git commit -m "test: register PackageManagerDriverRegistry in all route test containers"
```
