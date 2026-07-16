# Configurable Snooze Check Interval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the vulnerability snooze check interval configurable via app settings (database-backed, UI-visible) instead of hardcoded 1 hour.

**Architecture:** Add `snooze_check_interval` to seed defaults, read from DB at server startup, expose in settings UI via KNOWN_SETTINGS metadata. Three files, no schema changes, no new routes.

**Tech Stack:** TypeScript, Drizzle ORM, SQLite, Fastify, Mantine

## Global Constraints

- Use `yarn` for dependency management
- Use full words in identifiers
- No schema changes, no new routes, no new components
- Setting key: `snooze_check_interval`, value stored as string (milliseconds)
- Default value: `"3600000"` (1 hour)

---

### Task 1: Add snooze_check_interval to seed, server, and UI

**Files:**

- Modify: `src/api/db/seedAppSettings.ts:9-22` (add to DEFAULT_SETTINGS)
- Modify: `src/api/server.ts:1-45,121-135` (add imports, read setting, use in setInterval)
- Modify: `src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts:13-48` (add to KNOWN_SETTINGS)

**Interfaces:**

- Consumes: `appSettings` table (existing), `databaseClient.db` (existing)
- Produces: No new interfaces

- [ ] **Step 1: Add snooze_check_interval to seed defaults**

In `src/api/db/seedAppSettings.ts`, add a comma after the `log_level` entry's closing brace (line 21) and append the new entry:

```typescript
    {
        key: "log_level",
        value: "warn"
    },
    {
        key: "snooze_check_interval",
        value: "3600000"
    }
```

- [ ] **Step 2: Add imports to server.ts**

In `src/api/server.ts`, add `eq` import from drizzle-orm at line 2 (after `import "dotenv/config"`):

```typescript
import { eq } from "drizzle-orm";
```

Add `appSettings` to an import from the schema. Add after the `seedAppSettings` import (line 20):

```typescript
import { appSettings } from "./db/schema.js";
```

- [ ] **Step 3: Remove hardcoded constant and read from DB**

In `src/api/server.ts`, remove line 45:

```typescript
const SNOOZE_CHECK_INTERVAL_MS = 3600000;
```

After `await seedAppSettings(databaseClient.db);` (line 62), add the database read:

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

- [ ] **Step 4: Update setInterval to use dynamic value**

In `src/api/server.ts`, change the `setInterval` call (currently line 135 referencing `SNOOZE_CHECK_INTERVAL_MS`) to use `snoozeCheckIntervalMs`:

```typescript
    }, snoozeCheckIntervalMs);
```

- [ ] **Step 5: Add to KNOWN_SETTINGS in presenter**

In `src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts`, add to `KNOWN_SETTINGS` after the `pr_body_template` entry (line 47):

```typescript
    snooze_check_interval: {
        label: "Snooze Check Interval",
        description:
            "How often the server checks for expired vulnerability snoozes (milliseconds). Requires restart.",
        options: [
            { label: "15 minutes", value: "900000" },
            { label: "30 minutes", value: "1800000" },
            { label: "1 hour", value: "3600000" },
            { label: "4 hours", value: "14400000" }
        ]
    }
```

- [ ] **Step 6: Run lint and type check**

Run:

```bash
yarn lint && yarn tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Run full test suite**

Run:

```bash
yarn test
```

Expected: All tests pass. No test changes needed — seed uses onConflictDoNothing so existing test DBs are unaffected.

- [ ] **Step 8: Commit**

```bash
git add src/api/db/seedAppSettings.ts src/api/server.ts src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts
git commit -m "feat(vulnerabilities): make snooze check interval configurable via app settings

Add snooze_check_interval to app settings with 1-hour default.
Server reads setting at startup from DB. UI shows dropdown with
15min/30min/1h/4h options. Requires server restart to take effect."
```
