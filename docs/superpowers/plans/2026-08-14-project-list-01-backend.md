# Project List Enhancements — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add API-side sorting, engine status filtering, and project rename to the project list endpoint.

**Architecture:** Denormalize `engineStatus` and `rootEnginesNode` onto the `projects` table via migration, add sort/filter params to `ListProjectsUseCase`, update them after each engine scan in `EngineScanJobExecutor`, and create a new `UpdateProjectUseCase` for renaming.

**Tech Stack:** Drizzle ORM, SQLite, Zod, Fastify, Vitest

**Spec:** `docs/superpowers/specs/2026-08-14-project-list-enhancements-design.md`

## Global Constraints

- Migrations via `drizzle-kit generate` only — never hand-write SQL
- Use `safeParse()` never `parse()` for Zod validation
- Named interfaces with `I` prefix — never inline structural types
- Use full words in identifiers — never abbreviate
- Run `yarn format:fix && yarn lint:fix` before each commit
- Run `yarn full` to verify after each commit

---

### Task 1: Database Migration — Add Engine Columns to Projects

**Files:**
- Modify: `src/api/db/schema.ts` (add `engineStatus` and `rootEnginesNode` columns)
- Create: migration file via `drizzle-kit generate`

**Interfaces:**
- Consumes: nothing
- Produces: `projects.engineStatus: text("engine_status")`, `projects.rootEnginesNode: text("root_engines_node")` — used by Tasks 2, 3, 4

- [ ] **Step 1: Add columns to schema.ts**

In `src/api/db/schema.ts`, add two nullable columns to the `projects` table:

```typescript
export const projects = sqliteTable("projects", {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    path: text("path").notNull().unique(),
    packageManager: text("package_manager"),
    pmVersion: text("pm_version"),
    addedAt: integer("added_at").notNull(),
    lastScannedAt: integer("last_scanned_at"),
    engineStatus: text("engine_status"),
    rootEnginesNode: text("root_engines_node")
});
```

- [ ] **Step 2: Generate migration**

Run: `yarn drizzle-kit generate`

Verify a new migration SQL file appears in `src/api/db/migrations/`.

- [ ] **Step 3: Run full build to verify migration applies**

Run: `yarn full > /tmp/build-output.txt 2>&1`

Read tail of output file. Expected: all tests pass, no schema errors.

- [ ] **Step 4: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/api/db/schema.ts src/api/db/migrations/
git commit -m "feat: add engineStatus and rootEnginesNode columns to projects table"
```

---

### Task 2: ListProjectsUseCase — Sorting and Engine Status Filter

**Files:**
- Modify: `src/shared/routes/projects.ts` (add `sortBy`, `sortOrder`, `engineStatus` to querystring)
- Modify: `src/shared/responses/projects.ts` (add `engineStatus`, `rootEnginesNode` to `projectSchema`)
- Modify: `src/api/routes/useCases/projects/abstractions/ListProjectsUseCase.ts` (add params + data fields)
- Modify: `src/api/routes/useCases/projects/ListProjectsUseCase.ts` (implement sort + filter)
- Modify: `src/api/routes/projects/projectCrudRoutes.ts` (pass new query params to use case)
- Modify: `src/api/routes/useCases/projects/__tests__/ListProjectsUseCase.test.ts`

**Interfaces:**
- Consumes: `projects.engineStatus`, `projects.rootEnginesNode` from Task 1
- Produces: sorted/filtered project list with `engineStatus` and `rootEnginesNode` on each item — used by Tasks 3, 4, and UI plan

- [ ] **Step 1: Update shared route and response schemas**

In `src/shared/routes/projects.ts`, update `listProjectsRoute` querystring:

```typescript
querystring: z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(200).optional(),
    search: z.string().optional(),
    teamId: z.string().optional(),
    sortBy: z.enum(["name", "addedAt", "lastScannedAt", "engineStatus"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    engineStatus: z.string().optional()
}),
```

In `src/shared/responses/projects.ts`, add to `projectSchema`:

```typescript
export const projectSchema = z.object({
    id: z.string(),
    name: z.string(),
    path: z.string(),
    packageManager: z.string().nullable(),
    pmVersion: z.string().nullable(),
    addedAt: z.number(),
    lastScannedAt: z.number().nullable(),
    security: securityStatusSchema.nullable().optional(),
    hasNodeModules: z.boolean(),
    teams: z.array(projectTeamBadgeSchema).optional(),
    engineStatus: z.string().nullable().optional(),
    rootEnginesNode: z.string().nullable().optional()
});
```

- [ ] **Step 2: Update use case abstraction**

In `src/api/routes/useCases/projects/abstractions/ListProjectsUseCase.ts`, add to params:

```typescript
export interface IListProjectsUseCaseParams {
    page?: number | undefined;
    pageSize?: number | undefined;
    search?: string | undefined;
    teamId?: string | undefined;
    sortBy?: "name" | "addedAt" | "lastScannedAt" | "engineStatus" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    engineStatus?: string | undefined;
}
```

Add to `IProjectListItem`:

```typescript
export interface IProjectListItem {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
    addedAt: number;
    lastScannedAt: number | null;
    security: SecurityService.CheckResult | null;
    hasNodeModules: boolean;
    teams: IProjectTeamBadge[];
    engineStatus: string | null;
    rootEnginesNode: string | null;
}
```

- [ ] **Step 3: Write failing tests for sorting**

In `src/api/routes/useCases/projects/__tests__/ListProjectsUseCase.test.ts`, add:

```typescript
it("sorts by name ascending by default", async () => {
    const { useCase, db } = setup();
    insertProject(db, { name: "charlie" });
    insertProject(db, { name: "alpha" });
    insertProject(db, { name: "bravo" });

    const result = await useCase.execute({});

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    const names = result.value.items.map(item => item.name);
    expect(names).toEqual(["alpha", "bravo", "charlie"]);
});

it("sorts by name descending when sortOrder is desc", async () => {
    const { useCase, db } = setup();
    insertProject(db, { name: "alpha" });
    insertProject(db, { name: "charlie" });

    const result = await useCase.execute({ sortBy: "name", sortOrder: "desc" });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    const names = result.value.items.map(item => item.name);
    expect(names).toEqual(["charlie", "alpha"]);
});

it("sorts by lastScannedAt with nulls last", async () => {
    const { useCase, db } = setup();
    insertProject(db, { name: "never-scanned", lastScannedAt: null });
    insertProject(db, { name: "old", lastScannedAt: 1000 });
    insertProject(db, { name: "recent", lastScannedAt: 5000 });

    const result = await useCase.execute({ sortBy: "lastScannedAt", sortOrder: "desc" });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    const names = result.value.items.map(item => item.name);
    expect(names).toEqual(["recent", "old", "never-scanned"]);
});

it("sorts by engineStatus with eol first (ascending)", async () => {
    const { useCase, db } = setup();
    insertProject(db, { name: "healthy", engineStatus: "current" });
    insertProject(db, { name: "risky", engineStatus: "eol" });
    insertProject(db, { name: "aging", engineStatus: "maintenance" });

    const result = await useCase.execute({ sortBy: "engineStatus", sortOrder: "asc" });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    const names = result.value.items.map(item => item.name);
    expect(names).toEqual(["risky", "aging", "healthy"]);
});

it("sorts by engineStatus with null (never scanned) last", async () => {
    const { useCase, db } = setup();
    insertProject(db, { name: "no-scan", engineStatus: null });
    insertProject(db, { name: "eol-project", engineStatus: "eol" });

    const result = await useCase.execute({ sortBy: "engineStatus", sortOrder: "asc" });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    const names = result.value.items.map(item => item.name);
    expect(names).toEqual(["eol-project", "no-scan"]);
});
```

- [ ] **Step 4: Write failing tests for engine status filter**

```typescript
it("filters by single engine status", async () => {
    const { useCase, db } = setup();
    insertProject(db, { name: "eol-one", engineStatus: "eol" });
    insertProject(db, { name: "current-one", engineStatus: "current" });

    const result = await useCase.execute({ engineStatus: "eol" });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0]!.name).toBe("eol-one");
    expect(result.value.total).toBe(1);
});

it("filters by multiple comma-separated engine statuses", async () => {
    const { useCase, db } = setup();
    insertProject(db, { name: "eol-one", engineStatus: "eol" });
    insertProject(db, { name: "maint-one", engineStatus: "maintenance" });
    insertProject(db, { name: "current-one", engineStatus: "current" });

    const result = await useCase.execute({ engineStatus: "eol,maintenance" });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.items).toHaveLength(2);
    expect(result.value.total).toBe(2);
});

it("includes engineStatus and rootEnginesNode in response items", async () => {
    const { useCase, db } = setup();
    insertProject(db, { name: "with-engine", engineStatus: "active-lts", rootEnginesNode: ">=18" });

    const result = await useCase.execute({});

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.items[0]!.engineStatus).toBe("active-lts");
    expect(result.value.items[0]!.rootEnginesNode).toBe(">=18");
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `yarn vitest run src/api/routes/useCases/projects/__tests__/ListProjectsUseCase.test.ts > /tmp/test-output.txt 2>&1`

Expected: FAIL — params not accepted, no sorting, no filtering.

- [ ] **Step 6: Implement sorting and filtering in ListProjectsUseCase**

In `src/api/routes/useCases/projects/ListProjectsUseCase.ts`, update the `execute` method:

```typescript
import { existsSync } from "fs";
import { join } from "path";
import { eq, sql, inArray, like, or, asc, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SecurityService } from "#api/services/Security/index.js";
import { projects, teams, teamProjects } from "#api/db/schema.js";
import { ListProjectsUseCase as Abstraction } from "./abstractions/ListProjectsUseCase.js";

const ENGINE_STATUS_PRIORITY = sql`CASE ${projects.engineStatus}
    WHEN 'eol' THEN 0
    WHEN 'maintenance' THEN 1
    WHEN 'unknown' THEN 2
    WHEN 'active-lts' THEN 3
    WHEN 'current' THEN 4
    ELSE 5
END`;

function buildOrderBy(
    sortBy: string | undefined,
    sortOrder: string | undefined
): SQL[] {
    const direction = sortOrder === "desc" ? desc : asc;

    switch (sortBy) {
        case "addedAt":
            return [direction(projects.addedAt)];
        case "lastScannedAt":
            return [
                asc(sql`CASE WHEN ${projects.lastScannedAt} IS NULL THEN 1 ELSE 0 END`),
                direction(projects.lastScannedAt)
            ];
        case "engineStatus":
            return [
                sortOrder === "desc"
                    ? desc(ENGINE_STATUS_PRIORITY)
                    : asc(ENGINE_STATUS_PRIORITY)
            ];
        case "name":
        default:
            return [direction(projects.name)];
    }
}
```

Add to `execute()`, before `listQuery.limit(pageSize)`:

```typescript
if (params.engineStatus) {
    const statuses = params.engineStatus.split(",").map(s => s.trim());
    conditions.push(inArray(projects.engineStatus, statuses));
}
```

Replace the bare `listQuery.limit(pageSize).offset(offset).all()` with:

```typescript
const orderClauses = buildOrderBy(params.sortBy, params.sortOrder);
const pagedProjects = await listQuery
    .orderBy(...orderClauses)
    .limit(pageSize)
    .offset(offset)
    .all();
```

Also add `engineStatus` and `rootEnginesNode` to the returned items:

```typescript
const items = await Promise.all(
    pagedProjects.map(async project => {
        const security = await this.securityService.getLatest(project.id);
        return {
            ...project,
            security,
            hasNodeModules: existsSync(join(project.path, "node_modules")),
            teams: teamsByProject.get(project.id) ?? [],
            engineStatus: project.engineStatus ?? null,
            rootEnginesNode: project.rootEnginesNode ?? null
        };
    })
);
```

The `WHERE` clause with `engineStatus` filter is already applied to the count query because `conditions` is shared. The count query doesn't need ordering.

- [ ] **Step 7: Update route handler to pass new params**

In `src/api/routes/projects/projectCrudRoutes.ts`, update the `listProjectsRoute` handler:

```typescript
registerRoute(app, listProjectsRoute, {}, async (request, reply) => {
    const useCase = container.resolve(ListProjectsUseCase);
    const result = await useCase.execute({
        page: request.query.page,
        pageSize: request.query.pageSize,
        search: request.query.search,
        teamId: request.query.teamId,
        sortBy: request.query.sortBy,
        sortOrder: request.query.sortOrder,
        engineStatus: request.query.engineStatus
    });

    return sendList<ListProjectsResponse>({
        reply,
        request,
        result
    });
});
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `yarn vitest run src/api/routes/useCases/projects/__tests__/ListProjectsUseCase.test.ts > /tmp/test-output.txt 2>&1`

Expected: PASS

- [ ] **Step 9: Run full build**

Run: `yarn full > /tmp/build-output.txt 2>&1`

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/shared/routes/projects.ts src/shared/responses/projects.ts src/api/routes/useCases/projects/ src/api/routes/projects/projectCrudRoutes.ts
git commit -m "feat: add sorting and engine status filtering to list projects API"
```

---

### Task 3: Update Engine Status After Scan

**Files:**
- Modify: `src/api/services/JobExecution/executors/EngineScanJobExecutor.ts`
- Modify: `src/api/services/JobExecution/executors/__tests__/EngineScanJobExecutor.test.ts`

**Interfaces:**
- Consumes: `projects.engineStatus`, `projects.rootEnginesNode` from Task 1; `IEngineScanResult.rootStatus`, `IEngineScanResult.rootEnginesNode` from `EngineService`
- Produces: updated `projects` rows with engine status after each scan — used by Task 2's sort/filter and UI plan

- [ ] **Step 1: Write the failing test**

In `src/api/services/JobExecution/executors/__tests__/EngineScanJobExecutor.test.ts`, add:

```typescript
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { projects } from "#api/db/schema.js";
```

Add a new test inside the existing `describe("EngineScanJobExecutor", ...)` block:

```typescript
it("updates the project's engineStatus and rootEnginesNode after a successful scan", async () => {
    const { container, db } = createTestApiContainer();
    const projectId = generateId();
    db.insert(projects)
        .values({
            id: projectId,
            name: "test-project",
            path: testDir,
            packageManager: "yarn",
            pmVersion: "4.0.0",
            addedAt: Date.now()
        })
        .run();

    const scanResult: EngineService.ScanResult = {
        rootStatus: "active-lts",
        rootEnginesNode: ">=18",
        findings: [],
        summary: {
            totalProjects: 1,
            counts: { eol: 0, maintenance: 0, activeLts: 1, current: 0, unknown: 0 },
            projectSummaries: [],
            staleProjectCount: 0,
            stalenessThresholdMs: 604800000
        }
    };

    container.registerInstance(EngineService, createStubEngineService(scanResult));
    container.registerInstance(WebSocketBroadcaster, createStubWebSocketBroadcaster());
    container.register(EngineScanJobExecutorRegistration);
    const executor = container.resolve(EngineScanJobExecutor);

    await executor.execute(makeContext({ referenceId: projectId, projectPath: testDir }));

    const row = db.select().from(projects).where(eq(projects.id, projectId)).get();
    expect(row?.engineStatus).toBe("active-lts");
    expect(row?.rootEnginesNode).toBe(">=18");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/api/services/JobExecution/executors/__tests__/EngineScanJobExecutor.test.ts > /tmp/test-output.txt 2>&1`

Expected: FAIL — `engineStatus` is null because executor doesn't update the projects table yet.

- [ ] **Step 3: Add DatabaseClient dependency and update implementation**

In `src/api/services/JobExecution/executors/EngineScanJobExecutor.ts`:

```typescript
import { eq } from "drizzle-orm";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { EngineScanJobExecutor as Abstraction } from "./abstractions/EngineScanJobExecutor.js";
import { EngineService } from "../../Engine/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects } from "#api/db/schema.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";

class EngineScanJobExecutorImpl implements Abstraction.Interface {
    public readonly type = "engine-scan" as const;

    public constructor(
        private readonly engineService: EngineService.Interface,
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface
    ) {}

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const projectId = context.referenceId;

        context.appendLog(`Starting engine scan for project ${projectId}`);
        context.setProgress({ percent: 0, label: "Scanning engines..." });

        const result = await this.engineService.scan({
            projectId,
            projectPath: context.projectPath,
            warnMaintenance: true
        });

        await this.databaseClient.db
            .update(projects)
            .set({
                engineStatus: result.rootStatus,
                rootEnginesNode: result.rootEnginesNode
            })
            .where(eq(projects.id, projectId))
            .run();

        this.webSocketBroadcaster.broadcast("engine-scan:complete", {
            projectId,
            counts: result.summary.counts
        });

        context.setProgress({ percent: 100, label: "Engine scan complete" });
        context.appendLog(
            `Engine scan complete: ${result.summary.counts.eol} EOL, ${result.summary.counts.maintenance} maintenance, ${result.summary.counts.activeLts} active LTS, ${result.summary.counts.current} current, ${result.summary.counts.unknown} unknown`
        );
    }
}

export const EngineScanJobExecutor = Abstraction.createImplementation({
    implementation: EngineScanJobExecutorImpl,
    dependencies: [EngineService, DatabaseClient, WebSocketBroadcaster]
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/api/services/JobExecution/executors/__tests__/EngineScanJobExecutor.test.ts > /tmp/test-output.txt 2>&1`

Expected: PASS

- [ ] **Step 5: Run full build**

Run: `yarn full > /tmp/build-output.txt 2>&1`

Read tail. Expected: all tests pass. If tests that resolve `EngineScanJobExecutor` from the container break because of the new `DatabaseClient` dependency, they need no change — `createTestApiContainer()` already provides `DatabaseClient`. If mock-based tests break (registering via `container.registerInstance`), they don't need to mock `DatabaseClient` because the real one from the test container works.

- [ ] **Step 6: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/api/services/JobExecution/executors/EngineScanJobExecutor.ts src/api/services/JobExecution/executors/__tests__/EngineScanJobExecutor.test.ts
git commit -m "feat: update project engineStatus after engine scan completes"
```

---

### Task 4: UpdateProjectUseCase — Project Rename

**Files:**
- Create: `src/api/routes/useCases/projects/abstractions/UpdateProjectUseCase.ts`
- Create: `src/api/routes/useCases/projects/UpdateProjectUseCase.ts`
- Create: `src/api/routes/useCases/projects/__tests__/UpdateProjectUseCase.test.ts`
- Modify: `src/api/routes/useCases/projects/feature.ts` (register)
- Modify: `src/api/routes/useCases/projects/index.ts` (export abstraction)
- Modify: `src/shared/routes/projects.ts` (add `updateProjectRoute`)
- Modify: `src/shared/responses/projects.ts` (add `updateProjectResponseSchema` + type export)
- Modify: `src/shared/routes/index.ts` (export new route)
- Modify: `src/shared/responses/index.ts` (export new type)
- Modify: `src/api/routes/projects/projectCrudRoutes.ts` (register PATCH handler)
- Modify: `src/shared/errors.ts` (add `INameAlreadyExistsError`)
- Modify: `src/shared/index.ts` (export `INameAlreadyExistsError`)

**Interfaces:**
- Consumes: `projects` table, `IProjectNotFoundError` from `src/shared/errors.ts`
- Produces: `UpdateProjectUseCase` abstraction + implementation + PATCH `/api/projects/:id` endpoint — used by UI plan

- [ ] **Step 1: Add error type and export it**

In `src/shared/errors.ts`, add:

```typescript
export interface INameAlreadyExistsError {
    code: "NAME_ALREADY_EXISTS";
    statusCode: 409;
    message: string;
}
```

In `src/shared/index.ts`, update the errors export line:

```typescript
export { type IUnexpectedError, type IProjectNotFoundError, type INameAlreadyExistsError, unexpectedError } from "./errors.js";
```

- [ ] **Step 2: Create abstraction**

Create `src/api/routes/useCases/projects/abstractions/UpdateProjectUseCase.ts`:

```typescript
import {
    createAbstraction,
    Result,
    type IUnexpectedError,
    type IProjectNotFoundError,
    type INameAlreadyExistsError
} from "#shared/index.js";

export interface IUpdateProjectUseCaseParams {
    id: string;
    name: string;
}

export interface IUpdateProjectUseCaseData {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
    addedAt: number;
    lastScannedAt: number | null;
    hasNodeModules: boolean;
    engineStatus: string | null;
    rootEnginesNode: string | null;
}

export interface IUpdateProjectUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    nameAlreadyExists: INameAlreadyExistsError;
    unexpected: IUnexpectedError;
}

type UpdateProjectUseCaseError = IUpdateProjectUseCaseErrors[keyof IUpdateProjectUseCaseErrors];

export interface IUpdateProjectUseCase {
    execute(
        params: IUpdateProjectUseCaseParams
    ): Promise<Result<IUpdateProjectUseCaseData, UpdateProjectUseCaseError>>;
}

export const UpdateProjectUseCase = createAbstraction<IUpdateProjectUseCase>(
    "Api/UpdateProjectUseCase"
);

export namespace UpdateProjectUseCase {
    export type Interface = IUpdateProjectUseCase;
    export type Params = IUpdateProjectUseCaseParams;
    export type Data = IUpdateProjectUseCaseData;
    export type Error = UpdateProjectUseCaseError;
}
```

- [ ] **Step 3: Add route and response schema**

In `src/shared/routes/projects.ts`, add:

```typescript
export const updateProjectRoute = defineRoute({
    method: "PATCH",
    path: "/api/projects/:id",
    description: "Update a project",
    params: z.object({ id: z.string() }),
    body: z.object({ name: z.string().trim().min(1).max(100) }),
    response: updateProjectResponseSchema
});
```

In `src/shared/responses/projects.ts`, add:

```typescript
export const updateProjectResponseSchema = z.object({ item: projectSchema });
export type UpdateProjectResponse = z.infer<typeof updateProjectResponseSchema>;
```

Export from `src/shared/routes/index.ts` and `src/shared/responses/index.ts`.

- [ ] **Step 4: Write failing tests**

Create `src/api/routes/useCases/projects/__tests__/UpdateProjectUseCase.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";
import { UpdateProjectUseCase, ProjectsUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    const useCase = container.resolve(UpdateProjectUseCase);
    return { useCase, db };
}

function insertProject(db: TestDb, overrides: Partial<typeof projects.$inferInsert> = {}): string {
    const id = overrides.id ?? generateId();
    db.insert(projects)
        .values({
            id,
            name: "original-name",
            path: `/tmp/${id}`,
            packageManager: "yarn",
            pmVersion: "4.0.0",
            addedAt: Date.now(),
            ...overrides
        })
        .run();
    return id;
}

describe("UpdateProjectUseCase", () => {
    it("renames a project and returns the updated data", async () => {
        const { useCase, db } = setup();
        const id = insertProject(db, { name: "old-name" });

        const result = await useCase.execute({ id, name: "new-name" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) return;
        expect(result.value.name).toBe("new-name");

        const row = db.select().from(projects).where(eq(projects.id, id)).get();
        expect(row?.name).toBe("new-name");
    });

    it("trims whitespace from the name", async () => {
        const { useCase, db } = setup();
        const id = insertProject(db);

        const result = await useCase.execute({ id, name: "  trimmed  " });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) return;
        expect(result.value.name).toBe("trimmed");
    });

    it("returns PROJECT_NOT_FOUND for a non-existent project", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({ id: "non-existent", name: "anything" });

        expect(result.isOk()).toBe(false);
        if (result.isOk()) return;
        expect(result.error.code).toBe("PROJECT_NOT_FOUND");
        expect(result.error.statusCode).toBe(404);
    });

    it("returns NAME_ALREADY_EXISTS when another project has the same name", async () => {
        const { useCase, db } = setup();
        insertProject(db, { name: "taken-name" });
        const id = insertProject(db, { name: "my-name" });

        const result = await useCase.execute({ id, name: "taken-name" });

        expect(result.isOk()).toBe(false);
        if (result.isOk()) return;
        expect(result.error.code).toBe("NAME_ALREADY_EXISTS");
        expect(result.error.statusCode).toBe(409);
    });

    it("allows renaming to the same name (no-op)", async () => {
        const { useCase, db } = setup();
        const id = insertProject(db, { name: "same-name" });

        const result = await useCase.execute({ id, name: "same-name" });

        expect(result.isOk()).toBe(true);
    });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `yarn vitest run src/api/routes/useCases/projects/__tests__/UpdateProjectUseCase.test.ts > /tmp/test-output.txt 2>&1`

Expected: FAIL — use case not implemented.

- [ ] **Step 6: Implement UpdateProjectUseCase**

Create `src/api/routes/useCases/projects/UpdateProjectUseCase.ts`:

```typescript
import { existsSync } from "fs";
import { join } from "path";
import { eq, and, ne } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects } from "#api/db/schema.js";
import { UpdateProjectUseCase as Abstraction } from "./abstractions/UpdateProjectUseCase.js";

class UpdateProjectUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const trimmedName = params.name.trim();

            const existing = db.select().from(projects).where(eq(projects.id, params.id)).get();
            if (!existing) {
                return Result.fail({
                    code: "PROJECT_NOT_FOUND",
                    statusCode: 404,
                    message: `Project ${params.id} not found`
                });
            }

            const duplicate = db
                .select()
                .from(projects)
                .where(and(eq(projects.name, trimmedName), ne(projects.id, params.id)))
                .get();

            if (duplicate) {
                return Result.fail({
                    code: "NAME_ALREADY_EXISTS",
                    statusCode: 409,
                    message: `A project named "${trimmedName}" already exists`
                });
            }

            db.update(projects)
                .set({ name: trimmedName })
                .where(eq(projects.id, params.id))
                .run();

            const updated = db.select().from(projects).where(eq(projects.id, params.id)).get()!;

            return Result.ok({
                id: updated.id,
                name: updated.name,
                path: updated.path,
                packageManager: updated.packageManager,
                pmVersion: updated.pmVersion,
                addedAt: updated.addedAt,
                lastScannedAt: updated.lastScannedAt,
                hasNodeModules: existsSync(join(updated.path, "node_modules")),
                engineStatus: updated.engineStatus ?? null,
                rootEnginesNode: updated.rootEnginesNode ?? null
            });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const UpdateProjectUseCase = Abstraction.createImplementation({
    implementation: UpdateProjectUseCaseImpl,
    dependencies: [DatabaseClient]
});
```

- [ ] **Step 7: Register in DI and exports**

In `src/api/routes/useCases/projects/feature.ts`, add import and registration:

```typescript
import { UpdateProjectUseCase } from "./UpdateProjectUseCase.js";
// in register():
container.register(UpdateProjectUseCase);
```

In `src/api/routes/useCases/projects/index.ts`, add export (abstraction only — matches existing pattern):

```typescript
export { UpdateProjectUseCase } from "./abstractions/UpdateProjectUseCase.js";
```

- [ ] **Step 8: Register PATCH route handler**

In `src/api/routes/projects/projectCrudRoutes.ts`, add the import and handler:

```typescript
import type { UpdateProjectResponse } from "#shared/responses/index.js";
import { updateProjectRoute } from "#shared/routes/index.js";
import { UpdateProjectUseCase } from "../useCases/projects/index.js";

// Inside registerProjectCrudRoutes:
registerRoute(
    app,
    updateProjectRoute,
    { preHandler: [requirePermission("full")] },
    async (request, reply) => {
        const useCase = container.resolve(UpdateProjectUseCase);
        const result = await useCase.execute({
            id: request.params.id,
            name: request.body.name
        });

        return sendOne<UpdateProjectResponse>({
            reply,
            request,
            result
        });
    }
);
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `yarn vitest run src/api/routes/useCases/projects/__tests__/UpdateProjectUseCase.test.ts > /tmp/test-output.txt 2>&1`

Expected: PASS

- [ ] **Step 10: Run full build**

Run: `yarn full > /tmp/build-output.txt 2>&1`

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/shared/ src/api/routes/useCases/projects/ src/api/routes/projects/projectCrudRoutes.ts
git commit -m "feat: add UpdateProjectUseCase for project rename via PATCH endpoint"
```
