# Install Job — Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `installFlags()` and `installCommand()` to PM drivers, create `InstallJobExecutor`, add API routes for install and install-options, add `install:complete` WS event, add `hasNodeModules` to project API responses.

**Architecture:** PM drivers own flag definitions and validation. `InstallJobExecutor` validates flags against driver, checks PM binary exists, runs install via `commandRunner.runStreaming`. New routes: `POST /api/projects/:id/install` and `GET /api/install-options/:packageManager`. `hasNodeModules` computed via `existsSync` on each project fetch.

**Tech Stack:** TypeScript, Zod, Fastify, Vitest

## Global Constraints

- oxfmt formatting (4-space indent for .ts files)
- oxlint linting
- Bun runtime
- Executors are plain classes created by registry — not individually DI-wired
- All shared types under `src/shared/`
- Run `bun run build` after each task to verify compilation

---

### Task 1: Add IInstallFlagDefinition type and driver interface methods

**Files:**

- Create: `src/shared/install/types.ts`
- Create: `src/shared/install/index.ts`
- Modify: `src/api/services/packageManagers/abstractions/PackageManagerDriver.ts`

**Interfaces:**

- Consumes: nothing
- Produces:
  - `IInstallFlagDefinition` — `{ flag: string; label: string; description: string; exclusive?: string }`
  - `installFlags(): IInstallFlagDefinition[]` on `IPackageManagerDriver`
  - `installCommand(flags: string[]): ICommandSpec` on `IPackageManagerDriver`

- [ ] **Step 1: Create shared install types**

Create `src/shared/install/types.ts`:

```ts
export interface IInstallFlagDefinition {
  flag: string;
  label: string;
  description: string;
  exclusive?: string;
}
```

Create `src/shared/install/index.ts`:

```ts
export { type IInstallFlagDefinition } from "./types.js";
```

- [ ] **Step 2: Add methods to IPackageManagerDriver**

In `src/api/services/packageManagers/abstractions/PackageManagerDriver.ts`:

1. Add import:

```ts
import type { IInstallFlagDefinition } from "#shared/install/types.js";
```

2. Add to `IPackageManagerDriver` interface:

```ts
    installFlags(): IInstallFlagDefinition[];
    installCommand(flags: string[]): ICommandSpec;
```

3. Add to namespace:

```ts
export type InstallFlagDefinition = IInstallFlagDefinition;
```

- [ ] **Step 3: Build to verify**

Run: `bun run build`
Expected: FAIL — all 4 drivers don't implement the new methods yet. That's expected.

- [ ] **Step 4: Commit**

```bash
git add src/shared/install/ src/api/services/packageManagers/abstractions/PackageManagerDriver.ts
git commit -m "feat: add IInstallFlagDefinition type and install methods to PM driver interface"
```

---

### Task 2: Implement installFlags/installCommand on all 4 drivers

**Files:**

- Modify: `src/api/services/packageManagers/NpmDriver.ts`
- Modify: `src/api/services/packageManagers/YarnDriver.ts`
- Modify: `src/api/services/packageManagers/PnpmDriver.ts`
- Modify: `src/api/services/packageManagers/BunDriver.ts`
- Test: `src/api/services/packageManagers/__tests__/NpmDriver.test.ts`
- Test: `src/api/services/packageManagers/__tests__/YarnDriver.test.ts`
- Test: `src/api/services/packageManagers/__tests__/PnpmDriver.test.ts`
- Test: `src/api/services/packageManagers/__tests__/BunDriver.test.ts`

**Interfaces:**

- Consumes: `IInstallFlagDefinition`, `ICommandSpec`
- Produces: `installFlags()` and `installCommand(flags)` on each driver

- [ ] **Step 1: Write failing tests for all 4 drivers**

Add to each driver's existing test file. Example for `NpmDriver.test.ts`:

```ts
describe("installFlags", () => {
  it("should return npm install flags", () => {
    const driver = createDriver();
    const flags = driver.installFlags();
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.every(f => f.flag.startsWith("--"))).toBe(true);
    expect(flags.map(f => f.flag)).toContain("--force");
  });
});

describe("installCommand", () => {
  it("should return npm install with no flags", () => {
    const driver = createDriver();
    const cmd = driver.installCommand([]);
    expect(cmd.command).toBe("npm");
    expect(cmd.args).toEqual(["install"]);
  });

  it("should return npm install with flags", () => {
    const driver = createDriver();
    const cmd = driver.installCommand(["--force", "--ignore-scripts"]);
    expect(cmd.command).toBe("npm");
    expect(cmd.args).toEqual(["install", "--force", "--ignore-scripts"]);
  });
});
```

Repeat pattern for YarnDriver (command: `yarn`), PnpmDriver (command: `pnpm`), BunDriver (command: `bun`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- --reporter=verbose src/api/services/packageManagers/__tests__/`
Expected: FAIL — methods not implemented

- [ ] **Step 3: Implement NpmDriver**

In `src/api/services/packageManagers/NpmDriver.ts`, add import and methods:

```ts
import type { IInstallFlagDefinition } from "#shared/install/types.js";
```

```ts
    public installFlags(): IInstallFlagDefinition[] {
        return [
            { flag: "--omit=dev", label: "Omit dev", description: "Skip devDependencies" },
            { flag: "--force", label: "Force", description: "Force reinstall all packages" },
            { flag: "--legacy-peer-deps", label: "Legacy peers", description: "Ignore peer dependency conflicts" },
            { flag: "--ignore-scripts", label: "Ignore scripts", description: "Skip lifecycle scripts" }
        ];
    }

    public installCommand(flags: string[]): Abstraction.CommandSpec {
        return { command: "npm", args: ["install", ...flags] };
    }
```

- [ ] **Step 4: Implement YarnDriver**

In `src/api/services/packageManagers/YarnDriver.ts`:

```ts
import type { IInstallFlagDefinition } from "#shared/install/types.js";
```

```ts
    public installFlags(): IInstallFlagDefinition[] {
        return [
            { flag: "--immutable", label: "Immutable", description: "Fail if lockfile would change" },
            { flag: "--production", label: "Production", description: "Skip devDependencies" },
            { flag: "--force", label: "Force", description: "Refetch all packages" },
            { flag: "--ignore-scripts", label: "Ignore scripts", description: "Skip lifecycle scripts" }
        ];
    }

    public installCommand(flags: string[]): Abstraction.CommandSpec {
        return { command: "yarn", args: ["install", ...flags] };
    }
```

- [ ] **Step 5: Implement PnpmDriver**

In `src/api/services/packageManagers/PnpmDriver.ts`:

```ts
import type { IInstallFlagDefinition } from "#shared/install/types.js";
```

```ts
    public installFlags(): IInstallFlagDefinition[] {
        return [
            { flag: "--frozen-lockfile", label: "Frozen lockfile", description: "Fail if lockfile is outdated" },
            { flag: "--prod", label: "Production", description: "Skip devDependencies" },
            { flag: "--force", label: "Force", description: "Force reinstall all packages" },
            { flag: "--ignore-scripts", label: "Ignore scripts", description: "Skip lifecycle scripts" }
        ];
    }

    public installCommand(flags: string[]): Abstraction.CommandSpec {
        return { command: "pnpm", args: ["install", ...flags] };
    }
```

- [ ] **Step 6: Implement BunDriver**

In `src/api/services/packageManagers/BunDriver.ts`:

```ts
import type { IInstallFlagDefinition } from "#shared/install/types.js";
```

```ts
    public installFlags(): IInstallFlagDefinition[] {
        return [
            { flag: "--frozen-lockfile", label: "Frozen lockfile", description: "Fail if lockfile is outdated" },
            { flag: "--production", label: "Production", description: "Skip devDependencies" },
            { flag: "--force", label: "Force", description: "Force reinstall all packages" },
            { flag: "--dry-run", label: "Dry run", description: "Preview install without making changes" },
            { flag: "--ignore-scripts", label: "Ignore scripts", description: "Skip lifecycle scripts" }
        ];
    }

    public installCommand(flags: string[]): Abstraction.CommandSpec {
        return { command: "bun", args: ["install", ...flags] };
    }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun run test -- --reporter=verbose src/api/services/packageManagers/__tests__/`
Expected: PASS

- [ ] **Step 8: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 9: Commit**

```bash
git add src/api/services/packageManagers/NpmDriver.ts \
  src/api/services/packageManagers/YarnDriver.ts \
  src/api/services/packageManagers/PnpmDriver.ts \
  src/api/services/packageManagers/BunDriver.ts \
  src/api/services/packageManagers/__tests__/
git commit -m "feat: implement installFlags and installCommand on all 4 PM drivers"
```

---

### Task 3: Add `install:complete` WS event type

**Files:**

- Modify: `src/shared/websocket/types.ts`

**Interfaces:**

- Consumes: `WSEventMap`
- Produces: `WSInstallComplete` interface, `"install:complete"` event in `WSEventMap`

- [ ] **Step 1: Add event type**

In `src/shared/websocket/types.ts`, add interface and event:

```ts
export interface WSInstallComplete {
  projectId: string;
}
```

Add to `WSEventMap`:

```ts
    "install:complete": WSInstallComplete;
```

- [ ] **Step 2: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 3: Commit**

```bash
git add src/shared/websocket/types.ts
git commit -m "feat: add install:complete WebSocket event type"
```

---

### Task 4: InstallJobExecutor

**Files:**

- Create: `src/api/services/jobExecutors/InstallJobExecutor.ts`
- Create: `src/api/services/jobExecutors/__tests__/InstallJobExecutor.test.ts`
- Modify: `src/api/services/jobExecutors/JobExecutorRegistry.ts`

**Interfaces:**

- Consumes: `JobExecutor.Interface`, `PackageManagerDriverRegistry.Interface`, `CommandRunner.Interface`, `WebSocketBroadcaster.Interface`
- Produces: `InstallJobExecutor` class with type `"install"`

- [ ] **Step 1: Write failing test**

Create `src/api/services/jobExecutors/__tests__/InstallJobExecutor.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InstallJobExecutor } from "../InstallJobExecutor.js";

function createMockDriver() {
  return {
    id: "npm",
    installFlags: vi.fn().mockReturnValue([
      { flag: "--force", label: "Force", description: "Force reinstall" },
      { flag: "--ignore-scripts", label: "Ignore scripts", description: "Skip scripts" }
    ]),
    installCommand: vi.fn().mockReturnValue({ command: "npm", args: ["install", "--force"] })
  };
}

function createMockRegistry(driver = createMockDriver()) {
  return { getDriver: vi.fn().mockReturnValue(driver) };
}

function createMockCommandRunner() {
  return {
    run: vi.fn().mockResolvedValue({ stdout: "1.0.0", stderr: "" }),
    runStreaming: vi.fn().mockResolvedValue(undefined)
  };
}

function createMockBroadcaster() {
  return { broadcast: vi.fn() };
}

function createContext(packagesJson: string = '{"flags":["--force"]}') {
  return {
    jobId: "job-1",
    projectId: "project-1",
    projectPath: "/tmp/test-project",
    packageManager: "npm",
    packagesJson,
    appendLog: vi.fn(),
    signal: new AbortController().signal
  };
}

describe("InstallJobExecutor", () => {
  it("should have type 'install'", () => {
    const executor = new InstallJobExecutor(
      createMockRegistry() as any,
      createMockCommandRunner() as any,
      createMockBroadcaster() as any
    );
    expect(executor.type).toBe("install");
  });

  it("should validate flags against driver's allowed flags", async () => {
    const executor = new InstallJobExecutor(
      createMockRegistry() as any,
      createMockCommandRunner() as any,
      createMockBroadcaster() as any
    );
    const context = createContext('{"flags":["--malicious-flag"]}');

    await expect(executor.execute(context)).rejects.toThrow();
  });

  it("should check PM binary exists before running install", async () => {
    const commandRunner = createMockCommandRunner();
    const executor = new InstallJobExecutor(
      createMockRegistry() as any,
      commandRunner as any,
      createMockBroadcaster() as any
    );

    await executor.execute(createContext());

    // First run call should be version check
    expect(commandRunner.run).toHaveBeenCalledWith(
      "npm",
      ["--version"],
      expect.objectContaining({ cwd: "/tmp/test-project" })
    );
  });

  it("should fail with clear error when PM binary is missing", async () => {
    const commandRunner = createMockCommandRunner();
    commandRunner.run.mockRejectedValue(new Error("ENOENT"));

    const executor = new InstallJobExecutor(
      createMockRegistry() as any,
      commandRunner as any,
      createMockBroadcaster() as any
    );

    await expect(executor.execute(createContext())).rejects.toThrow(/not installed/i);
  });

  it("should run install command with validated flags", async () => {
    const commandRunner = createMockCommandRunner();
    const driver = createMockDriver();
    const executor = new InstallJobExecutor(
      createMockRegistry(driver) as any,
      commandRunner as any,
      createMockBroadcaster() as any
    );

    await executor.execute(createContext('{"flags":["--force"]}'));

    expect(driver.installCommand).toHaveBeenCalledWith(["--force"]);
    expect(commandRunner.runStreaming).toHaveBeenCalled();
  });

  it("should broadcast install:complete on success", async () => {
    const broadcaster = createMockBroadcaster();
    const executor = new InstallJobExecutor(
      createMockRegistry() as any,
      createMockCommandRunner() as any,
      broadcaster as any
    );

    await executor.execute(createContext());

    expect(broadcaster.broadcast).toHaveBeenCalledWith("install:complete", {
      projectId: "project-1"
    });
  });

  it("should accept empty flags array for plain install", async () => {
    const driver = createMockDriver();
    const executor = new InstallJobExecutor(
      createMockRegistry(driver) as any,
      createMockCommandRunner() as any,
      createMockBroadcaster() as any
    );

    await executor.execute(createContext('{"flags":[]}'));
    expect(driver.installCommand).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --reporter=verbose src/api/services/jobExecutors/__tests__/InstallJobExecutor.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement InstallJobExecutor**

Create `src/api/services/jobExecutors/InstallJobExecutor.ts`:

```ts
import { z } from "zod";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import type { PackageManagerDriverRegistry } from "../packageManagers/abstractions/PackageManagerDriverRegistry.js";
import type { CommandRunner } from "../abstractions/CommandRunner.js";
import type { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";

export class InstallJobExecutor implements JobExecutor.Interface {
  public readonly type = "install";

  public constructor(
    private readonly driverRegistry: PackageManagerDriverRegistry.Interface,
    private readonly commandRunner: CommandRunner.Interface,
    private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface
  ) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    const driver = this.driverRegistry.getDriver(context.packageManager);
    const allowedFlags = driver.installFlags().map(f => f.flag);

    const schema = z.object({
      flags: z
        .array(allowedFlags.length > 0 ? z.enum(allowedFlags as [string, ...string[]]) : z.never())
        .default([])
    });

    const { flags } = schema.parse(JSON.parse(context.packagesJson ?? "{}"));

    try {
      await this.commandRunner.run(context.packageManager, ["--version"], {
        cwd: context.projectPath
      });
    } catch {
      throw new Error(
        `Package manager "${context.packageManager}" is not installed. Install it first.`
      );
    }

    const { command, args } = driver.installCommand(flags);
    await this.commandRunner.runStreaming(command, args, {
      cwd: context.projectPath,
      onStdout: context.appendLog,
      onStderr: context.appendLog,
      signal: context.signal
    });

    this.webSocketBroadcaster.broadcast("install:complete", {
      projectId: context.projectId
    });
  }
}
```

- [ ] **Step 4: Register in JobExecutorRegistry**

In `src/api/services/jobExecutors/JobExecutorRegistry.ts`:

1. Add import:

```ts
import { InstallJobExecutor } from "./InstallJobExecutor.js";
```

2. Add to `all` array in constructor:

```ts
            new InstallJobExecutor(
                this.driverRegistry,
                commandRunner,
                webSocketBroadcaster
            ),
```

Wait — `JobExecutorRegistryImpl` constructor takes flat params, not `this.xxx`. Look at existing pattern. The registry constructor receives dependencies as constructor args and passes them to executors. Add `PackageManagerDriverRegistry` as a dependency.

Actually, looking at the constructor: it already receives `packageManagerService`. But `InstallJobExecutor` needs `PackageManagerDriverRegistry` (for `getDriver`). The registry already has `PackageManagerService` but not `PackageManagerDriverRegistry`.

Two options:
a. Add `PackageManagerDriverRegistry` as a new constructor dep of `JobExecutorRegistryImpl`
b. Have `InstallJobExecutor` use `PackageManagerService` instead

Go with (a) — executor needs driver directly for `installFlags()` and `installCommand()`.

Update `JobExecutorRegistryImpl` constructor to accept `PackageManagerDriverRegistry`:

```ts
import { PackageManagerDriverRegistry } from "../packageManagers/abstractions/PackageManagerDriverRegistry.js";
```

Add param after existing ones:

```ts
driverRegistry: PackageManagerDriverRegistry.Interface;
```

Add to `all` array:

```ts
            new InstallJobExecutor(driverRegistry, commandRunner, webSocketBroadcaster),
```

Update the factory at bottom:

```ts
export const JobExecutorRegistry = Abstraction.createImplementation({
  implementation: JobExecutorRegistryImpl,
  dependencies: [
    UpgradeService,
    PackageManagerService,
    ScanService,
    SecurityService,
    DatabaseClient,
    WebSocketBroadcaster,
    CommandRunner,
    PackageManagerDriverRegistry
  ]
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- --reporter=verbose src/api/services/jobExecutors/__tests__/InstallJobExecutor.test.ts`
Expected: PASS

- [ ] **Step 6: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 7: Commit**

```bash
git add src/api/services/jobExecutors/InstallJobExecutor.ts \
  src/api/services/jobExecutors/__tests__/InstallJobExecutor.test.ts \
  src/api/services/jobExecutors/JobExecutorRegistry.ts
git commit -m "feat: add InstallJobExecutor with flag validation and PM binary check"
```

---

### Task 5: API routes — install and install-options

**Files:**

- Create: `src/shared/routes/install.ts`
- Create: `src/api/routes/install.ts`
- Modify: `src/shared/routes/index.ts`
- Modify: `src/api/routes/index.ts`
- Modify: `src/api/server.ts`

**Interfaces:**

- Consumes: `defineRoute`, `registerRoute`, `PackageManagerDriverRegistry`, `JobWorker`
- Produces:
  - `POST /api/projects/:id/install` — body `{ flags?: string[] }`, response `{ item: { jobId } }`
  - `GET /api/install-options/:packageManager` — response `{ items: IInstallFlagDefinition[] }`

- [ ] **Step 1: Create shared route definitions**

Create `src/shared/routes/install.ts`:

```ts
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

export const installProjectRoute = defineRoute({
  method: "POST",
  path: "/api/projects/:id/install",
  description: "Run package manager install for a project",
  params: z.object({ id: z.string() }),
  body: z.object({ flags: z.array(z.string()).optional().default([]) }),
  response: z.object({ item: z.object({ jobId: z.string() }) })
});

export const getInstallOptionsRoute = defineRoute({
  method: "GET",
  path: "/api/install-options/:packageManager",
  description: "Get available install flags for a package manager",
  params: z.object({ packageManager: z.string() }),
  response: z.object({
    items: z.array(
      z.object({
        flag: z.string(),
        label: z.string(),
        description: z.string(),
        exclusive: z.string().optional()
      })
    )
  })
});
```

- [ ] **Step 2: Export from shared routes index**

In `src/shared/routes/index.ts`, add:

```ts
export * from "./install.js";
```

- [ ] **Step 3: Create API route handler**

Create `src/api/routes/install.ts`:

```ts
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { registerRoute } from "#shared/routing/index.js";
import { installProjectRoute, getInstallOptionsRoute } from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { PackageManagerDriverRegistry } from "#api/services/packageManagers/abstractions/PackageManagerDriverRegistry.js";
import { projects, upgradeJobs } from "#api/db/schema.js";

interface PluginOptions {
  container: Container;
}

export async function installRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
  const databaseClient = options.container.resolve(DatabaseClient);
  const driverRegistry = options.container.resolve(PackageManagerDriverRegistry);

  registerRoute(app, installProjectRoute, {}, async (request, reply) => {
    const { id } = request.params;
    const { flags } = request.body;

    const project = await databaseClient.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();

    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    if (!project.packageManager) {
      return reply.status(400).send({ error: "No package manager detected for this project" });
    }

    const jobId = generateId();
    await databaseClient.db
      .insert(upgradeJobs)
      .values({
        id: jobId,
        projectId: id,
        type: "install",
        status: "pending",
        packages: JSON.stringify({ flags })
      })
      .run();

    return { item: { jobId } };
  });

  registerRoute(app, getInstallOptionsRoute, {}, async request => {
    const { packageManager } = request.params;
    const driver = driverRegistry.getDriver(packageManager);
    return { items: driver.installFlags() };
  });
}
```

- [ ] **Step 4: Export from API routes index**

In `src/api/routes/index.ts`, add:

```ts
export { installRoutes } from "./install.js";
```

- [ ] **Step 5: Register in server.ts**

In `src/api/server.ts`:

1. Add to imports:

```ts
installRoutes;
```

(add to the existing destructured import from `./routes/index.js`)

2. Add registration after existing route registrations:

```ts
await app.register(installRoutes, { container });
```

- [ ] **Step 6: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 7: Run full test suite**

Run: `bun run test`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/shared/routes/install.ts src/shared/routes/index.ts \
  src/api/routes/install.ts src/api/routes/index.ts src/api/server.ts
git commit -m "feat: add POST /api/projects/:id/install and GET /api/install-options/:pm routes"
```

---

### Task 6: Add hasNodeModules to project API responses

**Files:**

- Modify: `src/api/routes/projects.ts` (list and get handlers)
- Modify: `src/shared/routes/projects.ts` (schema)

**Interfaces:**

- Consumes: `existsSync` from `fs`, project path
- Produces: `hasNodeModules: boolean` on project list/get API responses

- [ ] **Step 1: Add hasNodeModules to project schema**

In `src/shared/routes/projects.ts`, add to `projectSchema`:

```ts
hasNodeModules: z.boolean();
```

- [ ] **Step 2: Compute hasNodeModules in project routes**

In `src/api/routes/projects.ts`, find where project responses are built. Add:

```ts
import { existsSync } from "fs";
import { join } from "path";
```

For each response that returns a project object, add:

```ts
hasNodeModules: existsSync(join(project.path, "node_modules"));
```

This applies to:

- `listProjectsRoute` handler — map over results
- `getProjectRoute` handler — single project
- `createProjectRoute` handler — newly created project

- [ ] **Step 3: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 4: Run full test suite**

Run: `bun run test`
Expected: tests may need `hasNodeModules` added to mock/expected responses. Fix any failures.

- [ ] **Step 5: Commit**

```bash
git add src/shared/routes/projects.ts src/api/routes/projects.ts
git commit -m "feat: add hasNodeModules to project API responses"
```
