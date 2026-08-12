# Changelog Resolution Improvements

## Problem

1. **Changelog count misleading** — packages page "Changelog (N)" counts all DB records including failed resolutions (`content: ""`, `source: "none"`). Clicking shows empty modal.
2. **Resolver coverage gaps** — all three existing resolvers have narrow requirements. GitHubReleasesResolver and ChangelogFileResolver both need `gh` CLI installed and authenticated. NpmReadmeResolver needs version-headings in README. Many public packages (e.g. `@11ty/gray-matter`) have a CHANGELOG.md on GitHub that none of the resolvers can reach when `gh` is unavailable.

## Solution

### Resolver Chain (new order)

```
1. GitHubReleasesResolver     (gh CLI)   — existing, fastest when gh available
2. ChangelogFileResolver      (gh CLI)   — existing, CHANGELOG.md via gh api
3. RawGitHubChangelogResolver (fetch)    — NEW: raw.githubusercontent.com, no auth, public repos only
4. GitHubHttpReleasesResolver (fetch)    — NEW: api.github.com releases, optional github_token
5. GitHubHttpFileResolver     (fetch)    — NEW: api.github.com contents, optional github_token
6. NpmReadmeResolver          (registry) — existing, last resort
```

Short-circuit stays: first resolver returning content wins. All six registered via `{ multiple: true }` DI injection in `ChangelogFeature.register()`.

**Intentional path overlap between resolvers 3 and 5:** RawGitHubChangelogResolver and GitHubHttpFileResolver search the same CHANGELOG.md paths. This is deliberate resilience — resolver 3 works without auth for public repos but fails silently on private repos. Resolver 5 authenticates via `github_token` and can access private repos. If resolver 3 fails (private repo, transient network error), resolver 5 retries the same paths with authentication. No wasted work because the short-circuit means only one resolver succeeds.

### RawGitHubChangelogResolver

Fetches `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}` via global `fetch()`. No authentication — works for public repositories only. Private repos return 404 silently; the authenticated GitHubHttpFileResolver (resolver 5) covers those.

**Input:** `packageName`, `repoUrl`, `versions`, `repoDirectory`

**Logic:**

1. `extractOwnerRepo(repoUrl)` — return empty on null/non-GitHub URL
2. Build path list (same priority as existing ChangelogFileResolver):
   - `{repoDirectory}/CHANGELOG.md` (if `repoDirectory` set)
   - `CHANGELOG.md`, `CHANGES.md`, `History.md` (root)
   - `packages/{unscoped}/CHANGELOG.md` (if scoped `@scope/name` package)
3. For each path, try branches: `main`, `master`
4. On HTTP 200, parse body with `parseVersionSections(body, versionSet)`
5. First non-empty result wins; return empty Map on all 404/error

**Dependencies:** None (uses global `fetch`). Registered as `ChangelogResolver` implementation with `dependencies: []`.

**Name:** `"raw-github-changelog"`

### GitHubHttpReleasesResolver

Same logic as existing `GitHubReleasesResolver` but uses `fetch()` instead of `gh` CLI.

**Endpoint:** `GET https://api.github.com/repos/{owner}/{repo}/releases?per_page=100`

**Auth:** Reads `github_token` from `app_settings` table, decrypts via `EncryptionService` (see Shared GitHub Token Helper below). If no token, still works for public repos (rate-limited to 60 requests/hour unauthenticated). Auth header: `Authorization: Bearer {token}`.

**Version matching:** Same as existing — strip `v` prefix (case-insensitive), handle monorepo `packageName@version` tags via `lastIndexOf('@')`.

**Response validation:** Zod schema for releases array (same `githubReleasesSchema` shape, reuse or duplicate from existing resolver).

**Dependencies:** `DatabaseClient`, `EncryptionService`.

**Name:** `"github-http-releases"`

### GitHubHttpFileResolver

Same logic as existing `ChangelogFileResolver` but uses `fetch()` instead of `gh` CLI.

**Endpoint:** `GET https://api.github.com/repos/{owner}/{repo}/contents/{path}`

**Auth:** Same as `GitHubHttpReleasesResolver` — `github_token` from `app_settings`, optional.

**Path search:** Same path priority as `ChangelogFileResolver` and `RawGitHubChangelogResolver`: `repoDirectory` paths first, root files, scoped package paths.

**Response:** Zod schema for contents response (same `githubContentsSchema` shape). Decode base64 content, parse with `parseVersionSections`.

**Dependencies:** `DatabaseClient`, `EncryptionService`.

**Name:** `"github-http-file"`

### Shared GitHub Token Helper

Both HTTP resolvers need to read and decrypt `github_token`. Extract a shared helper:

```typescript
interface IReadGitHubTokenInput {
  databaseClient: DatabaseClient.Interface;
  encryptionService: EncryptionService.Interface;
}

interface IGitHubTokenResult {
  token: string | null;
}

async function readGitHubToken(input: IReadGitHubTokenInput): Promise<IGitHubTokenResult>;
```

Located in `src/api/services/Changelog/resolvers/readGitHubToken.ts`. Reads `github_token` row from `app_settings`, decrypts via `EncryptionService`. Returns `{ token: null }` when not configured or when decryption fails — resolvers proceed without auth.

### Count Accuracy

**API packages route SQL** — the existing `LEFT JOIN` changelog subquery in `src/api/routes/packages.ts` (lines 98-106 for count query, lines 131-136 for data query) changes from a single `COUNT(*)` to two counts:

Current subquery:

```sql
LEFT JOIN (
    SELECT d.name AS dep_name, COUNT(*) AS cnt
    FROM changelogs c
    JOIN dependencies d ON c.dependency_id = d.id
    GROUP BY d.name
) cl ON cl.dep_name = sr.name
```

New subquery:

```sql
LEFT JOIN (
    SELECT d.name AS dep_name,
        COUNT(*) AS total_cnt,
        COUNT(CASE WHEN c.content IS NOT NULL AND c.content != '' AND c.source != 'none' THEN 1 END) AS resolved_cnt
    FROM changelogs c
    JOIN dependencies d ON c.dependency_id = d.id
    GROUP BY d.name
) cl ON cl.dep_name = sr.name
```

Mapped as:

- `COALESCE(cl.resolved_cnt, 0) AS resolvedChangelogCount`
- `COALESCE(cl.total_cnt, 0) AS totalChangelogCount`

This change applies to BOTH the count query (line 98) and the data query (line 131) in `packages.ts`.

**Data flow — full layer update:**

1. `src/api/routes/packages.ts` — SQL subquery + row mapping (`resolvedChangelogCount`, `totalChangelogCount`)
2. `src/shared/routes/packages.ts` — Zod schema: replace `changelogCount: z.number()` with `resolvedChangelogCount: z.number()` and `totalChangelogCount: z.number()`
3. `src/ui/features/Packages/abstractions/PackagesGateway.ts` — `IPackageListItem`: replace `changelogCount: number` with `resolvedChangelogCount: number` and `totalChangelogCount: number`
4. `src/ui/features/Packages/PackagesGateway.ts` — mapping in `list()` response
5. `src/ui/presentation/Packages/PackageList/abstractions/PackagesPresenter.ts` — `IPackageListItemViewModel`: replace `changelogCount: number` with `resolvedChangelogCount: number` and `totalChangelogCount: number`
6. `src/ui/presentation/Packages/PackageList/PackagesPresenter.ts` — mapping
7. `src/ui/presentation/Packages/PackageList/components/columns/ChangelogButton.tsx` — display logic (see below)

**ChangelogButton display logic** — currently renders static "Changelog" text. Updated to compute `pending = totalChangelogCount - resolvedChangelogCount` and render:

- `resolved > 0 && pending > 0` — `Changelog (3+2)` — "+2" in dimmed/secondary text color
- `resolved > 0 && pending === 0` — `Changelog (3)`
- `resolved === 0 && pending > 0` — `Changelog (+2)` — all pending, dimmed
- `resolved === 0 && pending === 0` — button hidden (nothing to show)

Button still hidden when `highestUpgradeType === "none"` (existing guard unchanged).

**hasChangelog filter** — existing `HAVING changelogCount > 0` changes to `HAVING total_cnt > 0` (semantics unchanged — filter means "has any changelog records").

### File Structure

```
src/api/services/Changelog/
  resolvers/
    RawGitHubChangelogResolver.ts          — NEW
    GitHubHttpReleasesResolver.ts           — NEW
    GitHubHttpFileResolver.ts               — NEW
    readGitHubToken.ts                      — NEW (shared helper)
    GitHubReleasesResolver.ts               — existing, unchanged
    ChangelogFileResolver.ts                — existing, unchanged
    NpmReadmeResolver.ts                    — existing, unchanged
  feature.ts                               — register 3 new resolvers
  __tests__/
    RawGitHubChangelogResolver.test.ts      — NEW
    GitHubHttpReleasesResolver.test.ts       — NEW
    GitHubHttpFileResolver.test.ts           — NEW
    readGitHubToken.test.ts                  — NEW

src/api/routes/packages.ts                 — SQL count changes (both count + data queries)
src/shared/routes/packages.ts              — schema update (two count fields)
src/ui/features/Packages/
  abstractions/PackagesGateway.ts          — interface update (two count fields)
  PackagesGateway.ts                       — mapping update
src/ui/presentation/Packages/PackageList/
  abstractions/PackagesPresenter.ts        — view model update (two count fields)
  PackagesPresenter.ts                     — mapping update
  components/columns/ChangelogButton.tsx   — display logic with resolved/pending counts
```

### Testing

- **RawGitHubChangelogResolver** — mock global `fetch`. Test: branch fallback (`main` then `master`), path priority order, `repoDirectory` first, 404 handling, scoped package path, `parseVersionSections` integration, null `repoUrl` early exit, non-GitHub URL early exit
- **GitHubHttpReleasesResolver** — mock `fetch`. Test: with token (auth header set), without token (no header), version matching (`v3.0.0`, `packageName@3.0.0`), rate limit error handling, empty releases array, Zod validation of response
- **GitHubHttpFileResolver** — mock `fetch`. Test: base64 decode, path search order, token auth, 404 fallthrough, private repo with token succeeds
- **readGitHubToken** — mock `DatabaseClient` + `EncryptionService`. Test: token found and decrypted, no token configured returns `{ token: null }`, decryption error returns `{ token: null }`
- **Count accuracy** — extend existing packages route tests. Seed changelogs with mixed states (content with text, content empty string with source "none", content null). Assert `resolvedChangelogCount` and `totalChangelogCount` values. Verify `hasChangelog` filter uses `totalChangelogCount`.
- **ChangelogButton** — unit test display logic for all 4 count combinations (resolved+pending, resolved-only, pending-only, neither)

### Error Handling

All new resolvers follow existing pattern: never throw, return empty `Map` on any error. `fetch` failures, JSON parse errors, Zod validation failures — all caught and return empty. Logging via `Logger.warn` for unexpected errors (network timeouts, malformed responses).

Rate limit responses from GitHub API (HTTP 403 with `X-RateLimit-Remaining: 0`) treated as failures — resolver returns empty, next resolver in chain tries. No retry/backoff within a single resolver — the chain itself provides fallback coverage. Rate-limited authenticated resolvers (4, 5) will also fail if the token's rate limit is exhausted, but resolver 3 (unauthenticated raw GitHub) has a separate rate limit pool.
