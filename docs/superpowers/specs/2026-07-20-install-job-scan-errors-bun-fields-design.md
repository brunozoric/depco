# Install Job, Scan Error Surfacing, Bun Security Fields

Date: 2026-07-20

## Overview

Three features plus one bugfix:

1. **Install job type** — run PM install with options dialog, node_modules badge on project card
2. **Scan error surfacing** — warning banner + job error state when lockfile stale/missing yields 0 deps
3. **Bun security fields expansion** — 5 new bunfig.toml fields
4. **Bugfix** — add missing "Bun" tab to SecuritySettingsPage SegmentedControl

## Feature 1: Install Job Type

### PM Driver Changes

Add two methods to `IPackageManagerDriver`:

```typescript
interface IInstallFlagDefinition {
    flag: string;
    label: string;
    description: string;
    exclusive?: string; // mutex group name
}

installFlags(): IInstallFlagDefinition[];
installCommand(flags: string[]): ICommandSpec;
```

Each driver defines its allowed flags:

**NpmDriver:**

- `--omit=dev` — skip devDependencies
- `--force` — force reinstall
- `--legacy-peer-deps` — ignore peer dependency conflicts
- `--ignore-scripts` — skip lifecycle scripts

**YarnDriver:**

- `--immutable` — fail if lockfile would change (Berry; Classic equivalent: `--frozen-lockfile`)
- `--production` — skip devDependencies
- `--force` — refetch all packages
- `--ignore-scripts` — skip lifecycle scripts

Note: YarnDriver currently targets Yarn Berry (v2+). Flag names use Berry syntax. If Classic support is needed later, driver can version-detect and map flags internally.

**PnpmDriver:**

- `--frozen-lockfile` — fail if lockfile outdated
- `--prod` — skip devDependencies
- `--force` — force reinstall
- `--ignore-scripts` — skip lifecycle scripts

**BunDriver:**

- `--frozen-lockfile` — fail if lockfile outdated
- `--production` — skip devDependencies
- `--force` — force reinstall
- `--dry-run` — preview only
- `--ignore-scripts` — skip lifecycle scripts

### InstallJobExecutor

New executor, type `"install"`. Registered in `JobExecutorRegistry`.

Flow:

1. Get driver from `PackageManagerDriverRegistry` using project's PM
2. Get allowed flags via `driver.installFlags()`
3. Build Zod schema dynamically: `z.object({ flags: z.array(z.enum(allowedFlagStrings)) })`
4. Validate incoming `packagesJson` against schema — rejects unknown flags
5. Check PM binary exists: `commandRunner.run(pm, ["--version"])` — fail with "Package manager not installed" if error
6. Run `driver.installCommand(validatedFlags)` via `commandRunner.runStreaming`
7. On completion, broadcast `install:complete` with `{ projectId }` via WebSocket

Dependencies: `PackageManagerDriverRegistry`, `CommandRunner`, `WebSocketBroadcaster`.

### API Route

`POST /api/projects/:id/install` — body: `{ flags?: string[] }`

Creates install job. Returns `{ item: { jobId, status } }`.

### Install Options Endpoint

`GET /api/install-options/:packageManager` — returns `IInstallFlagDefinition[]`

UI fetches this to know which flags to render. Driver is single source of truth.

### node_modules Detection

Add `hasNodeModules: boolean` to project API responses (list and get).

Server checks `existsSync(join(projectPath, "node_modules"))` on each project fetch.

### Frontend — Install Dialog

**InstallDialog** (modal):

- Shows project name and detected PM
- Loads install options from `GET /api/install-options/:pm`
- Renders PM-specific options component based on PM id
- Confirm button calls `POST /api/projects/:id/install` with selected flags
- Cancel dismisses

**PM option components** (4 files):

- `NpmInstallOptions`
- `YarnInstallOptions`
- `PnpmInstallOptions`
- `BunInstallOptions`

Each renders Mantine `Switch` controls for its flags. All default OFF (plain install). Components receive flag definitions from API, render accordingly. Layout can vary per PM.

**Component registry:**

```typescript
const INSTALL_OPTIONS_COMPONENTS: Record<
  PackageManagerId,
  React.ComponentType<InstallOptionsProps>
> = {
  npm: NpmInstallOptions,
  yarn: YarnInstallOptions,
  pnpm: PnpmInstallOptions,
  bun: BunInstallOptions
};
```

**InstallOptionsProps interface:**

```typescript
interface InstallOptionsProps {
  flags: IInstallFlagDefinition[];
  selected: string[];
  onToggle: (flag: string) => void;
}
```

### Frontend — node_modules Badge

`IProjectListItem` gets `hasNodeModules: boolean`.

`ProjectRow` renders:

- Green `Badge` "Installed" when `hasNodeModules === true`
- Gray `Badge` "Not Installed" when `hasNodeModules === false`

Placed after Package Manager column.

### Auto-refresh After Install

- Register `install:complete` in WebSocket event types
- `ProjectListPresenter` listens for `install:complete` — calls `loadProjectsUseCase.execute()` (refreshes project list including `hasNodeModules`)
- `ProjectDetailPresenter` listens for `install:complete` — reloads project data

### Install Button Placement

- `ProjectDetailPage`: new "Install" button in action group (alongside Scan, Upgrade Selected, Refresh Transient)
- `ProjectRow` (project list): optional — add to actions column dropdown

## Feature 2: Scan Error Surfacing

### Backend

After `scanService.scan()` returns results in `ScanJobExecutor`:

1. If `results.length === 0`:
   - Read `package.json` from `context.projectPath`
   - Check if `dependencies` or `devDependencies` have entries
   - If package.json has deps but scan found 0: set `warning` on job
2. New nullable `warning` column on `upgradeJobs` table
3. Store warning text: `"Lockfile may be stale or missing — 0 dependencies found despite package.json listing dependencies. Run install to regenerate."`
4. `scan:complete` WS payload gets `warning: string | null`

### Frontend — Warning Banner

`ProjectDetailPresenter` vm gets `scanWarning: string | null`.

Sources:

- `scan:complete` WS event `warning` field
- Last scan job in history (fallback for page reload)

`ProjectDetailPage` renders Mantine `Alert` color="orange" title="Scan Warning" when `scanWarning` is set. Placed above dependency table, below security panel.

### Frontend — Job Error State

`JobProgressPanel` already shows job history. Jobs with non-null `warning`:

- Show orange "Warning" badge next to status badge
- Tooltip or expandable text shows warning message

## Feature 3: Bun Security Fields Expansion

### New Fields

Add to `BUN_SECURITY_FIELDS` in `src/shared/security/bun.ts`:

| Field                      | Config      | Type    | Default | Description                                         |
| -------------------------- | ----------- | ------- | ------- | --------------------------------------------------- |
| `install.saveTextLockfile` | bunfig.toml | boolean | true    | Save human-readable text lockfile for code review   |
| `install.production`       | bunfig.toml | boolean | false   | Skip devDependencies in production                  |
| `install.peer`             | bunfig.toml | boolean | true    | Auto-install peer dependencies                      |
| `install.optional`         | bunfig.toml | boolean | true    | Install optionalDependencies                        |
| `install.auto`             | bunfig.toml | boolean | false   | Auto-install on import (disable for strict control) |

All use same `compare` pattern as existing `install.exact`/`install.frozen`: `toBoolean(actual) === toBoolean(expected)`.

### Seed

`seedSecurityDefaults` reads from `SECURITY_FIELD_REGISTRY` and inserts any missing fields. New fields auto-seed on startup. No migration needed.

### Tests

Extend `src/shared/security/__tests__/securityFields.test.ts`:

- Each new field has compare tests (true/false/null cases)
- Verify all fields present in registry

## Bugfix: SecuritySettingsPage Missing Bun Tab

`src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx` line 70-75:

Current:

```tsx
data={[
    { label: "Yarn", value: "yarn" },
    { label: "NPM", value: "npm" },
    { label: "PNPM", value: "pnpm" }
]}
```

Fix — add:

```tsx
{ label: "Bun", value: "bun" }
```

## File Inventory

### New Files

- `src/api/services/jobExecutors/InstallJobExecutor.ts`
- `src/api/services/jobExecutors/__tests__/InstallJobExecutor.test.ts`
- `src/api/routes/installOptions.ts`
- `src/shared/routes/installOptions.ts` (route definition)
- `src/shared/install/types.ts` (IInstallFlagDefinition)
- `src/ui/presentation/projects/ProjectDetail/components/InstallDialog.tsx`
- `src/ui/presentation/projects/ProjectDetail/components/install/NpmInstallOptions.tsx`
- `src/ui/presentation/projects/ProjectDetail/components/install/YarnInstallOptions.tsx`
- `src/ui/presentation/projects/ProjectDetail/components/install/PnpmInstallOptions.tsx`
- `src/ui/presentation/projects/ProjectDetail/components/install/BunInstallOptions.tsx`
- `src/ui/presentation/projects/ProjectDetail/components/install/registry.ts`
- `src/ui/presentation/projects/ProjectDetail/useCases/InstallProjectUseCase.ts` (abstraction + implementation)

### Modified Files

- `src/api/services/packageManagers/abstractions/PackageManagerDriver.ts` — add `installFlags()`, `installCommand()`
- `src/api/services/packageManagers/NpmDriver.ts` — implement install methods
- `src/api/services/packageManagers/YarnDriver.ts` — implement install methods
- `src/api/services/packageManagers/PnpmDriver.ts` — implement install methods
- `src/api/services/packageManagers/BunDriver.ts` — implement install methods
- `src/api/services/jobExecutors/JobExecutorRegistry.ts` — register InstallJobExecutor
- `src/api/routes/index.ts` — export install route and install-options route handlers
- `src/api/feature.ts` — register InstallJobExecutor dependencies in DI container
- `src/api/server.ts` — register install route and install-options route handlers via `app.register()`
- `src/shared/websocket/types.ts` — add `install:complete` event type, add `warning` field to `scan:complete` payload
- `src/api/db/schema.ts` — add `warning` column to `upgradeJobs`
- `src/api/services/jobExecutors/ScanJobExecutor.ts` — add 0-dep warning logic
- `src/shared/security/bun.ts` — add 5 new fields
- `src/shared/routes/index.ts` — export install route and install-options route definitions
- `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts` — add `hasNodeModules`
- `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts` — listen for `install:complete`
- `src/ui/presentation/projects/ProjectList/components/ProjectRow.tsx` — render node_modules badge
- `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts` — add `scanWarning`, install method
- `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts` — implement install, scanWarning, listen for install:complete
- `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx` — add Install button, warning banner
- `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx` — add Bun tab to SegmentedControl data array, update type cast from `"yarn" | "npm" | "pnpm"` to `PackageManagerId`
- `src/ui/features/projects/abstractions/ProjectsGateway.ts` — add install method, hasNodeModules on Project
- `src/ui/features/projects/ProjectsGateway.ts` — implement install method
- `src/ui/features/projects/ProjectsRepository.ts` — hasNodeModules field
- `src/ui/presentation/jobs/JobProgress/components/JobProgressPanel.tsx` — show warning badge
- PM driver test files — add installFlags/installCommand tests

## Design Decisions

- **Flag strings match CLI flags exactly** (e.g. `--frozen-lockfile`, not `frozenLockfile`). Driver's `installCommand(flags)` passes them directly to args array after `install`.
- **`IInstallFlagDefinition` lives in `src/shared/install/types.ts`** — shared between API and UI, like security types.
- **`hasNodeModules` is computed on every fetch**, not stored in DB. Cheap fs check, always fresh.
- **Scan warning is stored in DB** (`upgradeJobs.warning`) so it survives page reload and appears in job history.

## Testing Strategy

- **Unit tests:** InstallJobExecutor (flag validation, PM binary check, command execution), each driver's installFlags/installCommand, new Bun security fields compare logic
- **Integration tests:** POST /api/projects/:id/install route, GET /api/install-options/:pm route, scan warning when 0 deps with non-empty package.json
- **Existing tests:** must continue passing (494 tests baseline)
