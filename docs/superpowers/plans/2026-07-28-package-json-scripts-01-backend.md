# Package.json Script Discovery Part 1: Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `PackageJsonService` that reads `scripts` from a project's `package.json`, and extend the step hooks list endpoint to return discovered scripts alongside configured hooks.

**Architecture:** New `PackageJsonService` abstraction + implementation. Step hooks list handler resolves `PackageJsonService` to get discovered scripts, filters out scripts already configured as hooks, returns both in response.

**Tech Stack:** TypeScript, Zod, Vitest, `@webiny/di`

## Global Constraints

- Named interfaces only, no inline structural types
- yarn for all package management
- After all changes: `yarn format:fix && yarn lint:fix`
- Commit directly to main
- Depends on: file-config-01-backend plan (FileConfigService, configSource in list response)

---

### Task 1: PackageJsonService Abstraction and Implementation

**Files:**

- Create: `src/api/services/abstractions/PackageJsonService.ts`
- Create: `src/api/services/PackageJsonService.ts`
- Create: `src/api/services/__tests__/PackageJsonService.test.ts`

**Interfaces:**

- Consumes: nothing external
- Produces:
  - `IDiscoveredScript` — `{ name: string; command: string }`
  - `IPackageJsonService.getScripts(projectPath: string): Promise<IDiscoveredScript[]>`
  - `PackageJsonService` — DI abstraction token

- [ ] **Step 1: Write failing tests**

Create `src/api/services/__tests__/PackageJsonService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createContainer } from "#shared/index.js";
import { PackageJsonService } from "../abstractions/PackageJsonService.js";
import { PackageJsonService as PackageJsonServiceRegistration } from "../PackageJsonService.js";

describe("PackageJsonService", () => {
  let tempDir: string;
  let service: PackageJsonService.Interface;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-pkgjson-"));
    const container = createContainer();
    container.register(PackageJsonServiceRegistration).inSingletonScope();
    service = container.resolve(PackageJsonService);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns empty array when no package.json exists", async () => {
    const scripts = await service.getScripts(tempDir);
    expect(scripts).toEqual([]);
  });

  it("returns empty array when package.json has no scripts", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "test-project" }),
      "utf-8"
    );

    const scripts = await service.getScripts(tempDir);
    expect(scripts).toEqual([]);
  });

  it("returns discovered scripts from package.json", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        scripts: {
          build: "tsc",
          test: "vitest run",
          lint: "eslint ."
        }
      }),
      "utf-8"
    );

    const scripts = await service.getScripts(tempDir);
    expect(scripts).toEqual([
      { name: "build", command: "tsc" },
      { name: "lint", command: "eslint ." },
      { name: "test", command: "vitest run" }
    ]);
  });

  it("returns scripts sorted alphabetically by name", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        scripts: { z: "echo z", a: "echo a", m: "echo m" }
      }),
      "utf-8"
    );

    const scripts = await service.getScripts(tempDir);
    expect(scripts.map(s => s.name)).toEqual(["a", "m", "z"]);
  });

  it("returns empty array on malformed package.json", async () => {
    await writeFile(join(tempDir, "package.json"), "not json{{{", "utf-8");

    const scripts = await service.getScripts(tempDir);
    expect(scripts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/api/services/__tests__/PackageJsonService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create PackageJsonService abstraction**

Create `src/api/services/abstractions/PackageJsonService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IDiscoveredScript {
  name: string;
  command: string;
}

export interface IPackageJsonService {
  getScripts(projectPath: string): Promise<IDiscoveredScript[]>;
}

export const PackageJsonService = createAbstraction<IPackageJsonService>("Api/PackageJsonService");

export namespace PackageJsonService {
  export type Interface = IPackageJsonService;
  export type DiscoveredScript = IDiscoveredScript;
}
```

- [ ] **Step 4: Create PackageJsonService implementation**

Create `src/api/services/PackageJsonService.ts`:

```typescript
import { readFile } from "fs/promises";
import { join } from "path";
import { PackageJsonService as Abstraction } from "./abstractions/PackageJsonService.js";
import type { IDiscoveredScript } from "./abstractions/PackageJsonService.js";

interface IPackageJsonScripts {
  scripts?: Record<string, string>;
}

class PackageJsonServiceImpl implements Abstraction.Interface {
  public async getScripts(projectPath: string): Promise<IDiscoveredScript[]> {
    let raw: string;
    try {
      raw = await readFile(join(projectPath, "package.json"), "utf-8");
    } catch {
      return [];
    }

    let parsed: IPackageJsonScripts;
    try {
      parsed = JSON.parse(raw) as IPackageJsonScripts;
    } catch {
      return [];
    }

    if (!parsed.scripts || typeof parsed.scripts !== "object") {
      return [];
    }

    return Object.entries(parsed.scripts)
      .map(([name, command]) => ({ name, command }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

export const PackageJsonService = Abstraction.createImplementation({
  implementation: PackageJsonServiceImpl,
  dependencies: []
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/api/services/__tests__/PackageJsonService.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/services/abstractions/PackageJsonService.ts src/api/services/PackageJsonService.ts src/api/services/__tests__/PackageJsonService.test.ts
git commit -m "feat: add PackageJsonService for script discovery"
```

---

### Task 2: Extend Step Hooks List Endpoint with discoveredScripts

**Files:**

- Modify: `src/shared/routes/stepHooks.ts` — add `discoveredScripts` to list response schema
- Modify: `src/api/routes/stepHooks.ts` — resolve PackageJsonService, filter, return scripts
- Modify: `src/api/feature.ts` — register PackageJsonService

**Interfaces:**

- Consumes:
  - `PackageJsonService.Interface.getScripts(projectPath)` from Task 1
  - `projects` table — to look up project path by ID (already done in file-config plan)
  - `configSource` logic from file-config plan
- Produces:
  - `listStepHooksRoute` response now includes `discoveredScripts: { name: string; command: string }[]`
  - Backend filters out scripts whose name matches a configured hook

- [ ] **Step 1: Update route schema**

In `src/shared/routes/stepHooks.ts`, add to `listStepHooksRoute` response:

```typescript
const discoveredScriptSchema = z.object({
  name: z.string(),
  command: z.string()
});

export const listStepHooksRoute = defineRoute({
  method: "GET",
  path: "/api/projects/:id/step-hooks",
  description: "List step hooks for a project",
  params: z.object({ id: z.string() }),
  querystring: z.object({}),
  response: z.object({
    items: z.array(stepHookSchema),
    configSource: z.enum(["db", "file"]),
    discoveredScripts: z.array(discoveredScriptSchema)
  })
});
```

- [ ] **Step 2: Register PackageJsonService in API feature**

In `src/api/feature.ts`, add import and registration:

```typescript
// Add import:
import { PackageJsonService } from "./services/PackageJsonService.js";

// Add in register() after FileConfigService:
container.register(PackageJsonService).inSingletonScope();
```

- [ ] **Step 3: Update list handler to include discovered scripts**

In `src/api/routes/stepHooks.ts`, update list handler (builds on file-config plan changes):

```typescript
// Add import at top:
import { PackageJsonService } from "#api/services/abstractions/PackageJsonService.js";

// In the list handler, add discoveredScripts to BOTH code paths (file config and DB).
// The handler already has two branches from file-config plan — update each:

const packageJsonService = container.resolve(PackageJsonService);
const allScripts = await packageJsonService.getScripts(project.path);

if (fileConfig) {
  const now = Date.now();
  const fileItems = fileConfig.stepHooks.map((hook, index) => ({
    id: `file-${index}`,
    projectId: id,
    position: hook.position,
    name: hook.name,
    command: hook.command,
    type: hook.executionType,
    required: hook.required,
    enabled: true,
    sortOrder: index,
    source: "file" as const,
    createdAt: now,
    updatedAt: now
  }));

  const configuredNames = new Set(fileConfig.stepHooks.map(h => h.name));
  const discoveredScripts = allScripts.filter(s => !configuredNames.has(s.name));

  reply.send({
    items: fileItems,
    configSource: "file" as const,
    discoveredScripts
  });
  return;
}

const rows = await db
  .select()
  .from(projectStepHooks)
  .where(eq(projectStepHooks.projectId, id))
  .orderBy(asc(projectStepHooks.position), asc(projectStepHooks.sortOrder))
  .all();

const configuredNames = new Set(rows.map(row => row.name));
const discoveredScripts = allScripts.filter(s => !configuredNames.has(s.name));

reply.send({
  items: rows.map(toResponse),
  configSource: "db" as const,
  discoveredScripts
});
```

This replaces the entire list handler body from the file-config plan. Both file and DB paths now include `discoveredScripts`.

- [ ] **Step 4: Run format and lint**

Run: `yarn format:fix && yarn lint:fix`

- [ ] **Step 5: Run full test suite**

Run: `yarn vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/routes/stepHooks.ts src/api/routes/stepHooks.ts src/api/feature.ts
git commit -m "feat: add discovered scripts from package.json to step hooks list"
```
