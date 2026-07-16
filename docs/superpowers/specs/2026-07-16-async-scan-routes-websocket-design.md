# Async Scan, Typed Routes, WebSocket Notifications, and Multi-PM Support

Date: 2026-07-16

## Overview

Four interconnected changes:

1. **Shared typed route infrastructure** — `defineRoute` + Zod schemas shared between API and UI, validated at both ends. All existing routes migrated.
2. **Async scan via JobWorker** — scan becomes a background job with per-package progress. Results persisted to DB instead of in-memory cache.
3. **WebSocket event bus** — global typed pub/sub for real-time notifications (scan progress, job status, errors).
4. **Multi-package-manager support** — detect npm/yarn/pnpm on project add. Security config fields per PM stored in app settings.

## 1. Shared Route Infrastructure

### Pattern (from fundus)

Routes defined once in `src/shared/routes/`, imported by both API handlers and UI gateways.

```typescript
// src/shared/routes/projects.ts
export const scanProjectRoute = defineRoute({
  method: "POST",
  path: "/api/projects/:id/scan",
  params: z.object({ id: z.string() }),
  querystring: z.object({ force: z.string().optional() }),
  response: z.object({ item: z.object({ jobId: z.string() }) }),
  description: "Start async scan for a project"
});
```

### Components

| File                                    | Purpose                                                                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/routing/defineRoute.ts`     | Route definition factory. Type-checks params against path segments at compile time.                                                                              |
| `src/shared/routing/registerRoute.ts`   | Fastify bridge. Installs `preValidation` hook that runs Zod `.safeParse()` on params, body, querystring. Replaces raw values with parsed data on request object. |
| `src/shared/routing/interpolatePath.ts` | Replaces `:paramName` segments with URL-encoded values. Used by UI HTTP client.                                                                                  |
| `src/shared/routing/sendOne.ts`         | Response helper: wraps value in `{ item: T }`, status 200.                                                                                                       |
| `src/shared/routing/sendList.ts`        | Response helper: wraps array in `{ items: T[], total: number }`, status 200.                                                                                     |
| `src/shared/routing/sendNone.ts`        | Response helper: `{ success: true }`, status 200/204.                                                                                                            |
| `src/shared/routing/sendError.ts`       | Error response helper with status code.                                                                                                                          |
| `src/shared/routing/types.ts`           | `RouteDefinition`, `HTTPMethod`, `ExtractParams<TPath>`, `IRequestArgs`.                                                                                         |

### UI HTTP Client Update

`HTTPClient` gains a typed `request(route, args, options?)` method:

```typescript
interface IHTTPClient {
  request<TPath, TParams, TBody, TResponse, TMethod, TQuerystring>(
    route: RouteDefinition<TPath, TParams, TBody, TResponse, TMethod, TQuerystring>,
    args: IRequestArgs<TMethod, TParams, TBody, TQuerystring>,
    options?: { responseSchema?: ZodSchema }
  ): Promise<TResponse>;
}
```

- Path params interpolated via `interpolatePath`
- Query params appended as URL search params
- Body JSON-stringified for POST/PUT/PATCH/DELETE
- Response parsed through route's Zod response schema

Existing `get`, `post`, `del` methods removed — all calls go through `request()`.

### Route Definitions

All responses use `sendOne` (`{ item: T }`), `sendList` (`{ items: T[], total }`), or `sendNone` (`{ success: true }`) consistently.

**`src/shared/routes/projects.ts`** (8 routes):

| Method | Path                             | Response                         | Notes                                        |
| ------ | -------------------------------- | -------------------------------- | -------------------------------------------- |
| POST   | `/api/projects`                  | `{ item: Project }`              | Create project, auto-detects package manager |
| GET    | `/api/projects`                  | `{ items: Project[], total }`    | List with security status                    |
| GET    | `/api/projects/:id`              | `{ item: Project }`              | Single project                               |
| DELETE | `/api/projects/:id`              | `sendNone`                       | 409 if running job                           |
| POST   | `/api/projects/:id/scan`         | `{ item: { jobId } }`            | Enqueues async scan job                      |
| GET    | `/api/projects/:id/dependencies` | `{ items: Dependency[], total }` | Reads from `scan_results` DB table           |
| GET    | `/api/projects/:id/security`     | `{ item: SecurityStatus }`       | Read latest persisted check                  |
| POST   | `/api/projects/:id/security`     | `{ item: SecurityStatus }`       | Run fresh security check                     |

**`src/shared/routes/jobs.ts`** (4 routes — renamed from upgrades):

| Method | Path                               | Response                  | Notes                       |
| ------ | ---------------------------------- | ------------------------- | --------------------------- |
| POST   | `/api/projects/:id/jobs/upgrade`   | `{ item: { jobId } }`     | Start upgrade job           |
| POST   | `/api/projects/:id/jobs/transient` | `{ item: { jobId } }`     | Start transient refresh job |
| GET    | `/api/projects/:id/jobs`           | `{ items: Job[], total }` | List jobs for project       |
| GET    | `/api/projects/:id/jobs/:jobId`    | `{ item: Job }`           | Get single job              |

**`src/shared/routes/packageManager.ts`** (2 routes):

| Method | Path                                       | Response                | Notes             |
| ------ | ------------------------------------------ | ----------------------- | ----------------- |
| GET    | `/api/projects/:id/package-manager`        | `{ item: { version } }` | Get PM version    |
| POST   | `/api/projects/:id/package-manager/update` | `{ item: { jobId } }`   | Update PM version |

**`src/shared/routes/cache.ts`** (2 routes):

| Method | Path                      | Response   |
| ------ | ------------------------- | ---------- |
| DELETE | `/api/cache`              | `sendNone` |
| DELETE | `/api/cache/:packageName` | `sendNone` |

## 2. WebSocket Event Bus

### Server Side

**`src/api/websocket/`**:

- `WebSocketBroadcaster` — DI singleton, registered as constructor dependency of `JobWorker`. Holds all connected WebSocket clients in a `Set<WebSocket>`. Methods:
  - `broadcast(type, data)` — JSON-serializes `{ type, data }`, sends to all connected clients
  - `addClient(ws)` / `removeClient(ws)` — connection lifecycle
- Fastify plugin registers `GET /ws` via `@fastify/websocket`. On connection, adds client to broadcaster. On close/error, removes.

### Shared Event Types

**`src/shared/websocket/types.ts`**:

```typescript
type WSEvent =
  | {
      type: "scan:progress";
      data: { projectId: string; packageName: string; current: number; total: number };
    }
  | { type: "scan:complete"; data: { projectId: string } }
  | { type: "scan:failed"; data: { projectId: string; error: string } }
  | {
      type: "job:status";
      data: { jobId: string; projectId: string; status: string; logs?: string };
    }
  | { type: "notification"; data: { message: string; level: "info" | "error" } };
```

### UI Side

**`src/ui/websocket/WebSocketListener.ts`** — DI singleton:

- Connects to `ws://host/ws` on instantiation
- Auto-reconnects on disconnect (exponential backoff)
- `on(type, callback)` — registers listener. Multiple listeners per type supported (stored as `Map<string, Set<callback>>`).
- `off(type, callback)` — removes specific listener from the set
- On message: parse JSON, look up type in listener map, fire all registered callbacks in the set

Presenters/use cases register listeners in their lifecycle. Example:

```typescript
this.wsListener.on("scan:progress", data => {
  if (data.projectId === this.currentProjectId) {
    runInAction(() => {
      this.scanProgress = data;
    });
  }
});
```

## 3. Async Scan via JobWorker

### Job Types

Updated from `"dependency" | "transient" | "yarn"` to:

```typescript
type JobType = "dependency" | "transient" | "packageManager" | "scan";
```

`"yarn"` renamed to `"packageManager"` to support npm/yarn/pnpm.

### Scan Job Flow

1. **UI**: `POST /api/projects/:id/scan` — API enqueues scan job, returns `{ item: { jobId } }` immediately
2. **JobWorker**: picks up pending scan job, marks as running. Resolves `WebSocketBroadcaster` from DI (constructor dependency).
3. **ScanService**: receives `onProgress(packageName, current, total)` callback
   - `total` = `entries.length` (known after collecting dependency types and intersecting with installed versions, before registry lookups begin)
   - `current` = cumulative counter, incremented after each registry lookup
   - Each registry lookup fires the callback
   - JobWorker passes callback that calls `broadcaster.broadcast("scan:progress", { projectId, packageName, current, total })`
4. **Completion**: results persisted to `scan_results` table (DELETE old rows for projectId, INSERT new). Security check also runs. Broadcaster sends `scan:complete`.
5. **Failure**: broadcaster sends `scan:failed`

### Concurrent Jobs

`#runningProjects` constraint removed from `processNextJob()`. All pending jobs are picked up and fired concurrently. No limit on simultaneous jobs.

Implementation change in `processNextJob()`:

```typescript
// Before: skip if project already running
// After: fire all pending jobs
for (const job of pendingJobs) {
  void this.executeJob(job)
    .catch(() => {})
    .finally(() => {});
}
```

### Scan Results DB Table

```typescript
export const scanResults = sqliteTable("scan_results", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  currentVersion: text("current_version").notNull(),
  latestVersion: text("latest_version").notNull(),
  latestInRange: text("latest_in_range").notNull(),
  type: text("type").notNull(),
  upgradeType: text("upgrade_type").notNull(),
  scannedAt: integer("scanned_at").notNull()
});
```

On scan completion: DELETE all rows for projectId, INSERT new results. `GET /api/projects/:id/dependencies` reads from this table.

**Removal**: `ScanCache` service (in-memory) deleted. All scan data in DB.

### ScanService Changes

`scan()` method gains an optional `onProgress` callback:

```typescript
scan(
  projectPath: string,
  force?: boolean,
  onProgress?: (packageName: string, current: number, total: number) => void
): Promise<Dependency[]>
```

Called after each successful registry lookup. `total` is `entries.length` (computed before the batch loop). `current` is a cumulative counter starting at 0, incremented per package.

## 4. Multi-Package-Manager Support

### Detection

On `POST /api/projects` (project creation), detect the package manager by checking lockfile presence in priority order:

1. `yarn.lock` exists — Yarn
2. `pnpm-lock.yaml` exists — pnpm
3. `package-lock.json` exists — npm
4. None found — default to npm

The detected PM is stored in the `projects` table. New column: `packageManager: text("package_manager")` (values: `"yarn"`, `"npm"`, `"pnpm"`).

### Version Detection

Each PM has a different version command:

- Yarn: `yarn --version`
- npm: `npm --version`
- pnpm: `pnpm --version`

`YarnService` renamed to `PackageManagerService`. Receives `packageManager` string, dispatches to the correct CLI command:

```typescript
interface IPackageManagerService {
  updateVersion(
    projectPath: string,
    pm: string,
    version: string,
    onLog: (line: string) => void
  ): Promise<void>;
  getVersion(projectPath: string, pm: string): Promise<string>;
}
```

Internally maps PM to command: `{ yarn: "yarn", npm: "npm", pnpm: "pnpm" }`.

### Security Config

Each PM has different security-relevant config files and fields. These are configurable per PM via a DB settings table:

```typescript
export const pmSecuritySettings = sqliteTable(
  "pm_security_settings",
  {
    id: text("id").primaryKey().notNull(),
    packageManager: text("package_manager").notNull(), // "yarn" | "npm" | "pnpm"
    configFile: text("config_file").notNull(), // ".yarnrc.yml", ".npmrc", etc.
    fieldName: text("field_name").notNull(), // field to check
    expectedValue: text("expected_value") // null = just check presence, non-null = check exact value
  },
  table => ({
    uniqueField: unique().on(table.packageManager, table.configFile, table.fieldName)
  })
);
```

**Seeding**: migration inserts Yarn's 4 default checks on first run:

| packageManager | configFile  | fieldName               | expectedValue         |
| -------------- | ----------- | ----------------------- | --------------------- |
| yarn           | .yarnrc.yml | npmPreapprovedPackages  | null (presence check) |
| yarn           | .yarnrc.yml | npmMinimalAgeGate       | null (presence check) |
| yarn           | .yarnrc.yml | enableScripts           | false                 |
| yarn           | .yarnrc.yml | approvedGitRepositories | null (presence check) |

npm and pnpm settings start empty — user configures them via UI settings page. Until configured, `SecurityService.check()` returns `{ passes: true }` with no field checks (no rules = no violations).

**SecurityService.check() flow**:

1. Look up project's `packageManager` from projects table
2. Query `pmSecuritySettings` for that PM
3. If no settings found, return `{ passes: true }` (no rules configured)
4. For each setting: read the `configFile`, check if `fieldName` exists (or matches `expectedValue` if non-null)
5. Aggregate results

### Scan Service

`ScanService.scan()` receives the project's `packageManager` to dispatch to correct commands:

```typescript
scan(
  projectPath: string,
  packageManager: string,
  force?: boolean,
  onProgress?: (packageName: string, current: number, total: number) => void
): Promise<Dependency[]>
```

PM-specific commands for collecting installed versions:

- **Yarn**: `yarn info --all --json` + `yarn workspaces list --json` (current implementation)
- **npm**: `npm ls --all --json` + workspace detection via `package.json` workspaces field
- **pnpm**: `pnpm list --json` + `pnpm-workspace.yaml`

PM-specific commands for collecting dependency types (reading all workspace package.json files): workspace discovery differs per PM but the package.json reading step is identical.

Registry lookup stays the same across all PMs (npm registry is universal). Only the "installed versions" and "workspace list" commands differ.

### Projects Table Update

```typescript
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  packageManager: text("package_manager"), // NEW: "yarn" | "npm" | "pnpm"
  pmVersion: text("pm_version"), // RENAMED from yarn_version
  addedAt: integer("added_at").notNull(),
  lastScannedAt: integer("last_scanned_at")
});
```

## 5. UI Updates

### ProjectDetailPresenter

- `load()` — loads project info + reads last scan results from DB. No auto-scan.
- `scan()` — POSTs to start scan job (returns immediately). Registers WS listener for `scan:progress` and `scan:complete`.
- ViewModel gains `scanProgress: { current: number; total: number; packageName: string } | null`
- On `scan:complete` — reloads dependencies from `GET /dependencies`

### ProjectListPresenter

- `scanAll()` — POSTs scan for each project, registers WS listeners. Updates per-project status as each completes.
- List items gain `scanStatus: "idle" | "scanning" | "done" | "failed"` for per-row visual indicators.
- Project list shows package manager type (yarn/npm/pnpm) per project.

### JobProgressPresenter

- Registers WS listener for `job:status`. Updates job state reactively.
- Polling loop removed — websocket is the only notification channel.

## 6. File Structure

```
src/shared/
  routing/
    defineRoute.ts
    registerRoute.ts
    interpolatePath.ts
    sendOne.ts
    sendList.ts
    sendNone.ts
    sendError.ts
    types.ts
    index.ts
  routes/
    projects.ts
    jobs.ts
    packageManager.ts
    cache.ts
    index.ts
  websocket/
    types.ts

src/api/
  websocket/
    broadcaster.ts
    plugin.ts
    abstractions/
      WebSocketBroadcaster.ts

src/ui/
  websocket/
    WebSocketListener.ts
    abstractions/
      WebSocketListener.ts
    feature.ts
  httpClient/
    HTTPClient.ts           — request(route, args, options?) method
    abstractions/
      HTTPClient.ts         — updated interface

src/api/db/
  schema.ts                 — add scanResults, pmSecuritySettings tables; update projects
  migrations/               — new migration
```

### Removals

- `ScanCache` service + abstraction + tests
- `ScanCache` references in routes and feature registration
- Old `get`/`post`/`del` methods on HTTPClient
- `YarnService` renamed to `PackageManagerService`
- `yarn` job type references (renamed to `packageManager`)

## 7. Dependencies

- `zod` — schema validation (shared)
- `@fastify/websocket` — WebSocket support (API)

## 8. Testing Strategy

- **Route infrastructure**: unit tests for `defineRoute`, `registerRoute`, `interpolatePath`, response helpers
- **WebSocket**: unit test `WebSocketBroadcaster` with mock ws clients
- **Scan job**: integration test via JobWorker with mock CommandRunner, verify per-package progress events
- **Scan results DB**: verify persist/replace cycle
- **PM detection**: unit test lockfile detection for each PM
- **Security settings**: unit test config-driven security check for each PM
- **UI presenters**: test WS listener registration, progress state updates, multiple listeners per type
- **Existing route tests**: update to use new response envelope shapes (`sendOne`/`sendList`/`sendNone`)
