# Session Handoff — 2026-07-16 — Async Scan, Typed Routes, WebSocket, Multi-PM

## What was done

- **Typed routing infrastructure**: `defineRoute` + Zod schemas, `registerRoute` with preValidation, response helpers (`sendOne`/`sendList`/`sendNone`/`sendError`), `interpolatePath`, `IRequestArgs` for type-safe params/body
- **Shared route definitions**: all 16 routes defined with Zod schemas in `src/shared/routes/`, imported by both API handlers and UI gateways
- **All API routes migrated**: `registerRoute` + response envelopes, file renames (upgrades→jobs, yarn→packageManager)
- **All UI gateways migrated**: `httpClient.request(route, args)` replaces old `get`/`post`/`del`; old methods removed
- **WebSocket infrastructure**: `@fastify/websocket` plugin, `WebSocketBroadcaster` (API), `WebSocketListener` (UI) with typed events, auto-reconnect with exponential backoff
- **Async scan**: scan route enqueues job, JobWorker executes with WS progress broadcasts (`scan:progress`/`scan:complete`/`scan:failed`), results persisted to `scanResults` table, ScanCache removed
- **Multi-PM support**: `PackageManagerService` detects yarn/npm/pnpm by lockfile, dispatches PM-specific commands; replaces YarnService
- **Config-driven security**: `SecurityService` reads checks from `pmSecuritySettings` table, supports any PM; `securityChecks` table stores generic JSON results
- **PM-aware ScanService**: dispatches installed-version and workspace commands per PM (yarn/npm/pnpm parsers), `onProgress` callback for per-package progress
- **UI presenters updated**: async scan with WS-driven progress, dynamic SecurityPanel, per-project scan state (Map-keyed), JobProgressPresenter uses WS instead of polling

17 commits, 110 files changed, 5737 insertions, 1518 deletions, 219 tests (up from 155)

## Key decisions

- Scan results persist to DB (`scanResults` table), replacing in-memory `ScanCache`
- Typed routing: `defineRoute` + Zod + `registerRoute` pattern (simplified from fundus — no Result monad, no routeStore)
- WebSocket: single global connection, typed event bus (`WSEventMap`), multiple listeners per type
- Job types: `dependency`, `transient`, `packageManager` (renamed from `yarn`), `scan`
- Package manager auto-detected by lockfile presence (yarn.lock / pnpm-lock.yaml / package-lock.json)
- Security settings config-driven via `pmSecuritySettings` table (seeded with Yarn defaults)
- All routes use envelope pattern: `{item}`, `{items, total}`, `{success: true}`
- `HTTPClient` exposes only `request(route, args)` — old `get`/`post`/`del` removed
- Scan progress state is project-scoped in presenters (Map-keyed) to prevent state leaks on navigation
- JobProgressPresenter uses WS `job:status` events instead of polling

## Current state

- Branch: main
- Tests: 219 passed (29 test files)
- Build: passing (tsc clean)
- Lint/format: clean
- Unpushed commits: ~72 ahead of origin

## What might come next

- Settings UI for npm/pnpm security fields (pmSecuritySettings CRUD)
- Show scan:failed error message in UI (currently discarded)
- Playwright e2e tests
- Manual integration test (yarn dev, browser verification)
- Remove `IYarnUpgradePackage` naming remnant in JobWorker abstraction
- Consider renaming `updateYarn()` in ProjectDetailPresenter public API to `updatePackageManager()`
