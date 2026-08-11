# Session Handoff — 2026-08-11 — Engines Check, Refactoring, DI Improvements

## What was done

**Refactoring (3 commits)**
- Extracted modules from 5 large files: VulnerabilityService (497 → 290), JobWorker (467 → 411), AutoFixPrService (331 → 285), ProjectListPresenter (355 → 273), pnpm lockfile Zod validation
- Added injectable factories for 4 directly-created classes: CloneManagerFactory, DirectoryScanManagerFactory, ScanStatusManagerFactory, JobExecutionContextFactory
- Refactored RouteRegistry to `{ multiple: true }` DI injection — deleted 19 dead per-route abstraction files, simplified 19 feature files

**Engines check feature (15 commits)**
- Full Node.js EOL detection across root project + all node_modules dependencies
- Shared classification: `parseEnginesNode`, `classifyNodeVersion`, `NODE_RELEASES` embedded schedule
- API: EngineService (scan/getByProject/getSummary), NodeReleaseDataService (endoflife.date API + 24h DB cache + embedded fallback), 4 routes, EngineScanJobExecutor chained in ScanJobExecutor
- CLI: `depco scan --check engines|all`, CheckEnginesStep (offline, uses embedded schedule), all 4 formatters updated (table/json/csv/sarif), exit code 1 on root EOL
- UI: EngineStatusBadge on project list, EngineStatusSection on project detail, EngineOverviewWidget on dashboard, WS auto-refresh on engine-scan:complete
- DB: node_release_data + engine_checks tables
- Config: `scan.engines.ignore`, `scan.engines.warnMaintenance`

**Bug fixes (2 commits)**
- DashboardRoute matchPath catch-all matched all paths after RouteRegistry refactor — fixed to match "/" only
- Navigate calls used `/Projects/` (capital P) while routes match `/projects/` — fixed 14 files

18 commits, 181 files changed, 230 test files, 2175 tests

## Key decisions

- RouteRegistry uses `{ multiple: true }` DI injection — routes bind to shared Route token, features just register implementations
- Engine checks CLI is fully offline (embedded NODE_RELEASES) while API side fetches from endoflife.date with DB cache
- Root EOL triggers CLI exit code 1; dependency findings and maintenance are informational only
- `warnMaintenance` config parsed but not yet consumed (dead config path, noted for future)
- node_modules walker duplicated between CLI step and API service (different context shapes; dedup candidate)

## Current state

- Branch: main, 134 commits ahead of origin (not pushed)
- Tests: 2175 passed across 230 files
- Build: passing
- Lint/format/typecheck: clean
- Working tree: clean

## What might come next

- Feature: depco doctor command
- Feature: depco scan --watch mode
- Consume `warnMaintenance` config option in CheckEnginesStep and EngineService
- Dedup node_modules walker between CLI CheckEnginesStep and API EngineService
- React props naming convention audit (IXxxProps vs XxxProps)
