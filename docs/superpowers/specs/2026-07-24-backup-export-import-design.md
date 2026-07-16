# Backup Export/Import

Export all projects, settings, and package data as a single JSON file so a fresh instance can import it without re-fetching from registries.

## API

### `GET /api/projects/backup`

Returns a JSON backup of the entire application state (excluding transient data).

### `POST /api/projects/backup`

Accepts the same JSON structure. Uses INSERT OR IGNORE semantics — existing data is never overwritten. Returns per-section import counts.

## Export Payload

```json
{
  "version": 1,
  "exportedAt": 1784920000000,
  "appSettings": [],
  "securitySettings": [],
  "projects": [],
  "dependencies": [],
  "registryCache": []
}
```

### Sections

**appSettings** — All rows from `app_settings`.

```json
{ "key": "branch_template", "value": "chore/update-dependencies-${YYYY}-${MM}-${DD}" }
```

**securitySettings** — All rows from `pm_security_settings`. IDs are excluded — import generates new IDs.

```json
{
  "packageManager": "pnpm",
  "configFile": "pnpm-workspace.yaml",
  "fieldName": "ignoreScripts",
  "expectedValue": "true"
}
```

**projects** — Name, path, and package manager info. IDs and timestamps (`addedAt`, `lastScannedAt`) are excluded — `registerProject` sets `addedAt` to `Date.now()` and omits `lastScannedAt` (defaults to null; project will be scanned after import).

```json
{
  "name": "di",
  "path": "/Users/brunozoric/work/webiny/di",
  "packageManager": "pnpm",
  "pmVersion": "11.0.0"
}
```

**dependencies** — Joined from `dependencies`, `dependency_versions`, and `changelogs`. Nested structure avoids separate lookup tables. `dependencies.createdAt` is excluded — set to `Date.now()` on import. Dependencies with zero versions are exported with `"versions": []`.

```json
{
  "name": "react",
  "repoUrl": "https://github.com/facebook/react",
  "versions": [
    {
      "version": "19.0.0",
      "publishedAt": 1784920000000,
      "changelog": { "content": "...", "source": "github" }
    }
  ]
}
```

Changelog handling:

- No changelog row in DB for a version: `changelog` field omitted from export. No changelog row created on import.
- Changelog row exists with `content: null`: exported as `{ "content": null, "source": "github" }` (source may also be null: `{ "content": null, "source": null }`). On import, creates a changelog row with null content (marks "fetched, nothing found").
- Changelog row exists with content: exported with full content and source (source may be null).

On import, `changelogs.fetchedAt` is set to `Date.now()`.

**registryCache** — All rows from `registry_cache`.

```json
{ "packageName": "react", "data": "{...}", "cachedAt": 1784920000000 }
```

### Excluded from export

- `upgrade_jobs` — transient work queue
- `app_logs` — operational logs
- `security_checks` — re-scan after import
- `scan_results` — re-scan after import
- `upgrade_sessions` — transient wizard state

## Import Behavior

All inserts use Drizzle's `.onConflictDoNothing()` for idiomatic SQLite conflict handling. Existing data is never overwritten.

- **appSettings**: Insert each key/value. Skip if key exists.
- **securitySettings**: Generate new ID per row. Skip on unique constraint (packageManager + configFile + fieldName).
- **projects**: Check `existsSync(path)` before registering. Register via `registerProject` helper (detects PM, generates ID). Requires `PackageManagerService` from container. Skip if path already registered. If `registerProject` throws, catch the error, increment `failed` count, and add the error message to the `errors` array. Import continues with remaining projects — one failure does not abort the batch.
- **dependencies**: For each dependency entry:
  1. Insert dependency row by name (`onConflictDoNothing`). Query back the row by name to get its `id`.
  2. For each version: insert into `dependency_versions` with the resolved `dependencyId` (`onConflictDoNothing` on depId+version unique). Query back the row to get its `id`.
  3. If version has a `changelog` field: insert into `changelogs` with `dependencyId` (from step 1), `dependencyVersionId` (from step 2), `content`, `source` (nullable), and `fetchedAt = Date.now()`. Skip on `dependencyVersionId` unique constraint.
- **registryCache**: Insert by packageName primary key. Skip if exists.

### Import Response

```json
{
  "appSettings": { "imported": 3, "skipped": 0 },
  "securitySettings": { "imported": 7, "skipped": 0 },
  "projects": { "imported": 5, "skipped": 1, "failed": 1, "errors": ["Path /foo does not exist"] },
  "dependencies": { "imported": 42, "skipped": 10 },
  "registryCache": { "imported": 100, "skipped": 5 }
}
```

## Implementation

Backend only — no UI. Two routes in a new `backupRoutes` Fastify plugin.

### Files

- `src/shared/routes/backup.ts` — route definitions + Zod schemas
- `src/api/routes/backup.ts` — route handlers (export reads all tables, import writes with conflict handling)
- `src/api/routes/__tests__/backup.test.ts` — integration tests
- Wire into `server.ts`

### Dependencies from container

- `DatabaseClient` — direct table reads/writes
- `PackageManagerService` — needed by `registerProject` for PM detection during project import

### No new services or abstractions

Export is direct DB reads. Import is direct DB writes with `onConflictDoNothing`. `registerProject` helper (at `src/api/services/registerProject.ts`) handles project registration with PM detection and ID generation.
