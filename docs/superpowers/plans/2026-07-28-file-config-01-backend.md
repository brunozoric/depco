# File-Based Config Part 1: Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `FileConfigService` that reads `.dependency-upgrader.json` from a project path, and integrate it into `StepHookService` so file-based hooks take precedence over DB hooks.

**Architecture:** New `FileConfigService` abstraction + implementation follows existing DI pattern (`createAbstraction`/`createImplementation`). `StepHookService` gains `FileConfigService` as a dependency and checks for config file before querying DB. Step hooks list endpoint response extended with `configSource` field.

**Tech Stack:** TypeScript, Zod (validation), Vitest, `@webiny/di`

## Global Constraints

- Named interfaces only, no inline structural types
- yarn for all package management
- After all changes: `yarn format:fix && yarn lint:fix`
- Commit directly to main

---

### Task 1: FileConfigService Abstraction and Implementation

**Files:**

- Create: `src/api/services/abstractions/FileConfigService.ts`
- Create: `src/api/services/FileConfigService.ts`
- Create: `src/api/services/__tests__/FileConfigService.test.ts`

**Interfaces:**

- Consumes: nothing external
- Produces:
  - `IProjectFileConfig` — `{ stepHooks: IFileStepHook[] }`
  - `IFileStepHook` — `{ position: string; name: string; command: string; executionType: "command" | "script" | "package-script"; required: boolean }`
  - `IFileConfigService.readConfig(projectPath: string): Promise<IProjectFileConfig | null>`
  - `FileConfigService` — DI abstraction token

- [ ] **Step 1: Write failing tests**

Create `src/api/services/__tests__/FileConfigService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createContainer } from "#shared/index.js";
import { FileConfigService } from "../abstractions/FileConfigService.js";
import { FileConfigService as FileConfigServiceRegistration } from "../FileConfigService.js";

describe("FileConfigService", () => {
  let tempDir: string;
  let service: FileConfigService.Interface;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-test-"));
    const container = createContainer();
    container.register(FileConfigServiceRegistration).inSingletonScope();
    service = container.resolve(FileConfigService);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns null when config file does not exist", async () => {
    const result = await service.readConfig(tempDir);
    expect(result).toBeNull();
  });

  it("returns parsed config when valid file exists", async () => {
    const config = {
      stepHooks: [
        {
          position: "pre:upgrade",
          name: "Lint",
          command: "yarn lint",
          executionType: "command",
          required: true
        }
      ]
    };
    await writeFile(join(tempDir, ".dependency-upgrader.json"), JSON.stringify(config), "utf-8");

    const result = await service.readConfig(tempDir);
    expect(result).toEqual(config);
  });

  it("returns config with empty stepHooks array", async () => {
    await writeFile(
      join(tempDir, ".dependency-upgrader.json"),
      JSON.stringify({ stepHooks: [] }),
      "utf-8"
    );

    const result = await service.readConfig(tempDir);
    expect(result).toEqual({ stepHooks: [] });
  });

  it("throws on malformed JSON", async () => {
    await writeFile(join(tempDir, ".dependency-upgrader.json"), "not valid json{{{", "utf-8");

    await expect(service.readConfig(tempDir)).rejects.toThrow();
  });

  it("throws on invalid schema", async () => {
    await writeFile(
      join(tempDir, ".dependency-upgrader.json"),
      JSON.stringify({ stepHooks: [{ invalid: true }] }),
      "utf-8"
    );

    await expect(service.readConfig(tempDir)).rejects.toThrow();
  });

  it("throws when stepHooks entry missing required fields", async () => {
    await writeFile(
      join(tempDir, ".dependency-upgrader.json"),
      JSON.stringify({
        stepHooks: [{ position: "pre:upgrade", name: "Lint" }]
      }),
      "utf-8"
    );

    await expect(service.readConfig(tempDir)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/api/services/__tests__/FileConfigService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create FileConfigService abstraction**

Create `src/api/services/abstractions/FileConfigService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IFileStepHook {
  position: string;
  name: string;
  command: string;
  executionType: "command" | "script" | "package-script";
  required: boolean;
}

export interface IProjectFileConfig {
  stepHooks: IFileStepHook[];
}

export interface IFileConfigService {
  readConfig(projectPath: string): Promise<IProjectFileConfig | null>;
}

export const FileConfigService = createAbstraction<IFileConfigService>("Api/FileConfigService");

export namespace FileConfigService {
  export type Interface = IFileConfigService;
  export type FileConfig = IProjectFileConfig;
  export type StepHook = IFileStepHook;
}
```

- [ ] **Step 4: Create FileConfigService implementation**

Create `src/api/services/FileConfigService.ts`:

```typescript
import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { FileConfigService as Abstraction } from "./abstractions/FileConfigService.js";
import type { IProjectFileConfig } from "./abstractions/FileConfigService.js";

const CONFIG_FILENAME = ".dependency-upgrader.json";

const fileStepHookSchema = z.object({
  position: z.string(),
  name: z.string(),
  command: z.string(),
  executionType: z.enum(["command", "script", "package-script"]),
  required: z.boolean()
});

const projectFileConfigSchema = z.object({
  stepHooks: z.array(fileStepHookSchema)
});

class FileConfigServiceImpl implements Abstraction.Interface {
  public async readConfig(projectPath: string): Promise<IProjectFileConfig | null> {
    let raw: string;
    try {
      raw = await readFile(join(projectPath, CONFIG_FILENAME), "utf-8");
    } catch {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return projectFileConfigSchema.parse(parsed);
  }
}

export const FileConfigService = Abstraction.createImplementation({
  implementation: FileConfigServiceImpl,
  dependencies: []
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/api/services/__tests__/FileConfigService.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/services/abstractions/FileConfigService.ts src/api/services/FileConfigService.ts src/api/services/__tests__/FileConfigService.test.ts
git commit -m "feat: add FileConfigService for .dependency-upgrader.json parsing"
```

---

### Task 2: Integrate FileConfigService into StepHookService

**Files:**

- Modify: `src/api/services/StepHookService.ts` — add FileConfigService dependency, use projectPath
- Modify: `src/api/services/__tests__/StepHookService.test.ts` — add file config tests
- Modify: `src/api/feature.ts` — register FileConfigService

**Interfaces:**

- Consumes:
  - `FileConfigService.Interface.readConfig(projectPath)` from Task 1
  - `IFileStepHook` from Task 1
  - `IResolvedStepHook` from `src/api/services/abstractions/StepHookService.ts`
- Produces:
  - Modified `StepHookServiceImpl.getStepConfig` — returns file hooks with `source: "file"` when config file exists, DB hooks otherwise

- [ ] **Step 1: Write failing tests**

Add to `src/api/services/__tests__/StepHookService.test.ts`:

```typescript
// Add these imports at the top:
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { FileConfigService } from "../abstractions/FileConfigService.js";
import { FileConfigService as FileConfigServiceRegistration } from "../FileConfigService.js";

// Add to existing beforeEach after container creation:
// container.register(FileConfigServiceRegistration).inSingletonScope();

// Add new describe block:
describe("with file config", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-stephook-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns file hooks when config file exists, ignoring DB hooks", async () => {
    // Insert a DB hook
    const now = Date.now();
    await db
      .insert(projectStepHooks)
      .values({
        id: "h1",
        projectId: "p1",
        position: "pre:upgrade",
        name: "DB Hook",
        command: "echo db",
        type: "command",
        required: 0,
        enabled: 1,
        sortOrder: 0,
        source: "db",
        createdAt: now,
        updatedAt: now
      })
      .run();

    // Write config file
    await writeFile(
      join(tempDir, ".dependency-upgrader.json"),
      JSON.stringify({
        stepHooks: [
          {
            position: "pre:upgrade",
            name: "File Hook",
            command: "yarn lint",
            executionType: "command",
            required: true
          }
        ]
      }),
      "utf-8"
    );

    const config = await service.getStepConfig("p1", tempDir);
    expect(config).toHaveLength(1);
    expect(config[0]).toEqual(
      expect.objectContaining({
        name: "File Hook",
        command: "yarn lint",
        source: "file"
      })
    );
  });

  it("falls back to DB hooks when no config file", async () => {
    const now = Date.now();
    await db
      .insert(projectStepHooks)
      .values({
        id: "h1",
        projectId: "p1",
        position: "pre:upgrade",
        name: "DB Hook",
        command: "echo db",
        type: "command",
        required: 1,
        enabled: 1,
        sortOrder: 0,
        source: "db",
        createdAt: now,
        updatedAt: now
      })
      .run();

    const config = await service.getStepConfig("p1", tempDir);
    expect(config).toHaveLength(1);
    expect(config[0]).toEqual(
      expect.objectContaining({
        name: "DB Hook",
        source: "db"
      })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/api/services/__tests__/StepHookService.test.ts`
Expected: FAIL — FileConfigService not registered / file hooks not returned

- [ ] **Step 3: Update StepHookService implementation**

Modify `src/api/services/StepHookService.ts`:

```typescript
import { eq, and, asc } from "drizzle-orm";
import { StepHookService as Abstraction } from "./abstractions/StepHookService.js";
import type { IResolvedStepHook } from "./abstractions/StepHookService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { FileConfigService } from "./abstractions/FileConfigService.js";
import { projectStepHooks } from "#api/db/schema.js";

class StepHookServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly fileConfigService: FileConfigService.Interface
  ) {}

  public async getStepConfig(projectId: string, projectPath: string): Promise<IResolvedStepHook[]> {
    const fileConfig = await this.fileConfigService.readConfig(projectPath);

    if (fileConfig) {
      return fileConfig.stepHooks.map(hook => ({
        position: hook.position,
        name: hook.name,
        command: hook.command,
        executionType: hook.executionType,
        required: hook.required,
        source: "file" as const
      }));
    }

    const rows = await this.databaseClient.db
      .select()
      .from(projectStepHooks)
      .where(and(eq(projectStepHooks.projectId, projectId), eq(projectStepHooks.enabled, 1)))
      .orderBy(asc(projectStepHooks.position), asc(projectStepHooks.sortOrder))
      .all();

    return rows.map(row => ({
      position: row.position,
      name: row.name,
      command: row.command,
      executionType: row.type as IResolvedStepHook["executionType"],
      required: row.required === 1,
      source: row.source as IResolvedStepHook["source"]
    }));
  }
}

export const StepHookService = Abstraction.createImplementation({
  implementation: StepHookServiceImpl,
  dependencies: [DatabaseClient, FileConfigService]
});
```

- [ ] **Step 4: Register FileConfigService in API feature**

In `src/api/feature.ts`, add import and registration:

```typescript
// Add import:
import { FileConfigService } from "./services/FileConfigService.js";

// Add in register() before StepHookService:
container.register(FileConfigService).inSingletonScope();
```

- [ ] **Step 5: Update existing test setup to include FileConfigService**

In the existing `beforeEach` of `src/api/services/__tests__/StepHookService.test.ts`, add:

```typescript
import { FileConfigService as FileConfigServiceRegistration } from "../FileConfigService.js";

// Inside beforeEach, after container creation:
container.register(FileConfigServiceRegistration).inSingletonScope();
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn vitest run src/api/services/__tests__/StepHookService.test.ts`
Expected: All tests PASS (existing + new)

- [ ] **Step 7: Run full test suite**

Run: `yarn vitest run`
Expected: All tests PASS — no regressions. If any existing tests fail because they don't register `FileConfigService`, add the registration to their setup.

- [ ] **Step 8: Commit**

```bash
git add src/api/services/StepHookService.ts src/api/services/__tests__/StepHookService.test.ts src/api/feature.ts
git commit -m "feat: integrate FileConfigService into StepHookService"
```

---

### Task 3: Extend Step Hooks List Endpoint with configSource

**Files:**

- Modify: `src/shared/routes/stepHooks.ts` — add `configSource` to list response
- Modify: `src/api/routes/stepHooks.ts` — resolve config source in handler
- Modify: `src/api/routes/__tests__/stepHooks.test.ts` — register FileConfigService in container, test configSource field

**Interfaces:**

- Consumes:
  - `FileConfigService.Interface.readConfig(projectPath)` from Task 1
  - `projects` table — to look up project path by ID
- Produces:
  - `listStepHooksRoute` response now includes `configSource: "db" | "file"`

- [ ] **Step 1: Update route schema**

In `src/shared/routes/stepHooks.ts`, modify `listStepHooksRoute` response:

```typescript
export const listStepHooksRoute = defineRoute({
  method: "GET",
  path: "/api/projects/:id/step-hooks",
  description: "List step hooks for a project",
  params: z.object({ id: z.string() }),
  querystring: z.object({}),
  response: z.object({
    items: z.array(stepHookSchema),
    configSource: z.enum(["db", "file"])
  })
});
```

- [ ] **Step 2: Update route handler to resolve configSource**

In `src/api/routes/stepHooks.ts`, modify the list handler:

````typescript
// Add imports at top:
import { FileConfigService } from "#api/services/abstractions/FileConfigService.js";
import { projects } from "#api/db/schema.js";

// In the list handler, replace the existing implementation:
registerRoute(app, listStepHooksRoute, {}, async (request, reply) => {
    const { id } = request.params;

    // Look up project path
    const project = await db
        .select({ path: projects.path })
        .from(projects)
        .where(eq(projects.id, id))
        .get();

    if (!project) {
        sendError(reply, 404, "Project not found");
        return;
    }

    const fileConfigService = container.resolve(FileConfigService);
    const fileConfig = await fileConfigService.readConfig(project.path);

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

        reply.send({
            items: fileItems,
            configSource: "file" as const
        });
        return;
    }

    const rows = await db
        .select()
        .from(projectStepHooks)
        .where(eq(projectStepHooks.projectId, id))
        .orderBy(asc(projectStepHooks.position), asc(projectStepHooks.sortOrder))
        .all();

    reply.send({
        items: rows.map(toResponse),
        configSource: "db" as const
    });
});

- [ ] **Step 3: Register FileConfigService in route test setup**

In `src/api/routes/__tests__/stepHooks.test.ts`, the existing `beforeEach` creates a container and registers `DatabaseClient`. Add `FileConfigService` registration so the handler can resolve it:

```typescript
// Add import:
import { FileConfigService } from "../../services/FileConfigService.js";

// In beforeEach, after container.registerInstance(DatabaseClient, { db }):
container.register(FileConfigService).inSingletonScope();
````

- [ ] **Step 4: Run format and lint**

Run: `yarn format:fix && yarn lint:fix`

- [ ] **Step 5: Run full test suite**

Run: `yarn vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/routes/stepHooks.ts src/api/routes/stepHooks.ts src/api/routes/__tests__/stepHooks.test.ts
git commit -m "feat: add configSource field to step hooks list response"
```
