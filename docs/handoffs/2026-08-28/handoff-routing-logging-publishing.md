# Session 2026-08-28 Handoff (session 7)

Infrastructure cleanup, routing refactor, publishing setup. 9 commits, 399 test files / 2756 tests green.

## Key changes

### Route-derived response types

- `registerRoute` now provides typed `send` helpers as the handler's third argument: `send.one({ result })`, `send.list({ result })`, `send.none({ result })`
- Response types derived from the route definition's `TResponse` — no manual generics, no response type imports, no `reply`/`request` passthrough
- All 128 call sites across 34 route files converted (including backup routes)
- `sendOne`/`sendList`/`sendNone` removed from routing barrel (internal to `registerRoute`)
- 131 unused `z.infer` type aliases removed from `shared/responses/` (only `BackupPayload` and `ImportResult` remain)

### Per-destination log levels + hot-reload

- Three independent log level settings: `log_level` (DB destination, default warn), `console_log_level` (default info), `file_log_level` (default debug)
- `refreshLogLevels()` on `ILoggerService` — re-reads all three from DB and updates pino multistream entries in place, no restart needed
- `UpsertAppSettingUseCase` calls `refreshLogLevels()` when any `*log_level` key is saved
- `createDatabaseDestination` returns mutable `state` for runtime threshold updates
- File config (`.depco.json`) supports `consoleLogLevel` and `fileLogLevel`

### Type narrowing

- `ILicenseRow.source` narrowed to `LicenseSource` (`"registry" | "license-checker"`)
- `ILicenseRow.riskTier` narrowed to `LicenseRiskTier`
- `IJob` gained `progress`/`progressLabel` fields (matched DB schema and response)
- `IFileSettings.logLevel` expanded to all 6 pino levels

### Changesets + npm publishing

- Package: `@fundus/depco` on npmjs.com (public), version `0.0.0` (first changeset bumps to `0.0.1`)
- `@changesets/cli` + `@changesets/changelog-github` with `brunozoric/depco` repo
- `yarn release` = `yarn build && yarn build:ui && changeset publish`
- GitHub Actions: `publish.yml` triggers after CI on main via `changesets/action@v2.1.1`

### CI hardening

- All 5 workflows hardened with `step-security/harden-runner@v2.21.0`
- All action references hash-pinned (verified by automated test)
- `changesets/action` v1 → v2 (renamed inputs, manual `.npmrc` for npm auth)
- `codeql-action` v3.37.3 → v3.37.9
- CI: concurrency groups, dist-clean check, cancel-in-progress

## Rules established

- Route handlers use `send.one/list/none` — never import `sendOne`/`sendList`/`sendNone` directly
- Response type aliases in `shared/responses/` are only needed if used outside route handlers (e.g., backup use cases)
- Log level changes take effect immediately via `refreshLogLevels()` — no restart
- Every PR with user-facing changes needs a changeset (`yarn changeset`)
- Never publish from local machine — always via GitHub Actions

## Current state

- Branch: main, 9 commits ahead of last handoff
- All checks green: lint, format, typecheck, build, 399 test files / 2756 tests
- Working tree will be clean after this commit

## What might come next

- depco doctor CLI command
- Smoke test in CI (pack + install + `depco --help`)
- Set up `NPM_TOKEN` secret in GitHub repo for first publish
- Create initial changeset for 0.0.1 release
