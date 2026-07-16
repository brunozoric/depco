# Custom Steps Part 1: Backend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dynamic step pipeline to the upgrade session backend — DB schema, config types, CustomStepResolver, and updated UpgradeSessionService.

**Architecture:** Extend `upgrade_sessions` with `stepOrder` column. Add `project_step_hooks` table for per-project custom step config. Create `CustomStepResolver` class. Make `getNextStep()` accept step list. Update `UpgradeSessionService` to build dynamic step pipelines and per-session registries.

**Tech Stack:** TypeScript, Drizzle ORM (SQLite), Vitest

## Global Constraints

- Named interfaces only, no inline structural types
- yarn for all package management
- Follow existing DI patterns (createAbstraction / createImplementation)
- Abstractions and implementations in separate files, separate directories

---

### Task 1: DB Schema and Migration

**Files:**

- Modify: `src/api/db/schema.ts:129-139`
- Create: `src/api/db/migrations/0012_custom_step_hooks.sql`

**Interfaces:**

- Produces: `projectStepHooks` drizzle table, `stepOrder` column on `upgradeSessions`

- [ ] **Step 1: Add stepOrder column to upgradeSessions and new table**

In `src/api/db/schema.ts`, add `stepOrder` to the `upgradeSessions` table:

```typescript
export const upgradeSessions = sqliteTable("upgrade_sessions", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  status: text("status").notNull(),
  currentStep: text("current_step").notNull(),
  steps: text("steps").notNull(),
  stepOrder: text("step_order"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});
```

Add the new `projectStepHooks` table after `upgradeSessions`:

```typescript
export const projectStepHooks = sqliteTable("project_step_hooks", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  position: text("position").notNull(),
  name: text("name").notNull(),
  command: text("command").notNull(),
  type: text("type").notNull(),
  required: integer("required").notNull().default(0),
  enabled: integer("enabled").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  source: text("source").notNull().default("db"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});
```

- [ ] **Step 2: Generate migration**

Run: `yarn drizzle-kit generate`
Expected: New migration file generated in `src/api/db/migrations/`

- [ ] **Step 3: Verify migration applies**

Run: `yarn vitest run src/api/db/__tests__/schema.test.ts`
Expected: PASS — existing schema tests still pass (migration auto-applied in test DB)

- [ ] **Step 4: Commit**

```bash
git add src/api/db/schema.ts src/api/db/migrations/
git commit -m "feat: add project_step_hooks table and stepOrder column"
```

---

### Task 2: Step Abstraction Changes

**Files:**

- Modify: `src/api/services/stepResolvers/abstractions/StepResolver.ts`
- Modify: `src/api/services/stepResolvers/StepResolverRegistry.ts`
- Modify: `src/api/services/stepResolvers/__tests__/UpgradeResolver.test.ts`
- Create: `src/api/services/stepResolvers/abstractions/CustomStepConfig.ts`

**Interfaces:**

- Consumes: `IStepResolver`, `IStepContext`, `IStepResult` from `StepResolver.ts`
- Produces:
  - `getNextStep(currentType: string, stepOrder: string[]): string | null` — updated signature
  - `IStepContext.stepOrder: string[]` — new field
  - `ICustomStepConfig` interface
  - `IStepResolverRegistry.createSessionRegistry(customResolvers: IStepResolver[]): IStepResolverRegistry`

- [ ] **Step 1: Write failing test for new getNextStep signature**

Add test in a new file `src/api/services/stepResolvers/__tests__/getNextStep.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getNextStep, STEP_ORDER } from "../abstractions/StepResolver.js";

describe("getNextStep", () => {
  it("returns next step from default order", () => {
    const order = [...STEP_ORDER];
    expect(getNextStep("select-packages", order)).toBe("branch");
    expect(getNextStep("branch", order)).toBe("upgrade");
  });

  it("returns null for last step", () => {
    const order = [...STEP_ORDER];
    expect(getNextStep("commit", order)).toBeNull();
  });

  it("returns null for unknown step", () => {
    const order = [...STEP_ORDER];
    expect(getNextStep("nonexistent", order)).toBeNull();
  });

  it("navigates custom step order", () => {
    const order = [
      "pre:select-packages:stop-server",
      "select-packages",
      "branch",
      "pre:upgrade:lint-check",
      "upgrade",
      "post:upgrade:lint-fix",
      "refresh-transient",
      "commit",
      "post:commit:notify"
    ];

    expect(getNextStep("pre:select-packages:stop-server", order)).toBe("select-packages");
    expect(getNextStep("upgrade", order)).toBe("post:upgrade:lint-fix");
    expect(getNextStep("post:commit:notify", order)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/api/services/stepResolvers/__tests__/getNextStep.test.ts`
Expected: FAIL — `getNextStep` expects 1 argument, got 2

- [ ] **Step 3: Update IStepContext and getNextStep**

In `src/api/services/stepResolvers/abstractions/StepResolver.ts`:

Update `IStepContext`:

```typescript
export interface IStepContext {
  steps: IStepState[];
  packageManager: string;
  stepOrder: string[];
}
```

Update `getNextStep` to accept step order:

```typescript
export function getNextStep(currentType: string, stepOrder: string[]): string | null {
  const index = stepOrder.indexOf(currentType);
  if (index === -1 || index === stepOrder.length - 1) {
    return null;
  }
  return stepOrder[index + 1]!;
}
```

- [ ] **Step 4: Create ICustomStepConfig**

Create `src/api/services/stepResolvers/abstractions/CustomStepConfig.ts`:

```typescript
export interface ICustomStepConfig {
  name: string;
  command: string;
  executionType: "command" | "script" | "package-script";
  required: boolean;
}
```

- [ ] **Step 5: Update StepResolverRegistry with createSessionRegistry**

In `src/api/services/stepResolvers/abstractions/StepResolver.ts`, update the interface:

```typescript
export interface IStepResolverRegistry {
  getResolver(type: string): IStepResolver;
  createSessionRegistry(customResolvers: IStepResolver[]): IStepResolverRegistry;
}
```

In `src/api/services/stepResolvers/StepResolverRegistry.ts`:

```typescript
import { StepResolverRegistry as Abstraction } from "./abstractions/StepResolver.js";
import type { IStepResolver } from "./abstractions/StepResolver.js";

class StepResolverRegistryImpl implements Abstraction.Interface {
  private readonly resolvers = new Map<string, IStepResolver>();

  public constructor(...resolvers: IStepResolver[]) {
    for (const resolver of resolvers) {
      this.resolvers.set(resolver.type, resolver);
    }
  }

  public getResolver(type: string): IStepResolver {
    const resolver = this.resolvers.get(type);
    if (!resolver) {
      throw new Error(`No resolver registered for step type: ${type}`);
    }
    return resolver;
  }

  public createSessionRegistry(customResolvers: IStepResolver[]): Abstraction.Interface {
    const combined = [...this.resolvers.values(), ...customResolvers];
    return new StepResolverRegistryImpl(...combined);
  }
}

export { StepResolverRegistryImpl };
```

- [ ] **Step 6: Fix all existing resolver callers of getNextStep**

Each built-in resolver calls `getNextStep(this.type)`. Update all to `getNextStep(this.type, context.stepOrder)`:

Files to update (each has one call site):

- `src/api/services/stepResolvers/SelectPackagesResolver.ts`
- `src/api/services/stepResolvers/BranchResolver.ts`
- `src/api/services/stepResolvers/UpgradeResolver.ts`
- `src/api/services/stepResolvers/RefreshTransientResolver.ts`
- `src/api/services/stepResolvers/CommitResolver.ts`

Also in `src/api/services/UpgradeSessionService.ts` line 157 (`skipStep`):

```typescript
const nextStep = getNextStep(
  stepType,
  session.steps.map(s => s.type)
);
```

And update the `context` object in `executeStep` (line 112-115):

```typescript
const stepOrder = session.stepOrder ?? session.steps.map(s => s.type);
const context: IStepContext = {
  steps: session.steps,
  packageManager: project.packageManager ?? "yarn",
  stepOrder
};
```

- [ ] **Step 7: Update existing resolver tests**

In `src/api/services/stepResolvers/__tests__/UpgradeResolver.test.ts`, add `stepOrder` to every test's `context` object. For example, wherever you see:

```typescript
const context = { steps: [...], packageManager: "yarn" };
```

Change to:

```typescript
const context = { steps: [...], packageManager: "yarn", stepOrder: [...] };
```

where `stepOrder` matches the step types in `steps`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `yarn vitest run src/api/services/stepResolvers/ src/api/services/__tests__/UpgradeSessionService.test.ts`
Expected: PASS — all tests green

- [ ] **Step 9: Commit**

```bash
git add src/api/services/stepResolvers/ src/api/services/UpgradeSessionService.ts
git commit -m "feat: make step pipeline dynamic with stepOrder param

getNextStep() now accepts explicit step order array.
IStepContext gains stepOrder field. StepResolverRegistry
gains createSessionRegistry() for per-session registries."
```

---

### Task 3: CustomStepResolver

**Files:**

- Create: `src/api/services/stepResolvers/CustomStepResolver.ts`
- Create: `src/api/services/stepResolvers/__tests__/CustomStepResolver.test.ts`

**Interfaces:**

- Consumes:
  - `IStepResolver` from `StepResolver.ts`
  - `ICustomStepConfig` from `CustomStepConfig.ts`
  - `CommandRunner.Interface` — `runStreaming(command, args, options): Promise<Result>`
  - `getNextStep(currentType, stepOrder): string | null`
- Produces: `CustomStepResolver` class implementing `IStepResolver`

- [ ] **Step 1: Write failing tests**

Create `src/api/services/stepResolvers/__tests__/CustomStepResolver.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { CustomStepResolver } from "../CustomStepResolver.js";
import type { IStepContext } from "../abstractions/StepResolver.js";
import type { CommandRunner } from "../../abstractions/CommandRunner.js";

function createMockCommandRunner(exitCode = 0, stdout = "ok"): CommandRunner.Interface {
  return {
    run: vi.fn().mockResolvedValue({ stdout, stderr: "", exitCode }),
    runStreaming: vi.fn().mockResolvedValue({ stdout, stderr: "", exitCode })
  };
}

const STEP_ORDER = ["pre:upgrade:lint", "upgrade", "post:upgrade:test", "commit"];

function createContext(stepOrder: string[] = STEP_ORDER): IStepContext {
  return {
    steps: stepOrder.map((type, i) => ({
      type,
      status: i === 0 ? ("active" as const) : ("pending" as const),
      input: {},
      result: {}
    })),
    packageManager: "yarn",
    stepOrder
  };
}

describe("CustomStepResolver", () => {
  it("executes a shell command and returns completed step", async () => {
    const runner = createMockCommandRunner();
    const resolver = new CustomStepResolver(
      "pre:upgrade:lint",
      { name: "Lint", command: "eslint .", executionType: "command", required: true },
      runner
    );

    const result = await resolver.execute("/project", createContext(), {});

    expect(runner.runStreaming).toHaveBeenCalledWith(
      "sh",
      ["-c", "eslint ."],
      expect.objectContaining({ cwd: "/project" })
    );
    expect(result.updatedStep.status).toBe("completed");
    expect(result.updatedStep.type).toBe("pre:upgrade:lint");
    expect(result.nextStep).toBe("upgrade");
  });

  it("executes a script file", async () => {
    const runner = createMockCommandRunner();
    const resolver = new CustomStepResolver(
      "post:commit:notify",
      { name: "Notify", command: "./scripts/notify.sh", executionType: "script", required: false },
      runner
    );

    const result = await resolver.execute("/project", createContext(), {});

    expect(runner.runStreaming).toHaveBeenCalledWith(
      "sh",
      ["-c", "./scripts/notify.sh"],
      expect.objectContaining({ cwd: "/project" })
    );
    expect(result.updatedStep.status).toBe("completed");
  });

  it("executes a package-script via package manager", async () => {
    const runner = createMockCommandRunner();
    const resolver = new CustomStepResolver(
      "pre:upgrade:prebuild",
      { name: "Prebuild", command: "prebuild", executionType: "package-script", required: true },
      runner
    );

    const context = createContext();
    context.packageManager = "npm";

    const result = await resolver.execute("/project", context, {});

    expect(runner.runStreaming).toHaveBeenCalledWith(
      "npm",
      ["run", "prebuild"],
      expect.objectContaining({ cwd: "/project" })
    );
    expect(result.updatedStep.status).toBe("completed");
  });

  it("throws on failure when required", async () => {
    const runner = createMockCommandRunner(1, "");
    const resolver = new CustomStepResolver(
      "pre:upgrade:lint",
      { name: "Lint", command: "eslint .", executionType: "command", required: true },
      runner
    );

    await expect(resolver.execute("/project", createContext(), {})).rejects.toThrow(
      'Custom step "Lint" failed with exit code 1'
    );
  });

  it("returns skipped on failure when not required", async () => {
    const runner = createMockCommandRunner(1, "");
    const resolver = new CustomStepResolver(
      "pre:upgrade:lint",
      { name: "Lint", command: "eslint .", executionType: "command", required: false },
      runner
    );

    const result = await resolver.execute("/project", createContext(), {});

    expect(result.updatedStep.status).toBe("skipped");
    expect(result.updatedStep.result).toEqual(
      expect.objectContaining({ error: expect.any(String), exitCode: 1 })
    );
    expect(result.nextStep).toBe("upgrade");
  });

  it("streams output through onProgress", async () => {
    const runner: CommandRunner.Interface = {
      run: vi.fn(),
      runStreaming: vi.fn().mockImplementation(async (_cmd, _args, options) => {
        options.onStdout("line 1");
        options.onStdout("line 2");
        return { stdout: "line 1\nline 2", stderr: "", exitCode: 0 };
      })
    };

    const resolver = new CustomStepResolver(
      "pre:upgrade:lint",
      { name: "Lint", command: "eslint .", executionType: "command", required: true },
      runner
    );

    const logs: string[] = [];
    await resolver.execute("/project", createContext(), {}, log => logs.push(log));

    expect(logs).toEqual(["line 1", "line 2"]);
  });

  it("exposes type and required from constructor", () => {
    const runner = createMockCommandRunner();
    const resolver = new CustomStepResolver(
      "pre:upgrade:lint",
      { name: "Lint", command: "eslint .", executionType: "command", required: false },
      runner
    );

    expect(resolver.type).toBe("pre:upgrade:lint");
    expect(resolver.required).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/api/services/stepResolvers/__tests__/CustomStepResolver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CustomStepResolver**

Create `src/api/services/stepResolvers/CustomStepResolver.ts`:

```typescript
import type { IStepResolver, IStepContext, IStepResult } from "./abstractions/StepResolver.js";
import { getNextStep } from "./abstractions/StepResolver.js";
import type { ICustomStepConfig } from "./abstractions/CustomStepConfig.js";
import type { CommandRunner } from "../abstractions/CommandRunner.js";

export class CustomStepResolver implements IStepResolver {
  public readonly type: string;
  public readonly required: boolean;

  public constructor(
    type: string,
    private readonly config: ICustomStepConfig,
    private readonly commandRunner: CommandRunner.Interface
  ) {
    this.type = type;
    this.required = config.required;
  }

  public async execute(
    projectPath: string,
    context: IStepContext,
    input: Record<string, unknown>,
    onProgress?: (log: string) => void
  ): Promise<IStepResult> {
    const { command, args } = this.buildCommand(context.packageManager);

    const result = await this.commandRunner.runStreaming(command, args, {
      cwd: projectPath,
      onStdout: (line: string) => onProgress?.(line),
      onStderr: (line: string) => onProgress?.(line)
    });

    if (result.exitCode !== 0) {
      if (this.required) {
        throw new Error(
          `Custom step "${this.config.name}" failed with exit code ${result.exitCode}`
        );
      }

      return {
        updatedStep: {
          type: this.type,
          status: "skipped",
          input,
          result: {
            error: `Step failed with exit code ${result.exitCode}`,
            exitCode: result.exitCode
          }
        },
        nextStep: getNextStep(this.type, context.stepOrder)
      };
    }

    return {
      updatedStep: {
        type: this.type,
        status: "completed",
        input,
        result: { output: result.stdout }
      },
      nextStep: getNextStep(this.type, context.stepOrder)
    };
  }

  private buildCommand(packageManager: string): { command: string; args: string[] } {
    switch (this.config.executionType) {
      case "command":
      case "script":
        return { command: "sh", args: ["-c", this.config.command] };
      case "package-script":
        return { command: packageManager, args: ["run", this.config.command] };
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/api/services/stepResolvers/__tests__/CustomStepResolver.test.ts`
Expected: PASS — all 7 tests green

- [ ] **Step 5: Run full test suite**

Run: `yarn vitest run && yarn tsc --noEmit`
Expected: All pass, no type errors

- [ ] **Step 6: Commit**

```bash
git add src/api/services/stepResolvers/CustomStepResolver.ts src/api/services/stepResolvers/__tests__/CustomStepResolver.test.ts src/api/services/stepResolvers/abstractions/CustomStepConfig.ts
git commit -m "feat: add CustomStepResolver for pre/post step execution

Handles command, script, and package-script execution types.
Required steps throw on failure; optional steps skip gracefully.
Streams output through onProgress callback."
```

---

### Task 4: Session Step Config Loading and Dynamic Pipeline

**Files:**

- Create: `src/api/services/abstractions/StepHookService.ts`
- Create: `src/api/services/StepHookService.ts`
- Create: `src/api/services/__tests__/StepHookService.test.ts`
- Modify: `src/api/services/UpgradeSessionService.ts:41-74` (createSession)
- Modify: `src/api/services/UpgradeSessionService.ts:86-137` (executeStep)
- Modify: `src/api/services/abstractions/UpgradeSessionService.ts`
- Modify: `src/api/feature.ts`

**Interfaces:**

- Consumes:
  - `DatabaseClient.Interface` — `db` for querying `project_step_hooks`
  - `CommandRunner.Interface` — passed to `CustomStepResolver`
  - `StepResolverRegistry.Interface` — `createSessionRegistry(customResolvers)`
  - `ICustomStepConfig` from `CustomStepConfig.ts`
  - `STEP_ORDER` from `StepResolver.ts`
- Produces:
  - `IStepHookService.getStepConfig(projectId, projectPath): Promise<IResolvedStepConfig[]>`
  - `createSessionSteps(config): IStepState[]`
  - `buildStepOrder(config): string[]`
  - `toSlug(name: string): string`
  - Updated `IUpgradeSessionRow` with optional `stepOrder`

- [ ] **Step 1: Write failing tests for StepHookService**

Create `src/api/services/__tests__/StepHookService.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createContainer } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects, projectStepHooks } from "#api/db/schema.js";
import { StepHookService } from "../abstractions/StepHookService.js";
import { StepHookService as StepHookServiceRegistration } from "../StepHookService.js";

describe("StepHookService", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let service: StepHookService.Interface;

  beforeEach(async () => {
    db = await createTestDb();
    await db
      .insert(projects)
      .values({
        id: "p1",
        name: "test-project",
        path: "/tmp/test-project",
        packageManager: "yarn",
        addedAt: Date.now()
      })
      .run();

    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
    container.register(StepHookServiceRegistration).inSingletonScope();

    service = container.resolve(StepHookService);
  });

  it("returns empty config when no hooks defined", async () => {
    const config = await service.getStepConfig("p1", "/tmp/test-project");
    expect(config).toEqual([]);
  });

  it("returns DB hooks ordered by position and sortOrder", async () => {
    const now = Date.now();
    await db
      .insert(projectStepHooks)
      .values([
        {
          id: "h1",
          projectId: "p1",
          position: "pre:upgrade",
          name: "Lint",
          command: "eslint .",
          type: "command",
          required: 1,
          enabled: 1,
          sortOrder: 0,
          source: "db",
          createdAt: now,
          updatedAt: now
        },
        {
          id: "h2",
          projectId: "p1",
          position: "post:commit",
          name: "Notify",
          command: "./scripts/notify.sh",
          type: "script",
          required: 0,
          enabled: 1,
          sortOrder: 0,
          source: "db",
          createdAt: now,
          updatedAt: now
        }
      ])
      .run();

    const config = await service.getStepConfig("p1", "/tmp/test-project");
    expect(config).toHaveLength(2);
    expect(config[0]).toEqual(
      expect.objectContaining({
        position: "pre:upgrade",
        name: "Lint",
        command: "eslint .",
        executionType: "command",
        required: true
      })
    );
    expect(config[1]).toEqual(
      expect.objectContaining({
        position: "post:commit",
        name: "Notify",
        command: "./scripts/notify.sh",
        executionType: "script",
        required: false
      })
    );
  });

  it("filters out disabled hooks", async () => {
    const now = Date.now();
    await db
      .insert(projectStepHooks)
      .values({
        id: "h1",
        projectId: "p1",
        position: "pre:upgrade",
        name: "Disabled",
        command: "echo nope",
        type: "command",
        required: 0,
        enabled: 0,
        sortOrder: 0,
        source: "db",
        createdAt: now,
        updatedAt: now
      })
      .run();

    const config = await service.getStepConfig("p1", "/tmp/test-project");
    expect(config).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/api/services/__tests__/StepHookService.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Create StepHookService abstraction**

Create `src/api/services/abstractions/StepHookService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IResolvedStepHook {
  position: string;
  name: string;
  command: string;
  executionType: "command" | "script" | "package-script";
  required: boolean;
  source: "db" | "file" | "package-json";
}

export interface IStepHookService {
  getStepConfig(projectId: string, projectPath: string): Promise<IResolvedStepHook[]>;
}

export const StepHookService = createAbstraction<IStepHookService>("Api/StepHookService");

export namespace StepHookService {
  export type Interface = IStepHookService;
  export type ResolvedStepHook = IResolvedStepHook;
}
```

- [ ] **Step 4: Implement StepHookService**

Create `src/api/services/StepHookService.ts`:

```typescript
import { eq, and, asc } from "drizzle-orm";
import { StepHookService as Abstraction } from "./abstractions/StepHookService.js";
import type { IResolvedStepHook } from "./abstractions/StepHookService.js";
import { DatabaseClient } from "../db/abstractions/DatabaseClient.js";
import { projectStepHooks } from "../db/schema.js";

class StepHookServiceImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async getStepConfig(
    projectId: string,
    _projectPath: string
  ): Promise<IResolvedStepHook[]> {
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
  dependencies: [DatabaseClient]
});
```

- [ ] **Step 5: Run StepHookService tests**

Run: `yarn vitest run src/api/services/__tests__/StepHookService.test.ts`
Expected: PASS

- [ ] **Step 6: Write tests for step pipeline building utilities**

Create `src/api/services/stepResolvers/__tests__/stepPipeline.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildStepOrder, createSessionSteps, toSlug } from "../stepPipeline.js";
import type { IResolvedStepHook } from "../../abstractions/StepHookService.js";

describe("toSlug", () => {
  it("kebab-cases a name", () => {
    expect(toSlug("Run lint fix")).toBe("run-lint-fix");
  });

  it("strips non-alphanumeric characters", () => {
    expect(toSlug("Notify (team)!")).toBe("notify-team");
  });

  it("collapses multiple hyphens", () => {
    expect(toSlug("a  --  b")).toBe("a-b");
  });
});

describe("buildStepOrder", () => {
  it("returns default order with no hooks", () => {
    const order = buildStepOrder([]);
    expect(order).toEqual(["select-packages", "branch", "upgrade", "refresh-transient", "commit"]);
  });

  it("interleaves pre and post hooks", () => {
    const hooks: IResolvedStepHook[] = [
      {
        position: "pre:upgrade",
        name: "Lint",
        command: "eslint .",
        executionType: "command",
        required: true,
        source: "db"
      },
      {
        position: "post:commit",
        name: "Notify",
        command: "./notify.sh",
        executionType: "script",
        required: false,
        source: "db"
      }
    ];

    const order = buildStepOrder(hooks);
    expect(order).toEqual([
      "select-packages",
      "branch",
      "pre:upgrade:lint",
      "upgrade",
      "refresh-transient",
      "commit",
      "post:commit:notify"
    ]);
  });

  it("places multiple hooks for same position in order", () => {
    const hooks: IResolvedStepHook[] = [
      {
        position: "pre:upgrade",
        name: "First",
        command: "echo 1",
        executionType: "command",
        required: false,
        source: "db"
      },
      {
        position: "pre:upgrade",
        name: "Second",
        command: "echo 2",
        executionType: "command",
        required: false,
        source: "db"
      }
    ];

    const order = buildStepOrder(hooks);
    const upgradeIndex = order.indexOf("upgrade");
    expect(order[upgradeIndex - 2]).toBe("pre:upgrade:first");
    expect(order[upgradeIndex - 1]).toBe("pre:upgrade:second");
  });
});

describe("createSessionSteps", () => {
  it("creates step states matching step order", () => {
    const hooks: IResolvedStepHook[] = [
      {
        position: "pre:upgrade",
        name: "Lint",
        command: "eslint .",
        executionType: "command",
        required: true,
        source: "db"
      }
    ];

    const order = buildStepOrder(hooks);
    const steps = createSessionSteps(order, hooks);

    expect(steps).toHaveLength(6);
    expect(steps[0]!.status).toBe("active");
    expect(steps[1]!.status).toBe("pending");

    const customStep = steps.find(s => s.type === "pre:upgrade:lint");
    expect(customStep).toBeDefined();
    expect(customStep!.input).toEqual(
      expect.objectContaining({
        name: "Lint",
        command: "eslint .",
        executionType: "command"
      })
    );
  });
});
```

- [ ] **Step 7: Implement step pipeline utilities**

Create `src/api/services/stepResolvers/stepPipeline.ts`:

```typescript
import { STEP_ORDER } from "./abstractions/StepResolver.js";
import type { IStepState } from "./abstractions/StepResolver.js";
import type { IResolvedStepHook } from "../abstractions/StepHookService.js";

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildStepOrder(hooks: IResolvedStepHook[]): string[] {
  const preHooks = new Map<string, string[]>();
  const postHooks = new Map<string, string[]>();

  for (const hook of hooks) {
    const [position, builtInStep] = hook.position.split(":");
    if (!builtInStep) {
      continue;
    }

    const stepType = `${hook.position}:${toSlug(hook.name)}`;

    if (position === "pre") {
      const existing = preHooks.get(builtInStep) ?? [];
      existing.push(stepType);
      preHooks.set(builtInStep, existing);
    } else if (position === "post") {
      const existing = postHooks.get(builtInStep) ?? [];
      existing.push(stepType);
      postHooks.set(builtInStep, existing);
    }
  }

  const order: string[] = [];
  for (const step of STEP_ORDER) {
    const pre = preHooks.get(step) ?? [];
    order.push(...pre, step);
    const post = postHooks.get(step) ?? [];
    order.push(...post);
  }

  return order;
}

export function createSessionSteps(stepOrder: string[], hooks: IResolvedStepHook[]): IStepState[] {
  const hookByType = new Map<string, IResolvedStepHook>();
  for (const hook of hooks) {
    const stepType = `${hook.position}:${toSlug(hook.name)}`;
    hookByType.set(stepType, hook);
  }

  return stepOrder.map((type, index) => {
    const hook = hookByType.get(type);
    const input: Record<string, unknown> = hook
      ? { name: hook.name, command: hook.command, executionType: hook.executionType }
      : {};

    return {
      type,
      status: index === 0 ? ("active" as const) : ("pending" as const),
      input,
      result: {}
    };
  });
}
```

- [ ] **Step 8: Run pipeline tests**

Run: `yarn vitest run src/api/services/stepResolvers/__tests__/stepPipeline.test.ts`
Expected: PASS

- [ ] **Step 9: Update UpgradeSessionService and session row type**

In `src/api/services/abstractions/UpgradeSessionService.ts`, add `stepOrder` to the row:

```typescript
export interface IUpgradeSessionRow {
  id: string;
  projectId: string;
  status: string;
  currentStep: string;
  steps: IStepState[];
  stepOrder: string[];
  createdAt: number;
  updatedAt: number;
}
```

In `src/api/services/UpgradeSessionService.ts`:

1. Add imports for `StepHookService`, `CommandRunner`, `buildStepOrder`, `createSessionSteps`, `CustomStepResolver`, `ICustomStepConfig`
2. Add `StepHookService` and `CommandRunner` as constructor dependencies
3. Update `createSession` to:
   - Call `this.stepHookService.getStepConfig(projectId, project.path)`
   - Call `buildStepOrder(hooks)` to get dynamic step order
   - Call `createSessionSteps(stepOrder, hooks)` instead of `createDefaultSteps()`
   - Store `stepOrder` as JSON in the new column
4. Update `executeStep` to:
   - Parse `stepOrder` from session row
   - Build custom resolvers from hooks config
   - Use `createSessionRegistry` for step resolution
   - Pass `stepOrder` in context
5. Update `toRow` to parse `stepOrder` from DB
6. Update `skipStep` to use session's `stepOrder`

Update `dependencies` array at bottom of file to include `StepHookService` and `CommandRunner`.

- [ ] **Step 10: Register StepHookService in feature.ts**

In `src/api/feature.ts`, add:

```typescript
import { StepHookService } from "./services/StepHookService.js";
```

And register it:

```typescript
container.register(StepHookService).inSingletonScope();
```

- [ ] **Step 11: Update session route schema**

In `src/shared/routes/upgradeSessions.ts`, add `stepOrder` to `sessionSchema`:

```typescript
const sessionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  status: z.string(),
  currentStep: z.string(),
  steps: z.array(stepStateSchema),
  stepOrder: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number()
});
```

- [ ] **Step 12: Update UI session types**

In `src/ui/features/upgradeSessions/abstractions/UpgradeSessionsGateway.ts`, add `stepOrder`:

```typescript
export interface IUpgradeSessionResponse {
  id: string;
  projectId: string;
  status: "active" | "completed" | "aborted";
  currentStep: string;
  steps: IUpgradeStepState[];
  stepOrder: string[];
  createdAt: number;
  updatedAt: number;
}
```

Update `toSession` in `src/ui/features/upgradeSessions/UpgradeSessionsGateway.ts` to map `stepOrder`.

- [ ] **Step 13: Run full test suite**

Run: `yarn vitest run && yarn tsc --noEmit`
Expected: All pass, no type errors

- [ ] **Step 14: Commit**

```bash
git add src/api/services/ src/api/feature.ts src/api/db/ src/shared/routes/ src/ui/features/upgradeSessions/
git commit -m "feat: dynamic step pipeline with custom hook loading

createSession builds step order from project_step_hooks DB table.
executeStep rebuilds per-session registry with CustomStepResolvers.
Session row now includes stepOrder for pipeline navigation."
```
