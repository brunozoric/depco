# Periodic Re-Resolution of Transitive Deps on Cache Expiry

## Problem

Transitive dependency registry data (latest version, upgrade type) is resolved once after the initial scan and never refreshed. If a new version of a transitive dependency is published, the stale data persists until a full re-scan. There's no mechanism to periodically re-resolve transitive deps whose registry data has aged past a threshold.

## Goals

1. After each scan, mark transitive deps with stale registry data as unresolved so the chained transitive-resolve job re-fetches them
2. Configurable TTL for transitive registry data via `app_settings` (default 24 hours)
3. Add TTL setting to the UI settings page

## Non-Goals

- Standalone cron/scheduled job for re-resolution — only triggered after scans
- Re-resolution of direct dependencies (they're always resolved during scan)
- Changing the TransitiveResolveJobExecutor itself — it already processes `registryResolved: 0` rows

## Design

### Staleness Check in JobWorker

In `JobWorker.chainTransitiveResolveAfterScanIfNeeded()`:

1. Read `transitive-resolve-ttl` from `app_settings` table (default: 24 hours if not set)
2. Compute cutoff timestamp: `Date.now() - (ttlHours * 3600 * 1000)`
3. Before counting unresolved rows, mark stale transitive deps as unresolved:

```sql
UPDATE scan_results
SET registry_resolved = 0
WHERE project_id = ?
  AND dependency_kind = 'transitive'
  AND registry_resolved = 1
  AND scanned_at < ?
```

This uses `scannedAt` as the freshness timestamp. After marking stale rows, the existing unresolved count check naturally picks them up and enqueues the transitive-resolve job.

4. Log the count of stale rows marked: `"Marked N stale transitive deps for re-resolution (TTL: Xh)."`

### App Settings

New key in `app_settings`: `transitive-resolve-ttl` with string value representing hours.

- Default: `"24"` (seeded in `seedAppSettings.ts`)
- Valid range: 1-720 (1 hour to 30 days)
- `"0"` disables re-resolution (stale rows are never marked)

### Settings UI

Add a number input to the existing App Settings page for the transitive resolve TTL.

Read the current `AppSettingsPresenter` and `AppSettingsPage` to follow the existing pattern for settings fields (there are already scan interval, backup, and other settings displayed).

The setting should use the existing `options` pattern (Select dropdown), matching `snooze_check_interval` and `log_level`:

- Label: "Transitive Dep Cache TTL"
- Options: Disabled (0), 12 hours, 24 hours (default), 3 days (72), 7 days (168)
- Description: "Hours between re-checking transitive dependency versions. 0 disables re-resolution."
- No component changes needed — existing settings page already renders options-based fields as Select

### scanResults.scannedAt as Freshness Indicator

The `scan_results` table's `scannedAt` column records when the row was last written. For transitive deps:

- Initial scan sets `scannedAt` to the scan timestamp
- `TransitiveResolveJobExecutor` does NOT update `scannedAt` when resolving — it only sets `latestVersion`, `latestInRange`, `upgradeType`, `registryResolved`

This means `scannedAt` reflects when the package was last scanned, not when registry data was last fetched. For the staleness check, we need the registry resolution timestamp.

**Solution:** Use `scannedAt` on the `scan_results` row as an approximation. When `TransitiveResolveJobExecutor` resolves a package, it should update `scannedAt` to `Date.now()` alongside the other fields. This makes `scannedAt` the last-resolved timestamp for staleness checks.

This requires a small change to `TransitiveResolveJobExecutor`: add `scannedAt: Date.now()` to the update set.

## Files Changed

### Backend

- `src/api/services/JobWorker.ts` — staleness mark + TTL read in `chainTransitiveResolveAfterScanIfNeeded`
- `src/api/services/jobExecutors/TransitiveResolveJobExecutor.ts` — add `scannedAt: Date.now()` to update set
- `src/api/db/seedAppSettings.ts` — seed `transitive-resolve-ttl: "24"`

### UI

- `src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts` — expose TTL field
- `src/ui/presentation/settings/AppSettings/abstractions/AppSettingsPresenter.ts` — TTL in VM
- `src/ui/presentation/settings/AppSettings/components/AppSettingsPage.tsx` — NumberInput for TTL

### Tests

- `src/api/services/__tests__/JobWorker.test.ts` — test stale marking with TTL
- `src/api/services/jobExecutors/__tests__/TransitiveResolveJobExecutor.test.ts` — verify scannedAt updated

## Testing Strategy

**JobWorker tests:**

- Scan completes with stale transitive deps (scannedAt older than TTL): verify rows marked `registryResolved: 0`, transitive-resolve job enqueued
- Scan completes with fresh transitive deps (scannedAt within TTL): no rows marked stale
- TTL set to 0: no rows marked stale regardless of age
- TTL not in app_settings: defaults to 24 hours

**TransitiveResolveJobExecutor tests:**

- Verify resolved rows get `scannedAt` updated to current time

**UI:** No presenter tests needed for a simple settings field — follows existing pattern.
