# Normalized Dependency Schema

Refactor from single `changelogs` table (packageName+version keyed) to three normalized tables: `dependencies`, `dependencyVersions`, `changelogs`. Enables global package registry for the upcoming packages page and cleaner data model for changelog access.

## Schema

### dependencies

Global package registry. One row per unique package name across all projects.

```sql
CREATE TABLE dependencies (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    repo_url TEXT,
    created_at INTEGER NOT NULL
);
```

Populated during scan. `repoUrl` updated on re-scan if package moves repos.

### dependencyVersions

All known versions per package. Only upgradeable versions that pass the age gate are stored (not all versions from npm registry).

```sql
CREATE TABLE dependency_versions (
    id TEXT PRIMARY KEY NOT NULL,
    dependency_id TEXT NOT NULL REFERENCES dependencies(id),
    version TEXT NOT NULL,
    published_at INTEGER
);
CREATE UNIQUE INDEX dep_versions_dep_version_unique ON dependency_versions (dependency_id, version);
```

Populated during scan alongside changelog placeholders. `publishedAt` from registry `time` data (epoch ms, nullable if time data unavailable).

### changelogs

One changelog per dependency version. One-to-one with `dependencyVersions` via unique FK. Denormalized `dependencyId` for direct queries without joining through `dependencyVersions`.

```sql
CREATE TABLE changelogs (
    id TEXT PRIMARY KEY NOT NULL,
    dependency_id TEXT NOT NULL REFERENCES dependencies(id),
    dependency_version_id TEXT NOT NULL UNIQUE REFERENCES dependency_versions(id),
    content TEXT,
    source TEXT,
    fetched_at INTEGER
);
```

`content = null` means not yet fetched. Empty string means fetched, nothing found.

## Migration

Use `drizzle-kit generate` after updating schema.ts — it produces the SQL migration file and snapshot metadata automatically. Expected output: `0006_normalized_dependencies.sql` (or similar drizzle-generated name).

Content:

1. Drop old `changelogs` table (no data to preserve — feature just built, no users)
2. Create `dependencies`, `dependency_versions`, `changelogs` tables

Note: migration numbering is 0006 because 0005 created the old changelogs table. No concurrency concerns — single-threaded Node.js with single SQLite connection.

## Scan Integration Changes

`ScanJobExecutor.insertChangelogPlaceholders` currently inserts directly into `changelogs` with `packageName` + `version`. Refactor to:

1. For each upgradeable package: upsert into `dependencies` (insert if name not exists, update `repoUrl` if changed)
2. For each upgradeable version: upsert into `dependencyVersions` (insert if `dependencyId + version` not exists, set `publishedAt` from registry time data)
3. For each new `dependencyVersion` row: insert into `changelogs` with `dependencyId`, `dependencyVersionId`, `content = null`

Upsert pattern for `dependencies`: insert with `ON CONFLICT(name) DO UPDATE SET repo_url = excluded.repo_url`. Returns the `id` either way.

Upsert pattern for `dependencyVersions`: insert with `ON CONFLICT(dependency_id, version) DO NOTHING`. Query after to get the `id`.

Changelog insert: only for versions that don't already have a `changelogs` row (check by `dependencyVersionId`).

## ChangelogService Changes

### resolve(packageName)

Currently: queries `changelogs WHERE packageName = X AND content IS NULL`.

New:

1. Query `dependencies WHERE name = packageName` to get `dependencyId` and `repoUrl`
2. Query `changelogs WHERE dependencyId = X AND content IS NULL` joined with `dependencyVersions` to get version strings
3. Run resolver chain (unchanged — still takes `packageName`, `repoUrl`, `versions[]`)
4. Update `changelogs` rows by `id` where `content IS NULL`

### getChangelogs(packageName, from, to)

Currently: queries `changelogs WHERE packageName = X`, filters by version range.

New:

1. Query `dependencies WHERE name = packageName` to get `dependencyId`
2. Query `changelogs WHERE dependencyId = X` joined with `dependencyVersions` for version string and ordering
3. Filter by version range using `dependencyVersions.version`
4. Return same shape: `{ version, content, source }`

## API Route Changes

`GET /api/changelogs/:packageName?from=X&to=Y` — external contract unchanged. Internal queries use new tables.

## Query Patterns Enabled

Three independent access paths on `changelogs`:

- **All changelogs for a package:** `WHERE dependencyId = X`
- **Single version changelog:** `WHERE dependencyVersionId = X`
- **Filtered by version range:** `WHERE dependencyId = X` + join `dependencyVersions` for version filter

No multi-table join needed for common "get all changelogs for a package" case.

## Files Changed

```
src/
  api/
    db/
      schema.ts                                    -- replace changelogs, add dependencies + dependencyVersions
      migrations/0006_normalized_dependencies.sql   -- drop + create
    services/
      ChangelogService.ts                          -- query changes
      jobExecutors/ScanJobExecutor.ts              -- upsert into 3 tables instead of 1
    routes/
      changelogs.ts                                -- internal query changes (if any)
    services/__tests__/
      ChangelogService.test.ts                     -- update for new schema
    services/jobExecutors/__tests__/
      ScanJobExecutor.test.ts                      -- update for new schema
    routes/__tests__/
      changelogs.test.ts                           -- update for new schema
  testing/
    helpers/createTestDb.ts                        -- add new tables to in-memory test DB
```

## Constraints

- External API contract unchanged — no UI changes needed
- Resolver chain unchanged — still receives `packageName`, `repoUrl`, `versions[]`
- Old changelogs table dropped entirely (no data migration — feature has zero users)
- Same `content = null` / empty string semantics for fetch status
- `generateId()` from `@webiny/stdlib` for all new row IDs
- Upsert pattern uses Drizzle's `onConflictDoUpdate` / `onConflictDoNothing`
