# Changelog Feature

On-demand changelog viewing for upgradeable dependencies. Users click a "Changelog" button on a dependency row to see version-by-version release notes in an accordion modal.

## Database

Single `changelogs` table. One row per package+version. `content = null` means "not yet fetched". Empty string means "fetched, nothing found".

```sql
CREATE TABLE changelogs (
    id TEXT PRIMARY KEY NOT NULL,
    package_name TEXT NOT NULL,
    version TEXT NOT NULL,
    repo_url TEXT,
    content TEXT,
    source TEXT,
    fetched_at INTEGER
);
CREATE UNIQUE INDEX changelogs_package_version_unique ON changelogs (package_name, version);
```

Migration: `0005_changelogs.sql`. Drizzle schema in `src/api/db/schema.ts`.

## Registry Data

Add `repoUrl: string | null` and `readme: string | null` to `IRegistryPackageInfo` and `IRegistryCachePackageInfo`.

All 4 drivers extract `repoUrl` from npm view JSON `repository` field. Normalize to `https://github.com/{owner}/{repo}` format:

- Object form: `{ type: "git", url: "git+https://github.com/org/repo.git" }` — strip `git+` prefix and `.git` suffix
- String form: `"https://github.com/org/repo"` — use directly
- Non-GitHub or missing: store `null`

`readme` extracted from npm view JSON `readme` field. Used by `NpmReadmeResolver`.

Both fields cached in `registryCache.data` JSON alongside existing fields. Updated on re-fetch.

Backward compatibility: existing cached entries lack these fields. Parsing uses `?? null` fallback — same pattern as `time` field addition. No migration needed for cache; stale entries re-fetched on TTL expiry or force scan.

## Scan Integration

`ScanService.scan()` return type expands. Currently returns `Dependency[]`. New return shape:

```typescript
interface IScanResult {
  dependencies: IScanServiceDependency[];
  registryData: Map<
    string,
    {
      versions: string[];
      repoUrl: string | null;
      time: Record<string, string>;
    }
  >;
}
```

The `time` field is included so `ScanJobExecutor` can filter changelog versions by age gate without re-querying the registry cache.

`ScanJobExecutor` must update all call sites: `results.dependencies` instead of `results` directly (affects `results.length`, iteration, and DB insert).

`ScanJobExecutor` uses `registryData` after persisting scan results to insert changelog placeholder rows:

1. For each upgradeable package, get all versions from `registryData.versions` between `currentVersion` (exclusive) and `latestVersion` (inclusive)
2. Filter by age gate if active (use `time` data from `registryData`)
3. Query `changelogs` for highest stored version for that package
4. Insert only versions above the highest stored version
5. Set `repoUrl` from registry data, `content = null`

Re-scans only insert truly new versions. Existing rows (fetched or not) are untouched.

### Version Comparison

Version ordering uses the existing `versions` array from the registry, which npm returns in publish order (oldest first). To find versions between `currentVersion` and `latestVersion`:

1. Find the index of `currentVersion` in the `versions` array
2. Find the index of `latestVersion`
3. Slice the array between those indices (exclusive of current, inclusive of latest)

This avoids needing a semver library — the registry's own ordering is authoritative. If `currentVersion` is not found in the array (e.g., yanked), start from the beginning.

## Resolver Chain

`IChangelogResolver` interface:

```typescript
interface IChangelogResolver {
  readonly name: string;
  resolve(
    packageName: string,
    repoUrl: string | null,
    versions: string[]
  ): Promise<Map<string, string>>;
}
```

Returns `Map<version, markdownContent>`. Only includes versions it found content for. Returns empty Map on failure (never throws).

`ChangelogService` runs resolvers in order, first that returns a non-empty Map wins:

### 1. GitHubReleasesResolver

- Requires `repoUrl` (non-null, GitHub) and `gh` CLI installed
- Check: run `gh --version` via CommandRunner; if it fails, return empty Map (skip silently)
- Runs: `gh api repos/{owner}/{repo}/releases --paginate`
- Parses JSON response, matches releases to requested versions by tag name (strips `v` prefix, case-insensitive)
- Returns `body` field (markdown) for matched versions
- On any CommandRunner error: return empty Map (chain continues to next resolver)

### 2. ChangelogFileResolver

- Requires `repoUrl` (non-null, GitHub) and `gh` CLI installed
- Same `gh` availability check as above
- Tries files in order: `CHANGELOG.md`, `CHANGES.md`, `History.md` — first found wins
- Runs: `gh api repos/{owner}/{repo}/contents/{filename}`
- Decodes base64 content
- Parses by version headings using regex: `/^#{1,2}\s+\[?v?(\d+\.\d+\.\d+[^\]]*)\]?/im`
  - Matches: `## [1.2.3]`, `## 1.2.3`, `# v1.2.3`, `## [1.2.3-beta.1]`
  - Content between two headings = that version's changelog
- Returns parsed sections for matched versions
- On any error: return empty Map

### 3. NpmReadmeResolver

- No external dependencies — reads `readme` field from registry cache data
- NpmReadmeResolver receives readme content as parameter (ChangelogService reads it from cache and passes it)
- Attempts to parse version sections using same heading regex as ChangelogFileResolver
- Returns matched versions
- On any error: return empty Map

### Error Handling and Partial Failure

Each resolver returns only what it found — never throws. If a resolver partially succeeds (e.g., GitHub API returns some releases but pagination fails), it returns what it got. `ChangelogService` proceeds with whatever content was found.

After the winning resolver returns, `ChangelogService` bulk-updates DB rows:

- Matched versions: set `content`, `source = resolver.name`, `fetchedAt = Date.now()`
- Unmatched versions (no resolver found content): set `content = ""`, `source = "none"`, `fetchedAt = Date.now()`

Update guard: only update rows where `content IS NULL`. Rows with non-null content (already fetched) are never overwritten.

## API

```
GET /api/changelogs/:packageName?from=<version>&to=<version>
```

Both `from` and `to` are required query params. Validated as non-empty strings. No semver validation — just used to filter DB rows. If no rows match the range, return empty array (not an error).

Response:

```typescript
{
  items: Array<{
    version: string;
    content: string | null;
    source: string | null;
  }>;
  total: number;
}
```

Flow:

1. Query `changelogs` for `packageName` where version in range `(from, to]` (using the `versions` array ordering from registry cache for range filtering)
2. If any rows have `content IS NULL`, run `ChangelogService.resolve()` for that package (fetches all unfetched versions at once, not just the requested range)
3. Re-query and return updated rows
4. If resolver fails entirely, rows still have `content = ""` after the attempt — returned as-is

First request triggers fetch. Subsequent requests serve from DB.

Route defined in `src/shared/routes/changelogs.ts`. Handler in `src/api/routes/changelogs.ts`.

## UI

### DependencyTable

- Add "Changelog" button (ActionIcon or Button) to each dependency row
- Disabled if no upgradeable versions

### ChangelogModal

- Plain React component (useState), not MobX observer
- Props: `opened`, `onClose`, `packageName`, `currentVersion`, `latestVersion`, `getChangelogs` callback
- On open: calls `getChangelogs(packageName, currentVersion, latestVersion)`
- Loading state while fetching
- Mantine Accordion with one item per version (newest first)
- Item label: version number + source badge
- Item body: `react-markdown` rendered content
- "No changelog available" for versions with empty content

### ProjectDetailPresenter

- New method: `getChangelogs(packageName: string, from: string, to: string): Promise<ChangelogEntry[]>`
- Delegates to `ProjectsGateway.getChangelogs()`

### ProjectsGateway

- New method: `getChangelogs(packageName: string, from: string, to: string): Promise<ChangelogEntry[]>`
- Calls `GET /api/changelogs/:packageName?from=X&to=Y`

### New dependency

- `react-markdown` for rendering changelog markdown in the modal

## File Structure

```
src/
  api/
    db/
      schema.ts                    -- add changelogs table
      migrations/0005_changelogs.sql
    routes/
      changelogs.ts                -- GET /api/changelogs/:packageName
    services/
      ChangelogService.ts          -- resolver orchestration + DB ops
      abstractions/
        ChangelogService.ts        -- interface
      changelogResolvers/
        abstractions/
          ChangelogResolver.ts     -- IChangelogResolver interface
        GitHubReleasesResolver.ts
        ChangelogFileResolver.ts
        NpmReadmeResolver.ts
  shared/
    routes/
      changelogs.ts                -- route definition
  ui/
    presentation/
      projects/
        ProjectDetail/
          components/
            ChangelogModal.tsx     -- accordion modal with react-markdown
```

## Constraints

- Only store versions that pass the minimal age gate
- Resolver chain uses `gh` CLI with user's existing auth (no token management)
- Resolvers never throw — return empty Map on failure, chain continues to next
- repoUrl is updatable on re-fetch (package can move repos)
- Changelog content is immutable once fetched: update guard in ChangelogService only writes rows where `content IS NULL`
- Version ordering uses registry's `versions` array (publish order), not semver comparison
