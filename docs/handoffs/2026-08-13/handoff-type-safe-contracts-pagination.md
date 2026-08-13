# Session Handoff — 2026-08-13 — Type-Safe API/UI Contracts + Pagination

## What was done

- **Type-safe API/UI contracts**: Full fundus-style pattern — SendableError interface, Result-based send helpers (sendOne/sendList/sendNone/sendError handle errors internally), response schemas extracted to `src/shared/responses/` for all 25 domains, route definitions reference them. Teams pilot with full error codes, then rolled out to all ~36 route handler files. 160 files changed across 20 commits.
- **Response schema extraction**: Created `src/shared/responses/<domain>.ts` for all domains. Single source of truth — API sends, UI validates via HTTPClient.
- **Zod safeParse migration**: Replaced all `parse()` with `safeParse()` across codebase (~19 call sites). No more throwing validation errors.
- **Node.js release schedule fix**: `eol` field now accepts `false` for unreleased versions. Entries without EOL date skipped.
- **Rate limit fix**: Disabled global rate limit (100 req/min was blocking bulk scans). Per-route limits on auth endpoints only (brute-force protection).
- **Project list pagination**: Server-side pagination with search and team filtering. UrlFilterService for shareable URLs. Pagination component in UI. Default pageSize 25.
- 393 test files, 2712 tests, all green.

## Key decisions

- Always use `safeParse()`, never `parse()` — saved to memory as feedback
- Never push unless user says to — saved to memory as feedback
- `sendOne`/`sendList`/`sendNone` accept `Result<Data, SendableError>` — no more `result.match()` in route handlers
- Non-teams use cases use `mapError(error => ({ ...error, code: "UNKNOWN" }))` as temporary bridge — code field will be added per domain later
- Response schemas live in `src/shared/responses/<domain>.ts`, route definitions import from there
- Rate limiting: only on unauthenticated auth endpoints (closed app — authenticated users shouldn't be limited)
- `z.any()` removed from blob routes (SBOM, vulnerability export) — sendBlob bypasses validation

## Current state

- Branch: main
- Tests: 2712 passed (393 files)
- Build: passing
- Unpushed commits: 21

## What might come next

- **Infrastructure logging (pino)**: User wants pino with multiple transports (DB, file, console). Separate from app logs. Needs UI page too. Was discussed but deferred.
- **Error codes for remaining domains**: Teams has typed codes, rest use `"UNKNOWN"`. Roll out `code` field to all ~24 remaining domain use cases.
- **Project list pagination testing**: Test with real data to verify pageSize 5 works as expected.
- **depco doctor command**: Mentioned in prior session handoff.
- **depco scan --watch mode**: Mentioned in prior session handoff.
