# Session Handoff — 2026-07-22 — Upgrade Wizard & Dependency Improvements

## What was done

- **Store all dependencies**: ScanService now persists every dependency (including up-to-date) so projects show full package composition. Upgrade filter (all/upgradeable/up-to-date) on project detail page.
- **Packages page improvements**: Per-project version display with inline upgrade badges (replaced aggregated version/upgrade columns). Added "none" filter, per-package rescan button.
- **Semver validation**: Replaced hand-rolled version comparison with `semver` package. Prevents bogus downgrades (4.x -> 2.x) by clamping latestVersion to currentVersion when registry reports lower.
- **Prerelease filtering**: Skips rc/alpha/beta/prerelease versions when resolving latest. Falls back to last stable version.
- **Upgrade wizard** (30 tasks across 6 plans): Full guided multi-step upgrade flow at `/projects/:id/upgrade`. API-first design — same endpoints work for UI and AI agents. 5-step pipeline: select packages, create branch, run upgrades, refresh transient, commit. Step resolver registry for extensibility. Template-based branch names and commit messages from app settings.
- **Cleanup**: Removed target version picker and upgradeSelected from project detail page (wizard handles it now).
- 36 commits, 618 tests (61 test files)

## Key decisions

- All dependencies stored regardless of upgrade status (upgradeType "none" for up-to-date)
- Prerelease versions never offered as upgrade targets unless specifically requested
- Upgrade wizard is API-first — sessions persist in DB, every step executable via HTTP
- Step resolvers are a registry pattern — adding a step = implement resolver + register
- App settings is a general key-value table (not upgrade-specific) for future reuse
- GitService scoped to step resolvers (not standalone API endpoints)
- Version picker removed from project detail — version selection happens in wizard's SelectPackagesStep
- WebSocket events defined for step progress but broadcast wiring is a follow-up

## Current state

- Branch: main
- Tests: 618 passed (61 files)
- Build: passing
- Unpushed commits: ~36

## What might come next

1. Manual UI testing of upgrade wizard end-to-end
2. Push to origin
3. Wire WebSocket broadcast for step execution progress (logs streaming during upgrade/refresh)
4. App settings UI page (edit branch/commit templates in browser)
5. Read package manager from project record in UpgradeResolver (currently hardcoded "yarn")
6. Session cleanup (auto-expire stale sessions)
7. Add more template tokens (e.g. ${TIMESTAMP}, ${USER})
8. Future steps: push to remote, PR creation, custom pre/post steps
