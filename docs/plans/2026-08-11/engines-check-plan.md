# Engines Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect projects and dependencies targeting EOL or maintenance-phase Node.js versions, surfaced in both CLI and UI.

**Architecture:** Shared pure functions for engine classification (`src/shared/engines/`), API service with DB persistence (`src/api/services/Engine/`), CLI step in scan pipeline, UI features + presentation layer. Node release data fetched from endoflife.date API, cached in DB, with embedded constant fallback.

**Tech Stack:** TypeScript, Drizzle ORM (SQLite), Zod validation, Vitest, Fastify routes, MobX presenters, Mantine UI components.

## Global Constraints

- Yarn 4 for all commands (`yarn full` for pipeline)
- Named interfaces only (no inline structural types)
- Object params with named keys for functions with 2+ params
- Full words in identifiers (no abbreviations)
- Abstractions in `abstractions/` directory, one file per DI token
- Implementations use `createImplementation`, never export `*Impl`
- Tests use `createTestApiContainer` / `createTestCliContainer`, never `new XxxImpl()`
- All JSON.parse from external sources validated with Zod
- DB migrations via `drizzle-kit generate`
- Format/lint before commit (`yarn lint:fix && yarn format:fix`)

---

### Task 1: Shared Engine Types and Classification Functions

**Files:**

- Create: `src/shared/engines/types.ts`
- Create: `src/shared/engines/nodeReleases.ts`
- Create: `src/shared/engines/parseEnginesNode.ts`
- Create: `src/shared/engines/classifyNodeVersion.ts`
- Create: `src/shared/engines/index.ts`
- Test: `src/shared/engines/__tests__/parseEnginesNode.test.ts`
- Test: `src/shared/engines/__tests__/classifyNodeVersion.test.ts`

**Interfaces:**

- Consumes: nothing (foundation task)
- Produces:
  - `EngineStatus` type: `"current" | "active-lts" | "maintenance" | "eol" | "unknown"`
  - `INodeRelease` interface: `{ version: number; codename: string | null; releaseDate: number; ltsStart: number | null; maintenanceStart: number | null; eolDate: number }`
  - `IEngineClassification` interface: `{ status: EngineStatus; eolDate: number | null; codename: string | null }`
  - `parseEnginesNode(enginesField: string): number | null`
  - `classifyNodeVersion(input: { majorVersion: number; schedule: INodeRelease[]; now?: number }): IEngineClassification`
  - `NODE_RELEASES: INodeRelease[]` constant

- [ ] **Step 1: Write types**

Create `src/shared/engines/types.ts`:

```typescript
export type EngineStatus = "current" | "active-lts" | "maintenance" | "eol" | "unknown";

export interface INodeRelease {
  version: number;
  codename: string | null;
  releaseDate: number;
  ltsStart: number | null;
  maintenanceStart: number | null;
  eolDate: number;
}

export interface IEngineClassification {
  status: EngineStatus;
  eolDate: number | null;
  codename: string | null;
}

export interface IEngineStatusCounts {
  eol: number;
  maintenance: number;
  activeLts: number;
  current: number;
  unknown: number;
}
```

- [ ] **Step 2: Write NODE_RELEASES constant**

Create `src/shared/engines/nodeReleases.ts` with the embedded fallback schedule. Include Node 16-24+ with real dates from the Node.js release schedule. Dates as timestamps.

```typescript
import type { INodeRelease } from "./types.js";

export const NODE_RELEASES: INodeRelease[] = [
  {
    version: 16,
    codename: "Gallium",
    releaseDate: Date.UTC(2021, 3, 20),
    ltsStart: Date.UTC(2021, 9, 26),
    maintenanceStart: Date.UTC(2022, 9, 18),
    eolDate: Date.UTC(2023, 8, 11)
  },
  {
    version: 18,
    codename: "Hydrogen",
    releaseDate: Date.UTC(2022, 3, 19),
    ltsStart: Date.UTC(2022, 9, 25),
    maintenanceStart: Date.UTC(2023, 9, 18),
    eolDate: Date.UTC(2025, 3, 30)
  },
  {
    version: 20,
    codename: "Iron",
    releaseDate: Date.UTC(2023, 3, 18),
    ltsStart: Date.UTC(2023, 9, 24),
    maintenanceStart: Date.UTC(2024, 9, 22),
    eolDate: Date.UTC(2026, 3, 30)
  },
  {
    version: 22,
    codename: "Jod",
    releaseDate: Date.UTC(2024, 3, 24),
    ltsStart: Date.UTC(2024, 9, 29),
    maintenanceStart: Date.UTC(2025, 9, 21),
    eolDate: Date.UTC(2027, 3, 30)
  },
  {
    version: 24,
    codename: null,
    releaseDate: Date.UTC(2025, 4, 6),
    ltsStart: null,
    maintenanceStart: null,
    eolDate: Date.UTC(2025, 8, 1)
  }
];
```

Note: verify exact dates against https://nodejs.org/en/about/previous-releases at implementation time.

- [ ] **Step 3: Write failing tests for parseEnginesNode**

Create `src/shared/engines/__tests__/parseEnginesNode.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseEnginesNode } from "../parseEnginesNode.js";

describe("parseEnginesNode", () => {
  it("extracts minimum major from >=18.0.0", () => {
    expect(parseEnginesNode(">=18.0.0")).toBe(18);
  });

  it("extracts minimum major from ^20.0.0", () => {
    expect(parseEnginesNode("^20.0.0")).toBe(20);
  });

  it("extracts minimum major from ~22.1.0", () => {
    expect(parseEnginesNode("~22.1.0")).toBe(22);
  });

  it("extracts minimum major from bare version 18", () => {
    expect(parseEnginesNode("18")).toBe(18);
  });

  it("extracts minimum major from range >=16 <20", () => {
    expect(parseEnginesNode(">=16 <20")).toBe(16);
  });

  it("extracts minimum major from OR range >=18 || >=20", () => {
    expect(parseEnginesNode(">=18 || >=20")).toBe(18);
  });

  it("returns null for wildcard *", () => {
    expect(parseEnginesNode("*")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseEnginesNode("")).toBeNull();
  });

  it("returns null for unparsable value", () => {
    expect(parseEnginesNode("not-a-version")).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `yarn vitest run src/shared/engines/__tests__/parseEnginesNode.test.ts`
Expected: FAIL — module not found

- [ ] **Step 5: Implement parseEnginesNode**

Create `src/shared/engines/parseEnginesNode.ts`:

```typescript
export function parseEnginesNode(enginesField: string): number | null {
  if (!enginesField || enginesField === "*") {
    return null;
  }

  const versionPattern = /(?:>=?|[~^])?(\d+)/g;
  const matches: number[] = [];

  let match: RegExpExecArray | null;
  while ((match = versionPattern.exec(enginesField)) !== null) {
    const major = parseInt(match[1]!, 10);
    if (!isNaN(major)) {
      matches.push(major);
    }
  }

  if (matches.length === 0) {
    return null;
  }

  return Math.min(...matches);
}
```

- [ ] **Step 6: Run parseEnginesNode tests**

Run: `yarn vitest run src/shared/engines/__tests__/parseEnginesNode.test.ts`
Expected: PASS

- [ ] **Step 7: Write failing tests for classifyNodeVersion**

Create `src/shared/engines/__tests__/classifyNodeVersion.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { classifyNodeVersion } from "../classifyNodeVersion.js";
import { NODE_RELEASES } from "../nodeReleases.js";

describe("classifyNodeVersion", () => {
  it("classifies Node 16 as eol", () => {
    const result = classifyNodeVersion({
      majorVersion: 16,
      schedule: NODE_RELEASES,
      now: Date.UTC(2025, 7, 1)
    });
    expect(result.status).toBe("eol");
    expect(result.codename).toBe("Gallium");
  });

  it("classifies Node 22 as active-lts when in LTS window", () => {
    const result = classifyNodeVersion({
      majorVersion: 22,
      schedule: NODE_RELEASES,
      now: Date.UTC(2025, 7, 1)
    });
    expect(result.status).toBe("active-lts");
    expect(result.codename).toBe("Jod");
  });

  it("classifies Node 24 as current when before LTS start", () => {
    const result = classifyNodeVersion({
      majorVersion: 24,
      schedule: NODE_RELEASES,
      now: Date.UTC(2025, 7, 1)
    });
    expect(result.status).toBe("current");
  });

  it("classifies unknown major version as unknown", () => {
    const result = classifyNodeVersion({
      majorVersion: 99,
      schedule: NODE_RELEASES,
      now: Date.UTC(2025, 7, 1)
    });
    expect(result.status).toBe("unknown");
    expect(result.eolDate).toBeNull();
  });

  it("classifies node in maintenance window", () => {
    const result = classifyNodeVersion({
      majorVersion: 20,
      schedule: NODE_RELEASES,
      now: Date.UTC(2025, 7, 1)
    });
    expect(result.status).toBe("maintenance");
  });

  it("returns eolDate for known versions", () => {
    const result = classifyNodeVersion({
      majorVersion: 18,
      schedule: NODE_RELEASES,
      now: Date.UTC(2025, 7, 1)
    });
    expect(result.eolDate).toBe(Date.UTC(2025, 3, 30));
  });
});
```

- [ ] **Step 8: Run tests to verify they fail**

Run: `yarn vitest run src/shared/engines/__tests__/classifyNodeVersion.test.ts`
Expected: FAIL — module not found

- [ ] **Step 9: Implement classifyNodeVersion**

Create `src/shared/engines/classifyNodeVersion.ts`:

```typescript
import type { INodeRelease, IEngineClassification } from "./types.js";

export function classifyNodeVersion(input: {
  majorVersion: number;
  schedule: INodeRelease[];
  now?: number;
}): IEngineClassification {
  const { majorVersion, schedule, now = Date.now() } = input;
  const release = schedule.find(r => r.version === majorVersion);

  if (!release) {
    return { status: "unknown", eolDate: null, codename: null };
  }

  if (now >= release.eolDate) {
    return { status: "eol", eolDate: release.eolDate, codename: release.codename };
  }

  if (release.maintenanceStart !== null && now >= release.maintenanceStart) {
    return { status: "maintenance", eolDate: release.eolDate, codename: release.codename };
  }

  if (release.ltsStart !== null && now >= release.ltsStart) {
    return { status: "active-lts", eolDate: release.eolDate, codename: release.codename };
  }

  return { status: "current", eolDate: release.eolDate, codename: release.codename };
}
```

- [ ] **Step 10: Run classifyNodeVersion tests**

Run: `yarn vitest run src/shared/engines/__tests__/classifyNodeVersion.test.ts`
Expected: PASS

- [ ] **Step 11: Create barrel export**

Create `src/shared/engines/index.ts`:

```typescript
export type {
  EngineStatus,
  INodeRelease,
  IEngineClassification,
  IEngineStatusCounts
} from "./types.js";
export { parseEnginesNode } from "./parseEnginesNode.js";
export { classifyNodeVersion } from "./classifyNodeVersion.js";
export { NODE_RELEASES } from "./nodeReleases.js";
```

- [ ] **Step 12: Run full tests, commit**

Run: `yarn vitest run src/shared/engines/`
Expected: all pass

```bash
git add src/shared/engines/
git commit -m "feat: add shared engine classification types and functions"
```

---

### Task 2: Database Schema and Migration

**Files:**

- Modify: `src/api/db/schema.ts`
- Create: migration via `drizzle-kit generate`

**Interfaces:**

- Consumes: nothing
- Produces:
  - `nodeReleaseData` Drizzle table (columns: id, version, codename, releaseDate, ltsStart, maintenanceStart, eolDate, fetchedAt)
  - `engineChecks` Drizzle table (columns: id, projectId, packageName, enginesNode, minimumMajor, status, eolDate, scannedAt)

- [ ] **Step 1: Add tables to schema.ts**

Add to `src/api/db/schema.ts`:

```typescript
export const nodeReleaseData = sqliteTable(
  "node_release_data",
  {
    id: text("id").primaryKey(),
    version: integer("version").notNull(),
    codename: text("codename"),
    releaseDate: integer("release_date").notNull(),
    ltsStart: integer("lts_start"),
    maintenanceStart: integer("maintenance_start"),
    eolDate: integer("eol_date").notNull(),
    fetchedAt: integer("fetched_at").notNull()
  },
  table => ({
    uniqueVersion: unique().on(table.version)
  })
);

export const engineChecks = sqliteTable(
  "engine_checks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    packageName: text("package_name").notNull(),
    enginesNode: text("engines_node"),
    minimumMajor: integer("minimum_major"),
    status: text("status").notNull(),
    eolDate: integer("eol_date"),
    scannedAt: integer("scanned_at").notNull()
  },
  table => ({
    uniqueProjectPackage: unique().on(table.projectId, table.packageName)
  })
);
```

- [ ] **Step 2: Generate migration**

Run: `yarn drizzle-kit generate`

Verify a new migration file was created in `src/api/db/migrations/`.

- [ ] **Step 3: Run tests to verify migration works**

Run: `yarn vitest run src/api/db/__tests__/schema.test.ts`
Expected: PASS (test creates DB from schema and verifies tables exist)

- [ ] **Step 4: Commit**

```bash
git add src/api/db/schema.ts src/api/db/migrations/
git commit -m "feat: add node_release_data and engine_checks tables"
```

---

### Task 3: NodeReleaseDataService

**Files:**

- Create: `src/api/services/Engine/abstractions/NodeReleaseDataService.ts`
- Create: `src/api/services/Engine/NodeReleaseDataService.ts`
- Test: `src/api/services/Engine/__tests__/NodeReleaseDataService.test.ts`

**Interfaces:**

- Consumes: `nodeReleaseData` table from Task 2, `INodeRelease` from Task 1
- Produces:
  - `NodeReleaseDataService.Interface`: `{ getSchedule(): Promise<INodeRelease[]> }`

- [ ] **Step 1: Write abstraction**

Create `src/api/services/Engine/abstractions/NodeReleaseDataService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { INodeRelease } from "#shared/engines/types.js";

export interface INodeReleaseDataService {
  getSchedule(): Promise<INodeRelease[]>;
}

export const NodeReleaseDataService = createAbstraction<INodeReleaseDataService>(
  "Api/NodeReleaseDataService"
);

export namespace NodeReleaseDataService {
  export type Interface = INodeReleaseDataService;
}
```

- [ ] **Step 2: Write failing tests**

Create `src/api/services/Engine/__tests__/NodeReleaseDataService.test.ts`. Tests should cover:

- Returns cached DB data when fresh (fetchedAt < 24h)
- Fetches from API when DB cache is stale
- Falls back to stale DB data when API fails
- Falls back to embedded constant when DB empty AND API fails
- Upserts fetched data to DB
- Validates API response with Zod

Use `createTestApiContainer` for test setup. Mock `fetch` via `vi.stubGlobal`.

- [ ] **Step 3: Implement NodeReleaseDataService**

Create `src/api/services/Engine/NodeReleaseDataService.ts`. Implementation:

- Check DB for rows, compare newest `fetchedAt` against 24h threshold
- If stale or empty, fetch `https://endoflife.date/api/nodejs.json`
- Validate response with Zod schema (array of objects with `cycle`, `releaseDate`, `lts`, `maintenance`, `eol`, `codename`)
- Transform API response to `INodeRelease[]` and upsert to `nodeReleaseData`
- On fetch failure: return stale DB rows if available, else embedded `NODE_RELEASES`
- On DB insert failure after successful fetch: log error, return fresh API data

- [ ] **Step 4: Run tests**

Run: `yarn vitest run src/api/services/Engine/__tests__/NodeReleaseDataService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/services/Engine/
git commit -m "feat: add NodeReleaseDataService with API cache and fallback"
```

---

### Task 4: EngineService

**Files:**

- Create: `src/api/services/Engine/abstractions/EngineService.ts`
- Create: `src/api/services/Engine/EngineService.ts`
- Create: `src/api/services/Engine/feature.ts`
- Create: `src/api/services/Engine/index.ts`
- Modify: `src/api/feature.ts` (add EngineFeature to API compositor)
- Test: `src/api/services/Engine/__tests__/EngineService.test.ts`

**Interfaces:**

- Consumes: `NodeReleaseDataService` from Task 3, `engineChecks` table from Task 2, shared classification from Task 1
- Produces:
  - `EngineService.Interface`: `{ scan(input), getByProject(projectId), getSummary(options?) }`
  - `IEngineScanResult`: `{ rootStatus, rootEnginesNode, findings, summary }`
  - `IEngineCheck`: `{ id, projectId, packageName, enginesNode, minimumMajor, status, eolDate, scannedAt }`
  - `IEngineSummary`: `{ totalProjects, counts, projectSummaries }`

- [ ] **Step 1: Write abstraction**

Create `src/api/services/Engine/abstractions/EngineService.ts` with full interface, type namespace, and all result types (`IEngineScanResult`, `IEngineCheck`, `IEngineSummary`, `IProjectEngineSummary`).

- [ ] **Step 2: Write failing tests**

Create `src/api/services/Engine/__tests__/EngineService.test.ts`. Tests should cover:

- `scan()`: reads root package.json engines, walks node_modules, classifies, persists
- `scan()`: sweeps stale rows after upsert
- `scan()`: handles missing engines.node (status "unknown")
- `scan()`: handles malformed node_modules package.json gracefully
- `getByProject()`: returns persisted engine checks
- `getSummary()`: aggregates across projects

Use `createTestApiContainer`. Seed test projects and scan results first. For filesystem reads (package.json, node_modules), the service needs access to the filesystem — mock via DI (CommandRunner pattern or direct fs abstraction) or use real temp directories.

- [ ] **Step 3: Implement EngineService**

Create `src/api/services/Engine/EngineService.ts`. Key implementation details:

- `scan()`: use `readFileSync` + Zod parse for each package.json, walk `node_modules` with `readdirSync` recursively, skip `.bin` dirs, catch per-package errors
- Upsert via `INSERT ... ON CONFLICT DO UPDATE` on `(projectId, packageName)`
- Sweep stale rows with `scannedAt < currentScannedAt` (same pattern as VulnerabilityService)
- Use `parseEnginesNode` + `classifyNodeVersion` from shared module

- [ ] **Step 4: Create feature.ts and index.ts**

Create `src/api/services/Engine/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { NodeReleaseDataService } from "./NodeReleaseDataService.js";
import { EngineService } from "./EngineService.js";

export const EngineFeature = createFeature({
  name: "Api/EngineFeature",
  register(container) {
    container.register(NodeReleaseDataService).inSingletonScope();
    container.register(EngineService).inSingletonScope();
  }
});
```

Create `src/api/services/Engine/index.ts` exporting abstractions and feature.

Add `EngineFeature` to `src/api/feature.ts` compositor.

- [ ] **Step 5: Run tests**

Run: `yarn vitest run src/api/services/Engine/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/services/Engine/ src/api/feature.ts
git commit -m "feat: add EngineService with scan, getByProject, getSummary"
```

---

### Task 5: API Routes

**Files:**

- Create: `src/shared/routes/engines.ts`
- Modify: `src/shared/routes/index.ts`
- Create: `src/api/routes/engines.ts`
- Modify: `src/api/server.ts` (register engine routes)
- Test: `src/api/routes/__tests__/engines.test.ts`

**Interfaces:**

- Consumes: `EngineService` from Task 4
- Produces:
  - `GET /api/engines/summary` — aggregate engine status
  - `GET /api/engines/releases` — cached Node release schedule
  - `GET /api/engines/:projectId` — engine checks for project
  - `POST /api/engines/:projectId/scan` — trigger engine scan

- [ ] **Step 1: Write route definitions**

Create `src/shared/routes/engines.ts` with Zod-validated route definitions using `defineRoute`. Add export to `src/shared/routes/index.ts`.

- [ ] **Step 2: Write failing route tests**

Create `src/api/routes/__tests__/engines.test.ts` using `createTestApiContainer`. Tests:

- GET summary returns counts across projects
- GET releases returns release schedule
- GET by project returns engine checks
- POST scan returns jobId (or triggers scan and returns result)

- [ ] **Step 3: Implement routes**

Create `src/api/routes/engines.ts` with `registerEngineRoutes` function. Register summary route BEFORE `:projectId` route to avoid path shadowing. Register in `src/api/server.ts`.

- [ ] **Step 4: Run tests**

Run: `yarn vitest run src/api/routes/__tests__/engines.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/routes/engines.ts src/shared/routes/index.ts src/api/routes/engines.ts src/api/server.ts
git commit -m "feat: add engine check API routes"
```

---

### Task 6: EngineScanJobExecutor and Scan Integration

**Files:**

- Create: `src/api/services/JobExecution/executors/EngineScanJobExecutor.ts`
- Modify: `src/api/services/JobExecution/executors/JobExecutorRegistry.ts` (add EngineScanJobExecutor)
- Modify: `src/api/services/JobExecution/feature.ts` (register EngineScanJobExecutor)
- Modify: `src/api/services/JobExecution/executors/ScanJobExecutor.ts` (add "engine-scan" to PARALLEL_CHILD_TYPES)
- Modify: `src/shared/websocket/types.ts`
- Modify: `src/ui/infrastructure/Events/eventMap.ts`
- Test: `src/api/services/JobExecution/executors/__tests__/EngineScanJobExecutor.test.ts`

**Interfaces:**

- Consumes: `EngineService` from Task 4, `WebSocketBroadcaster`
- Produces: `engine-scan:complete` WS event after scan, `EngineScanJobExecutor` registered in executor registry

- [ ] **Step 1: Add WS event types**

Add to `src/shared/websocket/types.ts`:

```typescript
interface WSEngineScanComplete {
  projectId: string;
  counts: IEngineStatusCounts;
}
```

Add to WSEventMap: `"engine-scan:complete": WSEngineScanComplete`.

Map in `src/ui/infrastructure/Events/eventMap.ts`.

- [ ] **Step 2: Write failing test for EngineScanJobExecutor**

Create `src/api/services/JobExecution/executors/__tests__/EngineScanJobExecutor.test.ts`. Tests:

- Has type "engine-scan"
- Calls EngineService.scan with projectId and projectPath from context
- Broadcasts engine-scan:complete with counts
- Logs summary via appendLog

Use `createTestApiContainer` pattern matching existing executor tests.

- [ ] **Step 3: Implement EngineScanJobExecutor**

Create `src/api/services/JobExecution/executors/EngineScanJobExecutor.ts`. Same pattern as `VulnerabilityScanJobExecutor` or `LicenseScanJobExecutor`:

```typescript
class EngineScanJobExecutorImpl implements JobExecutor.Interface {
  public readonly type = "engine-scan" as const;

  public constructor(
    private readonly engineService: EngineService.Interface,
    private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface
  ) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    context.appendLog("Starting engine scan...");
    context.setProgress({ percent: 0, label: "Scanning engines" });

    const result = await this.engineService.scan({
      projectId: context.referenceId,
      projectPath: context.projectPath
    });

    this.webSocketBroadcaster.broadcast("engine-scan:complete", {
      projectId: context.referenceId,
      counts: result.summary.counts
    });

    context.appendLog(
      `Engine scan complete: ${result.summary.counts.eol} EOL, ${result.summary.counts.maintenance} maintenance`
    );
    context.setProgress({ percent: 100 });
  }
}

export const EngineScanJobExecutor = JobExecutor.createImplementation({
  implementation: EngineScanJobExecutorImpl,
  dependencies: [EngineService, WebSocketBroadcaster]
});
```

- [ ] **Step 4: Register in JobExecutorRegistry and feature.ts**

Add `EngineScanJobExecutor` import and registration to `JobExecutorRegistry` constructor and `feature.ts`.

- [ ] **Step 5: Add to ScanJobExecutor PARALLEL_CHILD_TYPES**

Add `"engine-scan"` to `PARALLEL_CHILD_TYPES` array in `ScanJobExecutor.ts`. Update log message from "Starting vulnerability, license and graph scans..." to include "engine".

- [ ] **Step 6: Run tests**

Run: `yarn vitest run src/api/services/JobExecution/executors/__tests__/EngineScanJobExecutor.test.ts`
Run: `yarn vitest run src/api/services/JobExecution/executors/__tests__/ScanJobExecutor.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/api/services/JobExecution/ src/shared/websocket/types.ts src/ui/infrastructure/Events/eventMap.ts
git commit -m "feat: add EngineScanJobExecutor, chain in ScanJobExecutor"
```

---

### Task 7: CLI CheckEnginesStep

**Files:**

- Create: `src/cli/commands/scan/steps/CheckEngines/abstractions/CheckEnginesStep.ts`
- Create: `src/cli/commands/scan/steps/CheckEngines/CheckEnginesStep.ts`
- Create: `src/cli/commands/scan/steps/CheckEngines/feature.ts`
- Create: `src/cli/commands/scan/steps/CheckEngines/index.ts`
- Modify: `src/cli/commands/scan/ScanCommand.ts` (add step to pipeline)
- Modify: `src/cli/commands/scan/feature.ts` (add CheckEnginesFeature)
- Modify: `src/cli/index.ts` (add "engines" to --check choices)
- Test: `src/cli/commands/scan/steps/CheckEngines/__tests__/CheckEnginesStep.test.ts`

**Interfaces:**

- Consumes: `parseEnginesNode`, `classifyNodeVersion`, `NODE_RELEASES` from Task 1, `IStepContext` pipeline context
- Produces: `context.results.set("engines", IEnginesFinding[])` for RenderOutputStep

- [ ] **Step 1: Write abstraction**

Create `src/cli/commands/scan/steps/CheckEngines/abstractions/CheckEnginesStep.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const CheckEnginesStep = createAbstraction<IStep>("Cli/CheckEnginesStep");

export namespace CheckEnginesStep {
  export type Interface = IStep;
}
```

- [ ] **Step 2: Write failing tests**

Create test file. Tests:

- Skips when check is not "engines" and not "all"
- Reads root package.json engines.node and classifies
- Walks node_modules and classifies dependency engines
- Stores findings in context.results
- Handles missing engines.node (status "unknown")
- Handles missing node_modules gracefully

Use `createTestCliContainer`. Set up temp directory with package.json + node_modules for filesystem reads.

- [ ] **Step 3: Implement CheckEnginesStep**

Create `src/cli/commands/scan/steps/CheckEngines/CheckEnginesStep.ts`. Implementation:

- Skip logic: read `context.options["check"]`, skip if not "engines" and not "all"
- Read root `package.json` from `context.dataDirectory`
- Parse `engines.node`, classify with `classifyNodeVersion` using embedded `NODE_RELEASES`
- Walk `node_modules/**/package.json` — read engines.node from each, classify
- Apply config ignores: `config.scan?.engines?.ignore` + `config.scan?.ignoredPackages`
- Store findings array in `context.results.set("engines", findings)`

- [ ] **Step 4: Create feature.ts and index.ts, wire into ScanCommand**

Create feature.ts, index.ts. Add `CheckEnginesStep` to `ScanCommand.steps()` array (after CheckVulnerabilities, before RenderOutput). Add `CheckEnginesFeature` to `ScanCommandFeature` dependencies. Add `"engines"` to `--check` choices in `src/cli/index.ts`.

- [ ] **Step 5: Run tests**

Run: `yarn vitest run src/cli/commands/scan/steps/CheckEngines/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/scan/steps/CheckEngines/ src/cli/commands/scan/ScanCommand.ts src/cli/commands/scan/feature.ts src/cli/index.ts
git commit -m "feat: add CheckEnginesStep to CLI scan pipeline"
```

---

### Task 8: Config Extension and Formatter Updates

**Files:**

- Modify: `src/shared/config/types.ts`
- Modify: `src/shared/config/schema.ts`
- Modify: `src/cli/commands/scan/formatters/types.ts`
- Modify: `src/cli/commands/scan/formatters/TableFormatter.ts`
- Modify: `src/cli/commands/scan/formatters/JsonFormatter.ts`
- Modify: `src/cli/commands/scan/formatters/CsvFormatter.ts`
- Modify: `src/cli/commands/scan/formatters/SarifFormatter.ts`
- Modify: `src/cli/commands/scan/steps/RenderOutput/RenderOutputStep.ts`
- Test: `src/cli/commands/scan/formatters/__tests__/` (extend existing tests)

**Interfaces:**

- Consumes: `IEnginesFinding` type, `EngineStatus` from Task 1
- Produces: Updated formatters that render engines findings alongside license/vulnerability

- [ ] **Step 1: Extend config types and schema**

Add `IEnginesScanConfig` to `src/shared/config/types.ts`:

```typescript
export interface IEnginesScanConfig {
  ignore?: string[];
  warnMaintenance?: boolean;
}
```

Add `engines?: IEnginesScanConfig` to `IScanConfig`. Add corresponding Zod schema to `src/shared/config/schema.ts`.

- [ ] **Step 2: Extend IScanFindings and IScanOutput**

Add to `src/cli/commands/scan/formatters/types.ts`:

```typescript
export interface IEnginesFinding {
  packageName: string;
  version: string;
  enginesNode: string | null;
  minimumMajor: number | null;
  status: EngineStatus;
  eolDate: number | null;
  isRoot: boolean;
}
```

Add `engines: IEnginesFinding[]` to `IScanFindings`. Add engines counts to `IScanSummary`.

- [ ] **Step 3: Update RenderOutputStep**

In `RenderOutputStep.ts`, read engines findings from context and include in IScanOutput:

```typescript
const engines = (context.results.get("engines") as IEnginesFinding[]) ?? [];
```

Add to the output object: `findings: { license: violations, vulnerability: vulnerabilities, engines }`.

Add engines summary counts to `IScanSummary`. Update `applyExitCode` to check for root EOL:

```typescript
if (input.engines.some(finding => finding.isRoot && finding.status === "eol")) {
  process.exitCode = 1;
  return;
}
```

- [ ] **Step 4: Update TableFormatter**

Add "Node Engines" section after vulnerabilities. Use ANSI colors: red for EOL, yellow for maintenance, green for current/active-lts, gray for unknown. Mark root entry with `[root]` prefix.

```typescript
if (output.findings.engines.length > 0) {
  lines.push("", "Node Engines", "");
  lines.push("| Package | engines.node | Status | EOL Date |");
  lines.push("| --- | --- | --- | --- |");
  for (const finding of output.findings.engines) {
    const prefix = finding.isRoot ? "[root] " : "";
    const eolDate = finding.eolDate ? new Date(finding.eolDate).toISOString().split("T")[0] : "-";
    lines.push(
      `| ${prefix}${finding.packageName} | ${finding.enginesNode ?? "-"} | ${finding.status} | ${eolDate} |`
    );
  }
}
```

- [ ] **Step 5: Update JsonFormatter**

Include engines array in JSON output (no special formatting — JSON formatter serializes IScanOutput directly).

- [ ] **Step 6: Update CsvFormatter**

Add `type=engines` rows:

```typescript
for (const finding of output.findings.engines) {
  rows.push(
    this.formatRow({
      type: "engines",
      packageName: finding.packageName,
      version: finding.enginesNode ?? "",
      detail: finding.status,
      severity:
        finding.status === "eol" ? "error" : finding.status === "maintenance" ? "warning" : "info",
      source: finding.isRoot ? "root" : "dependency",
      fixVersion: finding.eolDate ? new Date(finding.eolDate).toISOString().split("T")[0]! : ""
    })
  );
}
```

- [ ] **Step 7: Update SarifFormatter**

Add `engines/eol` and `engines/maintenance` rules:

```typescript
for (const finding of output.findings.engines) {
  if (finding.status !== "eol" && finding.status !== "maintenance") {
    continue;
  }
  const ruleId = `engines/${finding.status}`;
  const level = finding.status === "eol" ? "error" : "warning";
  const ruleIndex = addRule({
    rules,
    rule: {
      id: ruleId,
      shortDescription: { text: `Node.js ${finding.status} engine requirement` },
      defaultConfiguration: { level: level as SarifLevel }
    }
  });
  results.push({
    ruleId,
    ruleIndex,
    message: {
      text: `Package ${finding.packageName} requires Node.js ${finding.enginesNode ?? "unknown"} (${finding.status})`
    },
    locations: [{ physicalLocation: { artifactLocation: { uri: "package.json" } } }],
    properties: { status: finding.status, enginesNode: finding.enginesNode, isRoot: finding.isRoot }
  });
}
```

- [ ] **Step 8: Extend formatter tests**

Add engines findings to existing formatter test fixtures. Each formatter test gets a new test case with a mix of EOL root + maintenance dependency findings. Verify output includes engines section/rows/rules.

- [ ] **Step 6: Run all formatter + scan tests**

Run: `yarn vitest run src/cli/commands/scan/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/shared/config/ src/cli/commands/scan/
git commit -m "feat: extend config schema and formatters for engines findings"
```

---

### Task 9: UI Features Layer (Gateway + Repository)

**Files:**

- Create: `src/ui/features/Engines/abstractions/EnginesGateway.ts`
- Create: `src/ui/features/Engines/abstractions/EnginesRepository.ts`
- Create: `src/ui/features/Engines/EnginesGateway.ts`
- Create: `src/ui/features/Engines/EnginesRepository.ts`
- Create: `src/ui/features/Engines/feature.ts`
- Create: `src/ui/features/Engines/index.ts`
- Test: `src/ui/features/Engines/__tests__/EnginesGateway.test.ts`

**Interfaces:**

- Consumes: Route definitions from Task 5, `HTTPClient` abstraction
- Produces:
  - `EnginesGateway.Interface`: `{ getByProject(projectId), getSummary(), scan(projectId), getReleases() }`
  - `EnginesRepository.Interface`: holds engine checks + summary state

- [ ] **Step 1: Write abstractions**

Standard gateway + repository abstractions in `abstractions/` directory.

- [ ] **Step 2: Write failing gateway tests**

Mock HTTPClient, verify correct routes called with correct args.

- [ ] **Step 3: Implement gateway and repository**

Standard pattern — gateway calls HTTPClient.request with route definitions, repository holds state.

- [ ] **Step 4: Create feature.ts**

Register gateway and repository. Add to UI features compositor.

- [ ] **Step 5: Run tests, commit**

```bash
git add src/ui/features/Engines/
git commit -m "feat: add EnginesGateway and EnginesRepository"
```

---

### Task 10: UI Presentation — Project List Badges, Project Detail Section, Dashboard Widget

**Files:**

- Create: `src/ui/infrastructure/Shared/engines/EngineStatusBadge.tsx`
- Create: `src/ui/infrastructure/Shared/engines/engineStatusColors.ts`
- Modify: `src/ui/presentation/Projects/ProjectList/ProjectListPresenter.ts` (add engine status to VM)
- Modify: `src/ui/presentation/Projects/ProjectList/components/ProjectListPage.tsx` (render badge)
- Modify: `src/ui/presentation/Projects/ProjectDetail/ProjectDetailPresenter.ts` (add engine data loading)
- Create: `src/ui/presentation/Projects/ProjectDetail/components/EngineStatusSection.tsx`
- Modify: `src/ui/presentation/Dashboard/Dashboard/DashboardPresenter.ts` (add engine summary)
- Create: `src/ui/presentation/Dashboard/Dashboard/components/EngineOverviewWidget.tsx`

**Interfaces:**

- Consumes: `EnginesGateway`, `EnginesRepository` from Task 9, `EventBridge` for WS events

- [ ] **Step 1: Add engine status colors constant**

Create `src/ui/infrastructure/Shared/engines/engineStatusColors.ts`:

```typescript
import type { EngineStatus } from "#shared/engines/types.js";

export const ENGINE_STATUS_COLORS: Record<EngineStatus, string> = {
  current: "green",
  "active-lts": "green",
  maintenance: "yellow",
  eol: "red",
  unknown: "gray"
};
```

- [ ] **Step 2: Add EngineStatusBadge component**

Create `src/ui/infrastructure/Shared/engines/EngineStatusBadge.tsx`:

```tsx
import { Badge } from "@mantine/core";
import type { EngineStatus } from "#shared/engines/types.js";
import { ENGINE_STATUS_COLORS } from "./engineStatusColors.js";

interface IEngineStatusBadgeProps {
  status: EngineStatus;
}

export function EngineStatusBadge({ status }: IEngineStatusBadgeProps): React.ReactNode {
  return (
    <Badge size="xs" color={ENGINE_STATUS_COLORS[status]} variant="dot">
      {status}
    </Badge>
  );
}
```

- [ ] **Step 3: Integrate into project list**

Add `engineStatus: EngineStatus` field to `ProjectListPresenter.ViewModel.ProjectListItem`. Load engine summary via `EnginesGateway.getSummary()` in the load use case (parallel with project load). Render `EngineStatusBadge` in project list rows. Update `ProjectListPresenter` abstraction with the new VM field.

- [ ] **Step 4: Integrate into project detail**

Add engine data loading to `ProjectDetailPresenter`. Create `EngineStatusSection` as a Mantine Accordion item showing:

- Root engine status prominently (Badge + engines.node string + EOL date if applicable)
- Table of dependency findings sorted by severity (eol first, then maintenance)
- Use `EngineStatusBadge` for each row's status column

Subscribe to `engine-scan:complete` via `EventBridge` to auto-reload engine data.

- [ ] **Step 5: Add dashboard widget**

Create `EngineOverviewWidget`:

- Load engine summary via `EnginesGateway.getSummary()` (parallel with other dashboard data)
- Show 3 stat cards: EOL count (red), Maintenance count (yellow), Current/LTS count (green)
- Each card links to project list (future: filtered view)
- Subscribe to `engine-scan:complete` for auto-refresh

Add widget to `DashboardPresenter` and `DashboardPage`.

- [ ] **Step 6: Run all UI tests**

Run: `yarn vitest run src/ui/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/
git commit -m "feat: add engine status badges, project detail section, dashboard widget"
```

---

### Task 11: Integration Test and Final Verification

**Files:**

- Modify: `src/cli/commands/scan/__tests__/ScanPipeline.integration.test.ts`
- Modify: `src/api/__tests__/serverBoot.test.ts` (add engine routes to route audit)

**Interfaces:**

- Consumes: all previous tasks

- [ ] **Step 1: Extend scan pipeline integration test**

Add `--check engines` test case. Verify findings appear in output for a project with EOL engines.node.

- [ ] **Step 2: Extend server boot route audit**

Add engine routes to the 22-endpoint route audit in `serverBoot.test.ts`.

- [ ] **Step 3: Run full pipeline**

Run: `yarn full`
Expected: adio + lint + format + typecheck + build + all tests pass

- [ ] **Step 4: Update AGENTS.md**

Add Engine service documentation to the API layer section. Document new tables, routes, CLI option, and UI integration.

- [ ] **Step 5: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete engines check feature — integration tests and docs"
```
