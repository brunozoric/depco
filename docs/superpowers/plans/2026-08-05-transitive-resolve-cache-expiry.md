# Transitive Resolve Cache Expiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After each scan, mark stale transitive deps for re-resolution based on a configurable TTL, and add the TTL setting to the UI.

**Architecture:** `JobWorker.chainTransitiveResolveAfterScanIfNeeded()` reads TTL from `app_settings`, marks stale `scan_results` rows as `registryResolved: 0`, then the existing transitive-resolve job picks them up. `TransitiveResolveJobExecutor` updates `scannedAt` on resolution so staleness can be tracked.

**Tech Stack:** TypeScript, Drizzle ORM (SQLite), Vitest, MobX, React/Mantine

## Global Constraints

- Use `yarn full` for all verification
- Named interfaces only
- Object params with named keys when function has 2+ parameters
- Full words in identifiers
- Commit all files after each task

---

### Task 1: Backend — Staleness Logic + scannedAt Update

Update `TransitiveResolveJobExecutor` to set `scannedAt` on resolution, seed the TTL setting, and add staleness marking to `JobWorker`.

**Files:**

- Modify: `src/api/services/jobExecutors/TransitiveResolveJobExecutor.ts`
- Modify: `src/api/services/JobWorker.ts`
- Modify: `src/api/db/seedAppSettings.ts`
- Modify: `src/api/services/jobExecutors/__tests__/TransitiveResolveJobExecutor.test.ts`
- Modify: `src/api/services/__tests__/JobWorker.test.ts`

**Interfaces:**

- Consumes: `app_settings` table (key/value), `scan_results` table (`scannedAt`, `registryResolved`, `dependencyKind`)
- Produces: Stale transitive deps marked `registryResolved: 0` after scan, resolved deps get `scannedAt` updated

- [ ] **Step 1: Update TransitiveResolveJobExecutor to set scannedAt**

In `src/api/services/jobExecutors/TransitiveResolveJobExecutor.ts`, in the DB update for successful resolutions (the `.set({...})` call around line 70-77), add `scannedAt: Date.now()`:

```typescript
await db
  .update(scanResults)
  .set({
    latestVersion,
    latestInRange: row.currentVersion,
    upgradeType,
    registryResolved: 1,
    scannedAt: Date.now()
  })
  .where(eq(scanResults.id, row.id))
  .run();
```

Also update the failed-package path (from the per-package error handling) to include `scannedAt: Date.now()`.

- [ ] **Step 2: Seed default TTL**

In `src/api/db/seedAppSettings.ts`, add to `DEFAULT_SETTINGS`:

```typescript
{
    key: "transitive-resolve-ttl",
    value: "24"
}
```

- [ ] **Step 3: Add staleness marking to JobWorker**

In `src/api/services/JobWorker.ts`, in `chainTransitiveResolveAfterScanIfNeeded()`:

Before the existing unresolved count query (line 346), add:

1. Read TTL from app_settings:

```typescript
const ttlSetting = await this.databaseClient.db
  .select({ value: appSettings.value })
  .from(appSettings)
  .where(eq(appSettings.key, "transitive-resolve-ttl"))
  .get();

const parsed = ttlSetting ? parseInt(ttlSetting.value, 10) : 24;
const ttlHours = isNaN(parsed) ? 24 : parsed;
```

2. If TTL > 0, mark stale rows:

```typescript
if (ttlHours > 0) {
  const cutoff = Date.now() - ttlHours * 3600 * 1000;
  const staleResult = await this.databaseClient.db
    .update(scanResults)
    .set({ registryResolved: 0 })
    .where(
      and(
        eq(scanResults.projectId, job.referenceId),
        eq(scanResults.dependencyKind, "transitive"),
        eq(scanResults.registryResolved, 1),
        lt(scanResults.scannedAt, cutoff)
      )
    )
    .run();

  if (staleResult.rowsAffected > 0) {
    appendLog(
      `Marked ${staleResult.rowsAffected} stale transitive deps for re-resolution (TTL: ${ttlHours}h).`
    );
  }
}
```

Import `appSettings` from schema and `lt` from drizzle-orm if not already imported.

- [ ] **Step 4: Write TransitiveResolveJobExecutor scannedAt test**

In `src/api/services/jobExecutors/__tests__/TransitiveResolveJobExecutor.test.ts`, add test:

```typescript
it("should update scannedAt when resolving packages", async () => {
  // Insert unresolved scan result with old scannedAt
  // Run executor
  // Verify scannedAt was updated to a recent timestamp
});
```

Read existing test file for the setup pattern (DB seeding, context creation, registry stub).

- [ ] **Step 5: Write JobWorker staleness tests**

In `src/api/services/__tests__/JobWorker.test.ts`, add tests:

Test 1: Stale transitive deps marked when scannedAt older than TTL — insert transitive scan result with old `scannedAt`, set TTL to 1 hour, complete a scan job, verify row has `registryResolved: 0` and transitive-resolve job was enqueued.

Test 2: Fresh transitive deps unchanged — insert transitive scan result with recent `scannedAt`, verify `registryResolved` stays 1.

Test 3: TTL = 0 disables marking — set TTL to "0", verify no rows marked stale.

Test 4: Missing TTL defaults to 24 hours — don't seed the setting, verify behavior matches 24h TTL.

Read existing JobWorker test file for the setup pattern.

- [ ] **Step 6: Run tests**

Run: `yarn vitest run src/api/services/jobExecutors/__tests__/TransitiveResolveJobExecutor.test.ts src/api/services/__tests__/JobWorker.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/api/
git commit -m "feat(api): add scan-triggered re-resolution of stale transitive deps

TransitiveResolveJobExecutor updates scannedAt on resolution. JobWorker
marks stale transitive deps as unresolved based on configurable TTL.
Default TTL: 24 hours. TTL 0 disables re-resolution."
```

---

### Task 2: UI — TTL Setting

Add transitive resolve TTL to the app settings page.

**Files:**

- Modify: `src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts`

**Interfaces:**

- Consumes: `app_settings` key `"transitive-resolve-ttl"` from Task 1
- Produces: TTL field visible and editable in settings page

- [ ] **Step 1: Add to KNOWN_SETTINGS**

In `src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts`, add to `KNOWN_SETTINGS` (around line 58, after `snooze_check_interval`):

```typescript
"transitive-resolve-ttl": {
    label: "Transitive Dep Cache TTL",
    description: "Hours between re-checking transitive dependency versions. 0 disables re-resolution.",
    options: [
        { label: "Disabled", value: "0" },
        { label: "12 hours", value: "12" },
        { label: "24 hours", value: "24" },
        { label: "3 days", value: "72" },
        { label: "7 days", value: "168" }
    ]
}
```

Using the existing `options` pattern (same as `snooze_check_interval` and `log_level`) so the UI renders a Select dropdown. No component changes needed — the existing settings page already iterates `KNOWN_SETTINGS` and renders options-based fields as Select components. The abstraction (`abstractions/AppSettingsPresenter.ts`) and component (`AppSettingsPage.tsx`) don't need modification because the existing SettingViewModel already supports the `options` field and renders it as a Select.

- [ ] **Step 2: Run full verification**

Run: `yarn full`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/ui/
git commit -m "feat(ui): add transitive dep cache TTL to app settings"
```
