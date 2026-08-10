# Session Handoff — 2026-08-09 — CLI, Router, Config

## What was done

**Infrastructure restructure (from previous branch merge):**

- Moved events/, httpClient/, websocket/, shared/ under src/ui/infrastructure/ with PascalCase
- Created 18 per-domain presentation compositors (PresentationFeature: 38 entries down to 18)
- Built DI Router system: 19 route abstractions (Route + RouteRegistry + RouterComponent), each page is a DI citizen
- Merged Shared/router/ into infrastructure/Router/ (navigate + useCurrentPath consolidated)
- Extracted App.tsx from 382 lines to 40 (AppLifecycle + AppHeader as siblings)

**CLI install feature:**

- `depco init` — 7 DI steps: EnsureDataDirectory, RunMigrations, GenerateEncryptionKey, SelectPort, CreateAdminUser, WriteEnvFile (0o600 permissions), PrintNextSteps
- `depco start` — 2 DI steps: ValidateEnvironment, StartServer
- StepRunner with progress display, rollback on failure, custom StepExecutionError
- Command abstraction — commands are step orchestrators
- Yargs with parseAsync(), demandCommand, strict()
- Full integration test for init flow

**CLI scan feature (standalone, no server/DB):**

- `depco scan` — 4 DI steps: DetectPackageManager, LoadConfig, ParseLockfile, CheckLicenses
- Parses lockfile via LockfileParserService (zero deps, pure parser)
- Fetches licenses from npm registry, classifies via classifyLicenseRiskTier
- Handles legacy object license format from npm registry
- Exit code 1 on non-permissive licenses

**depco.config.ts:**

- TypeScript config file with defineConfig() for type-safe autocomplete
- Exported via package.json exports as @fundus/depco/config
- Zod-validated (external user input)
- Controls: license allowedRiskTiers, ignoredPackages, vulnerability maxSeverity, registryUrl
- Loaded via tsx dynamic import (tsx/esm/api registered in CLI entry)

33 commits, 393 files changed, +10216/-1019, 205 test files, 1985 tests

## Key decisions

- PascalCase for domain subfolders in ui/ (features/, presentation/, infrastructure/); top-level dirs stay lowercase
- infrastructure/ groups UI infra: HttpClient, Events, WebSocket, Shared, Router
- Commands are step orchestrators — each command defines a list of DI-resolved steps
- Each step is a full DI abstraction (createAbstraction + createImplementation + createFeature)
- Routes are DI abstractions with matchPath + validateQueryString + render
- DashboardRoute (catch-all) registered via DashboardDomainFeature (last in deps) to avoid early registration via TeamDetail dependency
- PreAuthLifecycle vs PostAuthLifecycle split to preserve auth ordering
- depco.config.ts (not .json) — TypeScript for autocomplete, loaded via tsx
- All external config validated with Zod
- CLI standalone scan uses native fetch() + classifyLicenseRiskTier — no server, no DB

## Current state

- Branch: main, 33 commits ahead of origin (not pushed)
- Tests: 205 files, 1985 passed
- Build: passing
- Lint/format: clean
- Working tree: clean

## What might come next

- `scan:vulnerability` — OSV.dev API integration, standalone CLI check, respects depco.config.ts
- `--format json` — JSON output for CI pipeline consumption in scan command
- `depco doctor` — health check command (verify DB, .env, ENCRYPTION_KEY, server status)
- App.tsx further cleanup — AppHeader is 184 lines, nav menu could extract further
- Consider moving notification wiring from AppLifecycle into infrastructure features
