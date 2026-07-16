# Dependency Upgrader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based tool for managing npm dependency upgrades across multiple local Yarn projects, with security enforcement and async job execution.

**Architecture:** Single-process Fastify server with React UI. API layer uses SQLite+Drizzle, UI layer follows MVP (Gateway > Repository > UseCase > Presenter > React) with `@webiny/di` DI. API and UI tracks are independent — UI mocks HTTPClient, API uses in-memory SQLite.

**Tech Stack:** Fastify, SQLite, Drizzle ORM, React, Mantine, MobX, execa, `@webiny/di`, Vitest

## Global Constraints

- TypeScript strict mode (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, etc.)
- `moduleResolution: "nodenext"`, `module: "nodenext"`, `"type": "module"` in package.json
- All imports use `.js` extension (ESM)
- Path aliases: `#api/*`, `#ui/*`, `#shared/*` via package.json `imports` with conditional subpath imports (`"source"` condition for TS/Vitest, `"default"` for production Node.js)
- DI: every abstraction in `abstractions/` directory, one file per token, namespace with types, `Impl` suffix only on class declaration — never on exports or imports
- Barrel exports (`index.ts`): only abstractions and features — never implementations
- All class members need explicit access modifiers (`public`, `private`, `protected`) or `#` fields
- oxfmt: 4-space indent for `.ts`/`.tsx`, double quotes, no trailing commas
- oxlint: curly braces required, `--deny-warnings`
- UUIDs from `@webiny/stdlib` (`import { generateId } from "@webiny/stdlib"`)
- Never use `npx` or `yarn dlx` — ask user to add packages
- Tests: Vitest, config at `testing/vitest.config.ts`, test files in `src/**/__tests__/**/*.test.ts`

### Testing Rules

- **API tests:** Use in-memory SQLite (`:memory:`), real Drizzle schema, resolve ALL services through DI container. Only mock `CommandRunner` — register a conforming object via `container.registerInstance()`. Never `new XxxImpl()`, never `vi.fn()` for services.
- **UI tests:** Mock `HTTPClient` at the DI level — register a test object via `container.registerInstance()`. Use real use cases, real repositories, real presenters. Never mock gateways/repos directly.
- **DI container pattern for tests:**

```ts
import { createContainer } from "#shared/index.js";
import { SomeService } from "../abstractions/SomeService.js";
import { SomeService as SomeServiceRegistration } from "../SomeService.js";

const container = createContainer();
// Register mock for the ONLY allowed mock target
container.registerInstance(CommandRunner, {/* mock impl */});
// Register real service under test
container.register(SomeServiceRegistration);
// Resolve via abstraction token
const service = container.resolve(SomeService);
```

---

## Track: Foundation (must complete before API or UI tracks)

### Task 1: Install Required Packages

**Ask the user** to add all packages needed for the project. No code changes — just package installation.

- [ ] **Step 1: Ask user to add production dependencies**

```
yarn add fastify @fastify/static drizzle-orm better-sqlite3 @mantine/core @mantine/hooks @emotion/react mobx mobx-react-lite yaml @webiny/app concurrently
```

- [ ] **Step 2: Ask user to add dev dependencies**

```
yarn add -D vite @vitejs/plugin-react drizzle-kit @types/better-sqlite3
```

- [ ] **Step 3: Verify installation**

Run: `yarn install`
Expected: Clean install, no errors

---

### Task 2: Conditional Subpath Imports

**Files:**

- Modify: `package.json` (imports field)
- Modify: `tsconfig.json` (customConditions)
- Modify: `testing/vitest.config.ts` (resolve conditions)

**Why:** `#api/*`, `#ui/*`, `#shared/*` currently resolve to `./src/*` which works for development/TypeScript but fails at production runtime (`node dist/api/server.js`) because compiled output is in `dist/`. Conditional subpath imports let TypeScript and Vitest use `"source"` condition (resolving to `./src/*`) while Node.js production uses `"default"` (resolving to `./dist/*`).

- [ ] **Step 1: Update package.json imports to use conditional subpath imports**

Replace the `imports` field in `package.json`:

```json
"imports": {
    "#api/*": {
        "source": "./src/api/*",
        "default": "./dist/api/*"
    },
    "#ui/*": {
        "source": "./src/ui/*",
        "default": "./dist/ui/*"
    },
    "#shared/*": {
        "source": "./src/shared/*",
        "default": "./dist/shared/*"
    }
}
```

- [ ] **Step 2: Add customConditions to tsconfig.json**

Add to `compilerOptions`:

```json
"customConditions": ["source"]
```

- [ ] **Step 3: Update vitest config to use source condition**

```ts
// testing/vitest.config.ts
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

export default defineConfig({
  resolve: {
    conditions: ["source"]
  },
  test: {
    root,
    include: ["src/**/__tests__/**/*.test.ts"]
  }
});
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `yarn test`
Expected: PASS — existing shared/di tests pass with new resolution

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json testing/
git commit -m "chore: add conditional subpath imports for production builds"
```

---

### Task 3: Pre-create All Barrel Files

**Files:**

- Create: `src/api/db/abstractions/index.ts`
- Create: `src/api/db/index.ts`
- Create: `src/api/services/abstractions/index.ts`
- Create: `src/api/routes/index.ts`
- Create: `src/api/index.ts`
- Create: `src/ui/httpClient/abstractions/index.ts`
- Create: `src/ui/httpClient/index.ts`
- Create: `src/ui/features/projects/abstractions/index.ts`
- Create: `src/ui/features/projects/index.ts`
- Create: `src/ui/features/upgrades/abstractions/index.ts`
- Create: `src/ui/features/upgrades/index.ts`
- Create: `src/ui/shared/di/index.ts`

**Why:** Multiple parallel tasks append to the same barrel files, causing merge conflicts. Pre-create all barrels with their final contents so parallel tasks only create new files — never modify shared barrels.

- [ ] **Step 1: Create API barrel files**

```ts
// src/api/db/abstractions/index.ts
export { DatabaseClient } from "./DatabaseClient.js";
```

```ts
// src/api/db/index.ts
export { DatabaseClient } from "./abstractions/index.js";
export { projects, upgradeJobs, securityChecks, registryCache } from "./schema.js";
```

```ts
// src/api/services/abstractions/index.ts
export { CommandRunner } from "./CommandRunner.js";
export { SecurityService } from "./SecurityService.js";
export { RegistryCacheService } from "./RegistryCacheService.js";
export { ScanService } from "./ScanService.js";
export { ScanCache } from "./ScanCache.js";
export { UpgradeService } from "./UpgradeService.js";
export { YarnService } from "./YarnService.js";
export { JobWorker } from "./JobWorker.js";
```

```ts
// src/api/routes/index.ts
export { projectRoutes } from "./projects.js";
export { upgradeRoutes } from "./upgrades.js";
export { yarnRoutes } from "./yarn.js";
export { cacheRoutes } from "./cache.js";
```

```ts
// src/api/index.ts
export { ApiFeature } from "./feature.js";
```

- [ ] **Step 2: Create UI barrel files**

```ts
// src/ui/httpClient/abstractions/index.ts
export { HTTPClient } from "./HTTPClient.js";
```

```ts
// src/ui/httpClient/index.ts
export { HTTPClient } from "./abstractions/index.js";
export { HTTPClientFeature } from "./feature.js";
```

```ts
// src/ui/features/projects/abstractions/index.ts
export { ProjectsGateway } from "./ProjectsGateway.js";
export { ProjectsRepository } from "./ProjectsRepository.js";
```

```ts
// src/ui/features/projects/index.ts
export { ProjectsGateway } from "./abstractions/index.js";
export { ProjectsRepository } from "./abstractions/index.js";
export { ProjectsFeature } from "./feature.js";
```

```ts
// src/ui/features/upgrades/abstractions/index.ts
export { UpgradesGateway } from "./UpgradesGateway.js";
export { UpgradesRepository } from "./UpgradesRepository.js";
```

```ts
// src/ui/features/upgrades/index.ts
export { UpgradesGateway } from "./abstractions/index.js";
export { UpgradesRepository } from "./abstractions/index.js";
export { UpgradesFeature } from "./feature.js";
```

```ts
// src/ui/shared/di/index.ts
export { ContainerProvider, useContainer } from "./ContainerProvider.js";
export { useFeature } from "./useFeature.js";
```

- [ ] **Step 3: Commit**

Note: These files will not compile yet — the referenced modules do not exist. That is expected. They exist only to prevent parallel merge conflicts. TypeScript will report errors until all referenced files are created by later tasks.

```bash
git add src/api/ src/ui/
git commit -m "chore: pre-create barrel files for parallel task safety"
```

---

### Task 4: Vite Entry Point

**Files:**

- Create: `index.html`

**Why:** Vite requires an `index.html` at the project root (or configured root) as its entry point. Without it, the dev server and production build have no HTML shell to serve.

- [ ] **Step 1: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dependency Upgrader</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/ui/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "chore: add Vite index.html entry point"
```

---

### Task 5: Database Schema + Test

**Files:**

- Create: `src/api/db/schema.ts`
- Create: `testing/helpers/createTestDb.ts`
- Test: `src/api/db/__tests__/schema.test.ts`

**Interfaces:**

- Produces: Drizzle table definitions for `projects`, `upgradeJobs`, `securityChecks`, `registryCache`. Shared test helper `createTestDb()` that creates an in-memory SQLite database with all tables.

- [ ] **Step 1: Write schema.ts**

```ts
// src/api/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  yarnVersion: text("yarn_version"),
  addedAt: integer("added_at").notNull(),
  lastScannedAt: integer("last_scanned_at")
});

export const upgradeJobs = sqliteTable("upgrade_jobs", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  type: text("type").notNull(),
  status: text("status").notNull(),
  packages: text("packages"),
  logs: text("logs"),
  startedAt: integer("started_at"),
  completedAt: integer("completed_at")
});

export const registryCache = sqliteTable("registry_cache", {
  packageName: text("package_name").primaryKey().notNull(),
  data: text("data").notNull(),
  cachedAt: integer("cached_at").notNull()
});

export const securityChecks = sqliteTable("security_checks", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  checkedAt: integer("checked_at").notNull(),
  npmPreapprovedPackages: integer("npm_preapproved_packages").notNull().default(0),
  npmMinimalAgeGate: integer("npm_minimal_age_gate").notNull().default(0),
  enableScripts: integer("enable_scripts").notNull().default(0),
  approvedGitRepositories: integer("approved_git_repositories").notNull().default(0)
});
```

- [ ] **Step 2: Write shared test helper**

```ts
// testing/helpers/createTestDb.ts
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const CREATE_TABLES = `
    CREATE TABLE projects (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        yarn_version TEXT,
        added_at INTEGER NOT NULL,
        last_scanned_at INTEGER
    );
    CREATE TABLE upgrade_jobs (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL REFERENCES projects(id),
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        packages TEXT,
        logs TEXT,
        started_at INTEGER,
        completed_at INTEGER
    );
    CREATE TABLE security_checks (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL REFERENCES projects(id),
        checked_at INTEGER NOT NULL,
        npm_preapproved_packages INTEGER NOT NULL DEFAULT 0,
        npm_minimal_age_gate INTEGER NOT NULL DEFAULT 0,
        enable_scripts INTEGER NOT NULL DEFAULT 0,
        approved_git_repositories INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE registry_cache (
        package_name TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        cached_at INTEGER NOT NULL
    );
`;

export function createTestDb(): BetterSQLite3Database {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(CREATE_TABLES);
  return drizzle(sqlite);
}
```

- [ ] **Step 3: Write the test**

```ts
// src/api/db/__tests__/schema.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestDb } from "../../../../testing/helpers/createTestDb.js";
import { projects, upgradeJobs, securityChecks } from "../schema.js";

describe("database schema", () => {
  let db: BetterSQLite3Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("inserts and retrieves a project", () => {
    db.insert(projects)
      .values({
        id: "p1",
        name: "test-project",
        path: "/tmp/test",
        addedAt: Date.now()
      })
      .run();

    const result = db.select().from(projects).where(eq(projects.id, "p1")).get();
    expect(result).toBeDefined();
    expect(result!.name).toBe("test-project");
    expect(result!.path).toBe("/tmp/test");
  });

  it("inserts and retrieves an upgrade job", () => {
    db.insert(projects)
      .values({ id: "p1", name: "test", path: "/tmp/test", addedAt: Date.now() })
      .run();

    db.insert(upgradeJobs)
      .values({
        id: "j1",
        projectId: "p1",
        type: "dependency",
        status: "pending",
        packages: JSON.stringify([{ name: "react", from: "18.0.0", to: "19.0.0" }])
      })
      .run();

    const result = db.select().from(upgradeJobs).where(eq(upgradeJobs.id, "j1")).get();
    expect(result).toBeDefined();
    expect(result!.status).toBe("pending");
    expect(result!.type).toBe("dependency");
  });

  it("inserts and retrieves a security check", () => {
    db.insert(projects)
      .values({ id: "p1", name: "test", path: "/tmp/test", addedAt: Date.now() })
      .run();

    db.insert(securityChecks)
      .values({
        id: "sc1",
        projectId: "p1",
        checkedAt: Date.now(),
        npmPreapprovedPackages: 1,
        npmMinimalAgeGate: 1,
        enableScripts: 1,
        approvedGitRepositories: 0
      })
      .run();

    const result = db.select().from(securityChecks).where(eq(securityChecks.id, "sc1")).get();
    expect(result).toBeDefined();
    expect(result!.npmPreapprovedPackages).toBe(1);
    expect(result!.approvedGitRepositories).toBe(0);
  });

  it("enforces unique path constraint on projects", () => {
    db.insert(projects)
      .values({ id: "p1", name: "test", path: "/tmp/test", addedAt: Date.now() })
      .run();

    expect(() => {
      db.insert(projects)
        .values({ id: "p2", name: "test2", path: "/tmp/test", addedAt: Date.now() })
        .run();
    }).toThrow();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `yarn test`
Expected: PASS — all 4 schema tests pass

- [ ] **Step 5: Lint, format, commit**

```bash
yarn lint:fix && yarn format:fix
git add src/api/db/schema.ts src/api/db/__tests__/ testing/helpers/
git commit -m "feat(api): add Drizzle schema and test database helper"
```

---

### Task 6: DatabaseClient Abstraction

**Files:**

- Create: `src/api/db/abstractions/DatabaseClient.ts`
- Create: `src/api/db/client.ts`

**Interfaces:**

- Consumes: `createAbstraction` from `#shared/index.js`
- Produces: `DatabaseClient` abstraction token with `DatabaseClient.Interface` type (exposes `db` property typed as `BetterSQLite3Database`). Factory function `createDatabaseClient(dbPath)` for production use. In tests, use `container.registerInstance(DatabaseClient, { db: createTestDb() })`.

**Why registerInstance, not createImplementation:** `DatabaseClient` takes a scalar `dbPath` string — not a DI-resolvable token. The `registerInstance` (or `registerFactory`) pattern handles non-DI constructor arguments.

- [ ] **Step 1: Write abstraction**

```ts
// src/api/db/abstractions/DatabaseClient.ts
import { createAbstraction } from "#shared/index.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export interface IDatabaseClient {
  readonly db: BetterSQLite3Database;
}

export const DatabaseClient = createAbstraction<IDatabaseClient>("Api/DatabaseClient");

export namespace DatabaseClient {
  export type Interface = IDatabaseClient;
}
```

- [ ] **Step 2: Write factory function (not a DI implementation — just a factory)**

```ts
// src/api/db/client.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { DatabaseClient } from "./abstractions/DatabaseClient.js";

export function createDatabaseClient(dbPath: string): DatabaseClient.Interface {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return { db: drizzle(sqlite) };
}
```

Note: `client.ts` is NOT exported from the barrel `index.ts` — it is an internal implementation detail imported only by the API feature file.

- [ ] **Step 3: Lint, format, commit**

```bash
yarn lint:fix && yarn format:fix
git add src/api/db/abstractions/DatabaseClient.ts src/api/db/client.ts
git commit -m "feat(api): add DatabaseClient abstraction with factory function"
```

---

### Task 7: Drizzle Migration Setup

**Files:**

- Create: `drizzle.config.ts`
- Create: `src/api/db/migrate.ts`

**Why:** Drizzle migrations must auto-run on Fastify startup per the spec. This task creates the Drizzle Kit config for generating migrations and a `runMigrations()` function called at server startup.

- [ ] **Step 1: Create Drizzle Kit config**

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/api/db/schema.ts",
  out: "./src/api/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/upgrader.db"
  }
});
```

- [ ] **Step 2: Create migration runner**

```ts
// src/api/db/migrate.ts
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export function runMigrations(db: BetterSQLite3Database): void {
  migrate(db, { migrationsFolder: "./src/api/db/migrations" });
}
```

- [ ] **Step 3: Generate initial migration**

Run: `yarn drizzle-kit generate`
Expected: Migration SQL file created in `src/api/db/migrations/`

Note: Add `"drizzle-kit": "drizzle-kit"` to package.json scripts if not present.

- [ ] **Step 4: Commit**

```bash
git add drizzle.config.ts src/api/db/migrate.ts src/api/db/migrations/
git commit -m "feat(api): add Drizzle migration setup with auto-run support"
```

---

### Task 8: CommandRunner Abstraction + Implementation

**Files:**

- Create: `src/api/services/abstractions/CommandRunner.ts`
- Create: `src/api/services/CommandRunner.ts`
- Test: `src/api/services/__tests__/CommandRunner.test.ts`

**Interfaces:**

- Consumes: `createAbstraction` from `#shared/index.js`, `execa` package
- Produces: `CommandRunner` abstraction with `run(command, args, options): Promise<Result>` and `runStreaming(command, args, options): Promise<Result>`. This is the ONLY abstraction mocked in API tests — all execa calls go through it.

- [ ] **Step 1: Write abstraction**

```ts
// src/api/services/abstractions/CommandRunner.ts
import { createAbstraction } from "#shared/index.js";

interface ICommandRunnerResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface ICommandRunnerStreamOptions {
  cwd: string;
  onStdout: (line: string) => void;
  onStderr: (line: string) => void;
}

interface ICommandRunner {
  run(command: string, args: string[], options: { cwd: string }): Promise<ICommandRunnerResult>;
  runStreaming(
    command: string,
    args: string[],
    options: ICommandRunnerStreamOptions
  ): Promise<ICommandRunnerResult>;
}

export const CommandRunner = createAbstraction<ICommandRunner>("Api/CommandRunner");

export namespace CommandRunner {
  export type Interface = ICommandRunner;
  export type Result = ICommandRunnerResult;
  export type StreamOptions = ICommandRunnerStreamOptions;
}
```

- [ ] **Step 2: Write implementation**

```ts
// src/api/services/CommandRunner.ts
import { execa } from "execa";
import { CommandRunner as Abstraction } from "./abstractions/CommandRunner.js";

class ExecaCommandRunnerImpl implements Abstraction.Interface {
  public async run(
    command: string,
    args: string[],
    options: { cwd: string }
  ): Promise<Abstraction.Result> {
    try {
      const result = await execa(command, args, {
        cwd: options.cwd,
        reject: false
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode ?? 0
      };
    } catch (error) {
      return {
        stdout: "",
        stderr: String(error),
        exitCode: 1
      };
    }
  }

  public async runStreaming(
    command: string,
    args: string[],
    options: Abstraction.StreamOptions
  ): Promise<Abstraction.Result> {
    const subprocess = execa(command, args, {
      cwd: options.cwd,
      reject: false
    });

    subprocess.stdout?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        options.onStdout(line);
      }
    });

    subprocess.stderr?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        options.onStderr(line);
      }
    });

    const result = await subprocess;
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0
    };
  }
}

export const CommandRunner = Abstraction.createImplementation({
  implementation: ExecaCommandRunnerImpl,
  dependencies: []
});
```

- [ ] **Step 3: Write test (resolves through DI container)**

```ts
// src/api/services/__tests__/CommandRunner.test.ts
import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { CommandRunner } from "../abstractions/CommandRunner.js";
import { CommandRunner as CommandRunnerRegistration } from "../CommandRunner.js";

describe("ExecaCommandRunner", () => {
  function resolveRunner(): CommandRunner.Interface {
    const container = createContainer();
    container.register(CommandRunnerRegistration);
    return container.resolve(CommandRunner);
  }

  it("runs a simple command and captures stdout", async () => {
    const runner = resolveRunner();
    const result = await runner.run("echo", ["hello"], { cwd: process.cwd() });

    expect(result.stdout.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  it("captures exit code from failing command", async () => {
    const runner = resolveRunner();
    const result = await runner.run("node", ["-e", "process.exit(1)"], {
      cwd: process.cwd()
    });

    expect(result.exitCode).toBe(1);
  });

  it("streams stdout line by line", async () => {
    const lines: string[] = [];
    const runner = resolveRunner();
    await runner.runStreaming("node", ["-e", "console.log('line1'); console.log('line2');"], {
      cwd: process.cwd(),
      onStdout: line => lines.push(line),
      onStderr: () => {}
    });

    expect(lines).toContain("line1");
    expect(lines).toContain("line2");
  });
});
```

- [ ] **Step 4: Run tests**

Run: `yarn test`
Expected: PASS

- [ ] **Step 5: Lint, format, commit**

```bash
yarn lint:fix && yarn format:fix
git add src/api/services/abstractions/CommandRunner.ts src/api/services/CommandRunner.ts src/api/services/__tests__/
git commit -m "feat(api): add CommandRunner abstraction with execa implementation"
```

---

### Task 9: ScanCache Abstraction + Implementation

**Files:**

- Create: `src/api/services/abstractions/ScanCache.ts`
- Create: `src/api/services/ScanCache.ts`
- Test: `src/api/services/__tests__/ScanCache.test.ts`

**Interfaces:**

- Consumes: `createAbstraction` from `#shared/index.js`
- Produces: `ScanCache` abstraction with `set(projectId, deps)`, `get(projectId): Dependency[] | undefined`, `clear(projectId)`. In-memory `Map<string, Dependency[]>`. `GET /api/projects/:id/dependencies` reads from cache; cache miss returns empty array. `POST /api/projects/:id/scan` populates cache. `DELETE /api/projects/:id` clears cache for that project.

- [ ] **Step 1: Write abstraction**

```ts
// src/api/services/abstractions/ScanCache.ts
import { createAbstraction } from "#shared/index.js";

interface ICachedDependency {
  name: string;
  currentVersion: string;
  latestInRange: string;
  latestVersion: string;
  type: "dependency" | "devDependency";
  upgradeType: "patch" | "minor" | "major" | "none";
}

interface IScanCache {
  get(projectId: string): ICachedDependency[] | undefined;
  set(projectId: string, dependencies: ICachedDependency[]): void;
  clear(projectId: string): void;
}

export const ScanCache = createAbstraction<IScanCache>("Api/ScanCache");

export namespace ScanCache {
  export type Interface = IScanCache;
  export type CachedDependency = ICachedDependency;
}
```

- [ ] **Step 2: Write implementation**

```ts
// src/api/services/ScanCache.ts
import { ScanCache as Abstraction } from "./abstractions/ScanCache.js";

class ScanCacheImpl implements Abstraction.Interface {
  readonly #cache = new Map<string, Abstraction.CachedDependency[]>();

  public get(projectId: string): Abstraction.CachedDependency[] | undefined {
    return this.#cache.get(projectId);
  }

  public set(projectId: string, dependencies: Abstraction.CachedDependency[]): void {
    this.#cache.set(projectId, dependencies);
  }

  public clear(projectId: string): void {
    this.#cache.delete(projectId);
  }
}

export const ScanCache = Abstraction.createImplementation({
  implementation: ScanCacheImpl,
  dependencies: []
});
```

- [ ] **Step 3: Write test**

```ts
// src/api/services/__tests__/ScanCache.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { ScanCache } from "../abstractions/ScanCache.js";
import { ScanCache as ScanCacheRegistration } from "../ScanCache.js";

describe("ScanCache", () => {
  let cache: ScanCache.Interface;

  beforeEach(() => {
    const container = createContainer();
    container.register(ScanCacheRegistration);
    cache = container.resolve(ScanCache);
  });

  it("returns undefined for cache miss", () => {
    expect(cache.get("unknown")).toBeUndefined();
  });

  it("stores and retrieves dependencies", () => {
    const deps: ScanCache.CachedDependency[] = [
      {
        name: "react",
        currentVersion: "18.2.0",
        latestInRange: "18.3.1",
        latestVersion: "19.1.0",
        type: "dependency",
        upgradeType: "major"
      }
    ];
    cache.set("p1", deps);
    expect(cache.get("p1")).toEqual(deps);
  });

  it("clears cache for a project", () => {
    cache.set("p1", []);
    cache.clear("p1");
    expect(cache.get("p1")).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `yarn test`
Expected: PASS

- [ ] **Step 5: Lint, format, commit**

```bash
yarn lint:fix && yarn format:fix
git add src/api/services/abstractions/ScanCache.ts src/api/services/ScanCache.ts src/api/services/__tests__/ScanCache.test.ts
git commit -m "feat(api): add ScanCache for in-memory dependency scan results"
```

---

## Track: API (depends on Foundation)

### Task 10: SecurityService

**Files:**

- Create: `src/api/services/abstractions/SecurityService.ts`
- Create: `src/api/services/SecurityService.ts`
- Test: `src/api/services/__tests__/SecurityService.test.ts`

**Interfaces:**

- Consumes: `DatabaseClient` from Task 6 (to persist results to `security_checks` table)
- Produces: `SecurityService` abstraction with `check(projectId, projectPath): Promise<CheckResult>` and `getLatest(projectId): Promise<CheckResult | null>`. `check()` reads `.yarnrc.yml`, validates 4 keys, **persists result to `security_checks` table**, and returns the result.

- [ ] **Step 1: Write abstraction**

```ts
// src/api/services/abstractions/SecurityService.ts
import { createAbstraction } from "#shared/index.js";

interface ISecurityCheckResult {
  passes: boolean;
  npmPreapprovedPackages: boolean;
  npmMinimalAgeGate: boolean;
  enableScripts: boolean;
  approvedGitRepositories: boolean;
}

interface ISecurityService {
  check(projectId: string, projectPath: string): Promise<ISecurityCheckResult>;
  getLatest(projectId: string): Promise<ISecurityCheckResult | null>;
}

export const SecurityService = createAbstraction<ISecurityService>("Api/SecurityService");

export namespace SecurityService {
  export type Interface = ISecurityService;
  export type CheckResult = ISecurityCheckResult;
}
```

- [ ] **Step 2: Write implementation (persists to DB)**

```ts
// src/api/services/SecurityService.ts
import { readFile } from "fs/promises";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { SecurityService as Abstraction } from "./abstractions/SecurityService.js";
import { DatabaseClient } from "../db/abstractions/DatabaseClient.js";
import { securityChecks } from "../db/schema.js";

class SecurityServiceImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async check(projectId: string, projectPath: string): Promise<Abstraction.CheckResult> {
    const yarnrcPath = join(projectPath, ".yarnrc.yml");

    let content: string;
    try {
      content = await readFile(yarnrcPath, "utf-8");
    } catch {
      const failResult: Abstraction.CheckResult = {
        passes: false,
        npmPreapprovedPackages: false,
        npmMinimalAgeGate: false,
        enableScripts: false,
        approvedGitRepositories: false
      };
      this.persistResult(projectId, failResult);
      return failResult;
    }

    const config = parseYaml(content) as Record<string, unknown>;

    const npmPreapprovedPackages = "npmPreapprovedPackages" in config;
    const npmMinimalAgeGate = "npmMinimalAgeGate" in config;
    const enableScripts = "enableScripts" in config && config["enableScripts"] === false;
    const approvedGitRepositories = "approvedGitRepositories" in config;

    const result: Abstraction.CheckResult = {
      passes:
        npmPreapprovedPackages && npmMinimalAgeGate && enableScripts && approvedGitRepositories,
      npmPreapprovedPackages,
      npmMinimalAgeGate,
      enableScripts,
      approvedGitRepositories
    };

    this.persistResult(projectId, result);
    return result;
  }

  public async getLatest(projectId: string): Promise<Abstraction.CheckResult | null> {
    const row = this.databaseClient.db
      .select()
      .from(securityChecks)
      .where(eq(securityChecks.projectId, projectId))
      .orderBy(securityChecks.checkedAt)
      .get();

    if (!row) {
      return null;
    }

    const passes =
      row.npmPreapprovedPackages === 1 &&
      row.npmMinimalAgeGate === 1 &&
      row.enableScripts === 1 &&
      row.approvedGitRepositories === 1;

    return {
      passes,
      npmPreapprovedPackages: row.npmPreapprovedPackages === 1,
      npmMinimalAgeGate: row.npmMinimalAgeGate === 1,
      enableScripts: row.enableScripts === 1,
      approvedGitRepositories: row.approvedGitRepositories === 1
    };
  }

  private persistResult(projectId: string, result: Abstraction.CheckResult): void {
    this.databaseClient.db
      .insert(securityChecks)
      .values({
        id: generateId(),
        projectId,
        checkedAt: Date.now(),
        npmPreapprovedPackages: result.npmPreapprovedPackages ? 1 : 0,
        npmMinimalAgeGate: result.npmMinimalAgeGate ? 1 : 0,
        enableScripts: result.enableScripts ? 1 : 0,
        approvedGitRepositories: result.approvedGitRepositories ? 1 : 0
      })
      .run();
  }
}

export const SecurityService = Abstraction.createImplementation({
  implementation: SecurityServiceImpl,
  dependencies: [DatabaseClient]
});
```

- [ ] **Step 3: Write test (real service, real temp files, real DB — no mocks)**

```ts
// src/api/services/__tests__/SecurityService.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createContainer } from "#shared/index.js";
import { DatabaseClient } from "../../db/abstractions/DatabaseClient.js";
import { SecurityService } from "../abstractions/SecurityService.js";
import { SecurityService as SecurityServiceRegistration } from "../SecurityService.js";
import { securityChecks } from "../../db/schema.js";
import { createTestDb } from "../../../../testing/helpers/createTestDb.js";

describe("SecurityService", () => {
  let testDir: string;
  let service: SecurityService.Interface;
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDir = join(tmpdir(), `sec-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    db = createTestDb();
    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
    container.register(SecurityServiceRegistration);
    service = container.resolve(SecurityService);

    // Insert a project for foreign key
    db.insert(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("../../db/schema.js").projects
    );
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("passes when all 4 security settings are correct", async () => {
    writeFileSync(
      join(testDir, ".yarnrc.yml"),
      [
        "npmPreapprovedPackages: []",
        "npmMinimalAgeGate: 3d",
        "enableScripts: false",
        "approvedGitRepositories: []"
      ].join("\n")
    );

    const result = await service.check("p1", testDir);
    expect(result.passes).toBe(true);
    expect(result.npmPreapprovedPackages).toBe(true);
    expect(result.npmMinimalAgeGate).toBe(true);
    expect(result.enableScripts).toBe(true);
    expect(result.approvedGitRepositories).toBe(true);
  });

  it("fails when enableScripts is true", async () => {
    writeFileSync(
      join(testDir, ".yarnrc.yml"),
      [
        "npmPreapprovedPackages: []",
        "npmMinimalAgeGate: 3d",
        "enableScripts: true",
        "approvedGitRepositories: []"
      ].join("\n")
    );

    const result = await service.check("p1", testDir);
    expect(result.passes).toBe(false);
    expect(result.enableScripts).toBe(false);
  });

  it("fails when .yarnrc.yml does not exist", async () => {
    const result = await service.check("p1", testDir);
    expect(result.passes).toBe(false);
  });

  it("persists check result to security_checks table", async () => {
    writeFileSync(
      join(testDir, ".yarnrc.yml"),
      "enableScripts: false\napprovedGitRepositories: []\n"
    );

    await service.check("p1", testDir);

    const rows = db.select().from(securityChecks).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.projectId).toBe("p1");
  });

  it("retrieves latest check result", async () => {
    writeFileSync(
      join(testDir, ".yarnrc.yml"),
      [
        "npmPreapprovedPackages: []",
        "npmMinimalAgeGate: 3d",
        "enableScripts: false",
        "approvedGitRepositories: []"
      ].join("\n")
    );

    await service.check("p1", testDir);
    const latest = await service.getLatest("p1");
    expect(latest).toBeDefined();
    expect(latest!.passes).toBe(true);
  });
});
```

Note: The test `beforeEach` must also insert a project row (`id: "p1"`) into the `projects` table to satisfy the foreign key constraint on `security_checks.project_id`. The implementer should import `projects` from schema and insert:

```ts
import { projects } from "../../db/schema.js";
// inside beforeEach:
db.insert(projects).values({ id: "p1", name: "test", path: testDir, addedAt: Date.now() }).run();
```

- [ ] **Step 4: Run tests**

Run: `yarn test`
Expected: PASS

- [ ] **Step 5: Lint, format, commit**

```bash
yarn lint:fix && yarn format:fix
git add src/api/services/abstractions/SecurityService.ts src/api/services/SecurityService.ts src/api/services/__tests__/SecurityService.test.ts
git commit -m "feat(api): add SecurityService with DB persistence"
```

---

### Task 10b: RegistryCacheService

**Files:**

- Create: `src/api/services/abstractions/RegistryCacheService.ts`
- Create: `src/api/services/RegistryCacheService.ts`
- Test: `src/api/services/__tests__/RegistryCacheService.test.ts`

**Interfaces:**

- Consumes: `DatabaseClient` from Task 6, `CommandRunner` from Task 8
- Produces: `RegistryCacheService` abstraction with `getPackageInfo(packageName: string, force?: boolean): Promise<RegistryCacheService.PackageInfo>`, `clearAll(): Promise<void>`, `clearPackage(packageName: string): Promise<void>`. Caches `yarn npm info <pkg> --json` results in `registry_cache` table with 30 min TTL. If cache hit and not expired, returns cached data. If miss, expired, or `force=true`, re-fetches from registry and updates cache.

- [ ] **Step 1: Write abstraction**

```ts
// src/api/services/abstractions/RegistryCacheService.ts
import { createAbstraction } from "#shared/index.js";

interface IPackageInfo {
  name: string;
  latestVersion: string;
  distTags: Record<string, string>;
  versions: string[];
}

interface IRegistryCacheService {
  getPackageInfo(packageName: string, force?: boolean): Promise<IPackageInfo>;
  clearAll(): Promise<void>;
  clearPackage(packageName: string): Promise<void>;
}

export const RegistryCacheService = createAbstraction<IRegistryCacheService>(
  "Api/RegistryCacheService"
);

export namespace RegistryCacheService {
  export type Interface = IRegistryCacheService;
  export type PackageInfo = IPackageInfo;
}
```

- [ ] **Step 2: Write implementation**

```ts
// src/api/services/RegistryCacheService.ts
import { eq } from "drizzle-orm";
import { RegistryCacheService as Abstraction } from "./abstractions/RegistryCacheService.js";
import { DatabaseClient } from "../db/abstractions/DatabaseClient.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";
import { registryCache } from "../db/schema.js";

const TTL_MS = 30 * 60 * 1000;

class RegistryCacheServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly commandRunner: CommandRunner.Interface
  ) {}

  public async getPackageInfo(
    packageName: string,
    force?: boolean
  ): Promise<Abstraction.PackageInfo> {
    if (!force) {
      const cached = this.databaseClient.db
        .select()
        .from(registryCache)
        .where(eq(registryCache.packageName, packageName))
        .get();

      if (cached && Date.now() - cached.cachedAt < TTL_MS) {
        return JSON.parse(cached.data) as Abstraction.PackageInfo;
      }
    }

    const result = await this.commandRunner.run("yarn", ["npm", "info", packageName, "--json"], {
      cwd: process.cwd()
    });

    const raw = JSON.parse(result.stdout) as Record<string, unknown>;
    const info: Abstraction.PackageInfo = {
      name: packageName,
      latestVersion: (raw["dist-tags"] as Record<string, string>)?.["latest"] ?? "",
      distTags: (raw["dist-tags"] as Record<string, string>) ?? {},
      versions: (raw["versions"] as string[]) ?? []
    };

    this.databaseClient.db
      .insert(registryCache)
      .values({
        packageName,
        data: JSON.stringify(info),
        cachedAt: Date.now()
      })
      .onConflictDoUpdate({
        target: registryCache.packageName,
        set: {
          data: JSON.stringify(info),
          cachedAt: Date.now()
        }
      })
      .run();

    return info;
  }

  public async clearAll(): Promise<void> {
    this.databaseClient.db.delete(registryCache).run();
  }

  public async clearPackage(packageName: string): Promise<void> {
    this.databaseClient.db
      .delete(registryCache)
      .where(eq(registryCache.packageName, packageName))
      .run();
  }
}

export const RegistryCacheService = Abstraction.createImplementation({
  implementation: RegistryCacheServiceImpl,
  dependencies: [DatabaseClient, CommandRunner]
});
```

- [ ] **Step 3: Write test**

```ts
// src/api/services/__tests__/RegistryCacheService.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { createTestDb } from "../../../../testing/helpers/createTestDb.js";
import { DatabaseClient } from "../../db/abstractions/DatabaseClient.js";
import { CommandRunner } from "../abstractions/CommandRunner.js";
import { RegistryCacheService } from "../abstractions/RegistryCacheService.js";
import { RegistryCacheService as RegistryCacheServiceRegistration } from "../RegistryCacheService.js";
import { registryCache } from "../../db/schema.js";
import { eq } from "drizzle-orm";

function createMockCommandRunner(): CommandRunner.Interface {
  return {
    async run() {
      return {
        stdout: JSON.stringify({
          "dist-tags": { latest: "19.2.7", next: "19.3.0-canary" },
          versions: ["19.0.0", "19.1.0", "19.2.7"]
        }),
        stderr: "",
        exitCode: 0
      };
    },
    async runStreaming(_cmd, _args, options) {
      return { stdout: "", stderr: "", exitCode: 0 };
    }
  };
}

describe("RegistryCacheService", () => {
  let container: Container;

  beforeEach(() => {
    const db = createTestDb();
    container = new Container();
    container.registerInstance(DatabaseClient, { db });
    container.registerInstance(CommandRunner, createMockCommandRunner());
    container.register(RegistryCacheServiceRegistration).inSingletonScope();
  });

  it("fetches and caches package info", async () => {
    const service = container.resolve(RegistryCacheService);
    const info = await service.getPackageInfo("react");

    expect(info.name).toBe("react");
    expect(info.latestVersion).toBe("19.2.7");
    expect(info.distTags["latest"]).toBe("19.2.7");
  });

  it("returns cached data on second call", async () => {
    const service = container.resolve(RegistryCacheService);
    await service.getPackageInfo("react");

    const db = container.resolve(DatabaseClient).db;
    const cached = db
      .select()
      .from(registryCache)
      .where(eq(registryCache.packageName, "react"))
      .get();
    expect(cached).toBeDefined();
    expect(cached!.data).toContain("19.2.7");
  });

  it("clears all cache", async () => {
    const service = container.resolve(RegistryCacheService);
    await service.getPackageInfo("react");
    await service.clearAll();

    const db = container.resolve(DatabaseClient).db;
    const all = db.select().from(registryCache).all();
    expect(all).toHaveLength(0);
  });

  it("clears single package cache", async () => {
    const service = container.resolve(RegistryCacheService);
    await service.getPackageInfo("react");
    await service.clearPackage("react");

    const db = container.resolve(DatabaseClient).db;
    const cached = db
      .select()
      .from(registryCache)
      .where(eq(registryCache.packageName, "react"))
      .get();
    expect(cached).toBeUndefined();
  });

  it("force=true bypasses cache", async () => {
    const service = container.resolve(RegistryCacheService);
    await service.getPackageInfo("react");
    const info = await service.getPackageInfo("react", true);
    expect(info.latestVersion).toBe("19.2.7");
  });
});
```

- [ ] **Step 4: Run tests**

Run: `yarn test`
Expected: PASS

- [ ] **Step 5: Lint, format, commit**

```bash
yarn lint:fix && yarn format:fix
git add src/api/services/abstractions/RegistryCacheService.ts src/api/services/RegistryCacheService.ts src/api/services/__tests__/RegistryCacheService.test.ts
git commit -m "feat(api): add RegistryCacheService with 30min TTL"
```

---

### Task 11: ScanService (Two-Step Yarn Berry)

**Files:**

- Create: `src/api/services/abstractions/ScanService.ts`
- Create: `src/api/services/ScanService.ts`
- Test: `src/api/services/__tests__/ScanService.test.ts`

**Interfaces:**

- Consumes: `CommandRunner` from Task 8, `RegistryCacheService` from Task 10b
- Produces: `ScanService` abstraction with `scan(projectPath, force?): Promise<Dependency[]>`. Uses two-step Yarn Berry commands: (1) `yarn info --all --json` for installed versions (NDJSON), (2) read `package.json` for direct deps, (3) `RegistryCacheService.getPackageInfo()` per direct dep for registry latest (cached with 30min TTL). `force` param passed through to `RegistryCacheService`.

- [ ] **Step 1: Write abstraction**

```ts
// src/api/services/abstractions/ScanService.ts
import { createAbstraction } from "#shared/index.js";

interface IScannedDependency {
  name: string;
  currentVersion: string;
  latestInRange: string;
  latestVersion: string;
  type: "dependency" | "devDependency";
  upgradeType: "patch" | "minor" | "major" | "none";
}

interface IScanService {
  scan(projectPath: string): Promise<IScannedDependency[]>;
}

export const ScanService = createAbstraction<IScanService>("Api/ScanService");

export namespace ScanService {
  export type Interface = IScanService;
  export type Dependency = IScannedDependency;
}
```

- [ ] **Step 2: Write implementation**

```ts
// src/api/services/ScanService.ts
import { readFile } from "fs/promises";
import { join } from "path";
import { ScanService as Abstraction } from "./abstractions/ScanService.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";

function classifyUpgrade(current: string, latest: string): "patch" | "minor" | "major" | "none" {
  if (current === latest) {
    return "none";
  }
  const curParts = current.split(".");
  const latParts = latest.split(".");
  const curMajor = Number(curParts[0] ?? "0");
  const curMinor = Number(curParts[1] ?? "0");
  const latMajor = Number(latParts[0] ?? "0");
  const latMinor = Number(latParts[1] ?? "0");
  if (curMajor !== latMajor) {
    return "major";
  }
  if (curMinor !== latMinor) {
    return "minor";
  }
  return "patch";
}

interface YarnInfoEntry {
  value?: string;
  children?: { Version?: string };
}

interface NpmInfoResponse {
  "dist-tags"?: { latest?: string };
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

class ScanServiceImpl implements Abstraction.Interface {
  public constructor(private readonly commandRunner: CommandRunner.Interface) {}

  public async scan(projectPath: string): Promise<Abstraction.Dependency[]> {
    // Step 1: Get installed versions via yarn info --all --json (NDJSON)
    const infoResult = await this.commandRunner.run("yarn", ["info", "--all", "--json"], {
      cwd: projectPath
    });
    const installed = this.parseYarnInfo(infoResult.stdout);

    // Step 2: Read package.json to identify direct deps
    const pkgJsonPath = join(projectPath, "package.json");
    const pkgJsonContent = await readFile(pkgJsonPath, "utf-8");
    const pkgJson = JSON.parse(pkgJsonContent) as PackageJson;

    const directDeps = new Map<string, "dependency" | "devDependency">();
    for (const name of Object.keys(pkgJson.dependencies ?? {})) {
      directDeps.set(name, "dependency");
    }
    for (const name of Object.keys(pkgJson.devDependencies ?? {})) {
      directDeps.set(name, "devDependency");
    }

    // Step 3: For each direct dep, get latest version from registry
    const results: Abstraction.Dependency[] = [];
    for (const [name, type] of directDeps) {
      const currentVersion = installed.get(name);
      if (!currentVersion) {
        continue;
      }

      const npmInfoResult = await this.commandRunner.run("yarn", ["npm", "info", name, "--json"], {
        cwd: projectPath
      });

      let latestVersion = currentVersion;
      try {
        const npmInfo = JSON.parse(npmInfoResult.stdout) as NpmInfoResponse;
        latestVersion = npmInfo["dist-tags"]?.latest ?? currentVersion;
      } catch {
        // If npm info fails, use current as latest
      }

      results.push({
        name,
        currentVersion,
        latestInRange: currentVersion,
        latestVersion,
        type,
        upgradeType: classifyUpgrade(currentVersion, latestVersion)
      });
    }

    return results;
  }

  private parseYarnInfo(stdout: string): Map<string, string> {
    const versions = new Map<string, string>();
    for (const line of stdout.split("\n")) {
      if (!line.trim()) {
        continue;
      }
      try {
        const entry = JSON.parse(line) as YarnInfoEntry;
        if (entry.value && entry.children?.Version) {
          // value is "pkg@npm:version" or "pkg@version"
          const atNpmIndex = entry.value.indexOf("@npm:");
          let name: string;
          if (atNpmIndex > 0) {
            name = entry.value.substring(0, atNpmIndex);
          } else {
            const atIndex = entry.value.lastIndexOf("@");
            name = atIndex > 0 ? entry.value.substring(0, atIndex) : entry.value;
          }
          versions.set(name, entry.children.Version);
        }
      } catch {
        // skip malformed lines
      }
    }
    return versions;
  }
}

export const ScanService = Abstraction.createImplementation({
  implementation: ScanServiceImpl,
  dependencies: [CommandRunner]
});
```

Note: `latestInRange` is set to `currentVersion` as a simplification. A full implementation would parse the semver range from `package.json` and match against available versions from the `yarn npm info` response. Consider adding the `semver` package if precise range matching is needed.

- [ ] **Step 3: Write test (mocks only CommandRunner)**

```ts
// src/api/services/__tests__/ScanService.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createContainer } from "#shared/index.js";
import { CommandRunner } from "../abstractions/CommandRunner.js";
import { ScanService } from "../abstractions/ScanService.js";
import { ScanService as ScanServiceRegistration } from "../ScanService.js";

describe("ScanService", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `scan-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function createService(runHandler: CommandRunner.Interface["run"]): ScanService.Interface {
    const container = createContainer();
    container.registerInstance(CommandRunner, {
      run: runHandler,
      runStreaming: async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0
      })
    });
    container.register(ScanServiceRegistration);
    return container.resolve(ScanService);
  }

  it("scans dependencies using two-step yarn info", async () => {
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({
        name: "test",
        dependencies: { react: "^18.2.0" },
        devDependencies: { vitest: "^4.0.0" }
      })
    );

    const yarnInfoOutput = [
      JSON.stringify({
        value: "react@npm:18.2.0",
        children: { Version: "18.2.0" }
      }),
      JSON.stringify({
        value: "vitest@npm:4.0.0",
        children: { Version: "4.0.0" }
      })
    ].join("\n");

    const service = createService(async (_cmd, args) => {
      const firstArg = args[0];
      if (firstArg === "info") {
        return {
          stdout: yarnInfoOutput,
          stderr: "",
          exitCode: 0
        };
      }
      if (firstArg === "npm") {
        const pkgName = args[2];
        if (pkgName === "react") {
          return {
            stdout: JSON.stringify({
              "dist-tags": { latest: "19.1.0" }
            }),
            stderr: "",
            exitCode: 0
          };
        }
        if (pkgName === "vitest") {
          return {
            stdout: JSON.stringify({
              "dist-tags": { latest: "4.1.10" }
            }),
            stderr: "",
            exitCode: 0
          };
        }
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });

    const deps = await service.scan(testDir);

    expect(deps).toHaveLength(2);

    const react = deps.find(d => d.name === "react");
    expect(react).toBeDefined();
    expect(react!.currentVersion).toBe("18.2.0");
    expect(react!.latestVersion).toBe("19.1.0");
    expect(react!.type).toBe("dependency");
    expect(react!.upgradeType).toBe("major");

    const vitest = deps.find(d => d.name === "vitest");
    expect(vitest).toBeDefined();
    expect(vitest!.type).toBe("devDependency");
    expect(vitest!.upgradeType).toBe("minor");
  });

  it("returns empty array when no direct deps in package.json", async () => {
    writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "empty" }));

    const service = createService(async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0
    }));
    const deps = await service.scan(testDir);

    expect(deps).toEqual([]);
  });
});
```

- [ ] **Step 4: Run tests, lint, format, commit**

Run: `yarn test`
Expected: PASS

```bash
yarn lint:fix && yarn format:fix
git add src/api/services/abstractions/ScanService.ts src/api/services/ScanService.ts src/api/services/__tests__/ScanService.test.ts
git commit -m "feat(api): add ScanService with two-step Yarn Berry scanning"
```

---

### Task 12: UpgradeService

**Files:**

- Create: `src/api/services/abstractions/UpgradeService.ts`
- Create: `src/api/services/UpgradeService.ts`
- Test: `src/api/services/__tests__/UpgradeService.test.ts`

**Interfaces:**

- Consumes: `CommandRunner` from Task 8
- Produces: `UpgradeService` with `upgradePackage(projectPath, packageName, targetVersion, onLog): Promise<void>` and `refreshTransient(projectPath, onLog): Promise<void>`.

- [ ] **Step 1: Write abstraction**

```ts
// src/api/services/abstractions/UpgradeService.ts
import { createAbstraction } from "#shared/index.js";

interface IUpgradeService {
  upgradePackage(
    projectPath: string,
    packageName: string,
    targetVersion: string,
    onLog: (line: string) => void
  ): Promise<void>;
  refreshTransient(projectPath: string, onLog: (line: string) => void): Promise<void>;
}

export const UpgradeService = createAbstraction<IUpgradeService>("Api/UpgradeService");

export namespace UpgradeService {
  export type Interface = IUpgradeService;
}
```

- [ ] **Step 2: Write implementation**

```ts
// src/api/services/UpgradeService.ts
import { UpgradeService as Abstraction } from "./abstractions/UpgradeService.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";

class UpgradeServiceImpl implements Abstraction.Interface {
  public constructor(private readonly commandRunner: CommandRunner.Interface) {}

  public async upgradePackage(
    projectPath: string,
    packageName: string,
    targetVersion: string,
    onLog: (line: string) => void
  ): Promise<void> {
    await this.commandRunner.runStreaming("yarn", ["up", `${packageName}@${targetVersion}`], {
      cwd: projectPath,
      onStdout: onLog,
      onStderr: onLog
    });
  }

  public async refreshTransient(projectPath: string, onLog: (line: string) => void): Promise<void> {
    await this.commandRunner.runStreaming("yarn", ["up", "**", "-R"], {
      cwd: projectPath,
      onStdout: onLog,
      onStderr: onLog
    });
  }
}

export const UpgradeService = Abstraction.createImplementation({
  implementation: UpgradeServiceImpl,
  dependencies: [CommandRunner]
});
```

- [ ] **Step 3: Write test (mocks CommandRunner, verifies correct yarn commands)**

Follow the same DI-based testing pattern as Task 11. Register mock `CommandRunner` via `registerInstance`, register real `UpgradeService`, resolve and verify that `runStreaming` is called with `["up", "react@19.0.0"]` for `upgradePackage` and `["up", "**", "-R"]` for `refreshTransient`. Use `vi.fn()` ONLY on the mock methods themselves (not on services) to verify arguments.

- [ ] **Step 4: Run tests, lint, format, commit**

```bash
git commit -m "feat(api): add UpgradeService for dependency upgrades"
```

---

### Task 13: YarnService

**Files:**

- Create: `src/api/services/abstractions/YarnService.ts`
- Create: `src/api/services/YarnService.ts`
- Test: `src/api/services/__tests__/YarnService.test.ts`

**Interfaces:**

- Consumes: `CommandRunner` from Task 8
- Produces: `YarnService` with `updateVersion(projectPath, version, onLog): Promise<void>` and `getVersion(projectPath): Promise<string>`.

- [ ] **Step 1: Write abstraction**

```ts
// src/api/services/abstractions/YarnService.ts
import { createAbstraction } from "#shared/index.js";

interface IYarnService {
  updateVersion(projectPath: string, version: string, onLog: (line: string) => void): Promise<void>;
  getVersion(projectPath: string): Promise<string>;
}

export const YarnService = createAbstraction<IYarnService>("Api/YarnService");

export namespace YarnService {
  export type Interface = IYarnService;
}
```

- [ ] **Step 2: Write implementation**

```ts
// src/api/services/YarnService.ts
import { YarnService as Abstraction } from "./abstractions/YarnService.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";

class YarnServiceImpl implements Abstraction.Interface {
  public constructor(private readonly commandRunner: CommandRunner.Interface) {}

  public async updateVersion(
    projectPath: string,
    version: string,
    onLog: (line: string) => void
  ): Promise<void> {
    await this.commandRunner.runStreaming("yarn", ["set", "version", version], {
      cwd: projectPath,
      onStdout: onLog,
      onStderr: onLog
    });
  }

  public async getVersion(projectPath: string): Promise<string> {
    const result = await this.commandRunner.run("yarn", ["--version"], { cwd: projectPath });
    return result.stdout.trim();
  }
}

export const YarnService = Abstraction.createImplementation({
  implementation: YarnServiceImpl,
  dependencies: [CommandRunner]
});
```

- [ ] **Step 3: Write test**

Same DI pattern. Mock `CommandRunner`, verify `runStreaming` called with `["set", "version", "4.7.0"]` and `run` called with `["--version"]`.

- [ ] **Step 4: Run tests, lint, format, commit**

```bash
git commit -m "feat(api): add YarnService for Yarn version management"
```

---

### Task 14: JobWorker (FIFO Per Project + Concurrent Across Projects)

**Files:**

- Create: `src/api/services/abstractions/JobWorker.ts`
- Create: `src/api/services/JobWorker.ts`
- Test: `src/api/services/__tests__/JobWorker.test.ts`

**Interfaces:**

- Consumes: `DatabaseClient`, `UpgradeService`, `YarnService`, `SecurityService`, `ScanCache`
- Produces: `JobWorker` abstraction with `enqueue(input): Promise<string>`, `getJob(jobId): Promise<Job | null>`, `getJobsForProject(projectId): Promise<Job[]>`, `processNextJob(): Promise<void>`. Key behaviors: (1) `processNextJob()` picks one pending job per project, skipping projects that already have a running job. (2) Jobs for different projects run concurrently. (3) `enqueue` for `dependency`/`transient` type requires security check to pass.

- [ ] **Step 1: Write abstraction**

```ts
// src/api/services/abstractions/JobWorker.ts
import { createAbstraction } from "#shared/index.js";

interface IDepUpgradePackage {
  name: string;
  from: string;
  to: string;
}

interface IYarnUpgradePackage {
  from: string;
  to: string;
}

interface ICreateJobInput {
  projectId: string;
  type: "dependency" | "transient" | "yarn";
  packages?: IDepUpgradePackage[] | IYarnUpgradePackage | null | undefined;
}

interface IJob {
  id: string;
  projectId: string;
  type: string;
  status: string;
  packages: string | null;
  logs: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

interface IJobWorker {
  enqueue(input: ICreateJobInput): Promise<string>;
  getJob(jobId: string): Promise<IJob | null>;
  getJobsForProject(projectId: string): Promise<IJob[]>;
  processNextJob(): Promise<void>;
}

export const JobWorker = createAbstraction<IJobWorker>("Api/JobWorker");

export namespace JobWorker {
  export type Interface = IJobWorker;
  export type CreateJobInput = ICreateJobInput;
  export type Job = IJob;
  export type DepUpgradePackage = IDepUpgradePackage;
  export type YarnUpgradePackage = IYarnUpgradePackage;
}
```

- [ ] **Step 2: Write implementation (FIFO per project, concurrent across projects)**

```ts
// src/api/services/JobWorker.ts
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { JobWorker as Abstraction } from "./abstractions/JobWorker.js";
import { DatabaseClient } from "../db/abstractions/DatabaseClient.js";
import { UpgradeService } from "./abstractions/UpgradeService.js";
import { YarnService } from "./abstractions/YarnService.js";
import { SecurityService } from "./abstractions/SecurityService.js";
import { upgradeJobs, projects } from "../db/schema.js";

class JobWorkerImpl implements Abstraction.Interface {
  readonly #runningProjects = new Set<string>();

  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly upgradeService: UpgradeService.Interface,
    private readonly yarnService: YarnService.Interface,
    private readonly securityService: SecurityService.Interface
  ) {}

  public async enqueue(input: Abstraction.CreateJobInput): Promise<string> {
    if (input.type === "dependency" || input.type === "transient") {
      const project = this.databaseClient.db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .get();

      if (!project) {
        throw new Error("Project not found");
      }

      const securityResult = await this.securityService.check(project.id, project.path);
      if (!securityResult.passes) {
        throw new Error("Security check failed");
      }
    }

    const id = generateId();
    this.databaseClient.db
      .insert(upgradeJobs)
      .values({
        id,
        projectId: input.projectId,
        type: input.type,
        status: "pending",
        packages: input.packages ? JSON.stringify(input.packages) : null
      })
      .run();

    return id;
  }

  public async getJob(jobId: string): Promise<Abstraction.Job | null> {
    return (
      this.databaseClient.db.select().from(upgradeJobs).where(eq(upgradeJobs.id, jobId)).get() ??
      null
    );
  }

  public async getJobsForProject(projectId: string): Promise<Abstraction.Job[]> {
    return this.databaseClient.db
      .select()
      .from(upgradeJobs)
      .where(eq(upgradeJobs.projectId, projectId))
      .all();
  }

  public async processNextJob(): Promise<void> {
    const pendingJobs = this.databaseClient.db
      .select()
      .from(upgradeJobs)
      .where(eq(upgradeJobs.status, "pending"))
      .all();

    for (const job of pendingJobs) {
      if (this.#runningProjects.has(job.projectId)) {
        continue;
      }

      // Mark as running immediately to prevent double-pickup
      this.databaseClient.db
        .update(upgradeJobs)
        .set({ status: "running", startedAt: Date.now() })
        .where(eq(upgradeJobs.id, job.id))
        .run();

      this.#runningProjects.add(job.projectId);

      // Execute asynchronously — different projects run concurrently
      void this.executeJob(job).finally(() => {
        this.#runningProjects.delete(job.projectId);
      });
    }
  }

  private async executeJob(job: Abstraction.Job): Promise<void> {
    const project = this.databaseClient.db
      .select()
      .from(projects)
      .where(eq(projects.id, job.projectId))
      .get();

    if (!project) {
      this.failJob(job.id, "Project not found");
      return;
    }

    let logs = "";
    const appendLog = (line: string): void => {
      logs += line + "\n";
      this.databaseClient.db
        .update(upgradeJobs)
        .set({ logs })
        .where(eq(upgradeJobs.id, job.id))
        .run();
    };

    try {
      if (job.type === "dependency") {
        const packages = JSON.parse(job.packages ?? "[]") as Abstraction.DepUpgradePackage[];
        for (const pkg of packages) {
          await this.upgradeService.upgradePackage(project.path, pkg.name, pkg.to, appendLog);
        }
      } else if (job.type === "transient") {
        await this.upgradeService.refreshTransient(project.path, appendLog);
      } else if (job.type === "yarn") {
        const yarnPkg = JSON.parse(job.packages ?? "{}") as Abstraction.YarnUpgradePackage;
        await this.yarnService.updateVersion(project.path, yarnPkg.to, appendLog);
      }

      this.databaseClient.db
        .update(upgradeJobs)
        .set({
          status: "completed",
          completedAt: Date.now(),
          logs
        })
        .where(eq(upgradeJobs.id, job.id))
        .run();
    } catch (error) {
      this.failJob(job.id, `${logs}\nERROR: ${String(error)}`);
    }
  }

  private failJob(jobId: string, logs: string): void {
    this.databaseClient.db
      .update(upgradeJobs)
      .set({
        status: "failed",
        completedAt: Date.now(),
        logs
      })
      .where(eq(upgradeJobs.id, jobId))
      .run();
  }
}

export const JobWorker = Abstraction.createImplementation({
  implementation: JobWorkerImpl,
  dependencies: [DatabaseClient, UpgradeService, YarnService, SecurityService]
});
```

- [ ] **Step 3: Write test (real services, mock only CommandRunner, real DB + temp files)**

```ts
// src/api/services/__tests__/JobWorker.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createContainer } from "#shared/index.js";
import { DatabaseClient } from "../../db/abstractions/DatabaseClient.js";
import { CommandRunner } from "../abstractions/CommandRunner.js";
import { SecurityService } from "../abstractions/SecurityService.js";
import { SecurityService as SecurityServiceReg } from "../SecurityService.js";
import { UpgradeService } from "../abstractions/UpgradeService.js";
import { UpgradeService as UpgradeServiceReg } from "../UpgradeService.js";
import { YarnService as YarnServiceReg } from "../YarnService.js";
import { JobWorker } from "../abstractions/JobWorker.js";
import { JobWorker as JobWorkerReg } from "../JobWorker.js";
import { projects } from "../../db/schema.js";
import { createTestDb } from "../../../../testing/helpers/createTestDb.js";

const VALID_YARNRC = [
  "npmPreapprovedPackages: []",
  "npmMinimalAgeGate: 3d",
  "enableScripts: false",
  "approvedGitRepositories: []"
].join("\n");

describe("JobWorker", () => {
  let testDir: string;
  let worker: JobWorker.Interface;

  beforeEach(() => {
    testDir = join(tmpdir(), `worker-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, ".yarnrc.yml"), VALID_YARNRC);

    const db = createTestDb();
    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
    container.registerInstance(CommandRunner, {
      run: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      runStreaming: async (_c, _a, options) => {
        options.onStdout("Processing...");
        return { stdout: "", stderr: "", exitCode: 0 };
      }
    });
    container.register(SecurityServiceReg);
    container.register(UpgradeServiceReg);
    container.register(YarnServiceReg);
    container.register(JobWorkerReg);

    db.insert(projects)
      .values({
        id: "p1",
        name: "test-project",
        path: testDir,
        addedAt: Date.now()
      })
      .run();

    worker = container.resolve(JobWorker);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("enqueues a dependency upgrade job as pending", async () => {
    const jobId = await worker.enqueue({
      projectId: "p1",
      type: "dependency",
      packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
    });

    const job = await worker.getJob(jobId);
    expect(job).toBeDefined();
    expect(job!.status).toBe("pending");
    expect(job!.type).toBe("dependency");
  });

  it("rejects upgrade when security check fails", async () => {
    writeFileSync(join(testDir, ".yarnrc.yml"), "enableScripts: true\n");

    await expect(
      worker.enqueue({
        projectId: "p1",
        type: "dependency",
        packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
      })
    ).rejects.toThrow("Security check failed");
  });

  it("allows yarn update without security check", async () => {
    writeFileSync(join(testDir, ".yarnrc.yml"), "enableScripts: true\n");

    const jobId = await worker.enqueue({
      projectId: "p1",
      type: "yarn",
      packages: { from: "4.0.0", to: "4.7.0" }
    });

    expect(jobId).toBeDefined();
  });

  it("retrieves jobs for a project", async () => {
    await worker.enqueue({
      projectId: "p1",
      type: "dependency",
      packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
    });

    const jobs = await worker.getJobsForProject("p1");
    expect(jobs).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run tests, lint, format, commit**

```bash
git commit -m "feat(api): add JobWorker with FIFO per-project queue and concurrent execution"
```

---

### Task 15: API Feature (DI Registration)

**Files:**

- Create: `src/api/feature.ts`

**Interfaces:**

- Consumes: All API service implementations and abstractions
- Produces: `ApiFeature` that registers all API services in DI container. `DatabaseClient` registered via `registerInstance` with a factory call. All other services registered via `container.register()`.

- [ ] **Step 1: Write API feature**

```ts
// src/api/feature.ts
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { DatabaseClient } from "./db/abstractions/DatabaseClient.js";
import { createDatabaseClient } from "./db/client.js";
import { CommandRunner } from "./services/CommandRunner.js";
import { SecurityService } from "./services/SecurityService.js";
import { ScanService } from "./services/ScanService.js";
import { ScanCache } from "./services/ScanCache.js";
import { UpgradeService } from "./services/UpgradeService.js";
import { YarnService } from "./services/YarnService.js";
import { JobWorker } from "./services/JobWorker.js";

interface IApiFeatureContext {
  dbPath: string;
}

export const ApiFeature = createFeature<IApiFeatureContext>({
  name: "Api",
  register(container: Container, context: IApiFeatureContext) {
    container.registerInstance(DatabaseClient, createDatabaseClient(context.dbPath));
    container.register(CommandRunner).inSingletonScope();
    container.register(SecurityService).inSingletonScope();
    container.register(ScanService).inSingletonScope();
    container.register(ScanCache).inSingletonScope();
    container.register(UpgradeService).inSingletonScope();
    container.register(YarnService).inSingletonScope();
    container.register(JobWorker).inSingletonScope();
  }
});
```

Note: `register()` here imports from the implementation files (e.g., `./services/CommandRunner.js`), not from the abstractions. The implementation files export the `createImplementation` result which carries the abstraction-to-implementation mapping.

- [ ] **Step 2: Lint, format, commit**

```bash
yarn lint:fix && yarn format:fix
git add src/api/feature.ts
git commit -m "feat(api): add ApiFeature for DI registration"
```

---

### Task 16: Server Setup

**Files:**

- Create: `src/api/server.ts`

**Interfaces:**

- Consumes: `ApiFeature`, all route plugins, `@fastify/static` for production static serving, `runMigrations` from Task 7
- Produces: Fastify server that: (1) auto-runs Drizzle migrations on startup, (2) registers all route plugins, (3) starts `processNextJob()` polling via `setInterval`, (4) serves static UI files in production via `@fastify/static`.

- [ ] **Step 1: Write server.ts**

```ts
// src/api/server.ts
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { createContainer } from "#shared/index.js";
import { ApiFeature } from "./feature.js";
import { DatabaseClient } from "./db/abstractions/DatabaseClient.js";
import { JobWorker } from "./services/abstractions/JobWorker.js";
import { runMigrations } from "./db/migrate.js";
import { projectRoutes } from "./routes/projects.js";
import { upgradeRoutes } from "./routes/upgrades.js";
import { yarnRoutes } from "./routes/yarn.js";

const DB_PATH = "./data/upgrader.db";
const POLL_INTERVAL_MS = 3000;
const API_PORT = 3001;

async function main(): Promise<void> {
  // Ensure data directory exists
  if (!existsSync("./data")) {
    mkdirSync("./data", { recursive: true });
  }

  // Create DI container and register all services
  const container = createContainer();
  ApiFeature.register(container, { dbPath: DB_PATH });

  // Run migrations
  const databaseClient = container.resolve(DatabaseClient);
  runMigrations(databaseClient.db);

  // Create Fastify app
  const app = Fastify({ logger: true });

  // Register routes with container
  await app.register(projectRoutes, { container });
  await app.register(upgradeRoutes, { container });
  await app.register(yarnRoutes, { container });

  // Production: serve static UI files
  const distUiPath = resolve("dist/ui");
  if (existsSync(distUiPath)) {
    await app.register(fastifyStatic, {
      root: distUiPath,
      prefix: "/"
    });
  }

  // Start job processing polling loop
  const jobWorker = container.resolve(JobWorker);
  const pollInterval = setInterval(() => {
    void jobWorker.processNextJob();
  }, POLL_INTERVAL_MS);

  // Graceful shutdown
  app.addHook("onClose", () => {
    clearInterval(pollInterval);
  });

  await app.listen({ port: API_PORT, host: "0.0.0.0" });
}

void main();
```

- [ ] **Step 2: Lint, format, commit**

```bash
yarn lint:fix && yarn format:fix
git add src/api/server.ts
git commit -m "feat(api): add server with migrations, polling loop, and static serving"
```

---

### Task 17: Project Routes

**Files:**

- Create: `src/api/routes/projects.ts`
- Test: `src/api/routes/__tests__/projects.test.ts`

**Interfaces:**

- Consumes: `DatabaseClient`, `SecurityService`, `ScanService`, `ScanCache` (all resolved from container passed via Fastify plugin options)
- Produces: Fastify plugin with routes: `POST /api/projects` (derives name from package.json), `GET /api/projects`, `GET /api/projects/:id`, `DELETE /api/projects/:id` (cascade: hard-delete jobs + security_checks, clear scan cache, 409 if job running), `POST /api/projects/:id/scan`, `GET /api/projects/:id/dependencies` (from cache, empty array on miss), `GET /api/projects/:id/security`.

- [ ] **Step 1: Write route plugin**

```ts
// src/api/routes/projects.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import { eq, and } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { DatabaseClient } from "../db/abstractions/DatabaseClient.js";
import { SecurityService } from "../services/abstractions/SecurityService.js";
import { ScanService } from "../services/abstractions/ScanService.js";
import { ScanCache } from "../services/abstractions/ScanCache.js";
import { projects, upgradeJobs, securityChecks } from "../db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
  container: Container;
}

interface PackageJson {
  name?: string;
}

export async function projectRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
  const { container } = options;
  const databaseClient = container.resolve(DatabaseClient);
  const securityService = container.resolve(SecurityService);
  const scanService = container.resolve(ScanService);
  const scanCache = container.resolve(ScanCache);
  const { db } = databaseClient;

  // POST /api/projects — register project (name derived from package.json)
  app.post("/api/projects", async (request, reply) => {
    const body = request.body as { path: string };
    const projectPath = body.path;

    // Read name from package.json
    let name: string;
    try {
      const pkgContent = await readFile(join(projectPath, "package.json"), "utf-8");
      const pkgJson = JSON.parse(pkgContent) as PackageJson;
      name = pkgJson.name ?? basename(projectPath);
    } catch {
      name = basename(projectPath);
    }

    const id = generateId();
    db.insert(projects).values({ id, name, path: projectPath, addedAt: Date.now() }).run();

    reply.status(201);
    return { id, name, path: projectPath };
  });

  // GET /api/projects
  app.get("/api/projects", async () => {
    return db.select().from(projects).all();
  });

  // GET /api/projects/:id
  app.get<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) {
      reply.status(404);
      return { error: "Project not found" };
    }
    return project;
  });

  // DELETE /api/projects/:id — cascade delete with 409 if job running
  app.delete<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    const { id } = request.params;

    // Check for running jobs
    const runningJob = db
      .select()
      .from(upgradeJobs)
      .where(and(eq(upgradeJobs.projectId, id), eq(upgradeJobs.status, "running")))
      .get();

    if (runningJob) {
      reply.status(409);
      return {
        error: "Cannot delete project with running jobs"
      };
    }

    // Hard-delete related records
    db.delete(securityChecks).where(eq(securityChecks.projectId, id)).run();
    db.delete(upgradeJobs).where(eq(upgradeJobs.projectId, id)).run();
    db.delete(projects).where(eq(projects.id, id)).run();

    // Clear scan cache
    scanCache.clear(id);

    reply.status(204);
    return null;
  });

  // POST /api/projects/:id/scan — synchronous scan, populates cache
  app.post<{ Params: { id: string } }>("/api/projects/:id/scan", async (request, reply) => {
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) {
      reply.status(404);
      return { error: "Project not found" };
    }

    const deps = await scanService.scan(project.path);
    scanCache.set(project.id, deps);

    // Update lastScannedAt
    db.update(projects).set({ lastScannedAt: Date.now() }).where(eq(projects.id, project.id)).run();

    return deps;
  });

  // GET /api/projects/:id/dependencies — from cache, empty on miss
  app.get<{ Params: { id: string } }>("/api/projects/:id/dependencies", async (request, reply) => {
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) {
      reply.status(404);
      return { error: "Project not found" };
    }

    const cached = scanCache.get(project.id);
    return {
      dependencies: cached ?? [],
      lastScannedAt: project.lastScannedAt ?? null
    };
  });

  // GET /api/projects/:id/security
  app.get<{ Params: { id: string } }>("/api/projects/:id/security", async (request, reply) => {
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) {
      reply.status(404);
      return { error: "Project not found" };
    }

    const result = await securityService.check(project.id, project.path);
    return result;
  });
}
```

- [ ] **Step 2: Write test**

```ts
// src/api/routes/__tests__/projects.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Fastify from "fastify";
import { createContainer } from "#shared/index.js";
import { DatabaseClient } from "../../db/abstractions/DatabaseClient.js";
import { CommandRunner } from "../../services/abstractions/CommandRunner.js";
import { SecurityService as SecurityServiceReg } from "../../services/SecurityService.js";
import { ScanService as ScanServiceReg } from "../../services/ScanService.js";
import { ScanCache as ScanCacheReg } from "../../services/ScanCache.js";
import { projectRoutes } from "../projects.js";
import { projects } from "../../db/schema.js";
import { createTestDb } from "../../../../testing/helpers/createTestDb.js";

const VALID_YARNRC = [
  "npmPreapprovedPackages: []",
  "npmMinimalAgeGate: 3d",
  "enableScripts: false",
  "approvedGitRepositories: []"
].join("\n");

describe("project routes", () => {
  let app: ReturnType<typeof Fastify>;
  let testDir: string;
  let db: ReturnType<typeof createTestDb>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `route-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "my-test-project" }));
    writeFileSync(join(testDir, ".yarnrc.yml"), VALID_YARNRC);

    db = createTestDb();
    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
    container.registerInstance(CommandRunner, {
      run: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      runStreaming: async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0
      })
    });
    container.register(SecurityServiceReg);
    container.register(ScanServiceReg);
    container.register(ScanCacheReg);

    app = Fastify();
    await app.register(projectRoutes, { container });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  it("POST /api/projects derives name from package.json", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { path: testDir }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { name: string };
    expect(body.name).toBe("my-test-project");
  });

  it("GET /api/projects lists all projects", async () => {
    db.insert(projects)
      .values({
        id: "p1",
        name: "test",
        path: "/tmp/test",
        addedAt: Date.now()
      })
      .run();

    const response = await app.inject({
      method: "GET",
      url: "/api/projects"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as unknown[];
    expect(body).toHaveLength(1);
  });

  it("DELETE /api/projects/:id removes project and cascades", async () => {
    db.insert(projects)
      .values({
        id: "p1",
        name: "test",
        path: "/tmp/test",
        addedAt: Date.now()
      })
      .run();

    const response = await app.inject({
      method: "DELETE",
      url: "/api/projects/p1"
    });

    expect(response.statusCode).toBe(204);

    const remaining = db.select().from(projects).all();
    expect(remaining).toHaveLength(0);
  });

  it("DELETE returns 409 when job is running", async () => {
    db.insert(projects)
      .values({
        id: "p1",
        name: "test",
        path: "/tmp/test",
        addedAt: Date.now()
      })
      .run();

    // Import upgradeJobs for this test
    const { upgradeJobs } = await import("../../db/schema.js");
    db.insert(upgradeJobs)
      .values({
        id: "j1",
        projectId: "p1",
        type: "dependency",
        status: "running"
      })
      .run();

    const response = await app.inject({
      method: "DELETE",
      url: "/api/projects/p1"
    });

    expect(response.statusCode).toBe(409);
  });

  it("GET /api/projects/:id/dependencies returns empty on cache miss", async () => {
    db.insert(projects)
      .values({
        id: "p1",
        name: "test",
        path: "/tmp/test",
        addedAt: Date.now()
      })
      .run();

    const response = await app.inject({
      method: "GET",
      url: "/api/projects/p1/dependencies"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      dependencies: unknown[];
      lastScannedAt: null;
    };
    expect(body.dependencies).toEqual([]);
    expect(body.lastScannedAt).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests, lint, format, commit**

```bash
git commit -m "feat(api): add project CRUD routes with DELETE cascade and scan cache"
```

---

### Task 18: Upgrade + Yarn Routes

**Files:**

- Create: `src/api/routes/upgrades.ts`
- Create: `src/api/routes/yarn.ts`
- Test: `src/api/routes/__tests__/upgrades.test.ts`
- Test: `src/api/routes/__tests__/yarn.test.ts`

**Interfaces:**

- Consumes: `JobWorker`, `ScanCache`, `DatabaseClient`, `YarnService`
- Produces: `POST /api/projects/:id/upgrades` (maps `{name, targetVersion}` to `{name, from, to}` using scan cache; if `refreshTransient` is true, enqueues a second transient job), `POST /api/projects/:id/upgrades/transient`, `GET /api/projects/:id/upgrades/:jobId`, `GET /api/projects/:id/upgrades`, `POST /api/projects/:id/yarn/update`, `GET /api/projects/:id/yarn`.

**Key behaviors:**

1. **`{name, targetVersion}` to `{name, from, to}` mapping:** The upgrade request body has `packages: [{name, targetVersion}]`. The route looks up `from` in the scan cache by matching `name`:

```ts
const cached = scanCache.get(projectId);
const packagesWithFrom = body.packages.map((pkg: { name: string; targetVersion: string }) => {
  const found = cached?.find(d => d.name === pkg.name);
  return {
    name: pkg.name,
    from: found?.currentVersion ?? "unknown",
    to: pkg.targetVersion
  };
});
```

2. **`refreshTransient` flag:** If `body.refreshTransient` is true, enqueue a second transient job after the dependency upgrade job. Since the worker is FIFO per project, the transient job automatically runs after the dependency job completes:

```ts
const jobId = await jobWorker.enqueue({
  projectId: id,
  type: "dependency",
  packages: packagesWithFrom
});

if (body.refreshTransient === true) {
  await jobWorker.enqueue({
    projectId: id,
    type: "transient"
  });
}

return { jobId };
```

- [ ] **Step 1: Write upgrade routes plugin**

Implement as a Fastify plugin following the same pattern as `projectRoutes`. The plugin receives `container` via options, resolves `JobWorker`, `ScanCache`, and `DatabaseClient`.

- [ ] **Step 2: Write yarn routes plugin**

Implement `POST /api/projects/:id/yarn/update` (enqueues a yarn job with `{ from: currentVersion, to: body.version }`) and `GET /api/projects/:id/yarn` (returns `{ version }` from `YarnService.getVersion()`).

- [ ] **Step 3: Write tests**

Follow the same DI-based testing pattern as Task 17. Mock `CommandRunner`, use real services. Test that:

- Upgrade request maps `targetVersion` to `to` and looks up `from` from cache
- `refreshTransient: true` enqueues two jobs (dependency + transient)
- Upgrade returns 403 when security check fails
- Yarn update enqueues a yarn-type job

- [ ] **Step 4: Run tests, lint, format, commit**

```bash
git commit -m "feat(api): add upgrade and yarn routes with refreshTransient chaining"
```

---

## Track: UI (depends on Foundation — can run in parallel with API track)

### Task 19: HTTPClient Abstraction + Implementation

**Files:**

- Create: `src/ui/httpClient/abstractions/HTTPClient.ts`
- Create: `src/ui/httpClient/HTTPClient.ts`
- Create: `src/ui/httpClient/feature.ts`
- Test: `src/ui/httpClient/__tests__/HTTPClient.test.ts`

**Interfaces:**

- Consumes: `createAbstraction`, `createFeature` from `#shared/index.js`
- Produces: `HTTPClient` abstraction with `get<T>(url): Promise<T>`, `post<T>(url, body): Promise<T>`, `del(url): Promise<void>`. Implementation uses `fetch`. In UI tests, a mock HTTPClient is registered via `container.registerInstance()`.

- [ ] **Step 1: Write abstraction**

```ts
// src/ui/httpClient/abstractions/HTTPClient.ts
import { createAbstraction } from "#shared/index.js";

interface IHTTPClient {
  get<T>(url: string): Promise<T>;
  post<T>(url: string, body: unknown): Promise<T>;
  del(url: string): Promise<void>;
}

export const HTTPClient = createAbstraction<IHTTPClient>("Ui/HTTPClient");

export namespace HTTPClient {
  export type Interface = IHTTPClient;
}
```

- [ ] **Step 2: Write implementation**

```ts
// src/ui/httpClient/HTTPClient.ts
import { HTTPClient as Abstraction } from "./abstractions/HTTPClient.js";

class HTTPClientImpl implements Abstraction.Interface {
  public async get<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GET ${url} failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  public async post<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(`POST ${url} failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  public async del(url: string): Promise<void> {
    const response = await fetch(url, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(`DELETE ${url} failed: ${response.status}`);
    }
  }
}

export const HTTPClient = Abstraction.createImplementation({
  implementation: HTTPClientImpl,
  dependencies: []
});
```

- [ ] **Step 3: Write feature**

```ts
// src/ui/httpClient/feature.ts
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { HTTPClient } from "./HTTPClient.js";

export const HTTPClientFeature = createFeature({
  name: "Ui/HTTPClient",
  register(container: Container) {
    container.register(HTTPClient).inSingletonScope();
  }
});
```

- [ ] **Step 4: Write test (resolves through DI, also tests mock pattern)**

```ts
// src/ui/httpClient/__tests__/HTTPClient.test.ts
import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { HTTPClient } from "../abstractions/HTTPClient.js";
import { HTTPClient as HTTPClientRegistration } from "../HTTPClient.js";

describe("HTTPClient", () => {
  it("resolves from DI container", () => {
    const container = createContainer();
    container.register(HTTPClientRegistration);

    const client = container.resolve(HTTPClient);
    expect(client).toBeDefined();
    expect(typeof client.get).toBe("function");
    expect(typeof client.post).toBe("function");
    expect(typeof client.del).toBe("function");
  });

  it("mock implementation returns preset data via registerInstance", async () => {
    const container = createContainer();
    container.registerInstance(HTTPClient, {
      get: async <T>() => [{ id: "p1", name: "test" }] as T,
      post: async <T>() => ({ id: "new" }) as T,
      del: async () => {}
    });

    const client = container.resolve(HTTPClient);
    const result = await client.get("/api/projects");
    expect(result).toEqual([{ id: "p1", name: "test" }]);
  });
});
```

- [ ] **Step 5: Run tests, lint, format, commit**

```bash
git commit -m "feat(ui): add HTTPClient abstraction with fetch implementation"
```

---

### Task 20: useFeature Hook + ContainerProvider

**Files:**

- Create: `src/ui/shared/di/ContainerProvider.tsx`
- Create: `src/ui/shared/di/useFeature.ts`

**Interfaces:**

- Consumes: `createContainer`, `registerFeatures` from `#shared/index.js`, React
- Produces: `ContainerProvider` React component that creates a shared DI container and registers all features. `useFeature(feature)` hook that resolves a feature's exports from the shared container. `useContainer()` hook for direct container access.

**Why:** Every UI Provider component calls `useFeature(SomeFeature)` to get the presenter. The container must be shared (singletons like gateways and repositories must be the same instance across all providers). `ContainerProvider` wraps the entire app and holds the shared container in React context.

- [ ] **Step 1: Write ContainerProvider**

```tsx
// src/ui/shared/di/ContainerProvider.tsx
import type React from "react";
import { createContext, useContext, useMemo } from "react";
import type { Container } from "@webiny/di";
import { createContainer, registerFeatures } from "#shared/index.js";
import type { AnyFeature } from "#shared/index.js";

const ContainerContext = createContext<Container | null>(null);

interface ContainerProviderProps {
  features: AnyFeature[];
  children: React.ReactNode;
}

export function ContainerProvider({ features, children }: ContainerProviderProps): React.ReactNode {
  const container = useMemo(() => {
    const c = createContainer();
    registerFeatures(c, features);
    return c;
  }, [features]);

  return <ContainerContext value={container}>{children}</ContainerContext>;
}

export function useContainer(): Container {
  const container = useContext(ContainerContext);
  if (!container) {
    throw new Error("useContainer must be used within a ContainerProvider");
  }
  return container;
}
```

- [ ] **Step 2: Write useFeature hook**

```ts
// src/ui/shared/di/useFeature.ts
import { useMemo } from "react";
import type { Container } from "@webiny/di";
import { useContainer } from "./ContainerProvider.js";

interface FeatureWithResolve<TExports> {
  resolve(container: Container): TExports;
}

export function useFeature<TExports>(feature: FeatureWithResolve<TExports>): TExports {
  const container = useContainer();
  return useMemo(() => feature.resolve(container), [container, feature]);
}
```

- [ ] **Step 3: Lint, format, commit**

```bash
yarn lint:fix && yarn format:fix
git add src/ui/shared/
git commit -m "feat(ui): add ContainerProvider and useFeature hook for React DI"
```

---

### Task 21: ProjectsGateway + ProjectsRepository + Feature

**Files:**

- Create: `src/ui/features/projects/abstractions/ProjectsGateway.ts`
- Create: `src/ui/features/projects/abstractions/ProjectsRepository.ts`
- Create: `src/ui/features/projects/ProjectsGateway.ts`
- Create: `src/ui/features/projects/ProjectsRepository.ts`
- Create: `src/ui/features/projects/feature.ts`
- Test: `src/ui/features/projects/__tests__/ProjectsGateway.test.ts`

**Interfaces:**

- Consumes: `HTTPClient` from Task 19
- Produces: `ProjectsGateway` with `list(): Promise<Project[]>`, `get(id): Promise<Project>`, `create(path): Promise<Project>`, `remove(id): Promise<void>`, `scan(id): Promise<Dependency[]>`, `getDependencies(id): Promise<DependenciesResponse>`, `getSecurity(id): Promise<SecurityStatus>`. `ProjectsRepository` holds in-memory state: `projects`, `dependencies`, `securityStatus` with plain class methods (no MobX).

**Test pattern:** Register mock `HTTPClient` via `registerInstance`, register real `ProjectsGateway`, resolve and verify it calls the correct URLs and returns mapped data.

- [ ] **Step 1-5: Write abstractions, implementations, feature, test**

Follow the DI skill and UI architecture skill patterns. Gateway depends on `HTTPClient`. Repository depends on `ProjectsGateway`. Feature registers both as singletons.

- [ ] **Step 6: Lint, format, commit**

```bash
git commit -m "feat(ui): add ProjectsGateway and ProjectsRepository"
```

---

### Task 22: UpgradesGateway + UpgradesRepository + Feature

**Files:**

- Create: `src/ui/features/upgrades/abstractions/UpgradesGateway.ts`
- Create: `src/ui/features/upgrades/abstractions/UpgradesRepository.ts`
- Create: `src/ui/features/upgrades/UpgradesGateway.ts`
- Create: `src/ui/features/upgrades/UpgradesRepository.ts`
- Create: `src/ui/features/upgrades/feature.ts`
- Test: `src/ui/features/upgrades/__tests__/UpgradesGateway.test.ts`

**Interfaces:**

- Consumes: `HTTPClient` from Task 19
- Produces: `UpgradesGateway` with `startUpgrade(projectId, packages, refreshTransient): Promise<{ jobId }>`, `startTransient(projectId): Promise<{ jobId }>`, `getJob(projectId, jobId): Promise<Job>`, `getJobs(projectId): Promise<Job[]>`, `updateYarn(projectId, version): Promise<{ jobId }>`, `getYarnInfo(projectId): Promise<{ version }>`. `UpgradesRepository` holds job state.

- [ ] **Step 1-5: Same pattern as Task 21**

- [ ] **Step 6: Lint, format, commit**

```bash
git commit -m "feat(ui): add UpgradesGateway and UpgradesRepository"
```

---

### Task 23: Project Use Cases

**Files:**

- Create: `src/ui/presentation/projects/useCases/abstractions/LoadProjectsUseCase.ts`
- Create: `src/ui/presentation/projects/useCases/LoadProjectsUseCase.ts`
- Create: `src/ui/presentation/projects/useCases/abstractions/AddProjectUseCase.ts`
- Create: `src/ui/presentation/projects/useCases/AddProjectUseCase.ts`
- Create: `src/ui/presentation/projects/useCases/abstractions/RemoveProjectUseCase.ts`
- Create: `src/ui/presentation/projects/useCases/RemoveProjectUseCase.ts`
- Create: `src/ui/presentation/projects/useCases/abstractions/ScanProjectUseCase.ts`
- Create: `src/ui/presentation/projects/useCases/ScanProjectUseCase.ts`
- Create: `src/ui/presentation/projects/useCases/abstractions/CheckSecurityUseCase.ts`
- Create: `src/ui/presentation/projects/useCases/CheckSecurityUseCase.ts`
- Create: `src/ui/presentation/projects/useCases/abstractions/index.ts`
- Test: `src/ui/presentation/projects/useCases/__tests__/useCases.test.ts`

**Interfaces:**

- Consumes: `ProjectsGateway`, `ProjectsRepository` from Task 21
- Produces: Five use cases, each with an `execute()` method. Use cases orchestrate gateway calls and repository state updates. Presenters consume use cases — never gateways/repositories directly.

Each use case follows this pattern:

```ts
// abstractions/LoadProjectsUseCase.ts
import { createAbstraction } from "#shared/index.js";

interface ILoadProjectsUseCase {
  execute(): Promise<void>;
}

export const LoadProjectsUseCase =
  createAbstraction<ILoadProjectsUseCase>("Ui/LoadProjectsUseCase");

export namespace LoadProjectsUseCase {
  export type Interface = ILoadProjectsUseCase;
}
```

```ts
// LoadProjectsUseCase.ts
import { LoadProjectsUseCase as Abstraction } from "./abstractions/LoadProjectsUseCase.js";
import { ProjectsGateway } from "../../features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "../../features/projects/abstractions/ProjectsRepository.js";

class LoadProjectsUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly projectsGateway: ProjectsGateway.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface
  ) {}

  public execute = async (): Promise<void> => {
    const projects = await this.projectsGateway.list();
    this.projectsRepository.setProjects(projects);
  };
}

export const LoadProjectsUseCase = Abstraction.createImplementation({
  implementation: LoadProjectsUseCaseImpl,
  dependencies: [ProjectsGateway, ProjectsRepository]
});
```

- [ ] **Step 1-3: Write all five use case abstractions + implementations**

- `LoadProjectsUseCase` — calls `gateway.list()`, sets `repository.projects`
- `AddProjectUseCase` — calls `gateway.create(path)`, appends to `repository.projects`
- `RemoveProjectUseCase` — calls `gateway.remove(id)`, removes from `repository.projects`
- `ScanProjectUseCase` — calls `gateway.scan(id)`, sets `repository.dependencies`
- `CheckSecurityUseCase` — calls `gateway.getSecurity(id)`, sets `repository.securityStatus`

- [ ] **Step 4: Write test (mock HTTPClient, real everything else)**

Register mock `HTTPClient`, register real gateways, repositories, and use cases through DI. Verify that executing a use case updates the repository state correctly.

- [ ] **Step 5: Lint, format, commit**

```bash
git commit -m "feat(ui): add project use cases (Load, Add, Remove, Scan, CheckSecurity)"
```

---

### Task 24: Upgrade Use Cases

**Files:**

- Create: `src/ui/presentation/upgrades/useCases/abstractions/UpgradePackagesUseCase.ts`
- Create: `src/ui/presentation/upgrades/useCases/UpgradePackagesUseCase.ts`
- Create: `src/ui/presentation/upgrades/useCases/abstractions/RefreshTransientUseCase.ts`
- Create: `src/ui/presentation/upgrades/useCases/RefreshTransientUseCase.ts`
- Create: `src/ui/presentation/upgrades/useCases/abstractions/UpdateYarnUseCase.ts`
- Create: `src/ui/presentation/upgrades/useCases/UpdateYarnUseCase.ts`
- Create: `src/ui/presentation/upgrades/useCases/abstractions/GetJobUseCase.ts`
- Create: `src/ui/presentation/upgrades/useCases/GetJobUseCase.ts`
- Create: `src/ui/presentation/upgrades/useCases/abstractions/index.ts`
- Test: `src/ui/presentation/upgrades/useCases/__tests__/useCases.test.ts`

**Interfaces:**

- Consumes: `UpgradesGateway`, `UpgradesRepository` from Task 22
- Produces: Four use cases:
  - `UpgradePackagesUseCase.execute(projectId, packages, refreshTransient)` — calls `gateway.startUpgrade()`, stores `jobId` in repository
  - `RefreshTransientUseCase.execute(projectId)` — calls `gateway.startTransient()`
  - `UpdateYarnUseCase.execute(projectId, version)` — calls `gateway.updateYarn()`
  - `GetJobUseCase.execute(projectId, jobId)` — calls `gateway.getJob()`, updates repository

- [ ] **Step 1-4: Same pattern as Task 23**

- [ ] **Step 5: Lint, format, commit**

```bash
git commit -m "feat(ui): add upgrade use cases (UpgradePackages, RefreshTransient, UpdateYarn, GetJob)"
```

---

### Task 25: ProjectListPresenter

**Files:**

- Create: `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`
- Create: `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`
- Create: `src/ui/presentation/projects/ProjectList/feature.ts`
- Test: `src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts`

**Interfaces:**

- Consumes: `LoadProjectsUseCase`, `AddProjectUseCase`, `RemoveProjectUseCase` from Task 23
- Produces: `ProjectListPresenter` with `vm: { loading: boolean; projects: ProjectListItem[] }` and actions `load()`, `addProject(path)`, `removeProject(id)`. Uses `makeAutoObservable` with `{ vm: computed }`. All actions are arrow properties.

- [ ] **Step 1: Write abstraction**

```ts
// src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts
import { createAbstraction } from "#shared/index.js";

interface IProjectListItem {
  id: string;
  name: string;
  path: string;
  yarnVersion: string;
  securityPasses: boolean;
  lastScannedAt: string;
}

interface IProjectListViewModel {
  loading: boolean;
  projects: IProjectListItem[];
}

interface IProjectListPresenter {
  get vm(): IProjectListViewModel;
  load: () => Promise<void>;
  addProject: (path: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
}

export const ProjectListPresenter =
  createAbstraction<IProjectListPresenter>("Ui/ProjectListPresenter");

export namespace ProjectListPresenter {
  export type Interface = IProjectListPresenter;
  export type ViewModel = IProjectListViewModel;
  export type ProjectListItem = IProjectListItem;
}
```

- [ ] **Step 2: Write implementation**

```ts
// src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts
import { makeAutoObservable, runInAction, computed } from "mobx";
import { ProjectListPresenter as Abstraction } from "./abstractions/ProjectListPresenter.js";
import { LoadProjectsUseCase } from "../useCases/abstractions/LoadProjectsUseCase.js";
import { AddProjectUseCase } from "../useCases/abstractions/AddProjectUseCase.js";
import { RemoveProjectUseCase } from "../useCases/abstractions/RemoveProjectUseCase.js";
import { ProjectsRepository } from "../../../features/projects/abstractions/ProjectsRepository.js";

class ProjectListPresenterImpl implements Abstraction.Interface {
  private loading = false;

  public constructor(
    private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
    private readonly addProjectUseCase: AddProjectUseCase.Interface,
    private readonly removeProjectUseCase: RemoveProjectUseCase.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface
  ) {
    makeAutoObservable(this, { vm: computed });
  }

  public get vm(): Abstraction.ViewModel {
    const projects = this.projectsRepository.getProjects();
    return {
      loading: this.loading,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        path: p.path,
        yarnVersion: p.yarnVersion ?? "unknown",
        securityPasses: false,
        lastScannedAt: p.lastScannedAt ? new Date(p.lastScannedAt).toLocaleString() : "Never"
      }))
    };
  }

  public load = async (): Promise<void> => {
    this.loading = true;
    try {
      await this.loadProjectsUseCase.execute();
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  };

  public addProject = async (path: string): Promise<void> => {
    await this.addProjectUseCase.execute(path);
  };

  public removeProject = async (id: string): Promise<void> => {
    await this.removeProjectUseCase.execute(id);
  };
}

export const ProjectListPresenter = Abstraction.createImplementation({
  implementation: ProjectListPresenterImpl,
  dependencies: [LoadProjectsUseCase, AddProjectUseCase, RemoveProjectUseCase, ProjectsRepository]
});
```

Note: The presenter reads from `ProjectsRepository` for the `vm` getter but only writes through use cases. This follows the MVP layering: Presenter -> UseCase -> Gateway/Repository.

- [ ] **Step 3: Write feature**

```ts
// src/ui/presentation/projects/ProjectList/feature.ts
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { ProjectListPresenter as ProjectListPresenterAbstraction } from "./abstractions/ProjectListPresenter.js";
import { ProjectListPresenter } from "./ProjectListPresenter.js";

interface IProjectListFeatureExports {
  presenter: ProjectListPresenterAbstraction.Interface;
}

export const ProjectListFeature = createFeature<void, IProjectListFeatureExports>({
  name: "Ui/ProjectList",
  register(container: Container) {
    container.register(ProjectListPresenter);
  },
  resolve(container: Container): IProjectListFeatureExports {
    return {
      presenter: container.resolve(ProjectListPresenterAbstraction)
    };
  }
});
```

- [ ] **Step 4: Write test (mock HTTPClient, real everything else)**

```ts
// src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { ProjectsGateway as ProjectsGatewayReg } from "../../../../features/projects/ProjectsGateway.js";
import { ProjectsRepository as ProjectsRepositoryReg } from "../../../../features/projects/ProjectsRepository.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseReg } from "../../useCases/LoadProjectsUseCase.js";
import { AddProjectUseCase as AddProjectUseCaseReg } from "../../useCases/AddProjectUseCase.js";
import { RemoveProjectUseCase as RemoveProjectUseCaseReg } from "../../useCases/RemoveProjectUseCase.js";
import { ProjectListPresenter } from "../abstractions/ProjectListPresenter.js";
import { ProjectListPresenter as ProjectListPresenterReg } from "../ProjectListPresenter.js";

describe("ProjectListPresenter", () => {
  let presenter: ProjectListPresenter.Interface;

  beforeEach(() => {
    const container = createContainer();
    container.registerInstance(HTTPClient, {
      get: async <T>() =>
        [
          {
            id: "p1",
            name: "test",
            path: "/tmp/test",
            yarnVersion: "4.17.1",
            addedAt: Date.now(),
            lastScannedAt: null
          }
        ] as T,
      post: async <T>() => ({}) as T,
      del: async () => {}
    });
    container.register(ProjectsGatewayReg).inSingletonScope();
    container.register(ProjectsRepositoryReg).inSingletonScope();
    container.register(LoadProjectsUseCaseReg);
    container.register(AddProjectUseCaseReg);
    container.register(RemoveProjectUseCaseReg);
    container.register(ProjectListPresenterReg);

    presenter = container.resolve(ProjectListPresenter);
  });

  it("starts with loading false and empty projects", () => {
    expect(presenter.vm.loading).toBe(false);
    expect(presenter.vm.projects).toEqual([]);
  });

  it("loads projects and updates vm", async () => {
    await presenter.load();
    expect(presenter.vm.loading).toBe(false);
    expect(presenter.vm.projects).toHaveLength(1);
    expect(presenter.vm.projects[0]!.name).toBe("test");
  });
});
```

- [ ] **Step 5: Run tests, lint, format, commit**

```bash
git commit -m "feat(ui): add ProjectListPresenter with MobX computed vm"
```

---

### Task 26: ProjectDetailPresenter

**Files:**

- Create: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`
- Create: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`
- Create: `src/ui/presentation/projects/ProjectDetail/feature.ts`
- Test: `src/ui/presentation/projects/ProjectDetail/__tests__/ProjectDetailPresenter.test.ts`

**Interfaces:**

- Consumes: `ScanProjectUseCase`, `CheckSecurityUseCase`, `UpgradePackagesUseCase`, `RefreshTransientUseCase`, `UpdateYarnUseCase` from Tasks 23-24, plus `ProjectsRepository`, `UpgradesRepository`
- Produces: `ProjectDetailPresenter` with `vm: { loading, project, dependencies, security, selectedPackages, activeJob }` and actions: `load(id)`, `scan()`, `togglePackage(name)`, `setTargetVersion(name, version)`, `upgradeSelected()`, `refreshTransient()`, `updateYarn(version)`.

- [ ] **Step 1-4: Follow same pattern as Task 25**

Use cases handle all gateway/repository interactions. Presenter reads from repositories via use cases, never directly from gateways.

- [ ] **Step 5: Lint, format, commit**

```bash
git commit -m "feat(ui): add ProjectDetailPresenter"
```

---

### Task 27: JobProgressPresenter (Consumes Use Cases)

**Files:**

- Create: `src/ui/presentation/jobs/JobProgress/abstractions/JobProgressPresenter.ts`
- Create: `src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts`
- Create: `src/ui/presentation/jobs/JobProgress/feature.ts`
- Test: `src/ui/presentation/jobs/JobProgress/__tests__/JobProgressPresenter.test.ts`

**Interfaces:**

- Consumes: `GetJobUseCase` from Task 24, `UpgradesRepository`
- Produces: `JobProgressPresenter` with `vm: { activeJob: { status, logs, type } | null; history: Job[] }` and `startPolling(projectId, jobId)`, `stopPolling()`.

**Key: Presenter consumes use cases, NOT gateways directly.** The polling loop calls `getJobUseCase.execute(projectId, jobId)` which calls the gateway and updates the repository. The presenter reads from the repository.

- [ ] **Step 1: Write abstraction**

```ts
// src/ui/presentation/jobs/JobProgress/abstractions/JobProgressPresenter.ts
import { createAbstraction } from "#shared/index.js";

interface IJobViewModel {
  id: string;
  status: string;
  type: string;
  logs: string;
  startedAt: string;
  completedAt: string;
}

interface IJobProgressViewModel {
  activeJob: IJobViewModel | null;
  history: IJobViewModel[];
}

interface IJobProgressPresenter {
  get vm(): IJobProgressViewModel;
  startPolling: (projectId: string, jobId: string) => void;
  stopPolling: () => void;
}

export const JobProgressPresenter =
  createAbstraction<IJobProgressPresenter>("Ui/JobProgressPresenter");

export namespace JobProgressPresenter {
  export type Interface = IJobProgressPresenter;
  export type ViewModel = IJobProgressViewModel;
  export type JobViewModel = IJobViewModel;
}
```

- [ ] **Step 2: Write implementation**

The presenter uses `setInterval` for polling. `startPolling` sets up a 2-second interval that calls `getJobUseCase.execute()`. `stopPolling` clears the interval. The `vm` getter reads from `UpgradesRepository` to build the view model.

- [ ] **Step 3: Write feature + test**

Test registers mock `HTTPClient`, real gateways, repositories, use cases, and presenter. Verify that `vm` returns correct structure after use case execution.

- [ ] **Step 4: Lint, format, commit**

```bash
git commit -m "feat(ui): add JobProgressPresenter with polling via use cases"
```

---

### Task 28: JobProgress React Components

**Files:**

- Create: `src/ui/presentation/jobs/JobProgress/components/JobProgressPanel.tsx`
- Create: `src/ui/presentation/jobs/JobProgress/components/JobLogViewer.tsx`

**Interfaces:**

- Consumes: `JobProgressPresenter` from Task 27

**Why before ProjectDetail:** Task 30 (ProjectDetail components) renders `JobProgressPanel` inline. This task must complete first.

- [ ] **Step 1: Implement JobLogViewer**

Renders logs in a Mantine `Code` block with monospace font. Receives `logs: string` as prop.

- [ ] **Step 2: Implement JobProgressPanel**

Uses `observer()` wrapper. Reads `presenter.vm.activeJob`. Shows status badge (Mantine `Badge`), log viewer, and job history list.

- [ ] **Step 3: Lint, format, commit**

```bash
git commit -m "feat(ui): add JobProgress React components"
```

---

### Task 29: ProjectList React Components

**Files:**

- Create: `src/ui/presentation/projects/ProjectList/ProjectListProvider.tsx`
- Create: `src/ui/presentation/projects/ProjectList/components/ProjectListPage.tsx`
- Create: `src/ui/presentation/projects/ProjectList/components/AddProjectModal.tsx`

**Interfaces:**

- Consumes: `ProjectListPresenter` from Task 25, `ProjectListFeature`

- [ ] **Step 1: Implement Provider (render props pattern)**

```tsx
// src/ui/presentation/projects/ProjectList/ProjectListProvider.tsx
import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { ProjectListFeature } from "./feature.js";
import type { ProjectListPresenter } from "./abstractions/ProjectListPresenter.js";

interface ProjectListProviderProps {
  children: (params: { presenter: ProjectListPresenter.Interface }) => React.ReactNode;
}

export function ProjectListProvider({ children }: ProjectListProviderProps): React.ReactNode {
  const { presenter } = useFeature(ProjectListFeature);
  return children({ presenter });
}
```

- [ ] **Step 2: Implement ProjectListPage**

Uses `observer()`, Mantine `Table`, `Badge`, `Button`, `ActionIcon`. Calls `presenter.load()` in `useEffect`. Renders `vm.projects` in table rows. Security badge red/green.

- [ ] **Step 3: Implement AddProjectModal**

Uses `Modal`, `TextInput`, `Button` from Mantine. Calls `presenter.addProject(path)`.

- [ ] **Step 4: Lint, format, commit**

```bash
git commit -m "feat(ui): add ProjectList React components"
```

---

### Task 30: ProjectDetail React Components

**Files:**

- Create: `src/ui/presentation/projects/ProjectDetail/ProjectDetailProvider.tsx`
- Create: `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`
- Create: `src/ui/presentation/projects/ProjectDetail/components/DependencyTable.tsx`
- Create: `src/ui/presentation/projects/ProjectDetail/components/SecurityPanel.tsx`

**Interfaces:**

- Consumes: `ProjectDetailPresenter` from Task 26, `JobProgressPanel` from Task 28

**Depends on:** Task 28 (JobProgress components) — `ProjectDetailPage` renders `JobProgressPanel` inline.

- [ ] **Step 1: Implement Provider**

Same render-props pattern as Task 29.

- [ ] **Step 2: Implement SecurityPanel**

Shows 4 settings with pass/fail badges. Blocks all upgrade actions if any fail.

- [ ] **Step 3: Implement DependencyTable**

Mantine `Table` with checkboxes per dependency, version selector column (in-range or latest), "Upgrade Selected" button.

- [ ] **Step 4: Implement ProjectDetailPage**

Composes SecurityPanel, DependencyTable, and JobProgressPanel. Uses `observer()`. Calls `presenter.load(id)` in `useEffect` with route param.

- [ ] **Step 5: Lint, format, commit**

```bash
git commit -m "feat(ui): add ProjectDetail React components with inline job progress"
```

---

### Task 31: App Shell + Routing

**Files:**

- Create: `src/ui/App.tsx`
- Create: `src/ui/main.tsx`

**Interfaces:**

- Consumes: All UI features and providers from Tasks 19-30

- [ ] **Step 1: Create App.tsx**

```tsx
// src/ui/App.tsx
import { BrowserRouter, Routes, Route } from "@webiny/app";
import { MantineProvider } from "@mantine/core";
import { ContainerProvider } from "#ui/shared/di/ContainerProvider.js";
import { HTTPClientFeature } from "#ui/httpClient/index.js";
import { ProjectsFeature } from "#ui/features/projects/index.js";
import { UpgradesFeature } from "#ui/features/upgrades/index.js";
import { ProjectListProvider } from "./presentation/projects/ProjectList/ProjectListProvider.js";
import { ProjectListPage } from "./presentation/projects/ProjectList/components/ProjectListPage.js";
import { ProjectDetailProvider } from "./presentation/projects/ProjectDetail/ProjectDetailProvider.js";
import { ProjectDetailPage } from "./presentation/projects/ProjectDetail/components/ProjectDetailPage.js";
import type { AnyFeature } from "#shared/index.js";

const ALL_FEATURES: AnyFeature[] = [HTTPClientFeature, ProjectsFeature, UpgradesFeature];

export function App(): React.ReactNode {
  return (
    <ContainerProvider features={ALL_FEATURES}>
      <MantineProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <ProjectListProvider>
                  {({ presenter }) => <ProjectListPage presenter={presenter} />}
                </ProjectListProvider>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProjectDetailProvider>
                  {({ presenter }) => <ProjectDetailPage presenter={presenter} />}
                </ProjectDetailProvider>
              }
            />
          </Routes>
        </BrowserRouter>
      </MantineProvider>
    </ContainerProvider>
  );
}
```

Note: Presentation-level features (ProjectListFeature, ProjectDetailFeature, JobProgressFeature) should declare `dependencies` on the headless features (ProjectsFeature, UpgradesFeature) so `registerFeatures` auto-registers them. Alternatively, list all features in `ALL_FEATURES` — `registerFeatures` deduplicates.

- [ ] **Step 2: Create main.tsx**

```tsx
// src/ui/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 3: Lint, format, commit**

```bash
yarn lint:fix && yarn format:fix
git add src/ui/App.tsx src/ui/main.tsx
git commit -m "feat(ui): add App shell with routing and Mantine provider"
```

---

## Track: Integration

### Task 32: Vite Config + Dev/Production Scripts

**Files:**

- Create: `vite.config.ts`
- Modify: `package.json` (add `dev`, `start`, `build:ui`, `build:api` scripts)

- [ ] **Step 1: Create Vite config**

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ["source"]
  },
  build: {
    outDir: "dist/ui"
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001"
    }
  }
});
```

- [ ] **Step 2: Add scripts to package.json**

```json
{
  "dev": "concurrently \"node --import tsx src/api/server.ts\" \"vite\"",
  "dev:api": "node --import tsx src/api/server.ts",
  "dev:ui": "vite",
  "build:api": "tsc -b",
  "build:ui": "vite build",
  "build": "tsc -b && vite build",
  "start": "node dist/api/server.js"
}
```

- [ ] **Step 3: Verify dev mode**

Run: `yarn dev`
Expected: Fastify starts on port 3001, Vite dev server on port 5173 with proxy. UI loads in browser.

- [ ] **Step 4: Verify production build**

Run: `yarn build && yarn start`
Expected: Single-port Fastify serves API routes and static UI files via `@fastify/static`.

- [ ] **Step 5: Lint, format, commit**

```bash
yarn lint:fix && yarn format:fix
git add vite.config.ts package.json
git commit -m "feat: add Vite config and dev/production scripts"
```

---

## Parallelism Guide

Tasks that can run simultaneously (no shared file dependencies):

| Parallel Group                | Tasks       | Notes                                                                |
| ----------------------------- | ----------- | -------------------------------------------------------------------- |
| Foundation prereqs            | 1           | Must be first — installs packages                                    |
| Foundation config             | 2, 3, 4     | After 1 — subpath imports, barrels, index.html are independent       |
| Foundation DB + CommandRunner | 5+6+7, 8, 9 | After 3 — schema+client, CommandRunner, ScanCache are independent    |
| API Services (group A)        | 10, 11      | After 8 — SecurityService and ScanService are independent            |
| API Services (group B)        | 12, 13      | After 8 — UpgradeService and YarnService are independent             |
| API Services + UI HTTPClient  | 14, 19      | JobWorker after 10-13; HTTPClient after 3 (independent of API)       |
| API wiring                    | 15, 16      | After 14 — feature + server setup                                    |
| API routes                    | 17          | After 16 — needs server.ts                                           |
| API routes (upgrades)         | 18          | After 17 — needs project routes registered                           |
| UI DI layer                   | 20          | After 19 — useFeature + ContainerProvider                            |
| UI Headless features          | 21, 22      | After 20 — ProjectsGateway and UpgradesGateway are independent       |
| UI Use Cases                  | 23, 24      | After 21+22 — project and upgrade use cases are independent          |
| UI Presenters                 | 25, 26, 27  | After 23+24 — all three presenters are independent                   |
| UI Components (JobProgress)   | 28          | After 27 — must complete BEFORE ProjectDetail                        |
| UI Components (List + Detail) | 29, 30      | After 25+28 (List), After 26+28 (Detail) — independent of each other |
| App Shell                     | 31          | After 29+30                                                          |
| Integration                   | 32          | After 18+31 — needs both API and UI complete                         |

**Critical ordering constraints:**

- Task 28 (JobProgress components) MUST complete before Task 30 (ProjectDetail components) — ProjectDetail renders JobProgressPanel
- Task 17 (Project routes) MUST complete before Task 18 (Upgrade routes) — upgrade routes need server.ts with project routes registered
- Task 3 (Pre-create barrels) MUST complete before any task that creates abstraction or implementation files
