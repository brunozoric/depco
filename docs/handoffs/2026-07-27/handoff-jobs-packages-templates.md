# Session Handoff — 2026-07-27 — Jobs Filtering, Packages Upgrade, Templates, Auto-Scan

## What was done

- **StrictMode removed**: Prevented double API requests in dev (ChangelogModal, etc.)
- **Jobs page overhaul**: Server-side filtering (status, type, project, date from/to), pagination (25/page), startedAt DESC sorting, bulk delete with confirmation dialog
- **Packages page expandable rows**: Compact main row (name, count, highest upgrade badge). Click expands nested table with per-project details and per-project Upgrade button
- **Per-project upgrade**: Dialog with version prefix selector (^/~/exact), command preview, triggers single-package upgrade job for that project only
- **Targeted transient refresh**: `refreshTransientCommand(packageNames?)` on all 4 PM drivers. JobWorker extracts names from dependency job, threads to transient job. Security validation via regex
- **Auto-scan after upgrade**: `chainScanAfterJobIfNeeded` fires for install, dependency, and transient jobs. Packages page listens for `scan:complete` WS event and auto-reloads
- **Templates wired**: BranchStep and CommitStep read `branch_template`/`commit_template` from app_settings instead of hardcoded defaults

17 commits, 712 tests (67 files), 40 files changed (+1399/-383)

## Key decisions

- Single-package upgrade from packages page skips chained transient refresh — PM upgrade command already resolves transitive deps
- Package names passed to shell validated against `/^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i`
- Jobs page uses 25 per page, not 50
- Auto-scan chains for dependency and transient jobs (not just install)
- Templates loaded during wizard init alongside session creation — no extra round trip

## Current state

- Branch: main
- Tests: 712 passed (67 files)
- Build: passing
- Lint/format: clean
- Unpushed commits: 9

## What might come next

1. Manual UI testing of all new features (jobs filtering, packages upgrade, templates)
2. Push to origin
3. Notification toast when upgrade job completes (beyond scan:complete reload)
4. CLI commands for backup/restore
5. Custom pre/post steps for upgrade wizard
