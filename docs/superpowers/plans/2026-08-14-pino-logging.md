# Pino Logging Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom AppLogService (DB-only) with pino-based structured logging across three destinations (console, file, DB) and Fastify HTTP request logging.

**Architecture:** A new LoggerService creates a pino instance with `pino.multistream()` routing to console (pino-pretty), file (pino-roll), and a custom DB writable stream. AppLogServiceImpl is rewritten to delegate to the pino logger. Fastify receives the same pino instance for HTTP request/response logging.

**Tech Stack:** pino, pino-pretty, pino-roll, Node.js Writable streams, Drizzle ORM, Fastify

**Spec:** `docs/superpowers/specs/2026-08-14-pino-logging-design.md`

## Global Constraints

- Use yarn (not npm) for all package operations
- Use named interfaces, never inline structural types
- Use object params with named keys when function has 2+ params
- Use safeParse(), never parse() for Zod validation
- Always use full words in new code (no abbreviations)
- Follow existing DI pattern: abstractions and implementations in separate files
- Run `yarn full` (audit + lint + format + build + test) before committing
- Data directory: `./data` (same as SQLite DB location)

---

### Task 1: Add pino dependencies and create LoggerService abstraction

**Files:**
- Modify: `package.json` — add pino, pino-pretty, pino-roll
- Create: `src/api/services/Logger/abstractions/LoggerService.ts`
- Create: `src/api/services/Logger/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `ILoggerService { logger: pino.Logger }`, `LoggerService` abstraction constant

- [ ] **Step 1: Install pino dependencies**

```bash
yarn add pino pino-pretty pino-roll
```

- [ ] **Step 2: Create the LoggerService abstraction**

Create `src/api/services/Logger/abstractions/LoggerService.ts`:

```typescript
import type { Logger } from "pino";
import { createAbstraction } from "#shared/index.js";

export interface ILoggerService {
    logger: Logger;
}

export const LoggerService = createAbstraction<ILoggerService>("Api/LoggerService");

export namespace LoggerService {
    export type Interface = ILoggerService;
}
```

- [ ] **Step 3: Create barrel export**

Create `src/api/services/Logger/index.ts`:

```typescript
export { LoggerService } from "./abstractions/LoggerService.js";
```

- [ ] **Step 4: Verify build**

```bash
yarn build
```

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock src/api/services/Logger/
git commit -m "feat: add pino dependencies and LoggerService abstraction"
```

---

### Task 2: Create pino destinations (console, file, database)

**Files:**
- Create: `src/api/services/Logger/destinations/createConsoleDestination.ts`
- Create: `src/api/services/Logger/destinations/createFileDestination.ts`
- Create: `src/api/services/Logger/destinations/createDatabaseDestination.ts`
- Create: `src/api/services/Logger/destinations/__tests__/createDatabaseDestination.test.ts`

**Interfaces:**
- Consumes: `DatabaseClient.Interface`, `WebSocketBroadcaster.Interface` (existing)
- Produces: `createConsoleDestination(): StreamEntry`, `createFileDestination(options): StreamEntry`, `createDatabaseDestination(options): StreamEntry`

- [ ] **Step 1: Write the DB destination test**

Create `src/api/services/Logger/destinations/__tests__/createDatabaseDestination.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { appLogs } from "#api/db/schema.js";
import { createDatabaseDestination } from "../createDatabaseDestination.js";

describe("createDatabaseDestination", () => {
    let db: ReturnType<typeof createTestApiContainer>["db"];
    let broadcaster: WebSocketBroadcaster.Interface;

    beforeEach(() => {
        broadcaster = {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn(),
            closeConnectionsForUser: vi.fn()
        };

        const ctx = createTestApiContainer();
        db = ctx.db;
    });

    it("inserts a log entry into the database", async () => {
        const destination = createDatabaseDestination({ db, broadcaster, threshold: "info" });

        const logLine = JSON.stringify({
            level: 50,
            time: 1723654800000,
            msg: "Scan failed",
            source: "scan",
            projectId: "p1",
            details: "stack trace"
        }) + "\n";

        destination.write(logLine);

        await new Promise(resolve => setTimeout(resolve, 50));

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            level: "error",
            source: "scan",
            projectId: "p1",
            message: "Scan failed",
            details: "stack trace"
        });
    });

    it("broadcasts log:created event", async () => {
        const destination = createDatabaseDestination({ db, broadcaster, threshold: "info" });

        const logLine = JSON.stringify({
            level: 40,
            time: Date.now(),
            msg: "Lockfile stale",
            source: "scan",
            projectId: null
        }) + "\n";

        destination.write(logLine);

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(broadcaster.broadcast).toHaveBeenCalledWith(
            "log:created",
            expect.objectContaining({
                level: "warn",
                source: "scan",
                message: "Lockfile stale"
            })
        );
    });

    it("skips HTTP info-level logs", async () => {
        const destination = createDatabaseDestination({ db, broadcaster, threshold: "info" });

        const logLine = JSON.stringify({
            level: 30,
            time: Date.now(),
            msg: "request completed",
            source: "http"
        }) + "\n";

        destination.write(logLine);

        await new Promise(resolve => setTimeout(resolve, 50));

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(0);
    });

    it("persists HTTP error-level logs", async () => {
        const destination = createDatabaseDestination({ db, broadcaster, threshold: "info" });

        const logLine = JSON.stringify({
            level: 50,
            time: Date.now(),
            msg: "request errored",
            source: "http",
            projectId: null
        }) + "\n";

        destination.write(logLine);

        await new Promise(resolve => setTimeout(resolve, 50));

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(1);
    });

    it("respects threshold — skips info when threshold is warn", async () => {
        const destination = createDatabaseDestination({ db, broadcaster, threshold: "warn" });

        const logLine = JSON.stringify({
            level: 30,
            time: Date.now(),
            msg: "Scan started",
            source: "scan",
            projectId: "p1"
        }) + "\n";

        destination.write(logLine);

        await new Promise(resolve => setTimeout(resolve, 50));

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
yarn test -- --run src/api/services/Logger/destinations/__tests__/createDatabaseDestination.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create console destination**

Create `src/api/services/Logger/destinations/createConsoleDestination.ts`:

```typescript
import type { StreamEntry } from "pino";
import pinoPretty from "pino-pretty";

export function createConsoleDestination(): StreamEntry {
    const stream = pinoPretty({
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname"
    });

    return { stream };
}
```

- [ ] **Step 4: Create file destination**

Create `src/api/services/Logger/destinations/createFileDestination.ts`:

```typescript
import type { StreamEntry } from "pino";
import { roll } from "pino-roll";

interface IFileDestinationOptions {
    directory: string;
}

export async function createFileDestination(options: IFileDestinationOptions): Promise<StreamEntry> {
    const stream = await roll({
        file: `${options.directory}/app.log`,
        frequency: "daily",
        limit: { count: 7 },
        size: "10m"
    });

    return { stream };
}
```

- [ ] **Step 5: Create database destination**

Create `src/api/services/Logger/destinations/createDatabaseDestination.ts`:

```typescript
import { Writable } from "node:stream";
import { generateId } from "@webiny/stdlib";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { appLogs } from "#api/db/schema.js";

const PINO_LEVEL_TO_STRING: Record<number, string> = {
    10: "trace",
    20: "debug",
    30: "info",
    40: "warn",
    50: "error",
    60: "fatal"
};

const LEVEL_PRIORITY: Record<string, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5
};

interface IDatabaseDestinationOptions {
    db: BetterSQLite3Database;
    broadcaster: WebSocketBroadcaster.Interface;
    threshold: string;
}

export function createDatabaseDestination(options: IDatabaseDestinationOptions): Writable {
    const { db, broadcaster, threshold } = options;
    const thresholdPriority = LEVEL_PRIORITY[threshold] ?? 3;

    return new Writable({
        write(chunk: Buffer, _encoding, callback) {
            try {
                const line = chunk.toString().trim();
                if (!line) {
                    callback();
                    return;
                }

                const entry = JSON.parse(line);
                const levelString = PINO_LEVEL_TO_STRING[entry.level] ?? "info";
                const entryPriority = LEVEL_PRIORITY[levelString] ?? 2;
                const source = entry.source ?? "app";

                if (source === "http" && entryPriority < LEVEL_PRIORITY["warn"]!) {
                    callback();
                    return;
                }

                if (entryPriority < thresholdPriority) {
                    callback();
                    return;
                }

                const id = generateId();
                const createdAt = entry.time ?? Date.now();

                db.insert(appLogs)
                    .values({
                        id,
                        level: levelString,
                        source,
                        projectId: entry.projectId ?? null,
                        message: entry.msg ?? "",
                        details: entry.details ?? null,
                        createdAt
                    })
                    .run();

                broadcaster.broadcast("log:created", {
                    id,
                    level: levelString,
                    source,
                    projectId: entry.projectId ?? null,
                    message: entry.msg ?? "",
                    createdAt
                });

                callback();
            } catch {
                callback();
            }
        }
    });
}
```

- [ ] **Step 6: Run tests**

```bash
yarn test -- --run src/api/services/Logger/destinations/__tests__/createDatabaseDestination.test.ts
```

Expected: all 5 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/api/services/Logger/destinations/
git commit -m "feat: add pino destinations — console, file, database"
```

---

### Task 3: Implement LoggerService and wire into DI

**Files:**
- Create: `src/api/services/Logger/LoggerService.ts`
- Create: `src/api/services/Logger/feature.ts`
- Modify: `src/api/feature.ts` — register LoggerFeature
- Create: `src/api/services/Logger/__tests__/LoggerService.test.ts`

**Interfaces:**
- Consumes: `DatabaseClient.Interface`, `WebSocketBroadcaster.Interface`, `FileConfigService.Interface`, destinations from Task 2
- Produces: `LoggerService` implementation registered in DI, resolves to `{ logger: pino.Logger }`

- [ ] **Step 1: Write the LoggerService test**

Create `src/api/services/Logger/__tests__/LoggerService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { LoggerService } from "../abstractions/LoggerService.js";

describe("LoggerService", () => {
    beforeEach(() => {
        const broadcaster: WebSocketBroadcaster.Interface = {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn(),
            closeConnectionsForUser: vi.fn()
        };

        const { container } = createTestApiContainer();
        container.registerInstance(WebSocketBroadcaster, broadcaster);

        const service = container.resolve(LoggerService);

        expect(service.logger).toBeDefined();
        expect(typeof service.logger.info).toBe("function");
        expect(typeof service.logger.error).toBe("function");
        expect(typeof service.logger.warn).toBe("function");
        expect(typeof service.logger.debug).toBe("function");
    });

    it("resolves a pino logger from the container", () => {
        // assertions in beforeEach — if we reached here, logger resolved
        expect(true).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
yarn test -- --run src/api/services/Logger/__tests__/LoggerService.test.ts
```

Expected: FAIL — cannot resolve LoggerService

- [ ] **Step 3: Create LoggerService implementation**

Create `src/api/services/Logger/LoggerService.ts`:

```typescript
import pino from "pino";
import { LoggerService as Abstraction } from "./abstractions/LoggerService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { FileConfigService } from "../FileConfig/index.js";
import { createConsoleDestination } from "./destinations/createConsoleDestination.js";
import { createDatabaseDestination } from "./destinations/createDatabaseDestination.js";

class LoggerServiceImpl implements Abstraction.Interface {
    public readonly logger: pino.Logger;

    public constructor(
        databaseClient: DatabaseClient.Interface,
        webSocketBroadcaster: WebSocketBroadcaster.Interface,
        fileConfigService: FileConfigService.Interface
    ) {
        const dbDestination = createDatabaseDestination({
            db: databaseClient.db,
            broadcaster: webSocketBroadcaster,
            threshold: "warn"
        });

        const consoleDestination = createConsoleDestination();

        const streams: pino.StreamEntry[] = [
            consoleDestination,
            { stream: dbDestination }
        ];

        this.logger = pino(
            { level: "trace", timestamp: pino.stdTimeFunctions.epochTime },
            pino.multistream(streams)
        );
    }
}

export const LoggerService = Abstraction.createImplementation({
    implementation: LoggerServiceImpl,
    dependencies: [DatabaseClient, WebSocketBroadcaster, FileConfigService]
});
```

Note: File destination is async (pino-roll), so it will be added in Task 5 after the core works. This keeps Task 3 focused on getting the logger resolvable from DI.

- [ ] **Step 4: Create feature registration**

Create `src/api/services/Logger/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { LoggerService } from "./LoggerService.js";

export const LoggerFeature = createFeature({
    name: "Api/LoggerFeature",
    register(container) {
        container.register(LoggerService).inSingletonScope();
    }
});
```

- [ ] **Step 5: Register LoggerFeature in ApiFeature**

In `src/api/feature.ts`, add the import and registration. LoggerFeature must register BEFORE AppLogFeature since AppLogService will depend on LoggerService in Task 4.

Add import:
```typescript
import { LoggerFeature } from "./services/Logger/feature.js";
```

Add registration before `AppLogFeature.register(container)`:
```typescript
LoggerFeature.register(container);
```

- [ ] **Step 6: Update barrel export**

Update `src/api/services/Logger/index.ts`:

```typescript
export { LoggerService } from "./abstractions/LoggerService.js";
export { LoggerFeature } from "./feature.js";
```

- [ ] **Step 7: Run tests**

```bash
yarn test -- --run src/api/services/Logger/__tests__/LoggerService.test.ts
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/api/services/Logger/ src/api/feature.ts
git commit -m "feat: implement LoggerService with console and DB destinations"
```

---

### Task 4: Rewrite AppLogService to delegate to pino

**Files:**
- Modify: `src/api/services/AppLog/abstractions/AppLogService.ts` — expand LogLevel type
- Modify: `src/api/services/AppLog/AppLogService.ts` — rewrite to use LoggerService
- Modify: `src/api/services/AppLog/feature.ts` — update if needed
- Modify: `src/api/services/AppLog/__tests__/AppLogService.test.ts` — update for new behavior

**Interfaces:**
- Consumes: `LoggerService.Interface` from Task 3
- Produces: Same `IAppLogService` interface — callers (ErrorReporter, ConsoleEmailService, sendError) unchanged

- [ ] **Step 1: Expand LogLevel type**

In `src/api/services/AppLog/abstractions/AppLogService.ts`, change the LogLevel type:

```typescript
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
```

- [ ] **Step 2: Rewrite AppLogServiceImpl**

Replace the entire implementation in `src/api/services/AppLog/AppLogService.ts`:

```typescript
import { AppLogService as Abstraction } from "./abstractions/AppLogService.js";
import { LoggerService } from "../Logger/index.js";

class AppLogServiceImpl implements Abstraction.Interface {
    public constructor(private readonly loggerService: LoggerService.Interface) {}

    public async log(
        level: Abstraction.Level,
        source: string,
        projectId: string | null,
        message: string,
        details?: string
    ): Promise<void> {
        this.loggerService.logger[level]({ source, projectId, details: details ?? null }, message);
    }
}

export const AppLogService = Abstraction.createImplementation({
    implementation: AppLogServiceImpl,
    dependencies: [LoggerService]
});
```

- [ ] **Step 3: Update existing AppLogService tests**

The existing tests in `src/api/services/AppLog/__tests__/AppLogService.test.ts` verify DB writes and WebSocket broadcasts. These still work because the DB destination handles both. Update the tests:

- Remove mock of `WebSocketBroadcaster` — the real one is needed by LoggerService now, but we mock it at the container level.
- Ensure `WebSocketBroadcaster` mock is registered before resolving `AppLogService`.
- Keep all existing assertions — they verify the end-to-end flow through pino to the DB destination.
- Remove tests that check file-config-based log level filtering from `AppLogService` level — that filtering now lives in the DB destination's threshold. The `AppLogService` passes all levels through to pino; the DB destination filters.

Read the existing test file first, then update assertions that depend on log level filtering to account for the new architecture where filtering is in the DB destination, not AppLogService.

- [ ] **Step 4: Run tests**

```bash
yarn test -- --run src/api/services/AppLog/__tests__/AppLogService.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Run full test suite**

```bash
yarn full
```

Expected: all 2712+ tests PASS, lint/format/build clean

- [ ] **Step 6: Commit**

```bash
git add src/api/services/AppLog/ src/api/services/Logger/
git commit -m "refactor: rewrite AppLogService to delegate to pino logger"
```

---

### Task 5: Add file destination with rotation

**Files:**
- Modify: `src/api/services/Logger/LoggerService.ts` — add file destination to multistream
- Create: `src/api/services/Logger/destinations/__tests__/createFileDestination.test.ts`

**Interfaces:**
- Consumes: `createFileDestination` from Task 2, `FileConfigService` for data directory
- Produces: Updated LoggerService that writes to file + console + DB

- [ ] **Step 1: Write file destination test**

Create `src/api/services/Logger/destinations/__tests__/createFileDestination.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, existsSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import { createFileDestination } from "../createFileDestination.js";

const TEST_LOG_DIR = join(process.cwd(), "testing", "tmp", "logs");

describe("createFileDestination", () => {
    afterEach(() => {
        if (existsSync(TEST_LOG_DIR)) {
            rmSync(TEST_LOG_DIR, { recursive: true });
        }
    });

    it("creates a stream entry that can be written to", async () => {
        mkdirSync(TEST_LOG_DIR, { recursive: true });

        const entry = await createFileDestination({ directory: TEST_LOG_DIR });

        expect(entry.stream).toBeDefined();
        expect(typeof entry.stream.write).toBe("function");
    });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
yarn test -- --run src/api/services/Logger/destinations/__tests__/createFileDestination.test.ts
```

- [ ] **Step 3: Update LoggerService to include file destination**

Because `createFileDestination` is async (pino-roll uses async init), the LoggerService constructor can't await it. Use a deferred approach: start with console + DB, then add the file stream once it's ready.

Update `src/api/services/Logger/LoggerService.ts`:

```typescript
import pino from "pino";
import { LoggerService as Abstraction } from "./abstractions/LoggerService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { FileConfigService } from "../FileConfig/index.js";
import { createConsoleDestination } from "./destinations/createConsoleDestination.js";
import { createFileDestination } from "./destinations/createFileDestination.js";
import { createDatabaseDestination } from "./destinations/createDatabaseDestination.js";

const DATA_DIR = process.env["DATA_DIR"] ?? "./data";

class LoggerServiceImpl implements Abstraction.Interface {
    public readonly logger: pino.Logger;

    public constructor(
        databaseClient: DatabaseClient.Interface,
        webSocketBroadcaster: WebSocketBroadcaster.Interface,
        _fileConfigService: FileConfigService.Interface
    ) {
        const dbDestination = createDatabaseDestination({
            db: databaseClient.db,
            broadcaster: webSocketBroadcaster,
            threshold: "warn"
        });

        const consoleDestination = createConsoleDestination();
        const multistream = pino.multistream([
            consoleDestination,
            { stream: dbDestination }
        ]);

        this.logger = pino(
            { level: "trace", timestamp: pino.stdTimeFunctions.epochTime },
            multistream
        );

        void createFileDestination({ directory: DATA_DIR }).then(fileEntry => {
            multistream.add(fileEntry);
        });
    }
}

export const LoggerService = Abstraction.createImplementation({
    implementation: LoggerServiceImpl,
    dependencies: [DatabaseClient, WebSocketBroadcaster, FileConfigService]
});
```

- [ ] **Step 4: Run full test suite**

```bash
yarn full
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/services/Logger/
git commit -m "feat: add pino file destination with daily rotation and 10MB cap"
```

---

### Task 6: Wire pino into Fastify for HTTP request logging

**Files:**
- Modify: `src/api/server.ts` — replace inline Fastify logger with pino instance

**Interfaces:**
- Consumes: `LoggerService` from DI container
- Produces: Fastify uses pino for HTTP request/response logging with source "http"

- [ ] **Step 1: Update server.ts**

In `src/api/server.ts`, after the container is created and features registered, resolve the LoggerService and pass its logger to Fastify:

1. Add import:
```typescript
import { LoggerService } from "./services/Logger/index.js";
```

2. After `ApiFeature.register(container, { databaseClient });`, resolve the logger:
```typescript
const loggerService = container.resolve(LoggerService);
```

3. Replace `const app = Fastify({ logger: { level: "warn" } });` with:
```typescript
const app = Fastify({
    logger: loggerService.logger.child({ source: "http" })
});
```

4. Replace the `const logger = container.resolve(Logger);` and its usages in the error handler with `loggerService.logger`:
```typescript
loggerService.logger.error({ source: "server" }, `Route error: ${error.message}`);
```

- [ ] **Step 2: Run full test suite**

```bash
yarn full
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/api/server.ts
git commit -m "feat: wire pino into Fastify for HTTP request logging"
```
