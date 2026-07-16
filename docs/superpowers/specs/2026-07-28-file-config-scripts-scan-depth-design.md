# File Config, Package.json Scripts, Smart Scan Depth

## Overview

Three features extending existing systems: (1) `.dependency-upgrader.json` file-based config for step hooks, (2) package.json script discovery for step hook suggestions, (3) workspace-aware configurable scan depth.

## Feature 1: File-Based Config (`.dependency-upgrader.json`)

### Config File Format

Located at project root. Top-level object, extensible for future settings.

```json
{
  "stepHooks": [
    {
      "position": "pre:upgrade",
      "name": "Lint check",
      "command": "yarn lint",
      "executionType": "command",
      "required": true
    },
    {
      "position": "post:upgrade",
      "name": "Run tests",
      "command": "yarn test",
      "executionType": "command",
      "required": false
    }
  ]
}
```

Each entry in `stepHooks`:

- `position`: `"pre:<step>"` or `"post:<step>"` (e.g. `"pre:upgrade"`, `"post:commit"`)
- `name`: display name
- `command`: shell command to run
- `executionType`: `"command"` | `"script"` | `"package-script"`
- `required`: boolean — whether failure blocks the upgrade

### Backend

**New service: `FileConfigService`**

- Abstraction: `src/api/services/abstractions/FileConfigService.ts`
- Implementation: `src/api/services/FileConfigService.ts`
- Reads `.dependency-upgrader.json` from project path
- Validates with zod schema
- Returns typed config object (step hooks array, extensible for future fields)
- Returns `null` when file doesn't exist
- Throws on malformed JSON or schema validation failure — caller (StepHookService) catches and propagates as API error with descriptive message

**StepHookService changes:**

- Add `FileConfigService` as dependency
- `getStepConfig` logic:
  - Call `FileConfigService.readConfig(projectPath)`
  - If config file exists with `stepHooks` → return file hooks with `source: "file"`, ignore DB hooks
  - If no config file → return DB hooks as today
- File takes precedence over DB — no merging

### UI Behavior

When config file detected (step hooks config page):

- Hooks displayed as read-only list
- Banner: "Step hooks managed by .dependency-upgrader.json"
- Create/edit/delete buttons hidden
- File removal reverts UI to DB-driven editable mode

Detection: step hooks list API response includes `configSource: "db" | "file"` field. UI uses this to determine read-only state — no inference needed.

## Feature 2: Package.json Script Discovery

### Backend

**New service: `PackageJsonService`**

- Abstraction: `src/api/services/abstractions/PackageJsonService.ts`
- Implementation: `src/api/services/PackageJsonService.ts`
- Reads `package.json` from project path, extracts `scripts` object
- Returns array of discovered scripts: `{ name: string; command: string }[]`
- Returns empty array when no package.json or no scripts

Scripts are a **discovery mechanism**, not auto-execution. Some scripts need additional arguments (e.g. `yarn test:sql packages/api-headless-cms`) so they cannot run blindly.

### API

Extend step hooks list endpoint (`listStepHooksRoute` in `src/shared/routes/stepHooks.ts`) response schema:

- `items`: configured step hooks (from DB or file) — existing field
- `discoveredScripts`: `z.array(z.object({ name: z.string(), command: z.string() }))` — package.json scripts
- `configSource`: `z.enum(["db", "file"])` — tells UI whether hooks are editable

Backend handler returns both configured hooks and discovered scripts in one response. UI uses `configSource` to determine editability. Backend filters `discoveredScripts` to exclude scripts whose name already matches a configured hook — dedup happens server-side so UI doesn't need to cross-reference.

### UI Flow

Step hooks config page:

- Below configured hooks, a "Detected from package.json" section
- Read-only list of discovered scripts
- Each script has an "Add as hook" button
- Clicking opens step hook form pre-filled with script data
- User can edit command to append arguments before saving
- Once added, it's a regular DB step hook with `source: "package-json"` for traceability
- Discovered scripts list updates on page load (always reads fresh from package.json)
- Already-added scripts filtered out server-side (not returned in `discoveredScripts`)
- When config file is active (`configSource: "file"`), "Add as hook" buttons disabled with tooltip: "Hooks managed by config file — add scripts directly to .dependency-upgrader.json"

## Feature 3: Smart Scan Depth

### Backend — Enhanced Scan Endpoint

Add `depth` query param to `scanFilesystemRoute`:

- Type: integer, default: 1, max: 5
- Values > 5 silently clamped to 5
- Backwards compatible — depth 1 = current behavior

Route schema changes (`src/shared/routes/filesystem.ts`):

- Querystring: add `depth: z.coerce.number().int().min(1).max(5).optional().default(1)`
- Response: add `mode: z.enum(["workspaces", "depth"])`

Scan logic:

1. Check `package.json` at scanned path for `workspaces` field
2. If workspaces found → resolve workspace globs using same pattern as `collectWorkspacesFromPackageJson` (returns `IWorkspaceEntry[]` with `location` field). Map each entry to `{ name, path }` shape needed by scan response. Depth param ignored.
3. If workspaces field exists but all globs resolve to directories without `package.json` → fall back to depth scan
4. If no workspaces field → recurse subdirectories up to `depth` levels. Skip `node_modules`, `.git`, hidden dirs.

Response:

- Add `mode: "workspaces" | "depth"` field so UI knows which strategy was used
- Existing fields unchanged: `items`, `total`, `scannedPath`, `scannedCount`, `filteredCount`
- Existing dedup against registered projects stays

### Edge Cases

- Workspace globs resolving to nothing → fall back to depth scan
- Nested workspaces (workspace package has own workspaces field) → not followed, single-level resolution only
- Depth 1 = current behavior, fully backwards compatible

### UI — Scan Tab Changes

- Depth input: number stepper, range 1-5, default 1
- After scan completes, indicator of which mode was used: "Resolved from workspaces" or "Scanned to depth N"
- Results display unchanged — same project list with checkboxes

## Testing Strategy

### FileConfigService

- File exists with valid config → returns parsed hooks
- File exists with invalid schema → throws validation error
- File doesn't exist → returns null
- Malformed JSON → throws parse error

### PackageJsonService

- Package.json with scripts → returns script list
- Package.json without scripts → returns empty array
- No package.json → returns empty array

### StepHookService Integration

- Config file present → file hooks returned, DB ignored
- No config file → DB hooks returned
- Package.json scripts always discoverable regardless of config source

### Scan Endpoint

- Directory with workspace package.json → resolves workspaces, ignores depth
- Directory without workspaces → recurses to specified depth
- Depth defaults to 1 when not specified
- Depth capped at 5
- Empty workspace resolution → falls back to depth scan
- Existing project dedup works at all depths
