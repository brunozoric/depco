# Dependency Upgrader — Design Spec

## Overview

A browser-based tool for managing npm dependency upgrades across multiple local projects. Users register project paths via UI, view available upgrades, select which dependencies to upgrade (in-range or latest), and trigger upgrades with live progress. The tool enforces `.yarnrc.yml` security settings before allowing any upgrade operation.

## Architecture

Single-process Node.js application: Fastify serves both REST API and static React UI.

- **Dev mode:** Vite dev server (port 5173) proxies `/api/*` to Fastify (port 3001). Hot reload on both sides.
- **Production:** `yarn build` compiles API with tsc to `dist/api/`, builds UI with Vite to `dist/ui/`. `yarn start` runs Fastify serving API routes + static UI files. Single port.

## Tech Stack

- **API:** Fastify, SQLite + Drizzle ORM, execa for shell commands
- **UI:** React, Mantine, MobX, mobx-react-lite
- **Architecture:** MVP (Gateway → Repository → UseCase → Presenter → React) with `@webiny/di` dependency injection
- **IDs:** `@webiny/stdlib` for UUID generation

## Required Packages (to be added during implementation)

**Dependencies:** fastify, @fastify/static, drizzle-orm, better-sqlite3, @mantine/core, @mantine/hooks, @emotion/react, mobx, mobx-react-lite, yaml, execa, @webiny/app

**Dev dependencies:** vite, @vitejs/plugin-react, drizzle-kit, @types/better-sqlite3

## Domain Model

### Projects

Registered disk paths pointing to Yarn-managed Node.js projects.

| Field         | Type    | Description                              |
| ------------- | ------- | ---------------------------------------- |
| id            | TEXT PK | UUID from @webiny/stdlib                 |
| name          | TEXT    | From package.json name or directory name |
| path          | TEXT    | Absolute disk path, unique               |
| yarnVersion   | TEXT    | Detected Yarn version                    |
| addedAt       | INTEGER | Unix timestamp                           |
| lastScannedAt | INTEGER | Last dependency scan timestamp           |

### Upgrade Jobs

Async operations tracked in DB.

| Field       | Type    | Description                                    |
| ----------- | ------- | ---------------------------------------------- |
| id          | TEXT PK | UUID                                           |
| projectId   | TEXT FK | References projects.id                         |
| type        | TEXT    | `dependency` / `transient` / `yarn`            |
| status      | TEXT    | `pending` / `running` / `completed` / `failed` |
| packages    | TEXT    | JSON — see per-type semantics below            |
| logs        | TEXT    | Captured stdout/stderr                         |
| startedAt   | INTEGER | Unix timestamp                                 |
| completedAt | INTEGER | Unix timestamp                                 |

**`packages` field per job type:**

- `dependency` — JSON array of `{name, from, to}` where `from` is looked up from scan cache at job creation
- `transient` — `null` (no specific packages, runs `yarn up "**" -R` on all)
- `yarn` — JSON object `{from, to}` with old and new Yarn versions

### Security Checks

Per-project validation of `.yarnrc.yml` security settings. Each field stores whether the check passes (1) or fails (0). The check logic is:

- `npmPreapprovedPackages` — passes if key exists (any value, including empty array)
- `npmMinimalAgeGate` — passes if key exists (any value)
- `enableScripts` — passes if key exists AND value is `false`
- `approvedGitRepositories` — passes if key exists (any value, including empty array)

| Field                   | Type    | Description                             |
| ----------------------- | ------- | --------------------------------------- |
| id                      | TEXT PK | UUID                                    |
| projectId               | TEXT FK | References projects.id                  |
| checkedAt               | INTEGER | Unix timestamp                          |
| npmPreapprovedPackages  | INTEGER | 0/1 — passes if key exists              |
| npmMinimalAgeGate       | INTEGER | 0/1 — passes if key exists              |
| enableScripts           | INTEGER | 0/1 — passes if key exists AND is false |
| approvedGitRepositories | INTEGER | 0/1 — passes if key exists              |

### Registry Cache

Per-package cache of `yarn npm info` results, stored in SQLite. Avoids redundant registry calls when scanning multiple projects with shared dependencies.

| Field       | Type    | Description                             |
| ----------- | ------- | --------------------------------------- |
| packageName | TEXT PK | npm package name (unique)               |
| data        | TEXT    | Stringified JSON of full registry info  |
| cachedAt    | INTEGER | Unix timestamp of when data was fetched |

- **TTL:** 30 minutes. If `cachedAt` is older than 30 mins, re-fetch from registry.
- **Force refresh:** `DELETE /api/cache` clears all cached entries. `DELETE /api/cache/:packageName` clears one package. `POST /api/projects/:id/scan?force=true` bypasses cache for that scan.
- **Shared across projects:** If project A and project B both use `react`, only one registry call is made (within the TTL window).

### Dependencies (not persisted)

Scanned on demand using native Yarn Berry commands (two-step: `yarn info --all --json` for installed versions + registry cache for latest versions). Returned directly from API, never stored in DB. The `lastScannedAt` timestamp on the project record is updated on successful scan completion (not on failure) so the UI can show when data was last refreshed.

| Field          | Type   | Description                          |
| -------------- | ------ | ------------------------------------ |
| name           | string | Package name                         |
| currentVersion | string | Currently installed version          |
| latestInRange  | string | Latest version matching range        |
| latestVersion  | string | Absolute latest version              |
| type           | string | `dependency` / `devDependency`       |
| upgradeType    | string | `patch` / `minor` / `major` / `none` |

## API Routes

### Projects

| Method | Route                          | Description                                           |
| ------ | ------------------------------ | ----------------------------------------------------- |
| POST   | /api/projects                  | Register project path                                 |
| GET    | /api/projects                  | List all projects with security status                |
| GET    | /api/projects/:id              | Single project detail                                 |
| DELETE | /api/projects/:id              | Unregister project (cascades)                         |
| POST   | /api/projects/:id/scan         | Scan for upgrades (sync, ?force=true to bypass cache) |
| GET    | /api/projects/:id/dependencies | List deps with available upgrades                     |
| GET    | /api/projects/:id/security     | Current .yarnrc.yml security status                   |

### Upgrades

| Method | Route                                | Description                                |
| ------ | ------------------------------------ | ------------------------------------------ |
| POST   | /api/projects/:id/upgrades           | Start upgrade job (see request body below) |
| POST   | /api/projects/:id/upgrades/transient | Run `yarn up "**" -R`                      |
| GET    | /api/projects/:id/upgrades/:jobId    | Job status + logs (poll)                   |
| GET    | /api/projects/:id/upgrades           | Upgrade history                            |

### Yarn Management

| Method | Route                         | Description                            |
| ------ | ----------------------------- | -------------------------------------- |
| POST   | /api/projects/:id/yarn/update | Update Yarn (exact version or `berry`) |
| GET    | /api/projects/:id/yarn        | Current Yarn version info              |

### Registry Cache

| Method | Route                   | Description                    |
| ------ | ----------------------- | ------------------------------ |
| DELETE | /api/cache              | Clear all cached registry data |
| DELETE | /api/cache/:packageName | Clear cache for one package    |

### Request/Response Contracts

**POST /api/projects** request:

```json
{ "path": "/absolute/path/to/project" }
```

**POST /api/projects/:id/upgrades** request:

```json
{
  "packages": [
    { "name": "@webiny/di", "targetVersion": "1.1.0" },
    { "name": "react", "targetVersion": "19.3.0" }
  ],
  "refreshTransient": true
}
```

- `packages` — which deps to upgrade and to which version. The `from` field in the stored job record is populated by looking up the current version from the latest scan cache at job creation time.
- `refreshTransient` — if true, runs `yarn up "**" -R` after all upgrades complete

**POST /api/projects/:id/yarn/update** request:

```json
{ "version": "4.7.0" }
```

- `version` — exact semver string or the literal `"berry"` (resolved by `yarn set version berry` at runtime to latest stable)

**All async operations return:**

```json
{ "jobId": "uuid" }
```

### Key Behaviors

- All mutating operations (upgrade, yarn update, transient refresh) are async — return job ID immediately, client polls for status.
- Security check runs automatically before any upgrade or transient refresh. Returns 403 if any setting fails.
- Scan uses two-step Yarn Berry commands (`yarn info --all --json` + `yarn npm info <pkg> --json`) to build dependency data.
- **DELETE cascade:** Deleting a project hard-deletes all associated upgrade jobs, security checks, and clears the in-memory scan cache for that project. Fails with 409 if a job is currently running — wait for completion or cancel first.

## Upgrade Engine (Use Cases)

### ScanDependencies

- Two-step scan using native Yarn Berry commands:
  1. `yarn info --all --json` — NDJSON output, one line per installed package with current version
  2. Read project `package.json` to identify direct dependencies and devDependencies
  3. For each direct dep: check `registry_cache` table first (30 min TTL). If cache hit and not expired, use cached data. If miss or expired, run `yarn npm info <package> --json` and store result in cache.
  4. Compare installed version vs latest to classify as patch/minor/major
- `?force=true` query param on scan endpoint bypasses registry cache — re-fetches all packages from registry
- Parses output into structured dependency list
- **Synchronous** — runs inline in the request handler, returns dependency list directly in the response. Not a job. Updates `lastScannedAt` on the project record on success.
- Results are cached in-memory on the API side keyed by project ID. `GET /api/projects/:id/dependencies` returns the cached scan result without re-running `yarn outdated`. A new `POST /api/projects/:id/scan` refreshes the cache.
- **Cache miss (no prior scan or API restart):** `GET /api/projects/:id/dependencies` returns an empty array with `lastScannedAt: null`. UI shows "Not scanned yet" prompt.

### UpgradeDependencies

- For each selected package: `yarn up {package}@{targetVersion}`
- Streams stdout/stderr into job logs in DB (appended per-line as output arrives)
- If `refreshTransient` flag is set in request, automatically creates and queues a transient refresh job after upgrade completes

### RefreshTransientDeps

- Runs `yarn up "**" -R` in project directory
- Separate job type — can be triggered independently

### UpdateYarnVersion

- Runs `yarn set version {version}` — exact semver string or the literal `berry`
- `berry` is a Yarn-recognized keyword — `yarn set version berry` resolves to latest stable at runtime
- Captures output into job logs

### CheckSecurity

- Reads `.yarnrc.yml` with YAML parser
- Validates 4 required keys:
  - `npmPreapprovedPackages` — must exist
  - `npmMinimalAgeGate` — must exist
  - `enableScripts` — must be `false`
  - `approvedGitRepositories` — must exist
- Runs automatically before any upgrade, blocks if failing
- Result persisted to `security_checks` table

### Job Worker

- Picks up pending jobs from DB, sets `running`, executes, sets `completed`/`failed`
- Single worker per process — no concurrent upgrades on same project (yarn lockfile conflicts)
- Different projects can run concurrently
- **Queue behavior:** FIFO per project. If a job is already running for a project, new jobs for that project queue as `pending` and execute in order. Jobs for different projects run concurrently.
- **Log flushing:** Logs are appended to the DB per-line as stdout/stderr arrives from execa. The `logs` field is updated incrementally during execution so polling clients see live output.
- **Log size:** No hard limit — logs are plain text of yarn command output, typically a few KB per job. Old jobs can be cleaned up manually via DELETE.

## UI Pages

### Project List (home)

- Mantine Table of registered projects: name, path, yarn version, security status badge, last scanned
- "Add Project" button — modal with path input, validates path exists and has package.json
- Per-row actions: scan, view details, remove
- Security badge (red/green) — red blocks upgrade actions

### Project Detail

- Header: project name, path, yarn version
- Security panel: shows each of 4 settings with pass/fail indicators. Blocks all upgrade actions if any fail.
- Dependencies table: name, current version, in-range version, latest version, type
- Checkboxes per dependency, version selector column (in-range or latest)
- "Upgrade Selected" button — starts job, shows progress inline
- "Refresh Transient" button — runs `yarn up "**" -R`
- "Update Yarn" action — version input or "berry" shortcut

### Job Progress (inline in Project Detail)

- Shows running/completed/failed jobs
- Live log output via polling (2s interval)
- History of past jobs with timestamps and results

### MVP Architecture

Per `ui-architecture` and `dependency-injection` skills:

- **HTTPClient:** Abstraction + implementation for all HTTP calls. Gateways depend on `HTTPClient.Interface`, never on `fetch` directly. In tests, a mock HTTPClient is registered in the DI container returning preset responses — no real API needed.
- **Gateway:** Uses HTTPClient to call Fastify API
- **Repository:** Holds project list, dependency scan results, job state
- **UseCases:** ScanProject, UpgradePackages, RefreshTransient, UpdateYarn, CheckSecurity
- **Presenters:** ProjectListPresenter, ProjectDetailPresenter, JobProgressPresenter
- **React:** Dumb display layer, `observer()` wrapped, reads `presenter.vm` only
- All wired through `@webiny/di` with `createAbstraction`/`createFeature`

## File Structure

```
src/
  api/
    db/
      schema.ts              — Drizzle table definitions
      migrations/            — Drizzle Kit migrations
      client.ts              — SQLite connection setup
    routes/
      projects.ts            — project CRUD routes
      upgrades.ts            — upgrade job routes
      yarn.ts                — yarn management routes
      cache.ts               — registry cache management routes
    services/
      abstractions/          — DI tokens for all services
      ScanService.ts         — two-step scan (yarn info + registry cache)
      RegistryCacheService.ts — registry cache with 30min TTL
      UpgradeService.ts      — executes upgrades via execa
      SecurityService.ts     — .yarnrc.yml validation
      YarnService.ts         — yarn version management
      JobWorker.ts           — async job executor
    feature.ts               — API-level DI registration
    server.ts                — Fastify setup + plugin registration
  shared/
    di/                      — existing DI utilities (createAbstraction, createFeature, etc.)
    index.ts
  ui/
    httpClient/
      abstractions/
        HTTPClient.ts        — DI token + interface (get, post, delete methods)
      HTTPClient.ts          — fetch-based implementation
      feature.ts             — registers HTTPClient as singleton
    features/                — headless layer (Gateway + Repository)
      projects/
        abstractions/
        ProjectsGateway.ts
        ProjectsRepository.ts
        feature.ts
      upgrades/
        abstractions/
        UpgradesGateway.ts
        UpgradesRepository.ts
        feature.ts
    presentation/            — MVP presentation layer
      projects/
        ProjectList/
          abstractions/
          ProjectListPresenter.ts
          ProjectListProvider.tsx
          feature.ts
          components/
            ProjectListPage.tsx
            AddProjectModal.tsx
        ProjectDetail/
          abstractions/
          ProjectDetailPresenter.ts
          ProjectDetailProvider.tsx
          feature.ts
          components/
            ProjectDetailPage.tsx
            DependencyTable.tsx
            SecurityPanel.tsx
      jobs/
        JobProgress/
          abstractions/
          JobProgressPresenter.ts
          feature.ts
          components/
            JobProgressPanel.tsx
            JobLogViewer.tsx
    App.tsx
    main.tsx
data/
  upgrader.db                — SQLite database (gitignored)
```

## Database

- SQLite file at `./data/upgrader.db`, created on first run
- `./data/` gitignored
- Drizzle migrations run automatically on Fastify startup
- Drizzle schema in `src/api/db/schema.ts`

## Dev Setup

- `yarn dev` — starts Fastify API (port 3001) + Vite dev server (port 5173, proxies `/api/*` to Fastify)
- `yarn build` — tsc compiles API to `dist/api/`, Vite builds UI to `dist/ui/`
- `yarn start` — production: Fastify serves API + static UI, single port
- `yarn full` — adio + lint:fix + format:fix + build + test

## Testing Strategy

### API Tests

- Use SQLite in-memory (`:memory:`) — real Drizzle schema, real repositories, no mocks
- Resolve all services through DI container
- Test use cases and services end-to-end against in-memory DB
- Only mock: execa calls (yarn commands) — use DI abstraction for command execution

### UI Tests

- Mock HTTPClient at the DI level — register a test implementation returning preset responses
- Test presenters with real use cases, real repositories, mock gateway data
- No real API server needed — gateways get mock responses via HTTPClient
- Test that presenter `vm` produces correct view-ready data for given inputs
