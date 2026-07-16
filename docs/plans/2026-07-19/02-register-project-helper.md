# Shared registerProject Helper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract project registration logic into a shared helper used by both the create-project route and the future CloneJobExecutor.

**Architecture:** Plain async function (not DI-wired) that takes services as parameters. Reads package.json, detects PM, inserts into DB, returns the created project record.

**Tech Stack:** Node.js `fs/promises`, `@webiny/stdlib` for ID generation, Drizzle ORM

## Global Constraints

- Linter: oxlint, Formatter: oxfmt
- Build before test: `yarn build`
- No new DI abstractions needed — this is a utility function, not a service

---

### Task 1: Extract registerProject and refactor create-project route

**Files:**

- Create: `src/api/services/registerProject.ts`
- Modify: `src/api/routes/projects.ts` — use helper in create-project and import routes
- Modify: `src/api/routes/__tests__/projects.test.ts` — existing tests validate no regressions

**Interfaces:**

- Consumes: `PackageManagerService.Interface`, `DatabaseClient.Interface` from existing abstractions
- Produces: `registerProject(params): Promise<RegisteredProject>` function

```typescript
// Signature produced by this task:
interface RegisterProjectParams {
  projectPath: string;
  databaseClient: DatabaseClient.Interface;
  packageManagerService: PackageManagerService.Interface;
}

interface RegisteredProject {
  id: string;
  name: string;
  path: string;
  packageManager: string;
  pmVersion: string | null;
  addedAt: number;
}

function registerProject(params: RegisterProjectParams): Promise<RegisteredProject>;
```

- [ ] **Step 1: Write the helper**

```typescript
// src/api/services/registerProject.ts
import { readFile } from "fs/promises";
import { join, basename } from "path";
import { generateId } from "@webiny/stdlib";
import type { PackageManagerService } from "./abstractions/PackageManagerService.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects } from "#api/db/schema.js";

interface PackageJson {
  name?: string;
}

export interface RegisterProjectParams {
  projectPath: string;
  databaseClient: DatabaseClient.Interface;
  packageManagerService: PackageManagerService.Interface;
}

export interface RegisteredProject {
  id: string;
  name: string;
  path: string;
  packageManager: string;
  pmVersion: string | null;
  addedAt: number;
}

export async function registerProject(params: RegisterProjectParams): Promise<RegisteredProject> {
  const { projectPath, databaseClient, packageManagerService } = params;

  let name: string;
  try {
    const pkgContent = await readFile(join(projectPath, "package.json"), "utf-8");
    const pkgJson = JSON.parse(pkgContent) as PackageJson;
    name = pkgJson.name ?? basename(projectPath);
  } catch {
    name = basename(projectPath);
  }

  const packageManager = await packageManagerService.detect(projectPath);

  let pmVersion: string | null;
  try {
    pmVersion = await packageManagerService.getVersion(projectPath, packageManager);
  } catch {
    pmVersion = null;
  }

  const id = generateId();
  const addedAt = Date.now();
  await databaseClient.db
    .insert(projects)
    .values({ id, name, path: projectPath, packageManager, pmVersion, addedAt })
    .run();

  return { id, name, path: projectPath, packageManager, pmVersion, addedAt };
}
```

- [ ] **Step 2: Refactor create-project route to use helper**

In `src/api/routes/projects.ts`, replace the inline registration logic in the `createProjectRoute` handler (lines 46-77) with:

```typescript
registerRoute(app, createProjectRoute, {}, async (request, reply) => {
  const { path: projectPath } = request.body;

  let registered;
  try {
    registered = await registerProjectHelper({
      projectPath,
      databaseClient,
      packageManagerService
    });
  } catch (error) {
    sendError(reply, 400, (error as Error).message);
    return;
  }

  void securityService.check(registered.id, projectPath);

  sendOne(reply, { ...registered, lastScannedAt: null }, 201);
});
```

Add import at top:

```typescript
import { registerProject as registerProjectHelper } from "../services/registerProject.js";
```

- [ ] **Step 3: Refactor import route to use helper**

In `src/api/routes/projects.ts`, replace the inline registration logic in the `importProjectsRoute` handler with the same helper. The try/catch structure stays — the helper throws on PM detection failure, which maps to `"failed"` status.

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `yarn build && yarn vitest run src/api/routes/__tests__/projects.test.ts --reporter=verbose`
Expected: All 23 existing tests PASS — behavior unchanged

- [ ] **Step 5: Run full pipeline**

Run: `yarn lint && yarn format:fix && yarn build && yarn test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/api/services/registerProject.ts src/api/routes/projects.ts
git commit -m "refactor: extract registerProject helper from create-project route"
```
