# JobWorker Fix + CLI Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add error visibility to two silent DB-write catch blocks in `JobWorker.ts`, add a `depco config-check` CLI command that validates `depco.config.ts` without scanning, and add a `--output <path>` flag to `depco scan` that writes formatted results to a file instead of stdout.

**Architecture:** Task 1 touches only `JobWorker.ts` (adds `console.error` calls, no control-flow change). Task 2 follows the existing CLI command pattern exactly (`Command` abstraction + one `Step` + DI feature + yargs registration), mirroring `InitCommand`/`ScanCommand`. Task 3 extends the existing `ScanCommand` → `RenderOutputStep` pipeline: the step reads `context.options["output"]` and switches between `writeFileSync` and `console.log`.

**Tech Stack:** TypeScript, Vitest, @webiny/di, Zod, yargs

## Global Constraints

- Use `yarn full` to verify (lint, format, build, tests) before considering any task done
- Named interfaces only, no inline structural types
- Object params with named keys for 2+ params
- Full words in identifiers (no abbreviations)
- Format with `yarn format:fix` and `yarn lint:fix` before committing
- Follow the existing DI patterns exactly: `createAbstraction<T>(name)` for abstractions, `Abstraction.createImplementation({ implementation, dependencies })` for implementations, `createFeature({ name, dependencies, register(container) {...} })` for features, barrel `index.ts` files re-export the abstraction + feature
- Every new `Step` implementation file follows: `abstractions/<Name>.ts` (the `createAbstraction<IStep>` call + `Interface` namespace member), `abstractions/index.ts` (re-export), `<Name>.ts` (the class + `createImplementation`), `feature.ts` (the `createFeature`), `index.ts` (top barrel re-exporting abstraction + feature)

---

## Task 1: JobWorker Silent Catch Blocks Fix

**Files:**
- Modify: `src/api/services/JobExecution/JobWorker.ts:153` and `:190`
- Test: `src/api/services/JobExecution/__tests__/JobWorker.test.ts`

**Interfaces:**
- Consumes: nothing new — `JobWorker.Interface` (`enqueue`, `processNextJob`, `drain`, `getJob`) is unchanged
- Produces: no new exports; only observable behavior change is that `console.error` is called on DB write failure during log flush and progress write

This task has been verified end-to-end: the two catch-block edits below and both new tests were applied to the real repo, run with `yarn vitest --config testing/vitest.config.ts --run src/api/services/JobExecution/__tests__/JobWorker.test.ts`, and passed (38/38 tests), then reverted to hand off via this plan. `npx tsc --noEmit -p .` also reported no new errors. The exact code below is what was verified.

Current state of the two catch blocks (both silently swallow errors):

```typescript
// line ~142-154 (log flush, inside executeJob)
const flushLogs = (): void => {
    if (!logsDirty) {
        return;
    }
    logsDirty = false;
    try {
        this.databaseClient.db
            .update(upgradeJobs)
            .set({ logs })
            .where(eq(upgradeJobs.id, job.id))
            .run();
    } catch {}
};
```

```typescript
// line ~178-191 (progress write, inside setProgress)
const now = Date.now();
if (
    input.percent >= 100 ||
    now - lastProgressDbWriteAt >= PROGRESS_DB_WRITE_THROTTLE_MS
) {
    lastProgressDbWriteAt = now;
    try {
        this.databaseClient.db
            .update(upgradeJobs)
            .set({ progress: input.percent, progressLabel })
            .where(eq(upgradeJobs.id, job.id))
            .run();
    } catch {}
}
```

- [ ] **Step 1: Write the failing tests**

Open `src/api/services/JobExecution/__tests__/JobWorker.test.ts`. It already has a `describe("JobWorker", ...)` block with `worker`, `commandRunner`, `db`, `broadcaster`, `testDir` set up in `beforeEach`, and a project `"p1"` created via `createProject(db, "p1", join(testDir, "p1"))`. Insert the two tests below immediately before the `describe("scan jobs", () => {` line (so they sit inside the outer `describe("JobWorker", ...)` block, after the `"recovers stale running and pending jobs..."` test and the nested `waitForJob`/`waitForJobs`/`getRunningJobsForReference` describes).

Both tests intercept `db.update` by call count: call #1 is always the `processNextJob` "running" status write, call #3 is always the final `finishJob` write — only call #2 is made to throw, which isolates exactly the write we're targeting without breaking the rest of the job lifecycle. This was confirmed against the real `TransitiveResolveJobExecutor` (calls `setProgress({percent:100})` synchronously with zero unresolved rows, causing exactly one progress DB write) and `DependencyJobExecutor` (never calls `setProgress`, so pausing it mid-flight via a controlled `runStreaming` promise only exercises the log-flush interval).

```typescript
    it("logs an error to console when the progress DB write fails, without failing the job", async () => {
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        let updateCallCount = 0;
        const originalUpdate = db.update.bind(db);
        vi.spyOn(db, "update").mockImplementation(
            ((table: typeof upgradeJobs) => {
                updateCallCount++;
                if (updateCallCount === 2) {
                    return {
                        set: () => ({
                            where: () => ({
                                run: () => {
                                    throw new Error("disk full");
                                }
                            })
                        })
                    };
                }
                return originalUpdate(table);
            }) as typeof db.update
        );

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "transitive-resolve"
        });

        await worker.processNextJob();
        await worker.drain();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Failed to write job progress to database:",
            expect.any(Error)
        );

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("completed");

        consoleErrorSpy.mockRestore();
    });

    it("logs an error to console when the periodic log flush write fails, without failing the job", async () => {
        vi.useFakeTimers();
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        let resolveStreaming: (() => void) | undefined;
        commandRunner.runStreaming = vi.fn((_cmd, _args, options) => {
            options?.onStdout?.("line 1");
            return new Promise<CommandRunner.Result>(resolve => {
                resolveStreaming = () => resolve({ stdout: "", stderr: "", exitCode: 0 });
            });
        });

        let updateCallCount = 0;
        const originalUpdate = db.update.bind(db);
        vi.spyOn(db, "update").mockImplementation(
            ((table: typeof upgradeJobs) => {
                updateCallCount++;
                if (updateCallCount === 2) {
                    return {
                        set: () => ({
                            where: () => ({
                                run: () => {
                                    throw new Error("disk full");
                                }
                            })
                        })
                    };
                }
                return originalUpdate(table);
            }) as typeof db.update
        );

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        await vi.advanceTimersByTimeAsync(2000);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "Failed to flush job logs to database:",
            expect.any(Error)
        );

        resolveStreaming!();
        vi.useRealTimers();
        await worker.drain();

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("completed");

        consoleErrorSpy.mockRestore();
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vitest --config testing/vitest.config.ts --run src/api/services/JobExecution/__tests__/JobWorker.test.ts`
Expected: both new tests FAIL with something like `expect(jest.fn()).toHaveBeenCalledWith(...)` — `console.error` received zero calls, because the catch blocks are currently silent (`catch {}`).

- [ ] **Step 3: Implement the fix**

In `src/api/services/JobExecution/JobWorker.ts`, change the log-flush catch block:

```typescript
            } catch (error) {
                console.error("Failed to flush job logs to database:", error);
            }
        };
        const logFlushTimer = setInterval(flushLogs, LOG_DB_FLUSH_INTERVAL_MS);
```

And the progress-write catch block:

```typescript
                        .where(eq(upgradeJobs.id, job.id))
                        .run();
                } catch (error) {
                    console.error("Failed to write job progress to database:", error);
                }
            }
        };
```

Both catches still swallow the error (no re-throw, no status change) — only visibility changes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn vitest --config testing/vitest.config.ts --run src/api/services/JobExecution/__tests__/JobWorker.test.ts`
Expected: PASS, 38/38 tests (36 existing + 2 new).

- [ ] **Step 5: Run the full JobExecution suite and typecheck**

Run: `yarn vitest --config testing/vitest.config.ts --run src/api/services/JobExecution` and `npx tsc --noEmit -p .`
Expected: all pass, no new type errors.

- [ ] **Step 6: Commit**

```bash
git add src/api/services/JobExecution/JobWorker.ts src/api/services/JobExecution/__tests__/JobWorker.test.ts
git commit -m "fix: log DB write failures in JobWorker's log-flush and progress-write catch blocks"
```

---

## Task 2: `depco config-check` Command

**Files:**
- Create: `src/cli/commands/configCheck/abstractions/ConfigCheckCommand.ts`
- Create: `src/cli/commands/configCheck/abstractions/index.ts`
- Create: `src/cli/commands/configCheck/ConfigCheckCommand.ts`
- Create: `src/cli/commands/configCheck/feature.ts`
- Create: `src/cli/commands/configCheck/index.ts`
- Create: `src/cli/commands/configCheck/__tests__/ConfigCheckCommand.test.ts`
- Create: `src/cli/commands/configCheck/steps/ValidateConfig/abstractions/ValidateConfigStep.ts`
- Create: `src/cli/commands/configCheck/steps/ValidateConfig/abstractions/index.ts`
- Create: `src/cli/commands/configCheck/steps/ValidateConfig/ValidateConfigStep.ts`
- Create: `src/cli/commands/configCheck/steps/ValidateConfig/feature.ts`
- Create: `src/cli/commands/configCheck/steps/ValidateConfig/index.ts`
- Create: `src/cli/commands/configCheck/steps/ValidateConfig/__tests__/ValidateConfigStep.test.ts`
- Modify: `src/cli/feature.ts` — register `ConfigCheckCommandFeature`
- Modify: `src/cli/index.ts` — register `config-check` yargs command

**Interfaces:**
- Consumes: `Command.Interface` (`{ name, description, steps(), context() }`) from `src/cli/commands/abstractions/Command.ts`; `IStep`/`Step.Interface` (`{ name, description, execute(context) }`) from `src/cli/runner/abstractions/Step.ts`; `depcoConfigSchema` (a Zod object schema) from `src/shared/config/schema.ts`; `createAbstraction`, `createFeature`, `createContainer`, `registerFeatures` from `#shared/index.js`
- Produces: `ConfigCheckCommand` (abstraction + implementation), `ConfigCheckCommandFeature`, `ValidateConfigStep` (abstraction + implementation), `ValidateConfigStepFeature` — all consumed by Task 2's own `cli/index.ts` wiring only (no other task depends on these names)

### Step group A: `ValidateConfigStep`

- [ ] **Step 1: Write the failing test**

Create `src/cli/commands/configCheck/steps/ValidateConfig/__tests__/ValidateConfigStep.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createContainer } from "#shared/index.js";
import { ValidateConfigStepFeature } from "../feature.js";
import { ValidateConfigStep } from "../abstractions/ValidateConfigStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

function createTestContext(dataDirectory: string): IStepContext {
    return {
        dataDirectory,
        envFilePath: "./.env",
        options: {},
        results: new Map()
    };
}

describe("ValidateConfigStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createContainer>;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "validate-config-"));
        container = createContainer();
        ValidateConfigStepFeature.register(container);
        consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
        consoleLogSpy.mockRestore();
    });

    it("reports no config found and succeeds when depco.config.ts is missing", async () => {
        const step = container.resolve(ValidateConfigStep);
        const result = await step.execute(createTestContext(workDir));

        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith("No depco.config.ts found in current directory");
    });

    it("reports valid when depco.config.ts matches the schema", async () => {
        writeFileSync(
            join(workDir, "depco.config.ts"),
            `export default { scan: { license: { allowedRiskTiers: ["permissive"] } } };`
        );
        const step = container.resolve(ValidateConfigStep);
        const result = await step.execute(createTestContext(workDir));

        expect(result.success).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith("depco.config.ts is valid");
    });

    it("reports invalid and fails when depco.config.ts violates the schema", async () => {
        writeFileSync(
            join(workDir, "depco.config.ts"),
            `export default { scan: { license: { allowedRiskTiers: ["invalid-tier"] } } };`
        );
        const step = container.resolve(ValidateConfigStep);
        const result = await step.execute(createTestContext(workDir));

        expect(result.success).toBe(false);
        expect(consoleLogSpy).toHaveBeenCalledWith("depco.config.ts is invalid:");
        const loggedLines = consoleLogSpy.mock.calls.map(call => call[0] as string);
        expect(loggedLines.some(line => line.includes("scan.license.allowedRiskTiers.0"))).toBe(
            true
        );
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn vitest --config testing/vitest.config.ts --run src/cli/commands/configCheck/steps/ValidateConfig/__tests__/ValidateConfigStep.test.ts`
Expected: FAIL — `Cannot find module '../feature.js'` (nothing exists yet in this directory).

- [ ] **Step 3: Create the `ValidateConfigStep` abstraction**

Create `src/cli/commands/configCheck/steps/ValidateConfig/abstractions/ValidateConfigStep.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const ValidateConfigStep = createAbstraction<IStep>("Cli/ValidateConfigStep");

export namespace ValidateConfigStep {
    export type Interface = IStep;
}
```

Create `src/cli/commands/configCheck/steps/ValidateConfig/abstractions/index.ts`:

```typescript
export { ValidateConfigStep } from "./ValidateConfigStep.js";
```

- [ ] **Step 4: Implement `ValidateConfigStep`**

Create `src/cli/commands/configCheck/steps/ValidateConfig/ValidateConfigStep.ts`. This follows the exact `existsSync` + `pathToFileURL` dynamic-import pattern from `LoadConfigStep.ts`, but uses `depcoConfigSchema.safeParse` (matching the `safeParse` convention used elsewhere in the codebase, e.g. `src/shared/routing/registerRoute.ts` and `src/api/services/FileConfig/FileConfigService.ts`) so both the "invalid" and "load failed" cases can be reported without a try/catch around parsing itself:

```typescript
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ValidateConfigStep as Abstraction } from "./abstractions/ValidateConfigStep.js";
import { depcoConfigSchema } from "#shared/config/schema.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class ValidateConfigStepImpl implements Abstraction.Interface {
    public name = "validate-config";
    public description = "Validate depco.config.ts";

    public async execute(context: IStepContext): Promise<IStepResult> {
        const configPath = join(context.dataDirectory, "depco.config.ts");

        if (!existsSync(configPath)) {
            console.log("No depco.config.ts found in current directory");
            return {
                success: true,
                skipped: true,
                message: "no depco.config.ts found"
            };
        }

        let raw: unknown;
        try {
            const module = (await import(pathToFileURL(configPath).href)) as Record<
                string,
                unknown
            >;
            raw = module["default"];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.log(`Failed to load depco.config.ts: ${message}`);
            return { success: false, message: `Failed to load depco.config.ts: ${message}` };
        }

        const result = depcoConfigSchema.safeParse(raw);
        if (!result.success) {
            console.log("depco.config.ts is invalid:");
            for (const issue of result.error.issues) {
                const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
                console.log(`  ${path}: ${issue.message}`);
            }
            return { success: false, message: "depco.config.ts is invalid" };
        }

        console.log("depco.config.ts is valid");
        return { success: true, message: "depco.config.ts is valid" };
    }
}

export const ValidateConfigStep = Abstraction.createImplementation({
    implementation: ValidateConfigStepImpl,
    dependencies: []
});
```

Create `src/cli/commands/configCheck/steps/ValidateConfig/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { ValidateConfigStep } from "./ValidateConfigStep.js";

export const ValidateConfigStepFeature = createFeature({
    name: "Cli/ValidateConfigStep",
    register(container) {
        container.register(ValidateConfigStep).inSingletonScope();
    }
});
```

Create `src/cli/commands/configCheck/steps/ValidateConfig/index.ts`:

```typescript
export { ValidateConfigStep } from "./abstractions/ValidateConfigStep.js";
export { ValidateConfigStepFeature } from "./feature.js";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn vitest --config testing/vitest.config.ts --run src/cli/commands/configCheck/steps/ValidateConfig/__tests__/ValidateConfigStep.test.ts`
Expected: PASS, 3/3 tests. (The exact Zod issue path `scan.license.allowedRiskTiers.0` for an invalid `allowedRiskTiers` entry was confirmed by running `depcoConfigSchema.safeParse(...)` directly against this schema during plan research.)

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/configCheck/steps/ValidateConfig
git commit -m "feat: add ValidateConfigStep for depco config-check"
```

### Step group B: `ConfigCheckCommand`

- [ ] **Step 7: Write the failing test**

Create `src/cli/commands/configCheck/__tests__/ConfigCheckCommand.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createContainer, registerFeatures } from "#shared/index.js";
import { ConfigCheckCommandFeature } from "../feature.js";
import { ConfigCheckCommand } from "../abstractions/ConfigCheckCommand.js";

describe("ConfigCheckCommand", () => {
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        container = createContainer();
        registerFeatures(container, [ConfigCheckCommandFeature]);
    });

    it("returns 1 step", () => {
        const command = container.resolve(ConfigCheckCommand);
        const steps = command.steps();
        expect(steps).toHaveLength(1);
        expect(steps.map(step => step.name)).toEqual(["validate-config"]);
    });

    it("returns context with cwd as dataDirectory", () => {
        const command = container.resolve(ConfigCheckCommand);
        const context = command.context();
        expect(context.dataDirectory).toBe(process.cwd());
        expect(context.results).toBeInstanceOf(Map);
    });

    it("has correct name and description", () => {
        const command = container.resolve(ConfigCheckCommand);
        expect(command.name).toBe("config-check");
        expect(command.description).toBeTruthy();
    });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `yarn vitest --config testing/vitest.config.ts --run src/cli/commands/configCheck/__tests__/ConfigCheckCommand.test.ts`
Expected: FAIL — `Cannot find module '../feature.js'`.

- [ ] **Step 9: Create the `ConfigCheckCommand` abstraction**

Create `src/cli/commands/configCheck/abstractions/ConfigCheckCommand.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { Command } from "../../abstractions/Command.js";

export const ConfigCheckCommand = createAbstraction<Command.Interface>("Cli/ConfigCheckCommand");

export namespace ConfigCheckCommand {
    export type Interface = Command.Interface;
}
```

Create `src/cli/commands/configCheck/abstractions/index.ts`:

```typescript
export { ConfigCheckCommand } from "./ConfigCheckCommand.js";
```

- [ ] **Step 10: Implement `ConfigCheckCommand`**

Create `src/cli/commands/configCheck/ConfigCheckCommand.ts`:

```typescript
import { ConfigCheckCommand as Abstraction } from "./abstractions/ConfigCheckCommand.js";
import { ValidateConfigStep } from "./steps/ValidateConfig/index.js";
import type { Step } from "../../runner/abstractions/Step.js";

class ConfigCheckCommandImpl implements Abstraction.Interface {
    public name = "config-check";
    public description = "Validate depco.config.ts without running a scan";

    public constructor(private validateConfig: Step.Interface) {}

    public steps(): Step.Interface[] {
        return [this.validateConfig];
    }

    public context(): Step.Context {
        return {
            dataDirectory: process.cwd(),
            envFilePath: "./.env",
            options: {},
            results: new Map()
        };
    }
}

export const ConfigCheckCommand = Abstraction.createImplementation({
    implementation: ConfigCheckCommandImpl,
    dependencies: [ValidateConfigStep]
});
```

Create `src/cli/commands/configCheck/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { ValidateConfigStepFeature } from "./steps/ValidateConfig/index.js";
import { ConfigCheckCommand } from "./ConfigCheckCommand.js";

export const ConfigCheckCommandFeature = createFeature({
    name: "Cli/ConfigCheckCommand",
    dependencies: [ValidateConfigStepFeature],
    register(container) {
        container.register(ConfigCheckCommand).inSingletonScope();
    }
});
```

Create `src/cli/commands/configCheck/index.ts`:

```typescript
export { ConfigCheckCommand } from "./abstractions/ConfigCheckCommand.js";
export { ConfigCheckCommandFeature } from "./feature.js";
```

- [ ] **Step 11: Run the test to verify it passes**

Run: `yarn vitest --config testing/vitest.config.ts --run src/cli/commands/configCheck/__tests__/ConfigCheckCommand.test.ts`
Expected: PASS, 3/3 tests.

- [ ] **Step 12: Commit**

```bash
git add src/cli/commands/configCheck/ConfigCheckCommand.ts src/cli/commands/configCheck/feature.ts src/cli/commands/configCheck/index.ts src/cli/commands/configCheck/abstractions src/cli/commands/configCheck/__tests__
git commit -m "feat: add ConfigCheckCommand for depco config-check"
```

### Step group C: Wire into the CLI

- [ ] **Step 13: Register the feature in `src/cli/feature.ts`**

Current content:

```typescript
import { createFeature } from "#shared/index.js";
import { StepRunnerFeature } from "./runner/index.js";
import { InitCommandFeature } from "./commands/init/index.js";
import { StartCommandFeature } from "./commands/start/index.js";
import { ScanCommandFeature } from "./commands/scan/index.js";

export const CliFeature = createFeature({
    name: "Cli",
    dependencies: [StepRunnerFeature, InitCommandFeature, StartCommandFeature, ScanCommandFeature],
    register() {}
});
```

Replace with:

```typescript
import { createFeature } from "#shared/index.js";
import { StepRunnerFeature } from "./runner/index.js";
import { InitCommandFeature } from "./commands/init/index.js";
import { StartCommandFeature } from "./commands/start/index.js";
import { ScanCommandFeature } from "./commands/scan/index.js";
import { ConfigCheckCommandFeature } from "./commands/configCheck/index.js";

export const CliFeature = createFeature({
    name: "Cli",
    dependencies: [
        StepRunnerFeature,
        InitCommandFeature,
        StartCommandFeature,
        ScanCommandFeature,
        ConfigCheckCommandFeature
    ],
    register() {}
});
```

- [ ] **Step 14: Register the yargs command in `src/cli/index.ts`**

Current relevant content:

```typescript
import { createContainer, registerFeatures } from "#shared/index.js";
import { CliFeature } from "./feature.js";
import { InitCommand } from "./commands/init/index.js";
import { StartCommand } from "./commands/start/index.js";
import { ScanCommand } from "./commands/scan/index.js";
import { StepRunner } from "./runner/index.js";
```

```typescript
cli = cli.command(
    "scan",
    "Scan current directory for dependency issues",
    yargs =>
        yargs
            .option("check", {
                type: "string",
                description: "Check to run",
                default: "license",
                choices: ["license", "vulnerability", "all"]
            })
            .option("format", {
                type: "string",
                description: "Output format",
                default: "table",
                choices: ["table", "json", "csv", "sarif"]
            }),
    async argv => {
        const command = container.resolve(ScanCommand);
        await runner.run({ steps: command.steps(), context: command.context(argv) });
    }
);

cli.demandCommand(1, "Please specify a command: init, start, or scan")
```

Replace with (adding the import, the `config-check` command registration, and updating the `demandCommand` message):

```typescript
import { createContainer, registerFeatures } from "#shared/index.js";
import { CliFeature } from "./feature.js";
import { InitCommand } from "./commands/init/index.js";
import { StartCommand } from "./commands/start/index.js";
import { ScanCommand } from "./commands/scan/index.js";
import { ConfigCheckCommand } from "./commands/configCheck/index.js";
import { StepRunner } from "./runner/index.js";
```

```typescript
cli = cli.command(
    "scan",
    "Scan current directory for dependency issues",
    yargs =>
        yargs
            .option("check", {
                type: "string",
                description: "Check to run",
                default: "license",
                choices: ["license", "vulnerability", "all"]
            })
            .option("format", {
                type: "string",
                description: "Output format",
                default: "table",
                choices: ["table", "json", "csv", "sarif"]
            }),
    async argv => {
        const command = container.resolve(ScanCommand);
        await runner.run({ steps: command.steps(), context: command.context(argv) });
    }
);

cli = cli.command("config-check", "Validate depco.config.ts without running a scan", {}, async () => {
    const command = container.resolve(ConfigCheckCommand);
    await runner.run({ steps: command.steps(), context: command.context() });
});

cli.demandCommand(1, "Please specify a command: init, start, scan, or config-check")
```

(This edit will be combined with the `--output` option added to the `scan` command in Task 3 — do this edit first, then Task 3 edits the same `scan` block again.)

- [ ] **Step 15: Manual smoke test**

Run: `node --import tsx/esm src/cli/index.ts config-check` from a directory with no `depco.config.ts` (e.g. `/tmp`).
Expected output: `No depco.config.ts found in current directory` and exit code 0 (check with `echo $?`).

Run the same command from the repo root (has no `depco.config.ts` either, unless one was added) — same result. If you want to test the valid/invalid paths, temporarily create a `depco.config.ts` file with `export default { scan: { license: { allowedRiskTiers: ["permissive"] } } };` (valid) or `export default { scan: { license: { allowedRiskTiers: ["nonsense"] } } };` (invalid), run the command, and delete the file afterward.

- [ ] **Step 16: Typecheck and full test run**

Run: `npx tsc --noEmit -p .` and `yarn vitest --config testing/vitest.config.ts --run src/cli`
Expected: no new type errors, all CLI tests pass.

- [ ] **Step 17: Commit**

```bash
git add src/cli/feature.ts src/cli/index.ts
git commit -m "feat: register depco config-check command"
```

---

## Task 3: `--output` Flag for Scan Command

**Files:**
- Modify: `src/cli/commands/scan/steps/RenderOutput/RenderOutputStep.ts`
- Modify: `src/cli/commands/scan/steps/RenderOutput/__tests__/RenderOutputStep.test.ts`
- Modify: `src/cli/commands/scan/ScanCommand.ts` — forward `argv.output` into `context.options`
- Modify: `src/cli/commands/scan/__tests__/ScanCommand.test.ts`
- Modify: `src/cli/index.ts` — add `--output` yargs option to the `scan` command

**Interfaces:**
- Consumes: `IStepContext` (`{ dataDirectory, envFilePath, options: Record<string, unknown>, results: Map }`) from `src/cli/runner/abstractions/Step.ts`; `OutputFormatterFactory.Interface.create({ format }): { format(output: IScanOutput): string }` from `src/cli/commands/scan/formatters/abstractions/OutputFormatterFactory.ts` (unchanged)
- Produces: no new exported names — `context.options["output"]` becomes a recognized (optional) key that `RenderOutputStep` reads

Note: the spec's "Changes" section only lists `src/cli/index.ts` and `RenderOutputStep.ts`, but `ScanCommand.context(argv)` currently whitelists which `argv` keys are copied into `context.options` (only `check` and `format` today) — without also editing `ScanCommand.ts`, a `--output` flag passed on the CLI would never reach the step. This task adds that forwarding so the feature actually works end to end.

This task has been verified end-to-end: the `RenderOutputStep.ts` change and its three new tests below were applied to the real repo, run with `yarn vitest --config testing/vitest.config.ts --run src/cli/commands/scan/steps/RenderOutput/__tests__/RenderOutputStep.test.ts`, and passed (13/13 tests), then reverted to hand off via this plan. `npx tsc --noEmit -p .` also reported no new errors.

### Step group A: `RenderOutputStep`

- [ ] **Step 1: Write the failing tests**

In `src/cli/commands/scan/steps/RenderOutput/__tests__/RenderOutputStep.test.ts`, add the new imports at the top:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createContainer, registerFeatures } from "#shared/index.js";
import { RenderOutputStep } from "../abstractions/RenderOutputStep.js";
import { RenderOutputStepFeature } from "../feature.js";
import { OutputFormatterFeature } from "../../../formatters/feature.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";
```

Then, inside the `describe("RenderOutputStep", ...)` block, insert this new nested `describe` immediately before the existing `it("does not set exit code when there are no violations and no vulnerabilities", ...)` test (it can reuse the existing `createTestContext`, `step`, and `consoleSpy` from the outer scope):

```typescript
    describe("with --output", () => {
        let workDir: string;

        beforeEach(() => {
            workDir = mkdtempSync(join(tmpdir(), "render-output-"));
        });

        afterEach(() => {
            rmSync(workDir, { recursive: true, force: true });
        });

        it("writes formatted output to a file and prints a summary line", async () => {
            const outputPath = join(workDir, "results.json");
            const context = createTestContext({ output: outputPath });

            const result = await step.execute(context);

            expect(result.success).toBe(true);
            const fileContent = JSON.parse(readFileSync(outputPath, "utf-8"));
            expect(fileContent.findings.license).toHaveLength(1);
            expect(fileContent.findings.vulnerability).toHaveLength(1);

            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy.mock.calls[0][0]).toBe(`Wrote 2 findings to ${outputPath}`);
        });

        it("overwrites an existing file at the output path", async () => {
            const outputPath = join(workDir, "results.json");
            writeFileSync(outputPath, "stale content");
            const context = createTestContext({ output: outputPath });

            await step.execute(context);

            const fileContent = readFileSync(outputPath, "utf-8");
            expect(fileContent).not.toContain("stale content");
        });

        it("throws when the output path's parent directory does not exist", async () => {
            const outputPath = join(workDir, "missing-dir", "results.json");
            const context = createTestContext({ output: outputPath });

            await expect(step.execute(context)).rejects.toThrow();
        });
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vitest --config testing/vitest.config.ts --run src/cli/commands/scan/steps/RenderOutput/__tests__/RenderOutputStep.test.ts`
Expected: FAIL — the "writes formatted output to a file" test fails because `readFileSync(outputPath, ...)` throws (`ENOENT`, no file was written); the "overwrites" test fails the same way; the "throws when parent directory does not exist" test fails because `step.execute` currently never throws for this input (it just logs to console).

- [ ] **Step 3: Implement the `--output` handling in `RenderOutputStep.ts`**

Add the `writeFileSync` import at the top of `src/cli/commands/scan/steps/RenderOutput/RenderOutputStep.ts`:

```typescript
import { writeFileSync } from "node:fs";
import { RenderOutputStep as Abstraction } from "./abstractions/RenderOutputStep.js";
```

Replace the single `console.log(formatter.format(output));` line inside `execute` with:

```typescript
        const formatted = formatter.format(output);
        const outputPath = context.options["output"] as string | undefined;

        if (outputPath) {
            writeFileSync(outputPath, formatted);
            console.log(`Wrote ${output.summary.total} findings to ${outputPath}`);
        } else {
            console.log(formatted);
        }
```

`writeFileSync` throwing (missing parent directory, path is a directory) propagates out of `execute` uncaught — the `StepRunner` (in `src/cli/runner/StepRunner.ts`) already catches step-execution errors generically and reports them, matching the "let it throw" edge-case behavior from the spec.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn vitest --config testing/vitest.config.ts --run src/cli/commands/scan/steps/RenderOutput/__tests__/RenderOutputStep.test.ts`
Expected: PASS, 13/13 tests (10 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/scan/steps/RenderOutput/RenderOutputStep.ts src/cli/commands/scan/steps/RenderOutput/__tests__/RenderOutputStep.test.ts
git commit -m "feat: write scan output to a file when --output is set"
```

### Step group B: Forward `--output` through `ScanCommand` and yargs

- [ ] **Step 6: Write the failing test**

In `src/cli/commands/scan/__tests__/ScanCommand.test.ts`, add this test after the existing `"forwards argv.format into context.options"` test:

```typescript
    it("forwards argv.output into context.options", () => {
        const command = container.resolve(ScanCommand);
        const context = command.context({ output: "results.json" });
        expect(context.options["output"]).toBe("results.json");
    });

    it("leaves options.output undefined when no --output is given", () => {
        const command = container.resolve(ScanCommand);
        const context = command.context();
        expect(context.options["output"]).toBeUndefined();
    });
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `yarn vitest --config testing/vitest.config.ts --run src/cli/commands/scan/__tests__/ScanCommand.test.ts`
Expected: FAIL — `context.options["output"]` is `undefined` even when `"results.json"` was passed in, because `ScanCommand.context` doesn't forward it yet (the first new test fails; the second already passes trivially).

- [ ] **Step 8: Update `ScanCommand.ts` to forward `output`**

In `src/cli/commands/scan/ScanCommand.ts`, change:

```typescript
    public context(argv?: Record<string, unknown>): Step.Context {
        return {
            dataDirectory: process.cwd(),
            envFilePath: "./.env",
            options: { check: argv?.["check"] ?? "license", format: argv?.["format"] ?? "table" },
            results: new Map()
        };
    }
```

to:

```typescript
    public context(argv?: Record<string, unknown>): Step.Context {
        return {
            dataDirectory: process.cwd(),
            envFilePath: "./.env",
            options: {
                check: argv?.["check"] ?? "license",
                format: argv?.["format"] ?? "table",
                output: argv?.["output"] as string | undefined
            },
            results: new Map()
        };
    }
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `yarn vitest --config testing/vitest.config.ts --run src/cli/commands/scan/__tests__/ScanCommand.test.ts`
Expected: PASS, 9/9 tests (7 existing + 2 new).

- [ ] **Step 10: Add the `--output` yargs option in `src/cli/index.ts`**

Find the `scan` command registration (already modified by Task 2, Step 14, to add `config-check` below it — this edit targets the `scan` block itself):

```typescript
cli = cli.command(
    "scan",
    "Scan current directory for dependency issues",
    yargs =>
        yargs
            .option("check", {
                type: "string",
                description: "Check to run",
                default: "license",
                choices: ["license", "vulnerability", "all"]
            })
            .option("format", {
                type: "string",
                description: "Output format",
                default: "table",
                choices: ["table", "json", "csv", "sarif"]
            }),
    async argv => {
        const command = container.resolve(ScanCommand);
        await runner.run({ steps: command.steps(), context: command.context(argv) });
    }
);
```

Replace with:

```typescript
cli = cli.command(
    "scan",
    "Scan current directory for dependency issues",
    yargs =>
        yargs
            .option("check", {
                type: "string",
                description: "Check to run",
                default: "license",
                choices: ["license", "vulnerability", "all"]
            })
            .option("format", {
                type: "string",
                description: "Output format",
                default: "table",
                choices: ["table", "json", "csv", "sarif"]
            })
            .option("output", {
                type: "string",
                description: "Write output to file instead of stdout"
            }),
    async argv => {
        const command = container.resolve(ScanCommand);
        await runner.run({ steps: command.steps(), context: command.context(argv) });
    }
);
```

- [ ] **Step 11: Manual smoke test**

From a project directory with a lockfile (or the repo root), run:
`node --import tsx/esm src/cli/index.ts scan --format json --output /tmp/depco-results.json`
Expected: stdout prints `Wrote N findings to /tmp/depco-results.json` (no raw JSON dumped to stdout), and `/tmp/depco-results.json` contains the JSON report. Then run without `--output`:
`node --import tsx/esm src/cli/index.ts scan --format json`
Expected: raw JSON printed to stdout as before (unchanged default behavior).

- [ ] **Step 12: Typecheck and full test run**

Run: `npx tsc --noEmit -p .` and `yarn vitest --config testing/vitest.config.ts --run src/cli/commands/scan`
Expected: no new type errors, all scan-command tests pass.

- [ ] **Step 13: Commit**

```bash
git add src/cli/commands/scan/ScanCommand.ts src/cli/commands/scan/__tests__/ScanCommand.test.ts src/cli/index.ts
git commit -m "feat: add --output flag to depco scan"
```

---

## Final Verification

- [ ] **Run the full verification suite**

Run: `yarn full`
Expected: lint, format check, typecheck, and the full test suite all pass with no regressions.

- [ ] **Manual end-to-end pass**

1. `depco config-check` in a directory with no config → prints "No depco.config.ts found in current directory", exit 0.
2. `depco config-check` with a valid `depco.config.ts` → prints "depco.config.ts is valid", exit 0.
3. `depco config-check` with an invalid `depco.config.ts` → prints "depco.config.ts is invalid:" plus per-field messages, exit 1.
4. `depco scan --format json --output results.json` → writes `results.json`, prints a "Wrote N findings..." summary line, exit code still reflects violations/threshold as before.
5. `depco scan` with no `--output` → stdout output unchanged from before this plan.
