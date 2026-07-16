# Clone Job Executor + Clone Route — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New `clone` job type that runs `git clone` and registers the project. Route handler enqueues the job and validates the URL.

**Architecture:** `CloneJobExecutor` follows existing executor pattern (plain class, created by registry). Uses `CommandRunner.runStreaming` for git clone, `registerProject` helper for project registration. Clone route validates URL scheme (https/git@ only), extracts repo name, enqueues job.

**Tech Stack:** Zod for validation, execa via CommandRunner, Drizzle ORM

## Global Constraints

- URL whitelist: `https://` and `git@` schemes only
- No dependency on JobWorker from executor (circular dep)
- Executor stores projectId in job packages after registration so route/UI can enqueue scan
- Build before test: `yarn build`

## Dependencies on Prior Plans

- Plan 02 (`registerProject` helper) must be completed first

---

### Task 1: CloneJobExecutor

**Files:**

- Create: `src/api/services/jobExecutors/CloneJobExecutor.ts`
- Modify: `src/api/services/abstractions/JobWorker.ts` — add `"clone"` to type union
- Modify: `src/api/services/jobExecutors/JobExecutorRegistry.ts` — register CloneJobExecutor
- Create: `src/api/services/jobExecutors/__tests__/CloneJobExecutor.test.ts`

**Interfaces:**

- Consumes: `JobExecutor.Interface` from `jobExecutors/abstractions/JobExecutor.js`, `registerProject` from `../registerProject.js`, `CommandRunner.Interface`
- Produces: `CloneJobExecutor` class with `type = "clone"` and `execute(context)` method

- [ ] **Step 1: Write the test**

```typescript
// src/api/services/jobExecutors/__tests__/CloneJobExecutor.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { eq } from "drizzle-orm";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { seedYarnSecuritySettings } from "#testing/helpers/seedYarnSecuritySettings.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { CommandRunner } from "../../abstractions/CommandRunner.js";
import { SecurityService as SecurityServiceReg } from "../../SecurityService.js";
import { PackageManagerService as PackageManagerServiceReg } from "../../PackageManagerService.js";
import { PackageManagerDriverRegistry as PackageManagerDriverRegistryReg } from "../../packageManagers/PackageManagerDriverRegistry.js";
import { projects } from "#api/db/schema.js";
import { CloneJobExecutor } from "../CloneJobExecutor.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

describe("CloneJobExecutor", () => {
  let testDir: string;
  let cloneTarget: string;
  let executor: CloneJobExecutor;
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let commandRunnerMock: CommandRunner.Interface;

  beforeEach(async () => {
    testDir = join(tmpdir(), `clone-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    cloneTarget = join(testDir, "my-repo");
    mkdirSync(testDir, { recursive: true });

    db = await createTestDb();
    await seedYarnSecuritySettings(db);

    commandRunnerMock = {
      run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
      runStreaming: vi.fn(async (_command, _args, options) => {
        // Simulate git clone by creating the target dir with package.json + yarn.lock
        mkdirSync(cloneTarget, { recursive: true });
        writeFileSync(join(cloneTarget, "package.json"), JSON.stringify({ name: "my-repo" }));
        writeFileSync(join(cloneTarget, "yarn.lock"), "");
        options.onStdout("Cloning into 'my-repo'...");
        return { stdout: "", stderr: "", exitCode: 0 };
      })
    };

    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
    container.registerInstance(CommandRunner, commandRunnerMock);
    container.register(PackageManagerDriverRegistryReg).inSingletonScope();
    container.register(PackageManagerServiceReg).inSingletonScope();
    container.register(SecurityServiceReg).inSingletonScope();

    const packageManagerService = container.resolve(
      PackageManagerServiceReg.abstraction ?? PackageManagerServiceReg
    );
    const securityService = container.resolve(SecurityServiceReg.abstraction ?? SecurityServiceReg);

    executor = new CloneJobExecutor(commandRunnerMock, packageManagerService, securityService, {
      db
    });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function makeContext(
    overrides?: Partial<JobExecutor.ExecutionContext>
  ): JobExecutor.ExecutionContext {
    return {
      jobId: "job-1",
      projectId: "clone-project",
      projectPath: testDir,
      packageManager: "yarn",
      packagesJson: JSON.stringify({
        url: "https://github.com/org/my-repo.git",
        destination: cloneTarget
      }),
      appendLog: vi.fn(),
      signal: new AbortController().signal,
      ...overrides
    };
  }

  it("runs git clone with correct args", async () => {
    await executor.execute(makeContext());

    expect(commandRunnerMock.runStreaming).toHaveBeenCalledWith(
      "git",
      ["clone", "https://github.com/org/my-repo.git", cloneTarget],
      expect.objectContaining({ cwd: expect.any(String) })
    );
  });

  it("registers the project in the database after clone", async () => {
    await executor.execute(makeContext());

    const allProjects = await db.select().from(projects).all();
    expect(allProjects).toHaveLength(1);
    expect(allProjects[0]!.path).toBe(cloneTarget);
    expect(allProjects[0]!.name).toBe("my-repo");
    expect(allProjects[0]!.packageManager).toBe("yarn");
  });

  it("fails when git clone fails", async () => {
    commandRunnerMock.runStreaming = vi.fn(async () => {
      throw new Error("fatal: repository not found");
    });

    await expect(executor.execute(makeContext())).rejects.toThrow("fatal: repository not found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn build && yarn vitest run src/api/services/jobExecutors/__tests__/CloneJobExecutor.test.ts`
Expected: FAIL — `CloneJobExecutor` not found

- [ ] **Step 3: Write CloneJobExecutor**

```typescript
// src/api/services/jobExecutors/CloneJobExecutor.ts
import { z } from "zod";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import type { CommandRunner } from "../abstractions/CommandRunner.js";
import type { PackageManagerService } from "../abstractions/PackageManagerService.js";
import type { SecurityService } from "../abstractions/SecurityService.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { registerProject } from "../registerProject.js";
import { eq } from "drizzle-orm";
import { upgradeJobs } from "#api/db/schema.js";

const clonePackagesSchema = z.object({
  url: z.string(),
  destination: z.string()
});

export class CloneJobExecutor implements JobExecutor.Interface {
  public readonly type = "clone";

  public constructor(
    private readonly commandRunner: CommandRunner.Interface,
    private readonly packageManagerService: PackageManagerService.Interface,
    private readonly securityService: SecurityService.Interface,
    private readonly databaseClient: DatabaseClient.Interface
  ) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    const { url, destination } = clonePackagesSchema.parse(
      JSON.parse(context.packagesJson ?? "{}")
    );

    await this.commandRunner.runStreaming("git", ["clone", url, destination], {
      cwd: process.cwd(),
      onStdout: context.appendLog,
      onStderr: context.appendLog,
      signal: context.signal
    });

    const registered = await registerProject({
      projectPath: destination,
      databaseClient: this.databaseClient,
      packageManagerService: this.packageManagerService
    });

    await this.databaseClient.db
      .update(upgradeJobs)
      .set({ packages: JSON.stringify({ url, destination, projectId: registered.id }) })
      .where(eq(upgradeJobs.id, context.jobId))
      .run();

    void this.securityService.check(registered.id, destination);
  }
}
```

- [ ] **Step 4: Add "clone" to type union**

In `src/api/services/abstractions/JobWorker.ts`, change the `type` field in `ICreateJobInput`:

```typescript
type: "dependency" | "transient" | "packageManager" | "scan" | "clone";
```

- [ ] **Step 5: Register in JobExecutorRegistry**

In `src/api/services/jobExecutors/JobExecutorRegistry.ts`:

Add import:

```typescript
import { CommandRunner } from "../abstractions/CommandRunner.js";
import { CloneJobExecutor } from "./CloneJobExecutor.js";
```

Add `CommandRunner` to constructor params and dependencies array. Add to the `all` array:

```typescript
new CloneJobExecutor(commandRunner, packageManagerService, securityService, databaseClient);
```

- [ ] **Step 6: Run tests**

Run: `yarn build && yarn vitest run src/api/services/jobExecutors/__tests__/CloneJobExecutor.test.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 7: Run full pipeline**

Run: `yarn lint && yarn format:fix && yarn build && yarn test`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add src/api/services/jobExecutors/CloneJobExecutor.ts \
  src/api/services/jobExecutors/__tests__/CloneJobExecutor.test.ts \
  src/api/services/abstractions/JobWorker.ts \
  src/api/services/jobExecutors/JobExecutorRegistry.ts
git commit -m "feat: CloneJobExecutor — git clone + project registration"
```

---

### Task 2: Clone Route

**Files:**

- Modify: `src/shared/routes/projects.ts` — add `cloneProjectRoute` definition
- Modify: `src/api/routes/projects.ts` — add clone handler
- Modify: `src/api/routes/__tests__/projects.test.ts` — add clone tests

**Interfaces:**

- Consumes: `JobWorker.Interface.enqueue()`, route definitions
- Produces: `POST /api/projects/clone` endpoint

- [ ] **Step 1: Write the route definition**

In `src/shared/routes/projects.ts`, add:

```typescript
export const cloneProjectRoute = defineRoute({
  method: "POST",
  path: "/api/projects/clone",
  description: "Clone a GitHub repository and register as a project",
  params: z.object({}),
  body: z.object({
    url: z.string().min(1),
    destination: z.string().min(1),
    folderName: z.string().optional()
  }),
  response: z.object({ item: z.object({ jobId: z.string() }) })
});
```

Since `src/shared/routes/index.ts` already uses `export * from "./projects.js"`, the new `cloneProjectRoute` is automatically re-exported.

- [ ] **Step 2: Write the tests**

Add to `src/api/routes/__tests__/projects.test.ts`:

```typescript
it("POST /api/projects/clone enqueues a clone job", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects/clone",
    payload: {
      url: "https://github.com/org/repo.git",
      destination: testDir
    }
  });

  expect(response.statusCode).toBe(200);
  const body = response.json() as { item: { jobId: string } };
  expect(body.item.jobId).toBeDefined();

  const allJobs = await jobWorker.listAllJobs();
  const cloneJobs = allJobs.filter(job => job.type === "clone");
  expect(cloneJobs).toHaveLength(1);
});

it("POST /api/projects/clone uses folderName when provided", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects/clone",
    payload: {
      url: "https://github.com/org/repo.git",
      destination: testDir,
      folderName: "custom-name"
    }
  });

  expect(response.statusCode).toBe(200);
  const allJobs = await jobWorker.listAllJobs();
  const packages = JSON.parse(allJobs[0]!.packages!);
  expect(packages.destination).toBe(join(testDir, "custom-name"));
});

it("POST /api/projects/clone rejects file:// scheme URLs", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects/clone",
    payload: {
      url: "file:///etc/passwd",
      destination: testDir
    }
  });

  expect(response.statusCode).toBe(400);
});

it("POST /api/projects/clone rejects nonexistent destination", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects/clone",
    payload: {
      url: "https://github.com/org/repo.git",
      destination: "/nonexistent/path/xyz"
    }
  });

  expect(response.statusCode).toBe(400);
});

it("POST /api/projects/clone rejects already-registered path", async () => {
  // First add a project at testDir
  await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: { path: testDir }
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/projects/clone",
    payload: {
      url: "https://github.com/org/test.git",
      destination: join(testDir, ".."),
      folderName: basename(testDir)
    }
  });

  expect(response.statusCode).toBe(409);
});
```

Add `basename` to imports from `path`.

- [ ] **Step 3: Write the route handler**

In `src/api/routes/projects.ts`, add the handler before the `GET /api/projects/:id` route.

Add to existing imports:

```typescript
import { existsSync } from "fs";
```

Add `cloneProjectRoute` to the existing import from `#shared/routes/index.js`. Add `join` to the existing `path` import (if not already present).

Add helper function at top of the `projectRoutes` function body:

```typescript
function extractRepoName(url: string): string | null {
  const match = url.match(/\/([^/]+?)(?:\.git)?$/);
  if (match) {
    return match[1]!;
  }
  const sshMatch = url.match(/:([^/]+?)(?:\.git)?$/);
  return sshMatch?.[1] ?? null;
}
```

Then add the route handler:

```typescript
registerRoute(app, cloneProjectRoute, {}, async (request, reply) => {
  const { url, destination, folderName } = request.body;

  if (!url.startsWith("https://") && !url.startsWith("git@")) {
    sendError(reply, 400, "Only https:// and git@ URLs are supported");
    return;
  }

  const repoName = extractRepoName(url);
  if (!repoName) {
    sendError(reply, 400, "Could not extract repository name from URL");
    return;
  }

  const targetFolder = folderName ?? repoName;
  const finalPath = join(destination, targetFolder);

  if (!existsSync(destination)) {
    sendError(reply, 400, `Destination directory does not exist: ${destination}`);
    return;
  }

  const existing = await db.select().from(projects).where(eq(projects.path, finalPath)).get();

  if (existing) {
    sendError(reply, 409, `A project is already registered at ${finalPath}`);
    return;
  }

  const jobId = await jobWorker.enqueue({
    projectId: "clone",
    type: "clone",
    packages: JSON.stringify({ url, destination: finalPath })
  });

  sendOne(reply, { jobId });
});
```

- [ ] **Step 4: Run tests**

Run: `yarn build && yarn vitest run src/api/routes/__tests__/projects.test.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 5: Run full pipeline**

Run: `yarn lint && yarn format:fix && yarn build && yarn test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/shared/routes/projects.ts src/api/routes/projects.ts \
  src/api/routes/__tests__/projects.test.ts
git commit -m "feat: POST /api/projects/clone route with URL validation"
```
