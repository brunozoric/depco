# Session Handoff — 2026-07-21 — Changelogs, Packages Page, Schema Normalization

## What was done

- **Install button on project list** — reusable InstallDialog, auto-scan after install completes (chainScanAfterInstall in JobWorker), "install" added to ICreateJobInput type union, install route refactored to use JobWorker.enqueue
- **Security tooltip on project list** — hover shows per-check pass/fail breakdown
- **Minimal age gate enforcement** — scan respects configured age threshold, version publish timestamps (time field) cached in registry, ScanJobExecutor reads gate from pmSecuritySettings, added minimal-age-gate field to npm and pnpm security definitions
- **Folder browser improvements** — browse starts at process.cwd() instead of root, multi-select for batch project adding, selected rows get light blue background
- **Changelog feature** — on-demand changelog viewing for dependencies
  - Normalized DB schema: dependencies, dependencyVersions, changelogs (3 tables replacing 1)
  - Resolver chain: GitHubReleasesResolver (gh CLI), ChangelogFileResolver (CHANGELOG.md), NpmReadmeResolver
  - ChangelogService orchestrates resolvers, caches results, update guard (content IS NULL only)
  - API: GET /api/changelogs/:packageName?from=X&to=Y
  - UI: ChangelogModal with react-markdown accordion, Changelog button on DependencyTable
  - Registry info: repoUrl + readme extracted from npm view JSON, cached
- **Packages page** — global /packages route
  - API: GET /api/packages with SQL aggregation (json_group_array/json_object), pagination (LIMIT/OFFSET), sorting (name, lastPublishedAt), filters (search, upgradeType, projectId, hasChangelog)
  - Full MVP stack: PackagesGateway, PackagesRepository, LoadPackagesUseCase, PackagesPresenter (debounced search, sort toggle), PackagesPage
  - Reuses ChangelogModal from ProjectDetail
  - Nav link added alongside Jobs, Settings
- **Project rename** — Dependency Upgrader renamed to Dependency Manager
- 27 commits, 568 tests (up from 526), 51 test files

## Key decisions

- Changelogs use `gh api` via CommandRunner — leverages user's existing GitHub CLI auth, no token management
- Resolvers never throw — return empty Map, chain continues
- Version ordering uses registry's versions array (publish order), not semver comparison
- Changelog content immutable once fetched: update guard writes only content IS NULL rows
- Normalized schema: denormalized dependencyId on changelogs for direct queries without joining through dependencyVersions
- Packages page uses SQL aggregation (json_group_array), not JS-side dedup
- Pagination server-side with separate COUNT query for accurate total

## Current state

- Branch: main, 14 commits ahead of origin (not pushed)
- Tests: 568 passed (51 files)
- Build: passing
- Lint/format/adio: all clean
- Unpushed commits: 14

## What might come next

1. Manual UI testing of packages page end-to-end (search, filters, pagination, sorting, changelog modal)
2. Manual UI testing of changelog feature on project detail (scan a project, click Changelog button)
3. Push to origin (~14 commits)
4. Packages page spec has an outdated constraint ("Package deduplication via JS aggregation") — already fixed in implementation
5. Add more changelog resolvers (GitLab, Bitbucket)
6. Changelog fetch progress indicator (currently no feedback during on-demand fetch)
7. Batch changelog pre-fetch after scan (background job)
8. Package detail page (click package name to see full version history + changelogs)
