# Auto-Fix PRs Part 3: Job Executor, Routes & Auto-Chain

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build AutoFixPrJobExecutor (creates branches, upgrades, commits, pushes, creates PRs), API routes, shared route definitions, and wire the auto-chain from license-scan:completed.

**Architecture:** Job executor processes pending PR records, calling GitService/UpgradeService/ForgeService per record. Routes provide settings CRUD, PR listing, and manual generation trigger. Auto-chain via EventBus listener in server.ts.

**Tech Stack:** TypeScript, Fastify, Zod, Drizzle ORM, vitest

## Global Constraints

- Use full words in identifiers — no abbreviations
- Named interfaces only — no inline structural types
- Fixed path segments registered before parametrized routes
- Real SQLite in-memory for tests — use `createTestDatabaseClient()`
- Yarn for package management
- Tests in `src/**/__tests__/**/*.test.ts`

---

### Task 5: AutoFixPrJobExecutor

**Files:**

- Modify: `src/api/services/abstractions/GitService.ts` (add `checkout` method to interface)
- Modify: `src/api/services/GitService.ts` (implement `checkout` — runs `git checkout` without `-b`)
- Create: `src/api/services/jobExecutors/AutoFixPrJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/JobExecutorRegistry.ts` (register executor, add dependencies)
- Modify: `src/api/services/abstractions/JobWorker.ts` (add `"auto-fix-pr"` to type union)
- Modify: `src/shared/websocket/types.ts` (add WS event types)
- Create: `src/api/services/jobExecutors/__tests__/AutoFixPrJobExecutor.test.ts`

**Interfaces:**

- Consumes:
  - `AutoFixPrService.Interface` (Task 4) — `generateForProject()`, `buildPrBody()`
  - `GitService.Interface` — `getCurrentBranch()`, `checkout()` (new), `createAndCheckoutBranch()`, `stageAll()`, `commit()`, `push()`, `getStatus()`
  - `ForgeService.Interface` — `detectForge()`, `createPr()`
  - `UpgradeService.Interface` — `upgradePackage()`
  - `DatabaseClient.Interface` — update `autoFixPullRequests` status
  - `WebSocketBroadcaster.Interface` — broadcast progress/complete
- Produces: `AutoFixPrJobExecutor` with `type = "auto-fix-pr"`, `execute(context): Promise<void>`

- [ ] **Step 1a: Add `checkout` method to GitService**

`GitService` only has `createAndCheckoutBranch` (which runs `git checkout -b` — creates a new branch). The executor needs to return to an existing branch after creating PRs. Add a plain `checkout` method.

In `src/api/services/abstractions/GitService.ts`, add to `IGitService`:

```typescript
checkout(projectPath: string, branchName: string): Promise<void>;
```

In `src/api/services/GitService.ts`, add implementation:

```typescript
public async checkout(projectPath: string, branchName: string): Promise<void> {
    await this.commandRunner.run("git", ["checkout", branchName], {
        cwd: projectPath
    });
}
```

- [ ] **Step 1b: Add "auto-fix-pr" to job type union**

In `src/api/services/abstractions/JobWorker.ts`, add `"auto-fix-pr"` to the `type` union in `ICreateJobInput`.

- [ ] **Step 2: Add WebSocket event types**

In `src/shared/websocket/types.ts`:

```typescript
export interface WSAutoFixProgress {
  projectId: string;
  packageName: string;
  step: "branch" | "upgrade" | "commit" | "push" | "create-pr";
  current: number;
  total: number;
}

export interface WSAutoFixComplete {
  projectId: string;
  created: number;
  skipped: number;
  failed: number;
}
```

Add to `WSEventMap`:

```typescript
"auto-fix:progress": WSAutoFixProgress;
"auto-fix:complete": WSAutoFixComplete;
```

- [ ] **Step 3: Write tests**

Create `src/api/services/jobExecutors/__tests__/AutoFixPrJobExecutor.test.ts` covering:

1. **Type property**: `executor.type === "auto-fix-pr"`
2. **Happy path**: Mock GitService/ForgeService/UpgradeService — verify branch created, package upgraded, committed, pushed, PR created, record updated to "created"
3. **Failure recovery**: upgradePackage throws → record status "failed", original branch restored
4. **Dirty working tree**: getStatus returns files → execute throws without processing any records
5. **WS broadcast**: verify `auto-fix:complete` broadcast with correct counts
6. **Multi-package group**: record with 2 packageNames → both upgraded in same branch, single commit

Mock all external services (GitService, ForgeService, UpgradeService). Use real DB for autoFixPullRequests record tracking.

- [ ] **Step 4: Write implementation**

Create `src/api/services/jobExecutors/AutoFixPrJobExecutor.ts`:

```typescript
import { eq, and } from "drizzle-orm";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import type { AutoFixPrService } from "../abstractions/AutoFixPrService.js";
import type { GitService } from "../abstractions/GitService.js";
import type { ForgeService } from "../abstractions/ForgeService.js";
import type { UpgradeService } from "../abstractions/UpgradeService.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { autoFixPullRequests } from "#api/db/schema.js";

export class AutoFixPrJobExecutor implements JobExecutor.Interface {
  public readonly type = "auto-fix-pr";

  public constructor(
    private readonly autoFixPrService: AutoFixPrService.Interface,
    private readonly gitService: GitService.Interface,
    private readonly forgeService: ForgeService.Interface,
    private readonly upgradeService: UpgradeService.Interface,
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface
  ) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    const projectId = context.referenceId;

    // Step 1: Generate pending records via orchestration service
    await this.autoFixPrService.generateForProject(projectId);

    // Step 2: Load all pending records
    const pendingRecords = await this.databaseClient.db
      .select()
      .from(autoFixPullRequests)
      .where(
        and(eq(autoFixPullRequests.projectId, projectId), eq(autoFixPullRequests.status, "pending"))
      )
      .all();

    if (pendingRecords.length === 0) {
      this.webSocketBroadcaster.broadcast("auto-fix:complete", {
        projectId,
        created: 0,
        skipped: 0,
        failed: 0
      });
      return;
    }

    // Step 3: Check working tree
    const status = await this.gitService.getStatus(context.projectPath);
    if (status.length > 0) {
      throw new Error(
        "Working tree is dirty — auto-fix requires a clean working directory. " +
          "Commit or stash changes first."
      );
    }

    // Step 4: Save original branch
    const originalBranch = await this.gitService.getCurrentBranch(context.projectPath);
    let created = 0;
    let failed = 0;

    // Step 5: Process each pending record
    for (let i = 0; i < pendingRecords.length; i++) {
      const record = pendingRecords[i]!;
      const packageNames = JSON.parse(record.packageNames) as string[];
      const toVersions = JSON.parse(record.toVersions) as Record<string, string>;

      try {
        await this.gitService.createAndCheckoutBranch(context.projectPath, record.branchName);

        for (const packageName of packageNames) {
          const targetVersion = toVersions[packageName];
          if (targetVersion) {
            await this.upgradeService.upgradePackage(
              context.projectPath,
              packageName,
              targetVersion,
              context.packageManager,
              line => context.appendLog(line),
              context.signal
            );
          }

          this.webSocketBroadcaster.broadcast("auto-fix:progress", {
            projectId,
            packageName,
            step: "upgrade",
            current: i + 1,
            total: pendingRecords.length
          });
        }

        await this.gitService.stageAll(context.projectPath);

        const commitMessage =
          packageNames.length === 1
            ? `fix(deps): upgrade ${packageNames[0]} to ${toVersions[packageNames[0]!]}`
            : `fix(deps): upgrade ${packageNames.length} packages (${record.upgradeType})`;

        await this.gitService.commit(context.projectPath, commitMessage);

        const pushResult = await this.gitService.push(
          context.projectPath,
          "origin",
          record.branchName
        );

        if (!pushResult.success) {
          throw new Error(`Push failed: ${pushResult.output}`);
        }

        // Build PR body
        const packages = packageNames.map(name => ({
          packageName: name,
          fromVersion: (JSON.parse(record.fromVersions) as Record<string, string>)[name] ?? "",
          toVersion: toVersions[name] ?? "",
          upgradeType: record.upgradeType
        }));
        const licenseWarnings = record.licenseWarnings
          ? (JSON.parse(record.licenseWarnings) as string[])
          : [];

        // Load changelogs if available (best-effort)
        const changelogs: AutoFixPrService.ChangelogExcerpt[] = [];
        // Changelog resolution is handled by the existing changelog system
        // We read whatever is available in the DB

        const body = this.autoFixPrService.buildPrBody(packages, changelogs, licenseWarnings);

        const forgeType = await this.forgeService.detectForge(context.projectPath);
        if (forgeType === "unknown") {
          throw new Error("No forge configured — set github_token or gitlab_token in settings");
        }

        const prResult = await this.forgeService.createPr({
          projectPath: context.projectPath,
          title: commitMessage,
          body,
          head: record.branchName,
          base: originalBranch
        });

        await this.databaseClient.db
          .update(autoFixPullRequests)
          .set({
            status: "created",
            prUrl: prResult.url,
            prNumber: prResult.number,
            updatedAt: Date.now()
          })
          .where(eq(autoFixPullRequests.id, record.id))
          .run();

        created++;
      } catch (error) {
        await this.databaseClient.db
          .update(autoFixPullRequests)
          .set({
            status: "failed",
            updatedAt: Date.now()
          })
          .where(eq(autoFixPullRequests.id, record.id))
          .run();
        failed++;
        context.appendLog(
          `Auto-fix failed for ${packageNames.join(", ")}: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        try {
          await this.gitService.checkout(context.projectPath, originalBranch);
        } catch {
          // Best effort — if checkout fails, the next iteration will fail too
        }
      }
    }

    this.webSocketBroadcaster.broadcast("auto-fix:complete", {
      projectId,
      created,
      skipped: 0,
      failed
    });
  }
}
```

- [ ] **Step 5: Register in JobExecutorRegistry**

In `src/api/services/jobExecutors/JobExecutorRegistry.ts`:

1. Import `AutoFixPrService`, `AutoFixPrJobExecutor`, `GitService`, `ForgeService`, `UpgradeService`
2. Add constructor parameters for new dependencies
3. Add `new AutoFixPrJobExecutor(...)` to `all` array
4. Add new abstractions to `dependencies` array

- [ ] **Step 6: Run tests**

Run: `yarn test`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/api/services/abstractions/GitService.ts src/api/services/GitService.ts src/api/services/jobExecutors/AutoFixPrJobExecutor.ts src/api/services/jobExecutors/JobExecutorRegistry.ts src/api/services/abstractions/JobWorker.ts src/shared/websocket/types.ts src/api/services/jobExecutors/__tests__/AutoFixPrJobExecutor.test.ts
git commit -m "feat(auto-fix): add GitService.checkout and AutoFixPrJobExecutor"
```

---

### Task 6: Shared route definitions and API routes

**Files:**

- Create: `src/shared/routes/autoFix.ts`
- Modify: `src/shared/routes/index.ts` (add re-export)
- Create: `src/api/routes/autoFixSettings.ts`
- Create: `src/api/routes/autoFixPrs.ts`
- Modify: `src/api/routes/index.ts` (export new route plugins)
- Modify: `src/api/server.ts` (register routes + add license-scan:completed listener)
- Create: `src/api/routes/__tests__/autoFix.test.ts`

**Interfaces:**

- Consumes: `AutoFixSettingsService.Interface` (Task 3), `AutoFixPrService.Interface` (Task 4), `JobWorker.Interface`, `DatabaseClient.Interface`, route constants
- Produces: Fastify route plugins `autoFixSettingsRoutes`, `autoFixPrRoutes`

- [ ] **Step 1: Create shared route definitions**

Create `src/shared/routes/autoFix.ts` with Zod schemas for all routes:

- Settings GET/PUT routes
- PR list routes (with projectId/status filters)
- Generate trigger route
- PR delete route

- [ ] **Step 2: Add re-export**

In `src/shared/routes/index.ts`: `export * from "./autoFix.js";`

- [ ] **Step 3: Create settings routes**

Create `src/api/routes/autoFixSettings.ts`:

- `GET /api/auto-fix/:projectId/settings` — calls `settingsService.getSettingsOrDefaults()`
- `PUT /api/auto-fix/:projectId/settings` — calls `settingsService.updateSettings()`

- [ ] **Step 4: Create PR routes**

Create `src/api/routes/autoFixPrs.ts`:

- `GET /api/auto-fix/pull-requests` — list all, filter by projectId/status (registered BEFORE parametrized routes)
- `GET /api/auto-fix/:projectId/pull-requests` — per-project
- `POST /api/auto-fix/:projectId/generate` — enqueue `auto-fix-pr` job via JobWorker
- `DELETE /api/auto-fix/pull-requests/:id` — delete record

- [ ] **Step 5: Register routes and auto-chain in server.ts**

1. Import and register both route plugins after license routes
2. Add `license-scan:completed` EventBus listener:

```typescript
const autoFixSettingsService = container.resolve(AutoFixSettingsService);
eventBus.on("license-scan:completed", async (projectId: string) => {
  const settings = await autoFixSettingsService.getSettings(projectId);
  if (settings?.enabled) {
    void jobWorker.enqueue({
      referenceId: projectId,
      referenceType: "project",
      type: "auto-fix-pr"
    });
  }
});
```

- [ ] **Step 6: Write integration tests**

Create `src/api/routes/__tests__/autoFix.test.ts` covering:

1. GET settings returns defaults
2. PUT settings creates/updates
3. GET pull-requests returns empty
4. POST generate enqueues job
5. DELETE removes record

- [ ] **Step 7: Run all tests**

Run: `yarn build && yarn test`
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/shared/routes/autoFix.ts src/shared/routes/index.ts src/api/routes/autoFixSettings.ts src/api/routes/autoFixPrs.ts src/api/routes/index.ts src/api/server.ts src/api/routes/__tests__/autoFix.test.ts
git commit -m "feat(auto-fix): add API routes, shared definitions, and auto-chain listener"
```
