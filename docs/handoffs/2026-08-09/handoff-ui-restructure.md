# Session Handoff — 2026-08-09 — UI Architecture Restructure

## What was done

- Renamed all 24 `src/ui/features/` subfolders from camelCase to PascalCase (e.g., `autoFix` -> `AutoFix`)
- Renamed all 19 `src/ui/presentation/` subfolders from camelCase to PascalCase
- Updated ~550 import paths across the codebase (both `#ui/` alias paths and relative cross-folder imports)
- Created `src/ui/presentation/feature.ts` — PresentationFeature compositor that composes all 40 presentation sub-features into one feature
- Simplified `App.tsx`: ALL_FEATURES reduced from 63 entries to 1, import section from 135 lines to 75
- All data and infrastructure features are pulled in transitively through the dependency chain — only PresentationFeature needs to be listed
- Updated AGENTS.md with new PascalCase folder names and PresentationFeature documentation
- Updated dependencies (@fastify/compress, better-sqlite3, tsx)
- Shifted database dates from 2026-08-09 to 2026-08-08 per user request
- 5 commits on branch, squash-merged as PR #5
- 1923 tests passing across 186 files

## Key decisions

- Namespace types are the convention for accessing service types (e.g., `AuthService.SessionUser`), so explicit `export type { ISessionUser }` re-exports in index.ts are unnecessary
- PascalCase folder naming applies to domain subfolders within `features/` and `presentation/`, not to the top-level directories themselves (`features/`, `presentation/`, `httpClient/`, `events/`, `websocket/`, `shared/` stay lowercase)
- `presentation/Shared/` (PascalCase) is distinct from `src/ui/shared/` (lowercase) — the former is presentation utilities (ChangelogTracker), the latter is infrastructure (di, router, components)
- PresentationFeature compositor uses empty `register() {}` since all registration happens in sub-features via the dependency chain

## Current state

- Branch: bruno/feat/cli-install, 1 commit ahead (tsx update)
- Tests: 1923 passed (186 files)
- Build: passing
- Working tree: clean

## What might come next

- Apply same PascalCase pattern to `src/ui/httpClient/`, `src/ui/events/`, `src/ui/websocket/` (infrastructure dirs — currently lowercase)
- Extract App.tsx routing into a dedicated router module (AppRoutes still imports ~30 Provider/Page components)
- Consider per-domain compositors in each presentation folder for tighter grouping (currently only top-level PresentationFeature exists)
- CLI install feature (branch name suggests this is next)
