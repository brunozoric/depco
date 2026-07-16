# Session Handoff — 2026-07-20 — Clone Feature, Executor Pattern, WS Streaming

## What was done

- **Flaky test fix**: cancel-running-job route test — mock now checks `signal.aborted` before adding abort listener
- **Bun TOML security fields**: added `smol-toml`, extended `parseConfigFile` with `.toml` branch (flattens nested keys), added `install.exact` and `install.frozen` fields for `bunfig.toml`
- **WebSocket log streaming**: new `job:log` event broadcasts each line from `appendLog`. Client subscribes incrementally via `JobProgressPresenter` — no HTTP re-fetch per line
- **Project export/import**: `GET /api/projects/export` returns `[{path}]`, `POST /api/projects/import` adds with auto-scan, skips existing
- **Auto-seed security defaults**: `seedSecurityDefaults` runs after migrations, populates all PMs from `SECURITY_FIELD_REGISTRY`. Removed stale yarn INSERTs from migration 0001
- **Job executor strategy pattern**: replaced if-chain in `JobWorker.executeJob` with `JobExecutorRegistry` mapping type to executor. Each executor validates packages with Zod (no unsafe casts). 5 executors: dependency, transient, packageManager, scan, clone
- **Shared `registerProject` helper**: extracted from create-project route, used by create/import/clone. Gracefully handles missing lockfiles (null PM)
- **GitHub clone feature**: filesystem browse API, clone route with URL validation + argument injection prevention, CloneJobExecutor, UI FilesystemGateway, CloneProjectUseCase, presenter clone/browse VM, FolderBrowser component, AddProjectModal tabs
- **DI cleanup**: 8 missing `abstractions/index.ts` barrels, abbreviated variable names fixed, skills updated from fundus

22 commits, 85 files changed, 494 tests (43 files)

## Key decisions

- `JobExecutorRegistry` follows PackageManagerDriverRegistry pattern — executors are plain classes created by registry, not individually DI-wired
- Clone jobs use `projectId: "clone"` placeholder (FK on upgrade_jobs dropped via migration 0003)
- `JobWorker.executeJob` skips project lookup for clone jobs — executor handles everything
- `registerProject` catches PM detection failure gracefully (null PM) instead of throwing
- Git clone uses `--` end-of-options marker + URL whitelist (https/git@ only) for security
- Clone `folderName` validated against path traversal (no `/`, `\`, `..`)
- Filesystem browse canonicalizes paths via `realpath()`, resolves symlinks

## Current state

- Branch: main
- Tests: 494 passed (43 files)
- Build: passing
- Lint/format/adio: clean
- Unpushed commits: 22 (4 from prior session + 18 this session)

## What might come next

1. **Install job type + node_modules detection badge** — new `"install"` job type that runs PM install command, badge showing installed/not-installed state in project list. User specifically requested this.
2. **Manual UI testing** — restart dev server, verify clone modal works end-to-end, test folder browser navigation
3. **Push to origin** — 22 commits unpushed
4. **Scan error surfacing** — scans that fail silently (e.g. stale lockfile) should show error in UI rather than 0 deps
5. **Bun security fields expansion** — bunfig.toml needs more fields beyond install.exact/install.frozen
