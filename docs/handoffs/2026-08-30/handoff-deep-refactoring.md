# Session Handoff — 2026-08-30 — Deep Refactoring

## What was done

Comprehensive codebase cleanup, optimization, and modernization across 15 commits and 320+ files.

### Code quality
- Extracted ~90 inline structural types into named interfaces across the entire codebase
- Fixed 4 file separation violations (abstraction + implementation mixed)
- Replaced all `.parse()` with `.safeParse()` in 8+ files
- Created `formatZodError()` shared helper, replaced 16 `JSON.stringify(error.issues)` sites
- Replaced 16 inline `error instanceof Error` checks with `getErrorMessage()`
- Fixed unsafe non-null assertions in 7 files
- Fixed VulnerabilityDetailPresenter MobX config inconsistency
- Used `HOUR_MS` instead of magic `3600 * 1000` in 2 files
- Fixed O(n²) string building in JobExecutionContext (array + join)
- Fixed `process.exit(0)` on prompt cancellation → exit code 130

### Performance
- Eliminated N+1 queries in ImportBackupUseCase, packageScanHelpers, ListProjectsUseCase, BulkScanProjectsUseCase
- Added bulk `getLatestForProjects()` method to SecurityService
- Map pre-indexing in ExportBackupUseCase (O(D×V×C) → O(D+V+C))
- Added maxDepth/maxPaths limits to DependencyGraphService.findPaths BFS

### Shared module extraction (18 new modules)
- `shared/validation.ts` — formatZodError
- `shared/pagination.ts` — DEFAULT_PAGE_SIZES, computeTotalPages
- `shared/jobs/constants.ts` — TERMINAL_JOB_STATUSES
- `shared/versions/compareVersions.ts` — shared across API + UI
- `shared/routing/paginationSchema.ts` — reusable Zod pagination fields
- `shared/routing/handleResultError.ts` — shared error handling for send helpers
- `ui/infrastructure/Shared/formatting/` — dateFormatters, datetimeConverters, truncate, formatFieldName
- `ui/infrastructure/Shared/upgrades/upgradeBadgeColors.ts`
- `ui/presentation/Vulnerabilities/shared/computeDismissLabel.ts`
- `api/services/Changelog/resolvers/changelogPaths.ts` — monorepo heuristics
- `api/services/Changelog/schemas.ts` — shared Zod schemas
- `shared/security/comparators.ts` — booleanCompare, existsCompare, etc.
- `api/routes/types.ts` — shared IPluginOptions (was in 27 files)

### Deduplication
- IUnexpectedError removed from 68 local redefinitions → import from shared
- projectNotFoundError() factory replaces 21 inline Result.fail() literals
- PluginOptions extracted from 27 route files
- Security comparators extracted (17 inline copies → 3 named functions)
- Root package.json parsing extracted for 4 lockfile parsers
- jobHandleResponseSchema extracted (6 occurrences → 1)
- githubReleasesSchema + githubContentsSchema extracted
- cleanQuery migration (11 gateways)
- z.infer replaces 3 manual gateway type redeclarations

### Architecture
- Created PromptService abstraction (library-agnostic CLI prompts)
- Swapped @inquirer/prompts → @clack/prompts via the abstraction
- Decomposed ImportBackupUseCase.execute() (180 lines → 6 private methods)
- Decomposed createServer() (189 lines → registerAllRoutes + startBackgroundTimers)
- Expanded changelog monorepo path heuristics (packages/libs/apps/modules/plugins)

### CI/CD
- Added NPM_TOKEN gate on publish workflow (two-job design, skips gracefully)
- Tightened scorecard permissions (read-all → {})
- Added concurrency groups to codeql + pr-title workflows
- Updated codeql-action v3 → v4.37.9
- Added harden-runner to publish check-secrets job
- All 19 action references SHA-pinned with version comments

### Testing
- 20 new tests (401 files, 2776 tests total, was 399/2756)
- changelogPaths tests (7 tests for monorepo heuristics)
- ClackPromptService tests (8 tests including cancellation)
- N+1 fix integration tests (Export/Import/ListProjects)
- jscpd: 3.64% duplication (remaining clones are structural DI patterns)

## Key decisions

- **No event sourcing for jobs** — linear lifecycle (pending→running→terminal) doesn't warrant it. WebSocket broadcasts + logs provide sufficient audit trail for a single-server app.
- **oxlint can't enforce safeParse/getErrorMessage** — no `no-restricted-syntax` support. Conventions enforced by code review.
- **DashboardGateway not split** — 274 lines is 80% type definitions, only 17 lines of interface. Added section comments instead.
- **cleanQuery/cleanQueryRecord return undefined when empty** — matches original behavior (no-filter → undefined, not {})
- **PromptService validates undefined → ""** — clack passes undefined for empty input, coercing to "" is correct for string validators

## Current state

- Branch: main
- Tests: 401 files, 2776 tests pass
- Build: passing
- Unpushed commits: 15

## What might come next

- `depco doctor` CLI command (diagnostics/health check)
- Smoke test in CI (pack + install + depco --help)
- Set up NPM_TOKEN secret in GitHub repo
- Create initial changeset for 0.0.1 release
- Consider lazy-loading route modules in registerAllRoutes
