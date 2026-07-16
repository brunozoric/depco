# Changelog Job Executor + Async API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `changelog` job type that resolves changelogs asynchronously with per-version WS streaming. Change the GET endpoint to return cached entries immediately and auto-enqueue jobs for unfetched versions.

**Architecture:** New `ChangelogJobExecutor` registered in `JobExecutorRegistry`. Resolves only versions in the requested range (not all unfetched). Broadcasts `changelog:resolved` WS event per version. GET endpoint becomes non-blocking.

**Tech Stack:** Fastify, Drizzle ORM, WebSocket, Zod, Vitest

## Global Constraints

- Depends on plan 01 (referenceId rename) being complete
- Changelog jobs use `referenceType = "package"`, `referenceId = packageName`
- Existing `ChangelogService.resolve()` stays but is no longer called from routes
- Run `yarn full` after final task

---

### Task 1: WS Event Type

**Files:**

- Modify: `src/shared/websocket/types.ts` — add `changelog:resolved` event

**Produces:** `WSChangelogResolved` interface, `"changelog:resolved"` in `WSEventMap`

- [ ] **Step 1: Add WS event type**

`src/shared/websocket/types.ts`:

```typescript
export interface WSChangelogResolved {
  packageName: string;
  version: string;
  content: string | null;
  source: string | null;
}
```

Add to `WSEventMap`:

```typescript
"changelog:resolved": WSChangelogResolved;
```

- [ ] **Step 2: Add "changelog" to ICreateJobInput.type union**

`src/api/services/abstractions/JobWorker.ts`:

Add `"changelog"` to the `type` union in `ICreateJobInput`:

```typescript
type: "dependency" | "transient" | "packageManager" | "scan" | "clone" | "install" | "changelog";
```

- [ ] **Step 3: Build check**

```bash
yarn build 2>&1 | tail -5
```

---

### Task 2: ChangelogJobExecutor

**Files:**

- Create: `src/api/services/jobExecutors/ChangelogJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/JobExecutorRegistry.ts` — register it

**Consumes:** `JobExecutor.Interface`, `DatabaseClient`, `CommandRunner`, `RegistryCacheService`, `WebSocketBroadcaster`, changelog resolver classes

**Produces:** Executor with `type = "changelog"` that resolves changelogs per-version and broadcasts WS events

- [ ] **Step 1: Write test**

Create `src/api/services/jobExecutors/__tests__/ChangelogJobExecutor.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ChangelogJobExecutor } from "../ChangelogJobExecutor.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { CommandRunner } from "../../abstractions/CommandRunner.js";
import type { RegistryCacheService } from "../../abstractions/RegistryCacheService.js";
import type { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";

function createMockContext(packages: object): JobExecutor.ExecutionContext {
  return {
    jobId: "job-1",
    referenceId: "@test/pkg",
    projectPath: "",
    packageManager: "",
    packagesJson: JSON.stringify(packages),
    project: null,
    appendLog: vi.fn(),
    signal: new AbortController().signal
  };
}

describe("ChangelogJobExecutor", () => {
  it("has type 'changelog'", () => {
    const executor = new ChangelogJobExecutor(
      {} as DatabaseClient.Interface,
      {} as CommandRunner.Interface,
      {} as RegistryCacheService.Interface,
      {} as WebSocketBroadcaster.Interface
    );
    expect(executor.type).toBe("changelog");
  });

  it("broadcasts changelog:resolved for each version found", async () => {
    // Setup: mock DB to return unfetched versions, mock CommandRunner for gh api
    // Verify: broadcast called per version with correct payload
    // This test requires in-memory DB setup — use createTestDb pattern
  });
});
```

- [ ] **Step 2: Implement ChangelogJobExecutor**

Create `src/api/services/jobExecutors/ChangelogJobExecutor.ts`:

```typescript
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { CommandRunner } from "../abstractions/CommandRunner.js";
import type { RegistryCacheService } from "../abstractions/RegistryCacheService.js";
import type { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { changelogs, dependencies, dependencyVersions } from "#api/db/schema.js";
import { GitHubReleasesResolver } from "../changelogResolvers/GitHubReleasesResolver.js";
import { ChangelogFileResolver } from "../changelogResolvers/ChangelogFileResolver.js";
import { NpmReadmeResolver } from "../changelogResolvers/NpmReadmeResolver.js";
import type { ChangelogResolver } from "../changelogResolvers/abstractions/ChangelogResolver.js";
// compareVersions is currently a private function in ChangelogService.ts.
// Before this task, export it from ChangelogService.ts so it can be reused.
import { compareVersions } from "../ChangelogService.js";

const changelogPackagesSchema = z.object({
  packageName: z.string(),
  from: z.string(),
  to: z.string()
});

export class ChangelogJobExecutor implements JobExecutor.Interface {
  public readonly type = "changelog";
  private readonly resolvers: ChangelogResolver.Interface[];

  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    commandRunner: CommandRunner.Interface,
    registryCacheService: RegistryCacheService.Interface,
    private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface
  ) {
    this.resolvers = [
      new GitHubReleasesResolver(commandRunner),
      new ChangelogFileResolver(commandRunner),
      new NpmReadmeResolver(registryCacheService)
    ];
  }

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    const { packageName, from, to } = changelogPackagesSchema.parse(
      JSON.parse(context.packagesJson ?? "{}")
    );

    context.appendLog(`Resolving changelogs for ${packageName} (${from} → ${to})`);

    const depRow = await this.databaseClient.db
      .select()
      .from(dependencies)
      .where(eq(dependencies.name, packageName))
      .get();

    if (!depRow) {
      context.appendLog("Package not found in dependencies table");
      return;
    }

    const allUnfetched = await this.databaseClient.db
      .select({
        id: changelogs.id,
        version: dependencyVersions.version
      })
      .from(changelogs)
      .innerJoin(dependencyVersions, eq(changelogs.dependencyVersionId, dependencyVersions.id))
      .where(and(eq(changelogs.dependencyId, depRow.id), isNull(changelogs.content)))
      .all();

    const unfetched = allUnfetched.filter(
      row => compareVersions(row.version, from) > 0 && compareVersions(row.version, to) <= 0
    );

    if (unfetched.length === 0) {
      context.appendLog("All versions already resolved");
      return;
    }

    const versions = unfetched.map(row => row.version);
    context.appendLog(`${versions.length} versions to resolve: ${versions.join(", ")}`);

    let found = new Map<string, string>();
    let winnerName: string | null = null;

    for (const resolver of this.resolvers) {
      found = await resolver.resolve(packageName, depRow.repoUrl, versions);
      if (found.size > 0) {
        winnerName = resolver.name;
        context.appendLog(`Found ${found.size} entries via ${winnerName}`);
        break;
      }
    }

    const fetchedAt = Date.now();
    for (const row of unfetched) {
      const content = found.get(row.version);
      const source = content !== undefined ? winnerName : "none";

      await this.databaseClient.db
        .update(changelogs)
        .set({
          content: content ?? "",
          source,
          fetchedAt
        })
        .where(and(eq(changelogs.id, row.id), isNull(changelogs.content)))
        .run();

      this.webSocketBroadcaster.broadcast("changelog:resolved", {
        packageName,
        version: row.version,
        content: content ?? "",
        source
      });

      context.appendLog(`${row.version}: ${source}`);
    }
  }
}
```

- [ ] **Step 3: Register in JobExecutorRegistry**

`src/api/services/jobExecutors/JobExecutorRegistry.ts`:

Add import and instantiation:

```typescript
import { ChangelogJobExecutor } from "./ChangelogJobExecutor.js";
```

In constructor, add to `all` array:

```typescript
new ChangelogJobExecutor(databaseClient, commandRunner, registryCacheService, webSocketBroadcaster);
```

Add `RegistryCacheService` to constructor parameters if not already present. Update the `dependencies` array in `createImplementation`.

- [ ] **Step 4: Build + test**

```bash
yarn build 2>&1 | tail -5
yarn test 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/api/services/jobExecutors/ChangelogJobExecutor.ts src/api/services/jobExecutors/__tests__/ChangelogJobExecutor.test.ts src/api/services/jobExecutors/JobExecutorRegistry.ts src/shared/websocket/types.ts
git commit -m "feat: add ChangelogJobExecutor with per-version WS streaming"
```

---

### Task 3: Async GET Endpoint

**Files:**

- Modify: `src/shared/routes/changelogs.ts` — add `resolving` to response schema
- Modify: `src/api/routes/changelogs.ts` — non-blocking GET, auto-enqueue
- Modify: `src/api/services/JobWorker.ts` — handle changelog job type in executeJob() (no project lookup)

**Consumes:** `ChangelogService.getChangelogs()`, `ChangelogService.resetFailed()`, `JobWorker.enqueue()` (uses `referenceId`/`referenceType` from Plan 01 rename)

- [ ] **Step 1: Update route response schema**

`src/shared/routes/changelogs.ts`:

Add `resolving: z.boolean()` to both `getChangelogsRoute` and `reResolveChangelogsRoute` response schemas:

```typescript
const changelogResponseSchema = z.object({
  items: z.array(changelogEntrySchema),
  total: z.number(),
  resolving: z.boolean()
});
```

- [ ] **Step 2: Update GET route handler**

`src/api/routes/changelogs.ts`:

The handler needs `JobWorker` and `DatabaseClient` in addition to `ChangelogService`. Add imports and resolve from container.

New GET handler logic:

```typescript
registerRoute(app, getChangelogsRoute, {}, async (request, reply) => {
  const { packageName } = request.params;
  const { from, to } = request.query;

  if (from === to) {
    reply.send({ items: [], total: 0, resolving: false });
    return;
  }

  const entries = await changelogService.getChangelogs(packageName, from, to);

  const hasUnfetched = entries.some(e => e.content === null);

  let resolving = false;
  if (hasUnfetched) {
    const activeJob = await databaseClient.db
      .select()
      .from(upgradeJobs)
      .where(
        and(
          eq(upgradeJobs.type, "changelog"),
          eq(upgradeJobs.referenceId, packageName),
          inArray(upgradeJobs.status, ["pending", "running"])
        )
      )
      .get();

    if (!activeJob) {
      await jobWorker.enqueue({
        referenceId: packageName,
        referenceType: "package",
        type: "changelog",
        packages: JSON.stringify({ packageName, from, to })
      });
    }
    resolving = true;
  }

  reply.send({ items: entries, total: entries.length, resolving });
});
```

Note: import `inArray` from `drizzle-orm`. Import `upgradeJobs` from schema. Resolve `JobWorker` and `DatabaseClient` from container.

- [ ] **Step 3: Update POST re-resolve handler**

```typescript
registerRoute(app, reResolveChangelogsRoute, {}, async (request, reply) => {
  const { packageName } = request.params;
  const { from, to } = request.body;

  if (from === to) {
    reply.send({ items: [], total: 0, resolving: false });
    return;
  }

  await changelogService.resetFailed(packageName);

  await jobWorker.enqueue({
    referenceId: packageName,
    referenceType: "package",
    type: "changelog",
    packages: JSON.stringify({ packageName, from, to })
  });

  const entries = await changelogService.getChangelogs(packageName, from, to);
  reply.send({ items: entries, total: entries.length, resolving: true });
});
```

- [ ] **Step 4: Update JobWorker security check bypass for changelog jobs**

In `src/api/services/JobWorker.ts`, the `enqueue()` method runs a security check for `dependency` and `transient` jobs. Changelog jobs should skip this (they have no project):

The existing code only checks for `dependency` and `transient` types, so changelog jobs already bypass it. Verify this is the case.

Also verify that `executeJob()` handles the changelog job type. The clone job already handles `project = null` by checking `if (job.type === "clone")`. Add the same for changelog:

```typescript
if (job.type === "clone" || job.type === "changelog") {
  // No project context needed
  await executor.execute({
    jobId: job.id,
    referenceId: job.referenceId,
    projectPath: "",
    packageManager: "",
    packagesJson: job.packages,
    project: null,
    appendLog,
    signal: controller.signal
  });
} else {
  // existing project lookup flow
}
```

- [ ] **Step 5: Build + test**

```bash
yarn build 2>&1 | tail -5
yarn test 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/routes/changelogs.ts src/api/routes/changelogs.ts src/api/services/JobWorker.ts
git commit -m "feat: async changelog GET endpoint with auto-enqueue"
```

---

### Task 4: Update UI Gateways

**Files:**

- Modify: `src/ui/features/packages/abstractions/PackagesGateway.ts` — add IChangelogResult, update method signatures
- Modify: `src/ui/features/packages/PackagesGateway.ts` — handle `resolving` field
- Modify: `src/ui/features/projects/abstractions/ProjectsGateway.ts` — add IChangelogResult, update method signatures
- Modify: `src/ui/features/projects/ProjectsGateway.ts` — handle `resolving` field
- Modify: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts` — getChangelogs/reResolveChangelogs return IChangelogResult
- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts` — update return types
- Modify: `src/ui/presentation/packages/PackageList/abstractions/PackagesPresenter.ts` — getChangelogs/reResolveChangelogs return IChangelogResult
- Modify: `src/ui/presentation/packages/PackageList/PackagesPresenter.ts` — update return types
- Modify: `src/ui/presentation/projects/UpgradeWizard/abstractions/UpgradeWizardPresenter.ts` — getChangelogs/reResolveChangelogs return IChangelogResult
- Modify: `src/ui/presentation/projects/UpgradeWizard/UpgradeWizardPresenter.ts` — update return types

**Produces:** Gateway and presenter methods return `{ entries, resolving }` instead of just entries

- [ ] **Step 1: Update changelog response types**

Both gateway abstractions need a new return type for `getChangelogs` and `reResolveChangelogs`:

```typescript
export interface IChangelogResult {
  entries: IChangelogEntry[];
  resolving: boolean;
}
```

Update method signatures:

```typescript
getChangelogs(packageName: string, from: string, to: string): Promise<IChangelogResult>;
reResolveChangelogs(packageName: string, from: string, to: string): Promise<IChangelogResult>;
```

- [ ] **Step 2: Update gateway implementations**

Both `PackagesGateway.ts` and `ProjectsGateway.ts`:

```typescript
public async getChangelogs(
    packageName: string,
    from: string,
    to: string
): Promise<Abstraction.ChangelogResult> {
    const response = await this.httpClient.request(getChangelogsRoute, {
        params: { packageName },
        query: { from, to }
    });
    return { entries: response.items, resolving: response.resolving };
}
```

Same pattern for `reResolveChangelogs`.

- [ ] **Step 3: Update presenter methods that call gateways**

Update return types in presenters (`ProjectDetailPresenter`, `PackagesPresenter`, `UpgradeWizardPresenter`) and their abstractions to return `IChangelogResult` instead of `IChangelogEntry[]`.

- [ ] **Step 4: Build check**

```bash
yarn build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/
git commit -m "feat: update UI gateways for async changelog response"
```
