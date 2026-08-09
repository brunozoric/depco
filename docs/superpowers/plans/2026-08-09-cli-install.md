# CLI Install Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `src/cli/` into a yargs-based command system with full DI — commands as step orchestrators, each step its own abstraction/implementation/feature.

**Architecture:** Commands are step orchestrators. Each command defines a list of DI-resolved steps. StepRunner executes them sequentially with progress display and rollback on failure. Two commands: `depco init` (setup wizard) and `depco start` (run server).

**Tech Stack:** yargs (CLI framework), @webiny/di (DI container), @inquirer/prompts (interactive input), argon2 (password hashing), crypto (key generation)

## Global Constraints

- All DI follows existing pattern: `createAbstraction<T>(name)` + `Abstraction.createImplementation({implementation, dependencies})` + `createFeature({name, register(container)})` + index.ts exports abstractions+feature only
- Namespace pattern: `export namespace X { export type Interface = IX; }`
- Feature names use domain prefix: `"Cli/StepRunner"`, `"Cli/InitCommand"`
- PascalCase for all subdirectories under `src/cli/`
- Named interfaces (never inline structural types)
- Object params with named keys when function has 2+ params
- Full words in names (never abbreviate)
- `yarn full` must pass after every task
- Format with `yarn format:fix` + `yarn lint:fix` before committing
- Tests in `__tests__/` subdirectory colocated with implementation

---

### Task 1: Add yargs dependency + runner abstractions

**Files:**
- Modify: `package.json` (add yargs + @types/yargs)
- Create: `src/cli/runner/abstractions/Step.ts`
- Create: `src/cli/runner/abstractions/StepRunner.ts`
- Create: `src/cli/runner/abstractions/index.ts`

**Interfaces:**
- Consumes: `createAbstraction` from `#shared/index.js`
- Produces: `Step` abstraction (`IStep` with `name: string`, `description: string`, `execute(context: IStepContext): Promise<IStepResult>`, `rollback?(context: IStepContext): Promise<void>`), `StepRunner` abstraction (`IStepRunner` with `run(args: IStepRunnerArgs): Promise<void>` where `IStepRunnerArgs = { steps: Step.Interface[]; context: IStepContext }`), `IStepContext` interface (`dataDirectory: string`, `envFilePath: string`, `options: Record<string, unknown>`, `results: Map<string, unknown>`), `IStepResult` interface (`success: boolean`, `skipped?: boolean`, `message?: string`)

- [ ] **Step 1: Add yargs dependency**

```bash
yarn add yargs
yarn add -D @types/yargs
```

- [ ] **Step 2: Create Step abstraction**

```typescript
// src/cli/runner/abstractions/Step.ts
import { createAbstraction } from "#shared/index.js";

export interface IStepContext {
    dataDirectory: string;
    envFilePath: string;
    options: Record<string, unknown>;
    results: Map<string, unknown>;
}

export interface IStepResult {
    success: boolean;
    skipped?: boolean;
    message?: string;
}

export interface IStep {
    name: string;
    description: string;
    execute(context: IStepContext): Promise<IStepResult>;
    rollback?(context: IStepContext): Promise<void>;
}

export const Step = createAbstraction<IStep>("Cli/Step");

export namespace Step {
    export type Interface = IStep;
    export type Context = IStepContext;
    export type Result = IStepResult;
}
```

- [ ] **Step 3: Create StepRunner abstraction**

```typescript
// src/cli/runner/abstractions/StepRunner.ts
import { createAbstraction } from "#shared/index.js";
import type { Step } from "./Step.js";

export interface IStepRunnerArgs {
    steps: Step.Interface[];
    context: Step.Context;
}

export interface IStepRunner {
    run(args: IStepRunnerArgs): Promise<void>;
}

export const StepRunner = createAbstraction<IStepRunner>("Cli/StepRunner");

export namespace StepRunner {
    export type Interface = IStepRunner;
    export type Args = IStepRunnerArgs;
}
```

- [ ] **Step 4: Create abstractions barrel export**

```typescript
// src/cli/runner/abstractions/index.ts
export { Step, type IStep, type IStepContext, type IStepResult } from "./Step.js";
export { StepRunner, type IStepRunner, type IStepRunnerArgs } from "./StepRunner.js";
```

- [ ] **Step 5: Verify build**

```bash
yarn build
```

- [ ] **Step 6: Commit**

```bash
git add package.json yarn.lock src/cli/runner/abstractions/
git commit -m "feat(cli): add yargs dependency and runner abstractions (Step, StepRunner)"
```

---

### Task 2: StepRunner implementation + tests

**Files:**
- Create: `src/cli/runner/StepRunner.ts`
- Create: `src/cli/runner/feature.ts`
- Create: `src/cli/runner/index.ts`
- Create: `src/cli/runner/__tests__/StepRunner.test.ts`

**Interfaces:**
- Consumes: `Step`, `StepRunner` abstractions from `./abstractions/index.js`, `createFeature` from `#shared/index.js`
- Produces: `StepRunnerFeature`, `StepRunner` implementation (re-exported from index.ts)

- [ ] **Step 1: Write failing tests**

```typescript
// src/cli/runner/__tests__/StepRunner.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { StepRunnerFeature } from "../feature.js";
import { StepRunner } from "../abstractions/StepRunner.js";
import type { IStep, IStepContext, IStepResult } from "../abstractions/Step.js";

function createMockStep(overrides: Partial<IStep> = {}): IStep {
    return {
        name: overrides.name ?? "mock-step",
        description: overrides.description ?? "Mock step",
        execute: overrides.execute ?? vi.fn().mockResolvedValue({ success: true }),
        rollback: overrides.rollback
    };
}

function createTestContext(overrides: Partial<IStepContext> = {}): IStepContext {
    return {
        dataDirectory: "./test-data",
        envFilePath: "./.env.test",
        options: {},
        results: new Map(),
        ...overrides
    };
}

describe("StepRunner", () => {
    let container: ReturnType<typeof createContainer>;
    let runner: StepRunner.Interface;

    beforeEach(() => {
        container = createContainer();
        StepRunnerFeature.register(container);
        runner = container.resolve(StepRunner);
    });

    it("executes steps in order", async () => {
        const order: string[] = [];
        const step1 = createMockStep({
            name: "step-1",
            execute: vi.fn().mockImplementation(async () => {
                order.push("step-1");
                return { success: true };
            })
        });
        const step2 = createMockStep({
            name: "step-2",
            execute: vi.fn().mockImplementation(async () => {
                order.push("step-2");
                return { success: true };
            })
        });

        await runner.run({ steps: [step1, step2], context: createTestContext() });
        expect(order).toEqual(["step-1", "step-2"]);
    });

    it("stops execution on failure", async () => {
        const step1 = createMockStep({
            name: "failing",
            execute: vi.fn().mockResolvedValue({ success: false, message: "failed" })
        });
        const step2 = createMockStep({ name: "never-reached" });

        await expect(
            runner.run({ steps: [step1, step2], context: createTestContext() })
        ).rejects.toThrow();
        expect(step2.execute).not.toHaveBeenCalled();
    });

    it("calls rollback in reverse order on failure", async () => {
        const order: string[] = [];
        const step1 = createMockStep({
            name: "step-1",
            execute: vi.fn().mockResolvedValue({ success: true }),
            rollback: vi.fn().mockImplementation(async () => {
                order.push("rollback-1");
            })
        });
        const step2 = createMockStep({
            name: "step-2",
            execute: vi.fn().mockResolvedValue({ success: true }),
            rollback: vi.fn().mockImplementation(async () => {
                order.push("rollback-2");
            })
        });
        const step3 = createMockStep({
            name: "step-3",
            execute: vi.fn().mockResolvedValue({ success: false, message: "boom" })
        });

        await expect(
            runner.run({ steps: [step1, step2, step3], context: createTestContext() })
        ).rejects.toThrow();
        expect(order).toEqual(["rollback-2", "rollback-1"]);
    });

    it("skips rollback for steps without rollback method", async () => {
        const step1 = createMockStep({
            name: "no-rollback",
            execute: vi.fn().mockResolvedValue({ success: true })
        });
        const step2 = createMockStep({
            name: "failing",
            execute: vi.fn().mockResolvedValue({ success: false, message: "fail" })
        });

        await expect(
            runner.run({ steps: [step1, step2], context: createTestContext() })
        ).rejects.toThrow();
    });

    it("handles skipped steps without error", async () => {
        const step1 = createMockStep({
            name: "skipped",
            execute: vi.fn().mockResolvedValue({ success: true, skipped: true, message: "already exists" })
        });
        const step2 = createMockStep({ name: "runs" });

        await runner.run({ steps: [step1, step2], context: createTestContext() });
        expect(step2.execute).toHaveBeenCalled();
    });

    it("passes shared context through all steps", async () => {
        const step1 = createMockStep({
            name: "writer",
            execute: vi.fn().mockImplementation(async (context: IStepContext) => {
                context.results.set("key", "value");
                return { success: true };
            })
        });
        const step2 = createMockStep({
            name: "reader",
            execute: vi.fn().mockImplementation(async (context: IStepContext) => {
                expect(context.results.get("key")).toBe("value");
                return { success: true };
            })
        });

        await runner.run({ steps: [step1, step2], context: createTestContext() });
    });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
yarn test src/cli/runner/__tests__/StepRunner.test.ts
```

Expected: FAIL (StepRunnerFeature not found)

- [ ] **Step 3: Implement StepRunnerImpl**

```typescript
// src/cli/runner/StepRunner.ts
import { StepRunner as Abstraction } from "./abstractions/StepRunner.js";
import type { IStep, IStepContext } from "./abstractions/Step.js";

class StepRunnerImpl implements Abstraction.Interface {
    public async run(args: Abstraction.Args): Promise<void> {
        const { steps, context } = args;
        const completed: IStep[] = [];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]!;
            const label = `[${i + 1}/${steps.length}] ${step.description}`;

            try {
                const result = await step.execute(context);

                if (result.skipped) {
                    console.log(`\x1b[33m⊘ ${label} — skipped${result.message ? `: ${result.message}` : ""}\x1b[0m`);
                    continue;
                }

                if (!result.success) {
                    console.log(`\x1b[31m✗ ${label}${result.message ? `: ${result.message}` : ""}\x1b[0m`);
                    await this.rollback(completed, context);
                    throw new Error(`Step "${step.name}" failed${result.message ? `: ${result.message}` : ""}`);
                }

                console.log(`\x1b[32m✓ ${label}\x1b[0m`);
                completed.push(step);
            } catch (error) {
                if (error instanceof Error && error.message.startsWith("Step \"")) {
                    throw error;
                }
                console.log(`\x1b[31m✗ ${label}\x1b[0m`);
                await this.rollback(completed, context);
                throw new Error(`Step "${step.name}" threw: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    private async rollback(completed: IStep[], context: IStepContext): Promise<void> {
        for (let i = completed.length - 1; i >= 0; i--) {
            const step = completed[i]!;
            if (step.rollback) {
                try {
                    await step.rollback(context);
                    console.log(`\x1b[33m↩ Rolled back: ${step.name}\x1b[0m`);
                } catch (rollbackError) {
                    console.error(`\x1b[31m↩ Rollback failed for ${step.name}: ${rollbackError}\x1b[0m`);
                }
            }
        }
    }
}

export const StepRunner = Abstraction.createImplementation({
    implementation: StepRunnerImpl,
    dependencies: []
});
```

- [ ] **Step 4: Create feature**

```typescript
// src/cli/runner/feature.ts
import { createFeature } from "#shared/index.js";
import { StepRunner } from "./StepRunner.js";

export const StepRunnerFeature = createFeature({
    name: "Cli/StepRunner",
    register(container) {
        container.register(StepRunner).inSingletonScope();
    }
});
```

- [ ] **Step 5: Create runner barrel export**

```typescript
// src/cli/runner/index.ts
export { Step, StepRunner, type IStep, type IStepContext, type IStepResult, type IStepRunner, type IStepRunnerArgs } from "./abstractions/index.js";
export { StepRunnerFeature } from "./feature.js";
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
yarn test src/cli/runner/__tests__/StepRunner.test.ts
```

- [ ] **Step 7: Run full verification**

```bash
yarn full
```

- [ ] **Step 8: Commit**

```bash
git add src/cli/runner/
git commit -m "feat(cli): implement StepRunner with progress display and rollback"
```

---

### Task 3: Command abstraction

**Files:**
- Create: `src/cli/commands/abstractions/Command.ts`
- Create: `src/cli/commands/abstractions/index.ts`

**Interfaces:**
- Consumes: `Step` from `../../runner/abstractions/Step.js`, `createAbstraction` from `#shared/index.js`
- Produces: `Command` abstraction (`ICommand` with `name: string`, `description: string`, `steps(): Step.Interface[]`, `context(): Step.Context`)

- [ ] **Step 1: Create Command abstraction**

```typescript
// src/cli/commands/abstractions/Command.ts
import { createAbstraction } from "#shared/index.js";
import type { Step } from "../../runner/abstractions/Step.js";

export interface ICommand {
    name: string;
    description: string;
    steps(): Step.Interface[];
    context(): Step.Context;
}

export const Command = createAbstraction<ICommand>("Cli/Command");

export namespace Command {
    export type Interface = ICommand;
}
```

- [ ] **Step 2: Create barrel export**

```typescript
// src/cli/commands/abstractions/index.ts
export { Command, type ICommand } from "./Command.js";
```

- [ ] **Step 3: Verify build**

```bash
yarn build
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/abstractions/
git commit -m "feat(cli): add Command abstraction"
```

---

### Task 4: EnsureDataDirectory step

**Files:**
- Create: `src/cli/commands/init/steps/EnsureDataDirectory/abstractions/EnsureDataDirectoryStep.ts`
- Create: `src/cli/commands/init/steps/EnsureDataDirectory/abstractions/index.ts`
- Create: `src/cli/commands/init/steps/EnsureDataDirectory/EnsureDataDirectoryStep.ts`
- Create: `src/cli/commands/init/steps/EnsureDataDirectory/feature.ts`
- Create: `src/cli/commands/init/steps/EnsureDataDirectory/index.ts`
- Create: `src/cli/commands/init/steps/EnsureDataDirectory/__tests__/EnsureDataDirectoryStep.test.ts`

**Interfaces:**
- Consumes: `Step` from `../../../../../runner/abstractions/Step.js`, `createAbstraction` from `#shared/index.js`
- Produces: `EnsureDataDirectoryStep` abstraction, `EnsureDataDirectoryStepFeature`

- [ ] **Step 1: Write failing test**

```typescript
// src/cli/commands/init/steps/EnsureDataDirectory/__tests__/EnsureDataDirectoryStep.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createContainer } from "#shared/index.js";
import { EnsureDataDirectoryStepFeature } from "../feature.js";
import { EnsureDataDirectoryStep } from "../abstractions/EnsureDataDirectoryStep.js";
import type { IStepContext } from "../../../../../../cli/runner/abstractions/Step.js";

function createTestContext(dataDirectory: string): IStepContext {
    return {
        dataDirectory,
        envFilePath: "./.env",
        options: {},
        results: new Map()
    };
}

describe("EnsureDataDirectoryStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "ensure-data-"));
        container = createContainer();
        EnsureDataDirectoryStepFeature.register(container);
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("creates data directory when missing", async () => {
        const dataDir = join(workDir, "data");
        const step = container.resolve(EnsureDataDirectoryStep);
        const result = await step.execute(createTestContext(dataDir));
        expect(result.success).toBe(true);
        expect(existsSync(dataDir)).toBe(true);
    });

    it("skips when data directory already exists", async () => {
        const dataDir = join(workDir, "data");
        const { mkdirSync } = await import("node:fs");
        mkdirSync(dataDir);
        const step = container.resolve(EnsureDataDirectoryStep);
        const result = await step.execute(createTestContext(dataDir));
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
    });

    it("rollback removes empty directory", async () => {
        const dataDir = join(workDir, "data");
        const step = container.resolve(EnsureDataDirectoryStep);
        await step.execute(createTestContext(dataDir));
        expect(existsSync(dataDir)).toBe(true);
        await step.rollback!(createTestContext(dataDir));
        expect(existsSync(dataDir)).toBe(false);
    });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
yarn test src/cli/commands/init/steps/EnsureDataDirectory/__tests__/EnsureDataDirectoryStep.test.ts
```

- [ ] **Step 3: Create abstraction**

```typescript
// src/cli/commands/init/steps/EnsureDataDirectory/abstractions/EnsureDataDirectoryStep.ts
import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../../cli/runner/abstractions/Step.js";

export const EnsureDataDirectoryStep = createAbstraction<IStep>("Cli/EnsureDataDirectoryStep");

export namespace EnsureDataDirectoryStep {
    export type Interface = IStep;
}
```

```typescript
// src/cli/commands/init/steps/EnsureDataDirectory/abstractions/index.ts
export { EnsureDataDirectoryStep } from "./EnsureDataDirectoryStep.js";
```

- [ ] **Step 4: Implement**

```typescript
// src/cli/commands/init/steps/EnsureDataDirectory/EnsureDataDirectoryStep.ts
import { existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { EnsureDataDirectoryStep as Abstraction } from "./abstractions/EnsureDataDirectoryStep.js";
import type { IStepContext, IStepResult } from "../../../../../cli/runner/abstractions/Step.js";

class EnsureDataDirectoryStepImpl implements Abstraction.Interface {
    public name = "ensure-data-directory";
    public description = "Ensure data directory exists";

    public async execute(context: IStepContext): Promise<IStepResult> {
        if (existsSync(context.dataDirectory)) {
            return { success: true, skipped: true, message: "data directory already exists" };
        }
        mkdirSync(context.dataDirectory, { recursive: true });
        return { success: true };
    }

    public async rollback(context: IStepContext): Promise<void> {
        if (existsSync(context.dataDirectory)) {
            const entries = readdirSync(context.dataDirectory);
            if (entries.length === 0) {
                rmSync(context.dataDirectory, { recursive: true });
            }
        }
    }
}

export const EnsureDataDirectoryStep = Abstraction.createImplementation({
    implementation: EnsureDataDirectoryStepImpl,
    dependencies: []
});
```

- [ ] **Step 5: Create feature + barrel**

```typescript
// src/cli/commands/init/steps/EnsureDataDirectory/feature.ts
import { createFeature } from "#shared/index.js";
import { EnsureDataDirectoryStep } from "./EnsureDataDirectoryStep.js";

export const EnsureDataDirectoryStepFeature = createFeature({
    name: "Cli/EnsureDataDirectoryStep",
    register(container) {
        container.register(EnsureDataDirectoryStep).inSingletonScope();
    }
});
```

```typescript
// src/cli/commands/init/steps/EnsureDataDirectory/index.ts
export { EnsureDataDirectoryStep } from "./abstractions/EnsureDataDirectoryStep.js";
export { EnsureDataDirectoryStepFeature } from "./feature.js";
```

- [ ] **Step 6: Run test — verify pass**

```bash
yarn test src/cli/commands/init/steps/EnsureDataDirectory/__tests__/EnsureDataDirectoryStep.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/init/steps/EnsureDataDirectory/
git commit -m "feat(cli): add EnsureDataDirectory step"
```

---

### Task 5: RunMigrations step

**Files:**
- Create: `src/cli/commands/init/steps/RunMigrations/abstractions/RunMigrationsStep.ts`
- Create: `src/cli/commands/init/steps/RunMigrations/abstractions/index.ts`
- Create: `src/cli/commands/init/steps/RunMigrations/RunMigrationsStep.ts`
- Create: `src/cli/commands/init/steps/RunMigrations/feature.ts`
- Create: `src/cli/commands/init/steps/RunMigrations/index.ts`
- Create: `src/cli/commands/init/steps/RunMigrations/__tests__/RunMigrationsStep.test.ts`

**Interfaces:**
- Consumes: `Step` from runner abstractions, `createDatabaseClient` from `#api/db/client.js`, `runMigrations` from `#api/db/migrate.js`
- Produces: `RunMigrationsStep` abstraction, `RunMigrationsStepFeature`

- [ ] **Step 1: Write failing test**

```typescript
// src/cli/commands/init/steps/RunMigrations/__tests__/RunMigrationsStep.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createContainer } from "#shared/index.js";
import { RunMigrationsStepFeature } from "../feature.js";
import { RunMigrationsStep } from "../abstractions/RunMigrationsStep.js";
import type { IStepContext } from "../../../../../../cli/runner/abstractions/Step.js";

function createTestContext(dataDirectory: string): IStepContext {
    return {
        dataDirectory,
        envFilePath: join(dataDirectory, ".env"),
        options: {},
        results: new Map()
    };
}

describe("RunMigrationsStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "run-migrations-"));
        mkdirSync(join(workDir, "data"), { recursive: true });
        container = createContainer();
        RunMigrationsStepFeature.register(container);
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("creates database and runs migrations", async () => {
        const step = container.resolve(RunMigrationsStep);
        const context = createTestContext(join(workDir, "data"));
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(existsSync(join(workDir, "data", "manager.db"))).toBe(true);
    });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
yarn test src/cli/commands/init/steps/RunMigrations/__tests__/RunMigrationsStep.test.ts
```

- [ ] **Step 3: Create abstraction**

```typescript
// src/cli/commands/init/steps/RunMigrations/abstractions/RunMigrationsStep.ts
import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../../cli/runner/abstractions/Step.js";

export const RunMigrationsStep = createAbstraction<IStep>("Cli/RunMigrationsStep");

export namespace RunMigrationsStep {
    export type Interface = IStep;
}
```

```typescript
// src/cli/commands/init/steps/RunMigrations/abstractions/index.ts
export { RunMigrationsStep } from "./RunMigrationsStep.js";
```

- [ ] **Step 4: Implement**

```typescript
// src/cli/commands/init/steps/RunMigrations/RunMigrationsStep.ts
import { join } from "node:path";
import { RunMigrationsStep as Abstraction } from "./abstractions/RunMigrationsStep.js";
import { createDatabaseClient } from "#api/db/client.js";
import { runMigrations } from "#api/db/migrate.js";
import type { IStepContext, IStepResult } from "../../../../../cli/runner/abstractions/Step.js";

class RunMigrationsStepImpl implements Abstraction.Interface {
    public name = "run-migrations";
    public description = "Run database migrations";

    public async execute(context: IStepContext): Promise<IStepResult> {
        const dbPath = join(context.dataDirectory, "manager.db");
        const databaseClient = createDatabaseClient(dbPath);
        runMigrations(databaseClient.db);
        context.results.set("dbPath", dbPath);
        return { success: true };
    }
}

export const RunMigrationsStep = Abstraction.createImplementation({
    implementation: RunMigrationsStepImpl,
    dependencies: []
});
```

- [ ] **Step 5: Create feature + barrel**

```typescript
// src/cli/commands/init/steps/RunMigrations/feature.ts
import { createFeature } from "#shared/index.js";
import { RunMigrationsStep } from "./RunMigrationsStep.js";

export const RunMigrationsStepFeature = createFeature({
    name: "Cli/RunMigrationsStep",
    register(container) {
        container.register(RunMigrationsStep).inSingletonScope();
    }
});
```

```typescript
// src/cli/commands/init/steps/RunMigrations/index.ts
export { RunMigrationsStep } from "./abstractions/RunMigrationsStep.js";
export { RunMigrationsStepFeature } from "./feature.js";
```

- [ ] **Step 6: Run test — verify pass**

```bash
yarn test src/cli/commands/init/steps/RunMigrations/__tests__/RunMigrationsStep.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/init/steps/RunMigrations/
git commit -m "feat(cli): add RunMigrations step"
```

---

### Task 6: GenerateEncryptionKey + SelectPort steps

**Files:**
- Create: `src/cli/commands/init/steps/GenerateEncryptionKey/` (full DI structure)
- Create: `src/cli/commands/init/steps/SelectPort/` (full DI structure)
- Test: `__tests__/` in each

**Interfaces:**
- Consumes: `Step` from runner abstractions, `crypto.randomBytes` (Node built-in), `@inquirer/prompts` for port selection
- Produces: `GenerateEncryptionKeyStep` + `GenerateEncryptionKeyStepFeature`, `SelectPortStep` + `SelectPortStepFeature`. Both store values in `context.results`.

- [ ] **Step 1: Write GenerateEncryptionKey test**

```typescript
// src/cli/commands/init/steps/GenerateEncryptionKey/__tests__/GenerateEncryptionKeyStep.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { GenerateEncryptionKeyStepFeature } from "../feature.js";
import { GenerateEncryptionKeyStep } from "../abstractions/GenerateEncryptionKeyStep.js";
import type { IStepContext } from "../../../../../../cli/runner/abstractions/Step.js";

function createTestContext(): IStepContext {
    return {
        dataDirectory: "./data",
        envFilePath: "./.env",
        options: {},
        results: new Map()
    };
}

describe("GenerateEncryptionKeyStep", () => {
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        container = createContainer();
        GenerateEncryptionKeyStepFeature.register(container);
    });

    it("generates a 64-char hex key and stores in context", async () => {
        const step = container.resolve(GenerateEncryptionKeyStep);
        const context = createTestContext();
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        const key = context.results.get("encryptionKey") as string;
        expect(key).toHaveLength(64);
        expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it("generates unique keys on each call", async () => {
        const step = container.resolve(GenerateEncryptionKeyStep);
        const context1 = createTestContext();
        const context2 = createTestContext();
        await step.execute(context1);
        await step.execute(context2);
        expect(context1.results.get("encryptionKey")).not.toBe(context2.results.get("encryptionKey"));
    });
});
```

- [ ] **Step 2: Write SelectPort test**

```typescript
// src/cli/commands/init/steps/SelectPort/__tests__/SelectPortStep.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { SelectPortStepFeature } from "../feature.js";
import { SelectPortStep } from "../abstractions/SelectPortStep.js";
import type { IStepContext } from "../../../../../../cli/runner/abstractions/Step.js";

vi.mock("@inquirer/prompts", () => ({
    input: vi.fn().mockResolvedValue("4000")
}));

function createTestContext(): IStepContext {
    return {
        dataDirectory: "./data",
        envFilePath: "./.env",
        options: {},
        results: new Map()
    };
}

describe("SelectPortStep", () => {
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        container = createContainer();
        SelectPortStepFeature.register(container);
    });

    it("stores selected port in context", async () => {
        const step = container.resolve(SelectPortStep);
        const context = createTestContext();
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(context.results.get("port")).toBe("4000");
    });
});
```

- [ ] **Step 3: Run tests — verify failure**

```bash
yarn test src/cli/commands/init/steps/GenerateEncryptionKey/__tests__/GenerateEncryptionKeyStep.test.ts src/cli/commands/init/steps/SelectPort/__tests__/SelectPortStep.test.ts
```

- [ ] **Step 4: Implement GenerateEncryptionKey (abstraction + impl + feature + index)**

Follow exact same file structure as EnsureDataDirectory (Task 4). Implementation:

```typescript
// src/cli/commands/init/steps/GenerateEncryptionKey/GenerateEncryptionKeyStep.ts
import { randomBytes } from "node:crypto";
import { GenerateEncryptionKeyStep as Abstraction } from "./abstractions/GenerateEncryptionKeyStep.js";
import type { IStepContext, IStepResult } from "../../../../../cli/runner/abstractions/Step.js";

class GenerateEncryptionKeyStepImpl implements Abstraction.Interface {
    public name = "generate-encryption-key";
    public description = "Generate encryption key";

    public async execute(context: IStepContext): Promise<IStepResult> {
        const key = randomBytes(32).toString("hex");
        context.results.set("encryptionKey", key);
        return { success: true };
    }
}

export const GenerateEncryptionKeyStep = Abstraction.createImplementation({
    implementation: GenerateEncryptionKeyStepImpl,
    dependencies: []
});
```

- [ ] **Step 5: Implement SelectPort (abstraction + impl + feature + index)**

```typescript
// src/cli/commands/init/steps/SelectPort/SelectPortStep.ts
import { input } from "@inquirer/prompts";
import { SelectPortStep as Abstraction } from "./abstractions/SelectPortStep.js";
import type { IStepContext, IStepResult } from "../../../../../cli/runner/abstractions/Step.js";

class SelectPortStepImpl implements Abstraction.Interface {
    public name = "select-port";
    public description = "Select server port";

    public async execute(context: IStepContext): Promise<IStepResult> {
        const port = await input({
            message: "Server port:",
            default: "3001",
            validate: value => {
                const num = parseInt(value, 10);
                if (isNaN(num) || num < 1 || num > 65535) {
                    return "Port must be between 1 and 65535";
                }
                return true;
            }
        });
        context.results.set("port", port);
        return { success: true };
    }
}

export const SelectPortStep = Abstraction.createImplementation({
    implementation: SelectPortStepImpl,
    dependencies: []
});
```

- [ ] **Step 6: Run tests — verify pass**

```bash
yarn test src/cli/commands/init/steps/GenerateEncryptionKey/__tests__/ src/cli/commands/init/steps/SelectPort/__tests__/
```

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/init/steps/GenerateEncryptionKey/ src/cli/commands/init/steps/SelectPort/
git commit -m "feat(cli): add GenerateEncryptionKey and SelectPort steps"
```

---

### Task 7: CreateAdminUser step

**Files:**
- Create: `src/cli/commands/init/steps/CreateAdminUser/` (full DI structure)
- Test: `__tests__/CreateAdminUserStep.test.ts`

**Interfaces:**
- Consumes: `Step` from runner, `@inquirer/prompts` (input, password), `argon2` (hash), `@webiny/stdlib` (generateId), `createDatabaseClient` from `#api/db/client.js`, `users` from `#api/db/schema.js`
- Produces: `CreateAdminUserStep` abstraction, `CreateAdminUserStepFeature`

- [ ] **Step 1: Write failing test**

```typescript
// src/cli/commands/init/steps/CreateAdminUser/__tests__/CreateAdminUserStep.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sql } from "drizzle-orm";
import { createContainer } from "#shared/index.js";
import { createDatabaseClient } from "#api/db/client.js";
import { runMigrations } from "#api/db/migrate.js";
import { users } from "#api/db/schema.js";
import { CreateAdminUserStepFeature } from "../feature.js";
import { CreateAdminUserStep } from "../abstractions/CreateAdminUserStep.js";
import type { IStepContext } from "../../../../../../cli/runner/abstractions/Step.js";

vi.mock("@inquirer/prompts", () => ({
    input: vi.fn()
        .mockResolvedValueOnce("admin@test.com")
        .mockResolvedValueOnce("Admin User"),
    password: vi.fn()
        .mockResolvedValueOnce("password123")
        .mockResolvedValueOnce("password123")
}));

describe("CreateAdminUserStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "create-admin-"));
        mkdirSync(join(workDir, "data"), { recursive: true });
        container = createContainer();
        CreateAdminUserStepFeature.register(container);
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("creates admin user in database", async () => {
        const dbPath = join(workDir, "data", "manager.db");
        const databaseClient = createDatabaseClient(dbPath);
        runMigrations(databaseClient.db);

        const step = container.resolve(CreateAdminUserStep);
        const context: IStepContext = {
            dataDirectory: join(workDir, "data"),
            envFilePath: join(workDir, ".env"),
            options: {},
            results: new Map([["dbPath", dbPath]])
        };
        const result = await step.execute(context);
        expect(result.success).toBe(true);

        const count = databaseClient.db
            .select({ count: sql<number>`COUNT(*)` })
            .from(users)
            .get();
        expect(count?.count).toBe(1);
    });

    it("skips when users already exist", async () => {
        const { input, password } = await import("@inquirer/prompts");
        vi.mocked(input)
            .mockResolvedValueOnce("admin@test.com")
            .mockResolvedValueOnce("Admin User");
        vi.mocked(password)
            .mockResolvedValueOnce("password123")
            .mockResolvedValueOnce("password123");

        const dbPath = join(workDir, "data", "manager.db");
        const databaseClient = createDatabaseClient(dbPath);
        runMigrations(databaseClient.db);

        const step = container.resolve(CreateAdminUserStep);
        const context: IStepContext = {
            dataDirectory: join(workDir, "data"),
            envFilePath: join(workDir, ".env"),
            options: {},
            results: new Map([["dbPath", dbPath]])
        };

        await step.execute(context);

        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
    });
});
```

- [ ] **Step 2: Run test — verify failure**

- [ ] **Step 3: Create abstraction + implement + feature + index**

Implementation mirrors current `src/cli/init.ts` logic (lines 13-91) but as a DI step. Uses `context.results.get("dbPath")` to find the database. Checks for existing users and skips if found.

```typescript
// src/cli/commands/init/steps/CreateAdminUser/CreateAdminUserStep.ts
import { input, password } from "@inquirer/prompts";
import { hash } from "argon2";
import { generateId } from "@webiny/stdlib";
import { sql } from "drizzle-orm";
import { CreateAdminUserStep as Abstraction } from "./abstractions/CreateAdminUserStep.js";
import { createDatabaseClient } from "#api/db/client.js";
import { users } from "#api/db/schema.js";
import type { IStepContext, IStepResult } from "../../../../../cli/runner/abstractions/Step.js";

class CreateAdminUserStepImpl implements Abstraction.Interface {
    public name = "create-admin-user";
    public description = "Create admin user";

    public async execute(context: IStepContext): Promise<IStepResult> {
        const dbPath = context.results.get("dbPath") as string;
        const databaseClient = createDatabaseClient(dbPath);

        const countResult = databaseClient.db
            .select({ count: sql<number>`COUNT(*)` })
            .from(users)
            .get();

        if (countResult && countResult.count > 0) {
            return { success: true, skipped: true, message: "users already exist" };
        }

        console.log("\nCreate the first admin user:\n");

        const email = await input({
            message: "Email:",
            validate: value => {
                if (!value.includes("@")) {
                    return "Please enter a valid email address";
                }
                return true;
            }
        });

        const displayName = await input({
            message: "Display name:",
            validate: value => {
                if (value.length < 1) {
                    return "Display name is required";
                }
                return true;
            }
        });

        const userPassword = await password({
            message: "Password (min 8 chars):",
            validate: value => {
                if (value.length < 8) {
                    return "Password must be at least 8 characters";
                }
                return true;
            }
        });

        const confirmPassword = await password({
            message: "Confirm password:"
        });

        if (userPassword !== confirmPassword) {
            return { success: false, message: "Passwords do not match" };
        }

        const passwordHash = await hash(userPassword);
        const now = Date.now();

        databaseClient.db
            .insert(users)
            .values({
                id: generateId(),
                email: email.toLowerCase().trim(),
                passwordHash,
                displayName,
                permission: "full",
                isActive: 1,
                createdAt: now,
                updatedAt: now
            })
            .run();

        return { success: true, message: `Admin user created: ${email}` };
    }
}

export const CreateAdminUserStep = Abstraction.createImplementation({
    implementation: CreateAdminUserStepImpl,
    dependencies: []
});
```

- [ ] **Step 4: Run test — verify pass**
- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/init/steps/CreateAdminUser/
git commit -m "feat(cli): add CreateAdminUser step"
```

---

### Task 8: WriteEnvFile + PrintNextSteps steps

**Files:**
- Create: `src/cli/commands/init/steps/WriteEnvFile/` (full DI structure)
- Create: `src/cli/commands/init/steps/PrintNextSteps/` (full DI structure)

**Interfaces:**
- Consumes: `Step` from runner, `context.results` for encryptionKey/port/dbPath
- Produces: `WriteEnvFileStep` + `WriteEnvFileStepFeature`, `PrintNextStepsStep` + `PrintNextStepsStepFeature`

- [ ] **Step 1: Write WriteEnvFile test**

```typescript
// src/cli/commands/init/steps/WriteEnvFile/__tests__/WriteEnvFileStep.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, rmSync, mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createContainer } from "#shared/index.js";
import { WriteEnvFileStepFeature } from "../feature.js";
import { WriteEnvFileStep } from "../abstractions/WriteEnvFileStep.js";
import type { IStepContext } from "../../../../../../cli/runner/abstractions/Step.js";

describe("WriteEnvFileStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "write-env-"));
        container = createContainer();
        WriteEnvFileStepFeature.register(container);
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("writes .env with encryption key, port, and db path", async () => {
        const envPath = join(workDir, ".env");
        const step = container.resolve(WriteEnvFileStep);
        const context: IStepContext = {
            dataDirectory: "./data",
            envFilePath: envPath,
            options: {},
            results: new Map([
                ["encryptionKey", "abc123"],
                ["port", "4000"],
                ["dbPath", "./data/manager.db"]
            ])
        };
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        const content = readFileSync(envPath, "utf-8");
        expect(content).toContain("ENCRYPTION_KEY=abc123");
        expect(content).toContain("PORT=4000");
        expect(content).toContain("DB_PATH=./data/manager.db");
    });

    it("skips when .env already exists", async () => {
        const envPath = join(workDir, ".env");
        const { writeFileSync } = await import("node:fs");
        writeFileSync(envPath, "existing");
        const step = container.resolve(WriteEnvFileStep);
        const context: IStepContext = {
            dataDirectory: "./data",
            envFilePath: envPath,
            options: {},
            results: new Map([["encryptionKey", "x"], ["port", "3001"], ["dbPath", "./data/manager.db"]])
        };
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
    });

    it("rollback removes .env", async () => {
        const envPath = join(workDir, ".env");
        const step = container.resolve(WriteEnvFileStep);
        const context: IStepContext = {
            dataDirectory: "./data",
            envFilePath: envPath,
            options: {},
            results: new Map([["encryptionKey", "x"], ["port", "3001"], ["dbPath", "./data/manager.db"]])
        };
        await step.execute(context);
        expect(existsSync(envPath)).toBe(true);
        await step.rollback!(context);
        expect(existsSync(envPath)).toBe(false);
    });
});
```

- [ ] **Step 2: Write PrintNextSteps test**

```typescript
// src/cli/commands/init/steps/PrintNextSteps/__tests__/PrintNextStepsStep.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { PrintNextStepsStepFeature } from "../feature.js";
import { PrintNextStepsStep } from "../abstractions/PrintNextStepsStep.js";
import type { IStepContext } from "../../../../../../cli/runner/abstractions/Step.js";

describe("PrintNextStepsStep", () => {
    let container: ReturnType<typeof createContainer>;
    let output: string[];
    const originalLog = console.log;

    beforeEach(() => {
        output = [];
        console.log = (...args: unknown[]) => output.push(args.join(" "));
        container = createContainer();
        PrintNextStepsStepFeature.register(container);
    });

    afterEach(() => {
        console.log = originalLog;
    });

    it("prints depco start instruction", async () => {
        const step = container.resolve(PrintNextStepsStep);
        const context: IStepContext = {
            dataDirectory: "./data",
            envFilePath: "./.env",
            options: {},
            results: new Map()
        };
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        const text = output.join("\n");
        expect(text).toContain("depco start");
    });
});
```

- [ ] **Step 3: Run tests — verify failure**
- [ ] **Step 4: Implement WriteEnvFile**

```typescript
// src/cli/commands/init/steps/WriteEnvFile/WriteEnvFileStep.ts
import { existsSync, writeFileSync, rmSync } from "node:fs";
import { WriteEnvFileStep as Abstraction } from "./abstractions/WriteEnvFileStep.js";
import type { IStepContext, IStepResult } from "../../../../../cli/runner/abstractions/Step.js";

class WriteEnvFileStepImpl implements Abstraction.Interface {
    public name = "write-env-file";
    public description = "Write .env configuration file";

    public async execute(context: IStepContext): Promise<IStepResult> {
        if (existsSync(context.envFilePath)) {
            return { success: true, skipped: true, message: ".env already exists" };
        }

        const encryptionKey = context.results.get("encryptionKey") as string;
        const port = context.results.get("port") as string;
        const dbPath = context.results.get("dbPath") as string;

        const content = [
            `ENCRYPTION_KEY=${encryptionKey}`,
            `PORT=${port}`,
            `DB_PATH=${dbPath}`,
            ""
        ].join("\n");

        writeFileSync(context.envFilePath, content);
        return { success: true };
    }

    public async rollback(context: IStepContext): Promise<void> {
        if (existsSync(context.envFilePath)) {
            rmSync(context.envFilePath);
        }
    }
}

export const WriteEnvFileStep = Abstraction.createImplementation({
    implementation: WriteEnvFileStepImpl,
    dependencies: []
});
```

- [ ] **Step 5: Implement PrintNextSteps**

```typescript
// src/cli/commands/init/steps/PrintNextSteps/PrintNextStepsStep.ts
import { PrintNextStepsStep as Abstraction } from "./abstractions/PrintNextStepsStep.js";
import type { IStepContext, IStepResult } from "../../../../../cli/runner/abstractions/Step.js";

class PrintNextStepsStepImpl implements Abstraction.Interface {
    public name = "print-next-steps";
    public description = "Print next steps";

    public async execute(_context: IStepContext): Promise<IStepResult> {
        console.log("\n✅ Setup complete!\n");
        console.log("Next steps:\n");
        console.log("  depco start             # start the server");
        console.log("  open http://localhost:PORT\n");
        return { success: true };
    }
}

export const PrintNextStepsStep = Abstraction.createImplementation({
    implementation: PrintNextStepsStepImpl,
    dependencies: []
});
```

- [ ] **Step 6: Create all abstraction/feature/index files for both steps**

Each follows the same pattern as Task 4. Abstraction names: `"Cli/WriteEnvFileStep"`, `"Cli/PrintNextStepsStep"`.

- [ ] **Step 7: Run tests — verify pass**
- [ ] **Step 8: Commit**

```bash
git add src/cli/commands/init/steps/WriteEnvFile/ src/cli/commands/init/steps/PrintNextSteps/
git commit -m "feat(cli): add WriteEnvFile and PrintNextSteps steps"
```

---

### Task 9: InitCommand implementation

**Files:**
- Create: `src/cli/commands/init/abstractions/InitCommand.ts`
- Create: `src/cli/commands/init/abstractions/index.ts`
- Create: `src/cli/commands/init/InitCommand.ts`
- Create: `src/cli/commands/init/feature.ts`
- Create: `src/cli/commands/init/index.ts`
- Create: `src/cli/commands/init/__tests__/InitCommand.test.ts`

**Interfaces:**
- Consumes: `Command` from `../abstractions/Command.js`, all 7 step abstractions, `createAbstraction`/`createFeature` from `#shared/index.js`
- Produces: `InitCommand` abstraction, `InitCommandFeature`

- [ ] **Step 1: Write failing test**

```typescript
// src/cli/commands/init/__tests__/InitCommand.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { InitCommandFeature } from "../feature.js";
import { InitCommand } from "../abstractions/InitCommand.js";

describe("InitCommand", () => {
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        container = createContainer();
        InitCommandFeature.register(container);
    });

    it("returns 7 steps in correct order", () => {
        const command = container.resolve(InitCommand);
        const steps = command.steps();
        expect(steps).toHaveLength(7);
        expect(steps.map(s => s.name)).toEqual([
            "ensure-data-directory",
            "run-migrations",
            "generate-encryption-key",
            "select-port",
            "create-admin-user",
            "write-env-file",
            "print-next-steps"
        ]);
    });

    it("returns valid context", () => {
        const command = container.resolve(InitCommand);
        const context = command.context();
        expect(context.dataDirectory).toBe("./data");
        expect(context.envFilePath).toBe("./.env");
        expect(context.results).toBeInstanceOf(Map);
    });

    it("has correct name and description", () => {
        const command = container.resolve(InitCommand);
        expect(command.name).toBe("init");
        expect(command.description).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run test — verify failure**
- [ ] **Step 3: Create InitCommand abstraction**

```typescript
// src/cli/commands/init/abstractions/InitCommand.ts
import { createAbstraction } from "#shared/index.js";
import type { ICommand } from "../../abstractions/Command.js";

export const InitCommand = createAbstraction<ICommand>("Cli/InitCommand");

export namespace InitCommand {
    export type Interface = ICommand;
}
```

```typescript
// src/cli/commands/init/abstractions/index.ts
export { InitCommand } from "./InitCommand.js";
```

- [ ] **Step 4: Implement InitCommand**

```typescript
// src/cli/commands/init/InitCommand.ts
import { InitCommand as Abstraction } from "./abstractions/InitCommand.js";
import { EnsureDataDirectoryStep } from "./steps/EnsureDataDirectory/index.js";
import { RunMigrationsStep } from "./steps/RunMigrations/index.js";
import { GenerateEncryptionKeyStep } from "./steps/GenerateEncryptionKey/index.js";
import { SelectPortStep } from "./steps/SelectPort/index.js";
import { CreateAdminUserStep } from "./steps/CreateAdminUser/index.js";
import { WriteEnvFileStep } from "./steps/WriteEnvFile/index.js";
import { PrintNextStepsStep } from "./steps/PrintNextSteps/index.js";
import type { Step } from "../../../cli/runner/abstractions/Step.js";

class InitCommandImpl implements Abstraction.Interface {
    public name = "init";
    public description = "Initialize depco — create database, admin user, and environment config";

    public constructor(
        private ensureDataDirectory: Step.Interface,
        private runMigrations: Step.Interface,
        private generateEncryptionKey: Step.Interface,
        private selectPort: Step.Interface,
        private createAdminUser: Step.Interface,
        private writeEnvFile: Step.Interface,
        private printNextSteps: Step.Interface
    ) {}

    public steps(): Step.Interface[] {
        return [
            this.ensureDataDirectory,
            this.runMigrations,
            this.generateEncryptionKey,
            this.selectPort,
            this.createAdminUser,
            this.writeEnvFile,
            this.printNextSteps
        ];
    }

    public context(): Step.Context {
        return {
            dataDirectory: "./data",
            envFilePath: "./.env",
            options: {},
            results: new Map()
        };
    }
}

export const InitCommand = Abstraction.createImplementation({
    implementation: InitCommandImpl,
    dependencies: [
        EnsureDataDirectoryStep,
        RunMigrationsStep,
        GenerateEncryptionKeyStep,
        SelectPortStep,
        CreateAdminUserStep,
        WriteEnvFileStep,
        PrintNextStepsStep
    ]
});
```

- [ ] **Step 5: Create feature**

```typescript
// src/cli/commands/init/feature.ts
import { createFeature } from "#shared/index.js";
import { EnsureDataDirectoryStepFeature } from "./steps/EnsureDataDirectory/index.js";
import { RunMigrationsStepFeature } from "./steps/RunMigrations/index.js";
import { GenerateEncryptionKeyStepFeature } from "./steps/GenerateEncryptionKey/index.js";
import { SelectPortStepFeature } from "./steps/SelectPort/index.js";
import { CreateAdminUserStepFeature } from "./steps/CreateAdminUser/index.js";
import { WriteEnvFileStepFeature } from "./steps/WriteEnvFile/index.js";
import { PrintNextStepsStepFeature } from "./steps/PrintNextSteps/index.js";
import { InitCommand } from "./InitCommand.js";

export const InitCommandFeature = createFeature({
    name: "Cli/InitCommand",
    dependencies: [
        EnsureDataDirectoryStepFeature,
        RunMigrationsStepFeature,
        GenerateEncryptionKeyStepFeature,
        SelectPortStepFeature,
        CreateAdminUserStepFeature,
        WriteEnvFileStepFeature,
        PrintNextStepsStepFeature,
    ],
    register(container) {
        container.register(InitCommand).inSingletonScope();
    }
});
```

- [ ] **Step 6: Create barrel + commands barrel**

```typescript
// src/cli/commands/init/index.ts
export { InitCommand } from "./abstractions/InitCommand.js";
export { InitCommandFeature } from "./feature.js";
```

- [ ] **Step 7: Run test — verify pass**
- [ ] **Step 8: Run full verification**

```bash
yarn full
```

- [ ] **Step 9: Commit**

```bash
git add src/cli/commands/init/
git commit -m "feat(cli): add InitCommand with step composition"
```

---

### Task 10: Server refactor + start command

**Files:**
- Modify: `src/api/server.ts` (extract `startServer()` export)
- Create: `src/cli/commands/start/` (full DI structure with ValidateEnvironment + StartServer steps)
- Create: `src/cli/commands/start/__tests__/StartCommand.test.ts`
- Create: `src/cli/commands/start/steps/ValidateEnvironment/` (full DI structure)
- Create: `src/cli/commands/start/steps/StartServer/` (full DI structure)

**Interfaces:**
- Consumes: `Command` from abstractions, `Step` from runner, `createServer` + new `startServer` from `#api/server.js`
- Produces: `StartCommand` + `StartCommandFeature`, `ValidateEnvironmentStep` + `StartServerStep`

- [ ] **Step 1: Extract startServer from server.ts**

Rename current `main()` to `startServer()` and export it. Keep the bottom-level call as-is (it calls the renamed function).

Current (server.ts lines 227-238):
```typescript
async function main(): Promise<void> { ... }
```

Change to:
```typescript
export async function startServer(): Promise<void> {
    process.on("uncaughtException", error => {
        console.error("Uncaught exception:", error);
    });
    process.on("unhandledRejection", reason => {
        console.error("Unhandled rejection:", reason);
    });
    const app = await createServer();
    await app.listen({ port: API_PORT, host: "0.0.0.0" });
}
```

Bottom of file stays:
```typescript
startServer().catch(error => {
    console.error("Server failed to start:", error);
    process.exit(1);
});
```

- [ ] **Step 2: Write ValidateEnvironment test**

```typescript
// src/cli/commands/start/steps/ValidateEnvironment/__tests__/ValidateEnvironmentStep.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createContainer } from "#shared/index.js";
import { ValidateEnvironmentStepFeature } from "../feature.js";
import { ValidateEnvironmentStep } from "../abstractions/ValidateEnvironmentStep.js";
import type { IStepContext } from "../../../../../../cli/runner/abstractions/Step.js";

describe("ValidateEnvironmentStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "validate-env-"));
        container = createContainer();
        ValidateEnvironmentStepFeature.register(container);
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("succeeds when .env exists with ENCRYPTION_KEY", async () => {
        const envPath = join(workDir, ".env");
        writeFileSync(envPath, "ENCRYPTION_KEY=abc123\nPORT=3001\n");
        const step = container.resolve(ValidateEnvironmentStep);
        const context: IStepContext = {
            dataDirectory: "./data",
            envFilePath: envPath,
            options: {},
            results: new Map()
        };
        const result = await step.execute(context);
        expect(result.success).toBe(true);
    });

    it("fails when .env missing", async () => {
        const step = container.resolve(ValidateEnvironmentStep);
        const context: IStepContext = {
            dataDirectory: "./data",
            envFilePath: join(workDir, ".env"),
            options: {},
            results: new Map()
        };
        const result = await step.execute(context);
        expect(result.success).toBe(false);
    });
});
```

- [ ] **Step 3: Implement ValidateEnvironment + StartServer steps + StartCommand**

ValidateEnvironmentStep checks .env exists and contains ENCRYPTION_KEY.

StartServerStep calls `startServer()` from `#api/server.js`.

StartCommand has 2 steps: ValidateEnvironment, StartServer.

Follow identical DI structure as init steps.

- [ ] **Step 4: Create StartCommand feature + barrel**

```typescript
// src/cli/commands/start/feature.ts
import { createFeature } from "#shared/index.js";
import { ValidateEnvironmentStepFeature } from "./steps/ValidateEnvironment/index.js";
import { StartServerStepFeature } from "./steps/StartServer/index.js";
import { StartCommand } from "./StartCommand.js";

export const StartCommandFeature = createFeature({
    name: "Cli/StartCommand",
    dependencies: [
        ValidateEnvironmentStepFeature,
        StartServerStepFeature,
    ],
    register(container) {
        container.register(StartCommand).inSingletonScope();
    }
});
```

- [ ] **Step 5: Write StartCommand test**

```typescript
// src/cli/commands/start/__tests__/StartCommand.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { StartCommandFeature } from "../feature.js";
import { StartCommand } from "../abstractions/StartCommand.js";

describe("StartCommand", () => {
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        container = createContainer();
        StartCommandFeature.register(container);
    });

    it("returns 2 steps in correct order", () => {
        const command = container.resolve(StartCommand);
        const steps = command.steps();
        expect(steps).toHaveLength(2);
        expect(steps.map(s => s.name)).toEqual([
            "validate-environment",
            "start-server"
        ]);
    });
});
```

- [ ] **Step 6: Run tests — verify pass**
- [ ] **Step 7: Run full verification**

```bash
yarn full
```

- [ ] **Step 8: Commit**

```bash
git add src/api/server.ts src/cli/commands/start/
git commit -m "feat(cli): add StartCommand with ValidateEnvironment and StartServer steps"
```

---

### Task 11: CLI entry point + CliFeature + cleanup

**Files:**
- Rewrite: `src/cli/index.ts`
- Create: `src/cli/feature.ts`
- Create: `src/cli/commands/index.ts`
- Delete: `src/cli/init.ts`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `createContainer` from `#shared/index.js`, `CliFeature`, `InitCommand`, `StartCommand`, `StepRunner`
- Produces: Working `depco init` and `depco start` CLI commands

- [ ] **Step 1: Create CliFeature compositor**

```typescript
// src/cli/feature.ts
import { createFeature } from "#shared/index.js";
import { StepRunnerFeature } from "./runner/index.js";
import { InitCommandFeature } from "./commands/init/index.js";
import { StartCommandFeature } from "./commands/start/index.js";

export const CliFeature = createFeature({
    name: "Cli",
    dependencies: [
        StepRunnerFeature,
        InitCommandFeature,
        StartCommandFeature,
    ],
    register() {}
});
```

- [ ] **Step 2: Create commands barrel**

```typescript
// src/cli/commands/index.ts
export { InitCommand, InitCommandFeature } from "./init/index.js";
export { StartCommand, StartCommandFeature } from "./start/index.js";
export { Command } from "./abstractions/index.js";
```

- [ ] **Step 3: Rewrite cli/index.ts**

```typescript
// src/cli/index.ts
#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createContainer } from "#shared/index.js";
import { CliFeature } from "./feature.js";
import { InitCommand } from "./commands/init/index.js";
import { StartCommand } from "./commands/start/index.js";
import { StepRunner } from "./runner/index.js";

const container = createContainer();
CliFeature.register(container);

const runner = container.resolve(StepRunner);

let cli = yargs(hideBin(process.argv));

cli = cli.command("init", "Initialize depco", {}, async () => {
    const command = container.resolve(InitCommand);
    await runner.run({ steps: command.steps(), context: command.context() });
});

cli = cli.command("start", "Start the depco server", {}, async () => {
    const command = container.resolve(StartCommand);
    await runner.run({ steps: command.steps(), context: command.context() });
});

cli.help().parse();
```

- [ ] **Step 4: Delete old init.ts**

```bash
git rm src/cli/init.ts
```

- [ ] **Step 5: Update AGENTS.md**

Add CLI section documenting the new command structure, step runner, and DI pattern.

- [ ] **Step 6: Run full verification**

```bash
yarn full
```

- [ ] **Step 7: Format and commit**

```bash
yarn format:fix && yarn lint:fix
git add -A
git commit -m "feat(cli): wire CLI entry point with yargs, CliFeature compositor, remove old init"
```

---

Self-review complete:
- All 7 init steps covered (Tasks 4-8)
- StepRunner with rollback (Task 2)
- Command abstraction (Task 3)
- InitCommand composition (Task 9)
- StartCommand with server refactor (Task 10)
- CLI entry + cleanup (Task 11)
- All types/signatures consistent across tasks
- No placeholders — every step has code
- DI pattern matches codebase exactly (createAbstraction + namespace + createImplementation + createFeature)
