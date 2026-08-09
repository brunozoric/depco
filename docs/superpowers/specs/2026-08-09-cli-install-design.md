# CLI Install Feature Design

## Overview

Restructure `src/cli/` into a yargs-based command system with full DI (abstractions, implementations, features) following the same patterns as API services and UI infrastructure. Commands are step orchestrators — each command defines a list of steps, and the StepRunner executes them. Two commands: `depco init` (setup wizard) and `depco start` (run server).

## Directory Structure

```
src/cli/
  index.ts                                  — #!/usr/bin/env node, yargs setup, registers commands
  commands/
    abstractions/
      Command.ts                            — Command = createAbstraction<ICommand>("Cli/Command") — base abstraction
      index.ts
    init/
      abstractions/
        InitCommand.ts                      — createAbstraction<Command.Interface>("Cli/InitCommand")
        index.ts
      InitCommand.ts                        — InitCommandImpl + createImplementation (resolves + orders its steps)
      feature.ts                            — InitCommandFeature (depends on all init step features)
      index.ts                              — abstraction + feature exports
      steps/
        EnsureDataDirectory/
          abstractions/
            EnsureDataDirectoryStep.ts      — createAbstraction<Step.Interface>("Cli/EnsureDataDirectoryStep")
            index.ts
          EnsureDataDirectoryStep.ts        — EnsureDataDirectoryStepImpl + createImplementation
          feature.ts                        — EnsureDataDirectoryStepFeature
          index.ts                          — abstraction + feature exports
        RunMigrations/
          abstractions/
            RunMigrationsStep.ts
            index.ts
          RunMigrationsStep.ts
          feature.ts
          index.ts
        GenerateEncryptionKey/
          abstractions/
            GenerateEncryptionKeyStep.ts
            index.ts
          GenerateEncryptionKeyStep.ts
          feature.ts
          index.ts
        SelectPort/
          abstractions/
            SelectPortStep.ts
            index.ts
          SelectPortStep.ts
          feature.ts
          index.ts
        CreateAdminUser/
          abstractions/
            CreateAdminUserStep.ts
            index.ts
          CreateAdminUserStep.ts
          feature.ts
          index.ts
        WriteEnvFile/
          abstractions/
            WriteEnvFileStep.ts
            index.ts
          WriteEnvFileStep.ts
          feature.ts
          index.ts
        PrintNextSteps/
          abstractions/
            PrintNextStepsStep.ts
            index.ts
          PrintNextStepsStep.ts
          feature.ts
          index.ts
    start/
      abstractions/
        StartCommand.ts                     — createAbstraction<Command.Interface>("Cli/StartCommand")
        index.ts
      StartCommand.ts                       — StartCommandImpl + createImplementation
      feature.ts                            — StartCommandFeature
      index.ts
      steps/
        ValidateEnvironment/
          abstractions/
            ValidateEnvironmentStep.ts
            index.ts
          ValidateEnvironmentStep.ts
          feature.ts
          index.ts
        StartServer/
          abstractions/
            StartServerStep.ts
            index.ts
          StartServerStep.ts                — imports startServer() from #api/server.js
          feature.ts
          index.ts
  runner/
    abstractions/
      Step.ts                               — Step = createAbstraction<IStep>("Cli/Step") — base abstraction
      StepRunner.ts                         — StepRunner = createAbstraction<IStepRunner>("Cli/StepRunner")
      index.ts
    StepRunner.ts                           — StepRunnerImpl + createImplementation
    feature.ts                              — StepRunnerFeature
    index.ts                                — exports abstractions + feature
  feature.ts                                — CliFeature compositor (registers runner + all command features)
```

## Key Abstractions

### Command (base abstraction)

```typescript
// src/cli/commands/abstractions/Command.ts
interface ICommand {
    name: string;
    description: string;
    steps(): Step.Interface[];
    context(): IStepContext;
}

const Command = createAbstraction<ICommand>("Cli/Command");
```

Each command is a step orchestrator. It defines which steps run and in what order. The yargs handler resolves the command from the container and passes it to StepRunner:

```typescript
// yargs handler for any command
const command = container.resolve(InitCommand);
const runner = container.resolve(StepRunner);
await runner.run(command.steps(), command.context());
```

Concrete commands get their own abstraction:

```typescript
// init/abstractions/InitCommand.ts
const InitCommand = createAbstraction<Command.Interface>("Cli/InitCommand");
```

### Step (base abstraction)

```typescript
// src/cli/runner/abstractions/Step.ts
interface IStep {
    name: string;
    description: string;
    execute(context: IStepContext): Promise<IStepResult>;
    rollback?(context: IStepContext): Promise<void>;
}

const Step = createAbstraction<IStep>("Cli/Step");
```

All concrete steps extend `Step.Interface`. Each gets its own abstraction:

```typescript
// e.g., EnsureDataDirectory/abstractions/EnsureDataDirectoryStep.ts
const EnsureDataDirectoryStep = createAbstraction<Step.Interface>("Cli/EnsureDataDirectoryStep");
```

### StepContext

```typescript
interface IStepContext {
    dataDirectory: string;
    envFilePath: string;
    options: Record<string, unknown>;
    results: Map<string, unknown>;
}
```

Shared state passed through steps. Steps store results for later steps via `results` map (e.g., GenerateEncryptionKey stores the key, WriteEnvFile reads it).

### StepResult

```typescript
interface IStepResult {
    success: boolean;
    skipped?: boolean;
    message?: string;
}
```

### StepRunner

```typescript
interface IStepRunner {
    run(steps: Step.Interface[], context: IStepContext): Promise<void>;
}

const StepRunner = createAbstraction<IStepRunner>("Cli/StepRunner");
```

StepRunnerImpl handles:
- Sequential execution of steps
- Progress display: `[N/M] Step description...`
- On failure: calls `rollback()` in reverse order on completed steps
- Colored console output (green checkmark on success, red X on failure, yellow skip)

## Command Implementations

### InitCommand

InitCommandImpl receives all 7 step abstractions via DI constructor injection. `steps()` returns them in order. `context()` builds the default IStepContext.

```typescript
class InitCommandImpl implements Command.Interface {
    name = "init";
    description = "Initialize depco — create database, admin user, and environment config";

    constructor(
        private ensureDataDirectory: Step.Interface,
        private runMigrations: Step.Interface,
        private generateEncryptionKey: Step.Interface,
        private selectPort: Step.Interface,
        private createAdminUser: Step.Interface,
        private writeEnvFile: Step.Interface,
        private printNextSteps: Step.Interface
    ) {}

    steps(): Step.Interface[] {
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

    context(): IStepContext {
        return {
            dataDirectory: "./data",
            envFilePath: "./.env",
            options: {},
            results: new Map()
        };
    }
}

const InitCommand = Abstraction.createImplementation({
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

### StartCommand

StartCommandImpl has 2 steps: ValidateEnvironment (checks .env exists, DB accessible) and StartServer (runs Fastify).

## Init Steps Detail

| # | Step | Description | Rollback |
|---|------|-------------|----------|
| 1 | EnsureDataDirectory | Creates `./data/` if missing | Remove dir if empty |
| 2 | RunMigrations | Runs Drizzle migrations on SQLite DB | No (forward-only) |
| 3 | GenerateEncryptionKey | Generates random 32-byte hex key, stores in context | No |
| 4 | SelectPort | Prompts for port (default 3000), stores in context | No |
| 5 | CreateAdminUser | Prompts email/name/password, inserts into DB | No |
| 6 | WriteEnvFile | Writes `.env` with ENCRYPTION_KEY, PORT, DB_PATH | Remove .env |
| 7 | PrintNextSteps | Prints "run `depco start`" instructions | No |

### Step result flow via context.results

- GenerateEncryptionKey stores: `results.set("encryptionKey", key)`
- SelectPort stores: `results.set("port", port)`
- WriteEnvFile reads: `results.get("encryptionKey")`, `results.get("port")`

## Start Steps Detail

| # | Step | Description | Rollback |
|---|------|-------------|----------|
| 1 | ValidateEnvironment | Checks .env exists, ENCRYPTION_KEY set, DB file accessible | No |
| 2 | StartServer | Imports startServer() from #api/server.js, runs it | No |

## Feature Composition

```typescript
// cli/feature.ts — top-level compositor
const CliFeature = createFeature({
    name: "Cli",
    dependencies: [
        StepRunnerFeature,
        InitCommandFeature,    // pulls in all init step features
        StartCommandFeature,   // pulls in start step features
    ],
    register() {}
});

// commands/init/feature.ts
const InitCommandFeature = createFeature({
    name: "Cli/InitCommand",
    dependencies: [
        StepRunnerFeature,
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

## Container Lifecycle

```typescript
// cli/index.ts
const container = createContainer();
CliFeature.register(container);

// yargs dispatches to command handler, which does:
const command = container.resolve(InitCommand);  // or StartCommand
const runner = container.resolve(StepRunner);
await runner.run(command.steps(), command.context());
```

## CLI Entry Point

```typescript
// cli/index.ts
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
    await runner.run(command.steps(), command.context());
});

cli = cli.command("start", "Start the depco server", {}, async () => {
    const command = container.resolve(StartCommand);
    await runner.run(command.steps(), command.context());
});

cli.help().parse();
```

## Yargs Dependency

Add `yargs` + `@types/yargs` to package.json dependencies.

## Server Refactor

Extract `startServer()` function from current `src/api/server.ts` top-level code. Current server.ts runs on import — wrap in exported function that StartServerStep can call.

## Testing

Each step independently testable:
- Mock dependencies via DI
- Test execute() returns correct StepResult
- Test rollback() where applicable
- Test context.results flow between steps

Command tests:
- steps() returns correct step instances in correct order
- context() returns valid IStepContext

StepRunner tests:
- Executes steps in order
- Calls rollback on failure (reverse order)
- Skips rollback for steps without rollback
- Reports progress

Integration test for full init flow:
- Temp directory for data/env
- Verify DB created with migrations
- Verify .env written with correct values
- Verify admin user exists in DB

## Migration from Current CLI

- Current `src/cli/init.ts` — functionality absorbed into steps (CreateAdminUser, EnsureDataDirectory, RunMigrations)
- Current `src/cli/index.ts` — replaced by yargs-based entry
- `package.json` bin entry stays `./dist/cli/index.js`
- Current `src/api/server.ts` — top-level code wrapped in `startServer()` export
