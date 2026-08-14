# Session Handoff — 2026-08-14 — Error Codes, Pino Logging, Response Type Safety

## What was done

- **Typed error codes for all domains** — Added `code` string literal to every error interface across all 24 domains. Eliminated 126 `.mapError(... code: "UNKNOWN")` bridge sites. Extracted shared `IUnexpectedError`, `IProjectNotFoundError`, `unexpectedError()` helper to `src/shared/errors.ts`. Net -887 lines from deduplication. (3 commits, 349+121+56 files)

- **Pino logging infrastructure** — Replaced custom `AppLogService` (DB-only) with pino-based structured logging. Three destinations: console (pino-pretty), file (pino-roll with daily + 10MB rotation, 7-day retention), DB (custom writable stream to `appLogs` + WebSocket broadcast). `AppLogService` now delegates to `LoggerService`. Fastify HTTP request logging via pino child logger with `source: "http"`. DB destination filters HTTP info logs, validates log level against known pino levels. (7 commits + 2 fix commits)

- **Compile-time response type safety** — Added `UnwrapItem<T>` to `sendOne` for compile-time response checking. Exported response types from all 25 schema files. Added explicit generics to ~111 `sendOne`/`sendList` calls (e.g., `sendOne<CreateTeamResponse>({...})`). Fixed 3 real contract gaps found by the type checking (violation action enum, nullable fields). (4 commits, 67 files)

- 19 commits total, 420 files changed, 2717 tests green

## Key decisions

- Error codes follow teams pattern: domain-specific (JOB_NOT_FOUND, PROJECT_NOT_FOUND) + generic (UNEXPECTED_ERROR)
- Pino LoggerService reads log_level from DB at construction time (sync via better-sqlite3), not from FileConfigService
- File destination uses `initFileDestination()` called from server.ts after migrations (async pino-roll)
- Fastify v5 requires `loggerInstance` (not `logger`) for pre-built pino instances
- Response type safety is compile-time only (no runtime Zod validation in send functions)
- 5 routes use inferred generics due to exactOptionalPropertyTypes friction with Zod optional types — not real bugs

## Current state

- Branch: main
- Tests: 2717 passed (396 files)
- Build: passing
- Unpushed commits: ~41 ahead of origin

## What might come next

- Infrastructure logging UI page improvements (log level per destination configurable from UI)
- depco doctor command
- Per-destination log level configuration (currently hardcoded: console=info, file=debug, DB=warn)
- Fix remaining 5 routes with exactOptionalPropertyTypes friction for full compile-time coverage
- Consider deriving use case Data types from response schemas (single source of truth)
