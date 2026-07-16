# Session Handoff — 2026-07-16 — Scan fixes, bulk actions, async scan design

## What was done

- Fixed scan to read ALL workspace dependencies (not just root package.json) using `yarn workspaces list --json` + each workspace's `package.json`
- Added concurrent registry lookups (batches of 10) with in-flight dedup in RegistryCacheService
- Filtered out already-up-to-date deps from scan results
- Made scan non-blocking in UI (separate `loading` vs `scanning` states)
- Added bulk actions dropdown on project list: "Scan All", "Refresh All Security"
- Fixed security flow: `GET /security` reads from DB, `POST /security` runs fresh check, scan route runs security as side effect, project creation triggers security check
- Designed and wrote full spec + 15-task implementation plan for: async scan via JobWorker, typed routes (defineRoute/Zod shared schemas), WebSocket event bus, multi-PM support (npm/yarn/pnpm)
- Plan reviewed by Fable 5 model — 4 blockers and 12 warnings found and fixed
- 3 commits, 155 tests passing

## Key decisions

- `yarn info --all --json` provides ALL installed packages; workspace `package.json` files provide dep/devDep type classification
- Security check is a side effect of scan, not a separate UI call on every page load
- Scan results will be persisted to DB (new `scan_results` table) replacing in-memory ScanCache
- Full fundus routing pattern adopted: defineRoute + registerRoute + Zod schemas + sendOne/sendList/sendNone + typed HTTPClient.request()
- WebSocket: single global connection, typed event bus with `Map<type, Set<callback>>` for multiple listeners per type
- Job types: `dependency`, `transient`, `packageManager` (renamed from `yarn`), `scan`
- Package manager auto-detected on project creation by lockfile presence
- Security settings become config-driven via `pmSecuritySettings` DB table (seeded with Yarn defaults)
- All existing routes migrated to new pattern in same change

## Current state

- Branch: main
- Tests: 155 passed
- Build: passing
- Lint/format: passing
- Unpushed commits: 54 (51 from prior session + 3 from this session)

## What might come next

- Execute the 15-task implementation plan (subagent-driven recommended)
- Task 1: install @fastify/websocket
- Task 2: shared routing infrastructure
- Task 3: DB schema changes
- ...through Task 15: final cleanup
- After plan execution: settings UI for npm/pnpm security fields (deferred)
- After plan execution: browser end-to-end testing with Playwright
