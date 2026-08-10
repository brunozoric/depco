# Vulnerabilities Page + Presenter Refactor Design

Date: 2026-08-10

## Goal

Extract VulnerabilitiesPresenter.ts (449 lines) and VulnerabilitiesPage.tsx (496 lines) into focused sub-modules. Improve code quality during extraction.

## VulnerabilitiesPresenter.ts Refactor

### Current Structure

Single 449-line class with 10 DI dependencies and ~18 public methods spanning 6 concerns: filtering, selection, bulk actions, export, grouping, and data loading.

### Extraction Plan

Split the monolith into focused presenters that the main presenter delegates to. Each sub-presenter is a plain class (not DI-registered) instantiated by the main presenter.

**VulnerabilityFilterManager** — extracted from main presenter:

- `setSeverity()`, `setPackageName()`, `setSource()`, `setProjectIds()`, `setIncludeDismissed()`, `setDependencyType()`, `clearScannedDate()`, `setSortBy()`, `setPage()`
- Owns: URL filter reads/writes via UrlFilterService
- File: `src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilityFilterManager.ts`

**VulnerabilitySelectionManager** — extracted from main presenter:

- `toggleSelected()`, `selectAllOnPage()`, `clearSelection()`
- Owns: `selectedIds` Set
- File: `src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitySelectionManager.ts`

**VulnerabilityBulkActions** — extracted from main presenter:

- `bulkDismiss()`, `bulkSnooze()`, `bulkUndismiss()`, `bulkRescan()`
- Depends on: selection manager (for selected IDs), use cases
- File: `src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilityBulkActions.ts`

**VulnerabilityExportActions** — extracted from main presenter:

- `exportSelected()`, `exportAll()`
- Depends on: selection manager, export use case
- File: `src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilityExportActions.ts`

**VulnerabilitiesPresenter** stays as compositor:

- Instantiates sub-presenters, delegates public methods
- Owns: `load()`, `dispose()`, `vm` computed, `groupByProject` toggle
- Keeps MobX `makeAutoObservable` and reactions
- Dependencies flow through constructor as before (DI unchanged)

### Improvements During Extraction

- Move `computeProjectGroups()` and `toRowViewModel()` helper methods to standalone functions (pure, no `this` needed)
- Extract `DEFAULT_PAGE_SIZE` and `EXPIRED_SNOOZE_LOOKBACK_MS` constants to a shared constants file if used by sub-presenters
- Simplify the `vm` computed by delegating filter state reads to `VulnerabilityFilterManager.state`

## VulnerabilitiesPage.tsx Refactor

### Current Structure

Single 496-line observer component with inline rendering for filters, bulk actions, grouped view, flat table, pagination, and 4 confirmation dialogs.

### Extraction Plan

**VulnerabilityFilters** — filter controls section:

- Severity select, package name input, source select, project multi-select, dismissed toggle, dependency type select, scanned date filter
- Props: view model slice + setter callbacks
- File: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityFilters.tsx`

**VulnerabilityBulkBar** — bulk actions toolbar:

- Select all checkbox, selected count, dismiss/snooze/undismiss/rescan buttons
- Props: selection state + action callbacks
- File: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityBulkBar.tsx`

**VulnerabilityGroupedView** — accordion grouped by project:

- Project groups with vulnerability rows inside
- Props: grouped data + row renderer
- File: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityGroupedView.tsx`

**VulnerabilityTable** — flat table view:

- Sortable headers + vulnerability rows
- Props: vulnerabilities + sort state + callbacks
- File: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityTable.tsx`

**VulnerabilityConfirmDialogs** — 4 confirmation modals:

- Dismiss, snooze, undismiss, rescan confirmation dialogs
- Props: open states + confirm/cancel callbacks
- File: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityConfirmDialogs.tsx`

**VulnerabilitiesPage** stays as layout compositor:

- Wires sub-components together
- Owns: confirmation dialog state (useState hooks)
- Passes presenter methods as callbacks
- Target: ~80-120 lines

### Improvements During Extraction

- Move `isSafeAdvisoryUrl()` and `SOURCE_COLORS` to shared utilities (they're generic, not page-specific)
- Move `SEVERITY_COLORS` import to the components that actually use it (VulnerabilityTable, VulnerabilityGroupedView) instead of importing at page level
- Extract `renderVulnerabilityRow()` as a standalone component `VulnerabilityRow` for reuse between grouped and flat views

## Testing

- Existing `VulnerabilitiesPresenter.test.ts` tests must pass unchanged (public API preserved)
- No new tests needed for pure extraction — existing tests cover presenter behavior
- If any public method signatures change during improvement, update tests accordingly
