# Auto-Fix PRs Part 1: Prerequisite Fix, Schema & Settings Service

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the license-scan:completed EventBus emission (prerequisite), create DB schema for auto-fix settings and PRs, and build AutoFixSettingsService.

**Architecture:** Migration 0007 adds two tables. AutoFixSettingsService provides CRUD for per-project auto-fix configuration with defaults. LicenseScanJobExecutor patched to emit EventBus event and inject EventBus dependency.

**Tech Stack:** TypeScript, Drizzle ORM, SQLite, vitest

## Global Constraints

- Use full words in identifiers — "AutoFix" not "AF", "PullRequest" not "PR" in type names
- Named interfaces only — no inline structural types
- Abstraction and implementation in separate files, separate directories
- Real SQLite in-memory for tests — no DB mocks, use `createTestDatabaseClient()` from `#testing/helpers/createTestDb.js`
- Yarn for package management
- Tests in `src/**/__tests__/**/*.test.ts`

---

### Task 1: Emit license-scan:completed EventBus event

**Files:**

- Modify: `src/api/services/jobExecutors/LicenseScanJobExecutor.ts` (add EventBus import, inject dependency, emit event)
- Modify: `src/api/services/jobExecutors/JobExecutorRegistry.ts` (pass EventBus to LicenseScanJobExecutor constructor)
- Modify: `src/api/services/jobExecutors/__tests__/LicenseScanJobExecutor.test.ts` (add EventBus mock, verify emit)

**Interfaces:**

- Consumes: `EventBus.Interface` from `src/api/services/abstractions/EventBus.ts` — `emit<K extends EventName>(event: K, ...args: IEventMap[K]): void`
- Produces: `"license-scan:completed"` EventBus event emitted at end of LicenseScanJobExecutor.execute()

- [ ] **Step 1: Update LicenseScanJobExecutor to inject EventBus and emit event**

In `src/api/services/jobExecutors/LicenseScanJobExecutor.ts`:

1. Add import: `import type { EventBus } from "../abstractions/EventBus.js";`
2. Add constructor parameter: `private readonly eventBus: EventBus.Interface` as last parameter
3. At end of `execute()`, after the WS broadcast, add: `this.eventBus.emit("license-scan:completed", projectId);`

- [ ] **Step 2: Update JobExecutorRegistry to pass EventBus**

In `src/api/services/jobExecutors/JobExecutorRegistry.ts`:

The `eventBus` parameter already exists in the constructor (passed to `ScanJobExecutor`). Pass it as the last argument to `new LicenseScanJobExecutor(...)`.

- [ ] **Step 3: Update tests**

In `src/api/services/jobExecutors/__tests__/LicenseScanJobExecutor.test.ts`:

1. Add mock EventBus: `const eventBus = { on: vi.fn(), off: vi.fn(), emit: vi.fn() };`
2. Pass it as last constructor argument wherever `LicenseScanJobExecutor` is instantiated
3. Add test: verify `eventBus.emit` called with `"license-scan:completed"` and correct projectId after execute()

- [ ] **Step 4: Verify all tests pass**

Run: `yarn test`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/api/services/jobExecutors/LicenseScanJobExecutor.ts src/api/services/jobExecutors/JobExecutorRegistry.ts src/api/services/jobExecutors/__tests__/LicenseScanJobExecutor.test.ts
git commit -m "fix(licenses): emit license-scan:completed EventBus event from LicenseScanJobExecutor"
```

---

### Task 2: Database schema and migration for auto-fix tables

**Files:**

- Modify: `src/api/db/schema.ts` (add two tables after `licenseViolations`)
- Create: `src/api/db/migrations/0007_add_auto_fix.sql`
- Modify: `src/api/db/migrations/meta/_journal.json` (add entry for 0007)
- Modify: `src/testing/helpers/createTestDb.ts` (add DDL for new tables)

**Interfaces:**

- Produces: `autoFixSettings` and `autoFixPullRequests` Drizzle table definitions

- [ ] **Step 1: Add table definitions to schema.ts**

Add after the `licenseViolations` table in `src/api/db/schema.ts`:

```typescript
export const autoFixSettings = sqliteTable(
  "auto_fix_settings",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    enabled: integer("enabled").notNull(),
    upgradeTypes: text("upgrade_types").notNull(),
    groupingStrategy: text("grouping_strategy").notNull(),
    branchPrefix: text("branch_prefix").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
  },
  table => ({
    uniqueProject: unique().on(table.projectId)
  })
);

export const autoFixPullRequests = sqliteTable(
  "auto_fix_pull_requests",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    packageNames: text("package_names").notNull(),
    fromVersions: text("from_versions").notNull(),
    toVersions: text("to_versions").notNull(),
    upgradeType: text("upgrade_type").notNull(),
    branchName: text("branch_name").notNull(),
    prUrl: text("pr_url"),
    prNumber: integer("pr_number"),
    status: text("status").notNull(),
    licenseWarnings: text("license_warnings"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
  },
  table => ({
    uniqueProjectBranch: unique().on(table.projectId, table.branchName)
  })
);
```

- [ ] **Step 2: Create migration SQL**

Create `src/api/db/migrations/0007_add_auto_fix.sql`:

```sql
CREATE TABLE `auto_fix_settings` (
    `id` text PRIMARY KEY NOT NULL,
    `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
    `enabled` integer NOT NULL,
    `upgrade_types` text NOT NULL,
    `grouping_strategy` text NOT NULL,
    `branch_prefix` text NOT NULL,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    UNIQUE(`project_id`)
);
--> statement-breakpoint
CREATE TABLE `auto_fix_pull_requests` (
    `id` text PRIMARY KEY NOT NULL,
    `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
    `package_names` text NOT NULL,
    `from_versions` text NOT NULL,
    `to_versions` text NOT NULL,
    `upgrade_type` text NOT NULL,
    `branch_name` text NOT NULL,
    `pr_url` text,
    `pr_number` integer,
    `status` text NOT NULL,
    `license_warnings` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    UNIQUE(`project_id`, `branch_name`)
);
```

- [ ] **Step 3: Add migration to journal**

Add entry to `src/api/db/migrations/meta/_journal.json`:

```json
{
  "idx": 7,
  "version": "6",
  "when": 1786147200000,
  "tag": "0007_add_auto_fix",
  "breakpoints": true
}
```

- [ ] **Step 4: Update createTestDb.ts**

Add DDL for both tables to the `CREATE_TABLES` string in `src/testing/helpers/createTestDb.ts`, including UNIQUE indexes.

- [ ] **Step 5: Verify build and tests**

Run: `yarn build && yarn test`
Expected: clean build, all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/api/db/schema.ts src/api/db/migrations/0007_add_auto_fix.sql src/api/db/migrations/meta/_journal.json src/testing/helpers/createTestDb.ts
git commit -m "feat(auto-fix): add auto_fix_settings and auto_fix_pull_requests DB schema"
```

---

### Task 3: AutoFixSettingsService

**Files:**

- Create: `src/api/services/abstractions/AutoFixSettingsService.ts`
- Create: `src/api/services/AutoFixSettingsService.ts`
- Create: `src/api/services/__tests__/AutoFixSettingsService.test.ts`
- Modify: `src/api/feature.ts` (register service in DI)

**Interfaces:**

- Consumes: `DatabaseClient.Interface`, `autoFixSettings` table, `generateId()` from `@webiny/stdlib`
- Produces: `AutoFixSettingsService.Interface` with:
  - `getSettings(projectId: string): Promise<AutoFixSettingsService.Settings | null>` — returns row or null
  - `getSettingsOrDefaults(projectId: string): Promise<AutoFixSettingsService.Settings>` — returns row or defaults
  - `updateSettings(projectId: string, input: AutoFixSettingsService.UpdateInput): Promise<AutoFixSettingsService.Settings>` — upsert
  - `Settings = { id, projectId, enabled, upgradeTypes: string[], groupingStrategy, branchPrefix, createdAt, updatedAt }`
  - `UpdateInput = { enabled?: boolean, upgradeTypes?: string[], groupingStrategy?: string, branchPrefix?: string }`

- [ ] **Step 1: Create abstraction**

Create `src/api/services/abstractions/AutoFixSettingsService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IAutoFixSettings {
  id: string;
  projectId: string;
  enabled: boolean;
  upgradeTypes: string[];
  groupingStrategy: string;
  branchPrefix: string;
  createdAt: number;
  updatedAt: number;
}

export interface IUpdateAutoFixSettingsInput {
  enabled?: boolean;
  upgradeTypes?: string[];
  groupingStrategy?: string;
  branchPrefix?: string;
}

export interface IAutoFixSettingsService {
  getSettings(projectId: string): Promise<IAutoFixSettings | null>;
  getSettingsOrDefaults(projectId: string): Promise<IAutoFixSettings>;
  updateSettings(projectId: string, input: IUpdateAutoFixSettingsInput): Promise<IAutoFixSettings>;
}

export const AutoFixSettingsService = createAbstraction<IAutoFixSettingsService>(
  "Api/AutoFixSettingsService"
);

export namespace AutoFixSettingsService {
  export type Interface = IAutoFixSettingsService;
  export type Settings = IAutoFixSettings;
  export type UpdateInput = IUpdateAutoFixSettingsInput;
}
```

- [ ] **Step 2: Write failing tests**

Create `src/api/services/__tests__/AutoFixSettingsService.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { generateId } from "@webiny/stdlib";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects, autoFixSettings } from "#api/db/schema.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";

async function createService(databaseClient: DatabaseClient.Interface) {
  const { AutoFixSettingsServiceImpl } = await import("#api/services/AutoFixSettingsService.js");
  return new AutoFixSettingsServiceImpl(databaseClient);
}

describe("AutoFixSettingsService", () => {
  let databaseClient: DatabaseClient.Interface;
  const projectId = "project-1";

  beforeEach(async () => {
    databaseClient = await createTestDatabaseClient();
    await databaseClient.db
      .insert(projects)
      .values({
        id: projectId,
        name: "Test Project",
        path: "/test",
        addedAt: Date.now()
      })
      .run();
  });

  it("should return null when no settings exist", async () => {
    const service = await createService(databaseClient);
    const result = await service.getSettings(projectId);
    expect(result).toBeNull();
  });

  it("should return defaults when no settings exist", async () => {
    const service = await createService(databaseClient);
    const result = await service.getSettingsOrDefaults(projectId);
    expect(result.enabled).toBe(false);
    expect(result.upgradeTypes).toEqual(["patch"]);
    expect(result.groupingStrategy).toBe("per-package");
    expect(result.branchPrefix).toBe("auto-fix/");
  });

  it("should create settings on first update", async () => {
    const service = await createService(databaseClient);
    const result = await service.updateSettings(projectId, {
      enabled: true,
      upgradeTypes: ["patch", "minor"]
    });
    expect(result.enabled).toBe(true);
    expect(result.upgradeTypes).toEqual(["patch", "minor"]);
    expect(result.groupingStrategy).toBe("per-package");
  });

  it("should update existing settings", async () => {
    const service = await createService(databaseClient);
    await service.updateSettings(projectId, { enabled: true });
    const result = await service.updateSettings(projectId, {
      groupingStrategy: "per-project"
    });
    expect(result.enabled).toBe(true);
    expect(result.groupingStrategy).toBe("per-project");
  });

  it("should return saved settings via getSettings", async () => {
    const service = await createService(databaseClient);
    await service.updateSettings(projectId, {
      enabled: true,
      branchPrefix: "deps/"
    });
    const result = await service.getSettings(projectId);
    expect(result).not.toBeNull();
    expect(result!.enabled).toBe(true);
    expect(result!.branchPrefix).toBe("deps/");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test src/api/services/__tests__/AutoFixSettingsService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write implementation**

Create `src/api/services/AutoFixSettingsService.ts`:

```typescript
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { AutoFixSettingsService as Abstraction } from "./abstractions/AutoFixSettingsService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { autoFixSettings } from "#api/db/schema.js";

const DEFAULTS: Omit<Abstraction.Settings, "id" | "projectId" | "createdAt" | "updatedAt"> = {
  enabled: false,
  upgradeTypes: ["patch"],
  groupingStrategy: "per-package",
  branchPrefix: "auto-fix/"
};

function rowToSettings(row: typeof autoFixSettings.$inferSelect): Abstraction.Settings {
  return {
    id: row.id,
    projectId: row.projectId,
    enabled: row.enabled === 1,
    upgradeTypes: JSON.parse(row.upgradeTypes) as string[],
    groupingStrategy: row.groupingStrategy,
    branchPrefix: row.branchPrefix,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export class AutoFixSettingsServiceImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async getSettings(projectId: string): Promise<Abstraction.Settings | null> {
    const row = await this.databaseClient.db
      .select()
      .from(autoFixSettings)
      .where(eq(autoFixSettings.projectId, projectId))
      .get();
    return row ? rowToSettings(row) : null;
  }

  public async getSettingsOrDefaults(projectId: string): Promise<Abstraction.Settings> {
    const existing = await this.getSettings(projectId);
    if (existing) {
      return existing;
    }
    const now = Date.now();
    return {
      id: "",
      projectId,
      ...DEFAULTS,
      createdAt: now,
      updatedAt: now
    };
  }

  public async updateSettings(
    projectId: string,
    input: Abstraction.UpdateInput
  ): Promise<Abstraction.Settings> {
    const existing = await this.getSettings(projectId);
    const now = Date.now();

    if (existing) {
      const updated = {
        enabled: input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled ? 1 : 0,
        upgradeTypes:
          input.upgradeTypes !== undefined
            ? JSON.stringify(input.upgradeTypes)
            : JSON.stringify(existing.upgradeTypes),
        groupingStrategy: input.groupingStrategy ?? existing.groupingStrategy,
        branchPrefix: input.branchPrefix ?? existing.branchPrefix,
        updatedAt: now
      };

      await this.databaseClient.db
        .update(autoFixSettings)
        .set(updated)
        .where(eq(autoFixSettings.projectId, projectId))
        .run();

      return (await this.getSettings(projectId))!;
    }

    const newRow = {
      id: generateId(),
      projectId,
      enabled: input.enabled ? 1 : 0,
      upgradeTypes: JSON.stringify(input.upgradeTypes ?? DEFAULTS.upgradeTypes),
      groupingStrategy: input.groupingStrategy ?? DEFAULTS.groupingStrategy,
      branchPrefix: input.branchPrefix ?? DEFAULTS.branchPrefix,
      createdAt: now,
      updatedAt: now
    };

    await this.databaseClient.db.insert(autoFixSettings).values(newRow).run();
    return (await this.getSettings(projectId))!;
  }
}

export const AutoFixSettingsService = Abstraction.createImplementation({
  implementation: AutoFixSettingsServiceImpl,
  dependencies: [DatabaseClient]
});
```

- [ ] **Step 5: Register in DI**

In `src/api/feature.ts`, import and register `AutoFixSettingsService`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn test src/api/services/__tests__/AutoFixSettingsService.test.ts`
Expected: PASS — all 5 tests

- [ ] **Step 7: Run full test suite**

Run: `yarn build && yarn test`
Expected: clean

- [ ] **Step 8: Commit**

```bash
git add src/api/services/abstractions/AutoFixSettingsService.ts src/api/services/AutoFixSettingsService.ts src/api/services/__tests__/AutoFixSettingsService.test.ts src/api/feature.ts
git commit -m "feat(auto-fix): add AutoFixSettingsService with per-project configuration"
```
