# Feature 5: Configurable Snooze Check Interval

## Problem

The server-side `setInterval` that checks for expired vulnerability snoozes and broadcasts via WebSocket uses a hardcoded 1-hour interval (`SNOOZE_CHECK_INTERVAL_MS = 3600000` in `server.ts:45`). Users cannot adjust the check frequency.

## Solution

Make the snooze check interval configurable via the app settings system (database-backed, UI-visible). Read the setting at server startup when creating the interval. Default remains 1 hour.

## Approach

**Approach A (chosen): App setting with static read at startup**

Add `snooze_check_interval` key to app settings. Seed default value of `3600000`. Server reads it once from the database during `createServer()` before creating the `setInterval`. UI shows it in the settings page with predefined options.

Rejected alternative:

- Dynamic interval (re-read periodically, recreate interval on change): over-engineered for how rarely this setting changes. YAGNI.

## Changes

### 1. Seed default — `seedAppSettings.ts`

Add to `DEFAULT_SETTINGS` array:

```typescript
{
    key: "snooze_check_interval",
    value: "3600000"
}
```

### 2. Read setting at startup — `server.ts`

Replace hardcoded `SNOOZE_CHECK_INTERVAL_MS = 3600000` with a database read after `seedAppSettings(databaseClient.db)` (line 62). Query the `appSettings` table for key `snooze_check_interval`, parse as integer, fall back to 3600000 if missing or invalid.

New imports needed in `server.ts`:

- `eq` from `drizzle-orm`
- `appSettings` from `#api/db/schema.js` (add to existing schema import)

```typescript
const snoozeIntervalRow = await databaseClient.db
  .select({ value: appSettings.value })
  .from(appSettings)
  .where(eq(appSettings.key, "snooze_check_interval"))
  .get();
const snoozeCheckIntervalMs = snoozeIntervalRow
  ? parseInt(snoozeIntervalRow.value, 10) || 3600000
  : 3600000;
```

Use `snoozeCheckIntervalMs` in the `setInterval` call instead of the constant.

Remove the `SNOOZE_CHECK_INTERVAL_MS` constant.

### 3. UI metadata — `AppSettingsPresenter.ts`

Add to `KNOWN_SETTINGS`:

```typescript
snooze_check_interval: {
    label: "Snooze Check Interval",
    description: "How often the server checks for expired vulnerability snoozes (milliseconds). Requires restart.",
    options: [
        { label: "15 minutes", value: "900000" },
        { label: "30 minutes", value: "1800000" },
        { label: "1 hour", value: "3600000" },
        { label: "4 hours", value: "14400000" }
    ]
}
```

### 4. No new routes

Existing `PUT /api/settings/app/:key` handles upsert. Existing `GET /api/settings/app` returns all settings. No new API needed.

### 5. No new components

`AppSettingsPage` already renders `KNOWN_SETTINGS` with options as a dropdown when `options` array is present (same as `log_level`). Adding the key to `KNOWN_SETTINGS` is sufficient.

## Testing

### Backend — `server.ts`

No unit test for server startup interval (server.ts has no test file and the interval setup is in `createServer()`). The setting read is a simple DB query with parseInt fallback — testing via existing app settings route tests and manual verification.

### Seed — `seedAppSettings.ts`

Verify seed includes `snooze_check_interval` with value `"3600000"`. Add test if a seed test file exists; otherwise covered by existing seed behavior (onConflictDoNothing).

### Frontend — `AppSettingsPresenter.ts`

No new presenter tests needed — `KNOWN_SETTINGS` is a static metadata object consumed by the existing render loop. Presenter already has tests for the settings list/upsert flow.

## Scope

- Files modified: 3 (`server.ts`, `seedAppSettings.ts`, `AppSettingsPresenter.ts`)
- New tests: 0 (covered by existing patterns)
- Schema changes: 0
- New dependencies: 0
- New routes: 0
- New components: 0
