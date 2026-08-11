# Engines Check — Design Spec

Flag projects and dependencies targeting EOL or maintenance-phase Node.js versions.

## Overview

New `engines` check category alongside existing `license` and `vulnerability` checks. Works in both CLI (`depco scan --check engines|all`) and API/UI (server-side scan with DB persistence, dashboard widget, project list badges, project detail section).

## Data Source

Node.js release schedule from [endoflife.date API](https://endoflife.date/api/nodejs.json) with tiered fallback:

1. **DB cache** — `node_release_data` table, refreshed every 24h
2. **API fetch** — `GET https://endoflife.date/api/nodejs.json` when cache is stale
3. **Embedded constant** — `src/shared/engines/nodeReleases.ts` hardcoded schedule, used when both DB and API are unavailable (CLI standalone mode, network failure)

**Partial failure handling**: If API fetch succeeds but DB insert fails, return the fresh API data (best-effort persist, don't block on DB write failure). Log the DB error via Logger.

### `node_release_data` Table

| Column           | Type             | Description                      |
| ---------------- | ---------------- | -------------------------------- |
| id               | text PK          | Generated ID                     |
| version          | integer UNIQUE   | Major version (e.g. 22)          |
| codename         | text             | Release codename (e.g. "Jod")    |
| releaseDate      | integer          | Timestamp                        |
| ltsStart         | integer nullable | Timestamp, null for non-LTS      |
| maintenanceStart | integer nullable | Timestamp                        |
| eolDate          | integer          | Timestamp                        |
| fetchedAt        | integer          | When this row was last refreshed |

## Engine Classification

`src/shared/engines/` — pure functions, no DI, usable by both CLI and API.

### Types

```typescript
type EngineStatus = "current" | "active-lts" | "maintenance" | "eol" | "unknown";
```

### Functions

- `parseEnginesNode(enginesField: string): number | null` — extract minimum major version from semver range (e.g. `">=18.0.0"` → `18`, `"^20.0.0"` → `20`). Returns null if unparsable or field is missing.
- `classifyNodeVersion(input: { majorVersion: number; schedule: INodeRelease[]; now?: number }): IEngineClassification` — returns `{ status: EngineStatus, eolDate: number | null, codename: string | null }`. Callers pass parsed majorVersion; when `parseEnginesNode` returns null (missing/unparsable), caller assigns `status: "unknown"` directly without calling this function.
- `NODE_RELEASES` constant — embedded fallback schedule

```typescript
interface INodeRelease {
  version: number; // major version (e.g. 22)
  codename: string | null; // e.g. "Jod", null for non-LTS
  releaseDate: number; // timestamp
  ltsStart: number | null; // timestamp, null for non-LTS
  maintenanceStart: number | null;
  eolDate: number; // timestamp
}

interface IEngineClassification {
  status: EngineStatus;
  eolDate: number | null;
  codename: string | null;
}
```

## Engine Service (API)

`src/api/services/Engine/` — standard service structure (abstractions/, implementation, feature.ts, index.ts).

### NodeReleaseDataService

Manages the release schedule cache.

- `getSchedule(): Promise<INodeRelease[]>` — returns release data. Cache logic:
  - If DB has data and newest `fetchedAt` < 24h old, return from DB
  - Otherwise fetch endoflife.date API, upsert to DB, return
  - On fetch failure, return stale DB data
  - If DB empty AND fetch fails, return embedded `NODE_RELEASES` constant

### EngineService

Orchestrates engine checks for a project.

#### `engine_checks` Table

| Column       | Type             | Description                                               |
| ------------ | ---------------- | --------------------------------------------------------- |
| id           | text PK          | Generated ID                                              |
| projectId    | text FK          | References projects.id                                    |
| packageName  | text             | Empty string `""` for root project, package name for deps |
| enginesNode  | text nullable    | Raw engines.node string, null if missing                  |
| minimumMajor | integer nullable | Parsed minimum major version                              |
| status       | text             | EngineStatus value                                        |
| eolDate      | integer nullable | EOL date for the minimum supported version                |
| scannedAt    | integer          | Timestamp                                                 |

UNIQUE constraint via Drizzle `.unique().on(engineChecks.projectId, engineChecks.packageName)` — same pattern as `licenses` table. Root project uses `packageName = ""` (not null) so the unique constraint works correctly in SQLite.

Schema defined in `src/api/db/schema.ts`, migration via `drizzle-kit generate`.

#### Methods

- `scan(input: { projectId: string; projectPath: string }): Promise<IEngineScanResult>`
  1. Read root package.json `engines.node`
  2. Walk `node_modules/**/package.json` — collect all unique `engines.node` values per package. Skip `.bin` directories and symlink cycles. Malformed JSON or permission errors per package are caught individually — log warning, classify as `"unknown"`, continue scan.
  3. Get release schedule from NodeReleaseDataService
  4. Classify each entry
  5. Upsert to `engine_checks`, sweep stale rows (same scannedAt pattern as VulnerabilityService)
  6. Return result

```typescript
interface IEngineScanResult {
  rootStatus: EngineStatus;
  rootEnginesNode: string | null;
  findings: IEngineCheck[];
  summary: IEngineSummary;
}

interface IEngineCheck {
  id: string;
  projectId: string;
  packageName: string; // "" for root
  enginesNode: string | null;
  minimumMajor: number | null;
  status: EngineStatus;
  eolDate: number | null;
  scannedAt: number;
}

interface IEngineStatusCounts {
  eol: number;
  maintenance: number;
  activeLts: number;
  current: number;
  unknown: number;
}

interface IEngineSummary {
  totalProjects: number;
  counts: IEngineStatusCounts;
  projectSummaries: IProjectEngineSummary[];
}

interface IProjectEngineSummary {
  projectId: string;
  projectName: string;
  rootStatus: EngineStatus;
  rootEnginesNode: string | null;
  dependencyCounts: IEngineStatusCounts;
}
```

- `getByProject(projectId: string): Promise<IEngineCheck[]>` — query engine_checks for project
- `getSummary(options?: { projectIds?: string[] }): Promise<IEngineSummary>` — aggregate root engine status across projects for dashboard, includes per-project summaries with dependency EOL/maintenance counts

### Scan Integration

`ScanJobExecutor` chains `EngineService.scan()` after license scan. New WebSocket events: `engine-scan:progress`, `engine-scan:complete`.

## API Routes

`src/api/routes/engines.ts`, definitions in `src/shared/routes/engines.ts`.

| Method | Path                         | Description                               |
| ------ | ---------------------------- | ----------------------------------------- |
| GET    | /api/engines/summary         | Aggregate engine status across projects   |
| GET    | /api/engines/releases        | Cached Node release schedule              |
| GET    | /api/engines/:projectId      | Engine checks for a project (root + deps) |
| POST   | /api/engines/:projectId/scan | Trigger engine scan                       |

Summary registered before `:projectId` to avoid path shadowing.

## CLI Integration

### CheckEnginesStep

`src/cli/commands/scan/steps/CheckEngines/` — standard step structure.

- Reads `packages` from context (already parsed by ParseLockfile step)
- Reads root package.json `engines.node` from `context.dataDirectory`
- Uses shared classification functions + embedded `NODE_RELEASES` constant (no DB, no API — CLI is standalone)
- For dependencies: reads `engines.node` from each dep's `node_modules/<name>/package.json`
- Stores findings in `context.results.set("engines", findings)`
- Skip logic: same pattern as CheckVulnerabilitiesStep — reads `context.options["check"]`, returns `{ success: true, skipped: true }` when check is not `"engines"` and not `"all"`

### ScanCommand Changes

- Add `CheckEnginesStep` to step pipeline (after CheckVulnerabilities, before RenderOutput)
- `--check` choices: `license | vulnerability | engines | all` (default stays `license`)

### IScanOutput Extension

```typescript
interface IScanFindings {
  license: ILicenseViolation[];
  vulnerability: IMergedVulnerability[];
  engines: IEnginesFinding[]; // NEW
}

interface IEnginesFinding {
  packageName: string;
  version: string;
  enginesNode: string | null;
  minimumMajor: number | null;
  status: EngineStatus;
  eolDate: number | null;
  isRoot: boolean; // true when packageName is ""
}
```

### Exit Code

- Root project targets EOL Node → exit code 1
- Root project missing engines field → exit 0 (status "unknown", informational only)
- Root project in maintenance → exit 0 (informational, configurable via `warnMaintenance`)
- Dependency findings → informational only, never cause exit code

### Formatter Updates

All 4 formatters updated to render engines findings:

- **Table**: "Node Engines" section with package/engines/status/eol-date columns, root highlighted
- **JSON**: engines array in findings object
- **CSV**: `type=engines` rows
- **SARIF**: `engines/eol` and `engines/maintenance` rules

## Config

Extend `IDepcoConfig` and `depcoConfigSchema`:

```typescript
interface IEnginesScanConfig {
  ignore?: string[]; // packages to skip
  warnMaintenance?: boolean; // default true — include maintenance findings
}

interface IScanConfig {
  license?: ILicenseScanConfig;
  vulnerability?: IVulnerabilityScanConfig;
  engines?: IEnginesScanConfig; // NEW
  ignoredPackages?: string[];
  registryUrl?: string;
}
```

Global `scan.ignoredPackages` also applies to engines checks.

## UI

### Features Layer

`src/ui/features/Engines/` — EnginesGateway + EnginesRepository, standard pattern.

- `EnginesGateway`: `getByProject(projectId)`, `getSummary()`, `scan(projectId)`, `getReleases()`
- `EnginesRepository`: holds per-project engine checks + summary

### Presentation

**Project list** — `EngineStatusBadge` next to each project name:

- Green dot: current or active-lts
- Yellow dot: maintenance
- Red dot: eol
- Gray dot: no engines field

**Project detail** — `EngineStatusSection` (Accordion):

- Root engine status prominently displayed
- Table of dependencies with EOL/maintenance engine constraints
- Collapsible, sorted by severity (eol first)

**Dashboard** — `EngineOverviewWidget`:

- Count of projects by root engine status (X EOL, Y maintenance, Z current/lts)
- Links to project list filtered by status

### WebSocket Events

- `engine-scan:complete` — `{ projectId, counts: IEngineStatusCounts }`
- Progress tracked via standard `job:progress` event (built into JobExecutionContext)

## Testing

- **Shared**: unit tests for `parseEnginesNode`, `classifyNodeVersion` with various semver ranges and edge cases
- **NodeReleaseDataService**: test cache logic (fresh/stale/empty DB, API success/failure, fallback)
- **EngineService**: integration test with test DB, mock filesystem for package.json reads
- **CheckEnginesStep**: CLI step test with mock packages
- **Routes**: route tests via createTestApiContainer
- **Formatters**: extend existing formatter tests with engines findings
