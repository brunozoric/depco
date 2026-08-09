# Session Handoff — 2026-08-08 — API Services Restructure

## What was done

- Restructured `src/api/services/` from flat file layout into 26 PascalCase folder-per-service structure
- Each folder contains: `abstractions/`, implementation file(s), `feature.ts` (createFeature), `index.ts` (exports abstractions + feature only), `__tests__/`
- Created 11 domain folders (multiple services): AutoFix, Auth, Changelog, DependencyGraph, Git, JobExecution, License, PackageManager, Sbom, UpgradeSession, Vulnerability
- Created 15 standalone service folders: AppLog, CommandRunner, DependencyChange, Email, Encryption, ErrorReporter, EventBus, FileConfig, PackageJson, RegistryCache, Scan, ScanScheduler, Security, StepHook, Upgrade
- Rewrote top-level `feature.ts` as compositor — imports only sub-features, no implementation imports
- Moved `registerProject.ts` to `src/api/utils/`
- Moved `workers/` to `src/api/workers/`
- Deleted shared `abstractions/` and `__tests__/` directories
- Wrote spec and 11 plan files before implementation
- 17 commits, 1923 tests passing

## Key decisions

- PascalCase singular naming for all service folders (matches class naming convention)
- Domain folders group tightly coupled services: shared tables, direct call dependency, or same bounded context
- `index.ts` exports abstractions + feature only — never implementations
- Implementation files never leave their folder
- Subdirectories for strategies/drivers: `drivers/` in PackageManager, `resolvers/` in Changelog, `formatters/` in Sbom, `executors/` in JobExecution, `stepResolvers/` in UpgradeSession
- ScanService and ScanSchedulerService kept separate (not same domain) because scheduler uses scan service
- Auth domain includes UserService (tightly coupled via login/register flow)
- Email kept separate from Auth (future non-auth consumers expected)

## Current state

- Branch: `bruno/refactor/services-structure`
- Tests: 1923 passed (186 files)
- Build: passing
- Lint + format: clean
- Unpushed commits: 17

## What might come next

- Squash or rebase before merging to main
- Apply same folder-per-service pattern to UI features/presentation if desired
- Consider adding type re-exports to more index.ts files (currently only Vulnerability and StepHook have full type re-exports; others export just the abstraction token)
