# Session Handoff — 2026-08-04 — DI Conversion, Filters, UI Improvements

## What was done

- **DI conversion**: Converted all 7 remaining job executors + SBOM formatters/registry to `createAbstraction`/`createImplementation`. JobExecutorRegistry simplified from 19 deps to 8 injected abstractions. Split `UpgradeSessionStepResolverRegistry` to own abstraction file. Converted step resolver `execute` to object params (`IStepExecuteParams`).
- **Team detail page**: New route `/teams/:id` renders team header + full dashboard scoped to team via TeamFilterService (sets filter on load, restores on dispose). Clickable team names in team list.
- **Filters**: Team filter on project list (client-side via global TeamFilterSelect). Vulnerability transitive/direct filter — server-side `dependencyType` param on list + export routes with `filterByDependencyType`. Project list search bar (name/path/PM, case-insensitive).
- **UI improvements**: SBOM export converted from page to modal dialog with description text. Packages page column components extracted (PackageName, UpgradeType, LastRelease, ChangelogButton, RescanButton, ExpandedDependencies). Pagination at top + paginated expanded dependencies (10/page). Per-project scan action in project row dropdown. Clickable project names. Dependency changes table shows project name column.
- **Bug fixes**: `cleanQuery` helper strips `undefined` values from query objects — fixed `teamId=undefined` being sent as literal string causing empty trends/dashboard data.
- **Tests**: 25 new tests — TeamDetailPresenter (7), VulnerabilitiesPresenter dependencyType (7), vulnerability API dependencyType (5), project search (6). 1664 total across 162 files.
- 35 commits, 100 files changed

## Key decisions

- `CustomStepResolver` stays as plain class — factory pattern with runtime `type`/`config`, not a DI candidate
- Step resolver `execute` uses object params `{ projectPath, context, input, onProgress? }` for extensibility
- `cleanQuery` in `src/ui/httpClient/cleanQuery.ts` is the standard way to build query objects — strips undefined values
- `dependencyType` filter is server-side (post-enrichment in API route), not client-side
- SBOM is a dialog from nav menu, not a separate page — per-project export remains on project detail
- Always run `yarn full` (not individual commands), always commit all files after tasks

## Current state

- Branch: main, 35 commits ahead of origin (not pushed)
- Tests: 1664 passed across 162 files
- Build: passing (yarn full green)
- Unpushed commits: 35

## What might come next

1. Browser testing — all new features need manual verification (team detail, filters, search, SBOM dialog, trends data, packages pagination)
2. Team member/user management — teams exist but have no members
3. Vulnerability detail page improvements
4. More dashboard widgets or customization
5. Convert remaining inline types to named interfaces across codebase
