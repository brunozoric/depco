# Auto-Fix PR Generation — Design Spec

## Overview

Auto-fix PR generation creates git branches and pull requests for safe dependency upgrades automatically. Each eligible outdated package gets a branch, upgrade, commit, push, and PR — either triggered manually per project or automatically after each scan. License compliance policy gates upgrades: "deny" blocks, "warn" flags in PR body.

## Decisions

- **Upgrade scope**: Configurable per project (patch/minor/major), default patch-only
- **PR grouping**: Configurable per project (per-package, per-project, per-upgrade-type), default per-package
- **Trigger**: Both auto-after-scan and manual trigger, configurable per project, default manual
- **License gate**: Hard block for "deny" rules, warn-in-PR-body for "warn" rules, configurable override
- **Stale PRs**: Leave existing open PRs, skip duplicates — only create PRs for packages without an existing open auto-fix PR
- **Changelog**: Include already-resolved changelog excerpts in PR body, skip if not available
- **Architecture**: New standalone AutoFixPrJobExecutor using GitService/ForgeService/UpgradeService directly, not the interactive upgrade session pipeline

## Database Schema

### `auto_fix_settings` table

Per-project configuration. One row per project.

| Column           | Type                           | Notes                                               |
| ---------------- | ------------------------------ | --------------------------------------------------- |
| id               | text PK                        |                                                     |
| projectId        | text FK → projects(id) CASCADE | unique                                              |
| enabled          | integer                        | 0 = manual only, 1 = auto after scan                |
| upgradeTypes     | text                           | JSON array, e.g. `["patch"]` or `["patch","minor"]` |
| groupingStrategy | text                           | "per-package", "per-project", "per-upgrade-type"    |
| branchPrefix     | text                           | Default "auto-fix/"                                 |
| createdAt        | integer                        |                                                     |
| updatedAt        | integer                        |                                                     |

### `auto_fix_pull_requests` table

Tracks generated PRs. One row per PR (may cover one or multiple packages depending on grouping).

| Column          | Type                           | Notes                                              |
| --------------- | ------------------------------ | -------------------------------------------------- |
| id              | text PK                        |                                                    |
| projectId       | text FK → projects(id) CASCADE |                                                    |
| packageNames    | text                           | JSON array — single package or group               |
| fromVersions    | text                           | JSON object `{ "lodash": "4.17.20" }`              |
| toVersions      | text                           | JSON object `{ "lodash": "4.17.21" }`              |
| upgradeType     | text                           | "patch", "minor", or "major"                       |
| branchName      | text                           | e.g. "auto-fix/lodash-4.17.21"                     |
| prUrl           | text nullable                  | Null until PR created                              |
| prNumber        | integer nullable               |                                                    |
| status          | text                           | "pending", "created", "merged", "closed", "failed" |
| licenseWarnings | text nullable                  | JSON array of warning strings                      |
| createdAt       | integer                        |                                                    |
| updatedAt       | integer                        |                                                    |
| **unique**      | (projectId, branchName)        | prevent duplicate branches                         |

## Backend Services

### AutoFixSettingsService

CRUD for per-project auto-fix configuration. Abstraction + implementation following DI pattern.

- `getSettings(projectId: string): Promise<AutoFixSettings | null>` — returns config or null
- `updateSettings(projectId: string, input: UpdateAutoFixSettingsInput): Promise<AutoFixSettings>` — upsert
- Defaults when no settings exist: `enabled=false`, `upgradeTypes=["patch"]`, `groupingStrategy="per-package"`, `branchPrefix="auto-fix/"`

### AutoFixPrService

Orchestration logic. Determines what PRs to create, delegates execution to the job executor.

- `generateForProject(projectId: string): Promise<AutoFixResult>` — main entry point:
  1. Load scan results for project (outdated packages from `scanResults` table)
  2. Filter by configured upgrade types (patch/minor/major from `auto_fix_settings`)
  3. License gate: for each package's target version, check `LicensePolicyService`. Skip "deny" violations entirely. Collect "warn" violations for PR body.
  4. Duplicate check: query `auto_fix_pull_requests` for existing open PRs (status = "pending" or "created") — skip packages already covered
  5. Group packages by configured strategy:
     - "per-package": one record per package
     - "per-project": one record with all packages
     - "per-upgrade-type": one record per upgrade type (all patches together, all minors together, etc.)
  6. Create records in `auto_fix_pull_requests` with status "pending"
  7. Return `{ pending: AutoFixPullRequest[], skippedDeny: string[], skippedDuplicate: string[] }`

- `buildPrBody(packages: PackageUpgrade[], changelogs: ChangelogEntry[], licenseWarnings: string[]): string` — assembles markdown PR body:
  - Upgrade summary table (package | from | to | type)
  - Changelog excerpts per package (from `changelogs` table, if previously resolved)
  - License warnings section (if any "warn" rule matches)
  - "Generated by Dependency Manager" footer

### AutoFixPrJobExecutor

Registered in `JobExecutorRegistry` as type `"auto-fix-pr"`. Requires adding `"auto-fix-pr"` to the `ICreateJobInput` type union in `src/api/services/abstractions/JobWorker.ts` and registering the executor class in `JobExecutorRegistry`. Processes pending PR records for a project.

`execute()` flow:

1. Load all "pending" `auto_fix_pull_requests` for the project
2. Check `GitService.getStatus()` — if working tree is dirty, fail with error
3. Save current branch name via `GitService.getCurrentBranch()`
4. For each pending record:
   a. Create branch: `GitService.createAndCheckoutBranch(projectPath, branchName)`
   b. Upgrade packages: `UpgradeService.upgradePackage()` for each package in the group
   c. Stage + commit: `GitService.stageAll()` + `GitService.commit()`
   d. Push: `GitService.push(projectPath, "origin", branchName)`
   e. Create PR: `ForgeService.createPr()` with body from `AutoFixPrService.buildPrBody()`
   f. Update record: status="created", prUrl, prNumber
   g. Broadcast `auto-fix:progress` WS event
   h. On failure: update status="failed", log error
   i. Always: checkout back to original branch (try/finally)
5. Broadcast `auto-fix:complete` with counts

### ScanJobExecutor integration

In `server.ts`, extend the existing `scan:completed` listener. After enqueuing the license scan, also check auto-fix settings:

```typescript
// existing: scan:completed → enqueue license-scan
eventBus.on("scan:completed", projectId => {
  void jobWorker.enqueue({
    type: "license-scan",
    referenceId: projectId,
    referenceType: "project"
  });
});

// new: license-scan:completed → conditionally enqueue auto-fix-pr
eventBus.on("license-scan:completed", async projectId => {
  const settings = await autoFixSettingsService.getSettings(projectId);
  if (settings?.enabled) {
    void jobWorker.enqueue({
      type: "auto-fix-pr",
      referenceId: projectId,
      referenceType: "project"
    });
  }
});
```

Note: The auto-fix-pr job must run AFTER the license scan completes (so license data is fresh for the gate check). Rather than relying on enqueue ordering, listen for `license-scan:completed` EventBus event. This guarantees correct sequencing regardless of job queue timing.

**Prerequisite fix**: `LicenseScanJobExecutor` currently declares `"license-scan:completed"` in its EventBus module augmentation but never emits it. This feature's implementation must add `eventBus.emit("license-scan:completed", projectId)` at the end of `LicenseScanJobExecutor.execute()`, inject `EventBus` as a dependency, and update `JobExecutorRegistry` accordingly.

**WebSocket event registration**: Add `WSAutoFixProgress` and `WSAutoFixComplete` interfaces to `src/shared/websocket/types.ts` and register them in `WSEventMap`.

## API Routes

### Auto-fix settings routes (`src/api/routes/autoFixSettings.ts`)

| Method | Path                                | Purpose                                             |
| ------ | ----------------------------------- | --------------------------------------------------- |
| GET    | `/api/auto-fix/:projectId/settings` | Get project config (returns defaults if none saved) |
| PUT    | `/api/auto-fix/:projectId/settings` | Update project config (upsert)                      |

### Auto-fix PR routes (`src/api/routes/autoFixPrs.ts`)

Fixed path segments registered before parametrized routes.

| Method | Path                                     | Purpose                                                  |
| ------ | ---------------------------------------- | -------------------------------------------------------- |
| GET    | `/api/auto-fix/pull-requests`            | List all auto-fix PRs. Filter: `projectId`, `status`     |
| GET    | `/api/auto-fix/:projectId/pull-requests` | PRs for one project                                      |
| POST   | `/api/auto-fix/:projectId/generate`      | Manual trigger — generate PRs for project (enqueues job) |
| DELETE | `/api/auto-fix/pull-requests/:id`        | Remove PR tracking record                                |

### Shared route definitions

`src/shared/routes/autoFix.ts` — Zod schemas for all request/response shapes using `defineRoute()`.

### WebSocket events

- `auto-fix:progress` — `{ projectId, packageName, step, current, total }` where step is "branch" | "upgrade" | "commit" | "push" | "create-pr"
- `auto-fix:complete` — `{ projectId, created, skipped, failed }`

## UI Architecture

No standalone page — auto-fix is a project-level concern, lives on project detail.

### Project Detail Integration

`ProjectDetailPresenter` gains:

- `autoFixSettings` in VM: enabled, upgradeTypes, groupingStrategy, branchPrefix
- `autoFixPullRequests` in VM: list of PRs with status
- `updateAutoFixSettings(input)` action method
- `generateAutoFixPrs()` action method — manual trigger
- `autoFixRunning` boolean — tracks in-progress generation

New section on project detail page ("Auto-Fix PRs" collapsible):

- Settings panel: enable toggle, upgrade type checkboxes (patch/minor/major), grouping dropdown, branch prefix input
- "Generate PRs" button (disabled while running or when forge not detected)
- PR list table: package(s), version range (from → to), status badge (colored: pending=blue, created=green, merged=teal, closed=gray, failed=red), clickable PR link

### Dashboard Integration

Light touch — add "X open auto-fix PRs" count to existing dashboard summary or health card. No dedicated widget.

### Gateway and Repository

- `AutoFixGateway` — HTTP calls to settings and PR routes
- `AutoFixRepository` — stores settings and PR list
- `AutoFixFeature` — feature registration
- Use cases: `LoadAutoFixUseCase`, `UpdateAutoFixSettingsUseCase`, `GenerateAutoFixPrsUseCase`

## Error Handling & Edge Cases

- **Forge not configured**: `ForgeService.detectForge()` returns "unknown" → skip PR creation, set status "failed" with reason. UI shows "Configure forge token in settings" hint.
- **Branch already exists on remote**: `GitService.push()` fails → set status "failed", log error, continue to next group.
- **Package upgrade fails**: `UpgradeService.upgradePackage()` throws → set status "failed" for that group, restore original branch, continue to next group.
- **Concurrent auto-fix runs**: Second run sees existing "pending" records and skips those packages. JobWorker processes sequentially per its queue design.
- **No outdated packages**: `generateForProject()` returns zero counts. No records created, no job enqueued.
- **Working directory dirty**: `GitService.getStatus()` returns modified files → abort entire run with error. User must commit or stash first.
- **Original branch restoration**: Store original branch at start. On success or failure, checkout back. Wrap in try/finally.
- **License scan not yet complete**: If auto-fix runs before license scan finishes, license gate uses whatever data is in the `licenses` table (possibly stale). The sequential job ordering (license-scan enqueued first) prevents this in the auto trigger path. Manual trigger may hit stale data — acceptable, user is explicitly triggering.

## Testing Strategy

### Unit tests

- **AutoFixSettingsService**: CRUD, default values, upsert behavior
- **AutoFixPrService**:
  - Eligible package filtering by upgrade type config
  - License gate: deny blocks package, warn passes with warnings collected
  - Duplicate PR detection (skip packages with existing open PR)
  - Grouping strategies: per-package creates N records, per-project creates 1, per-upgrade-type creates up to 3
  - PR body builder: upgrade table, changelog inclusion when available, license warning section
- **AutoFixPrJobExecutor**:
  - Happy path: branch → upgrade → commit → push → createPr → status updated
  - Failure recovery: status set to "failed", original branch restored
  - Multi-package group: all packages upgraded in single branch
  - Dirty working tree detection
  - WS broadcast with correct counts

### Presenter tests

- Auto-fix settings in VM after load
- Settings update triggers reload
- Generate action calls use case
- PR list populated with status badges
- Running state while generation in progress

### Integration tests

- Settings CRUD route lifecycle
- Generate trigger → job enqueued
- PR list filtering by project/status

No mocks for DB — real SQLite in-memory, following project convention.
