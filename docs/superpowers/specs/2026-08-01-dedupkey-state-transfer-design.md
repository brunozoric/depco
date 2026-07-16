# Feature 4: Handle DedupKey Changes Across Rescans

## Problem

`computeDedupKey()` uses a priority cascade: CVE ID > hashed advisory URL > hashed (packageName + title). When a CVE is assigned to a vulnerability after the initial scan, the dedupKey changes from a hashed advisory URL to the CVE ID. The upsert creates a new row (new dedupKey), and the old row (old dedupKey) is swept as stale. Any dismiss or snooze state on the old row is lost.

## Solution

Pre-upsert state transfer inside `VulnerabilityService.scan()`. Before the upsert transaction, detect existing rows that share an advisory URL with incoming records but have a different dedupKey. Transfer `dismissedAt`, `dismissedUntil`, and `dismissedBy` from old rows to new records before upsert executes.

## Approach

**Approach A (chosen): Pre-upsert state transfer in scan transaction**

After building the `records` array (line 190) and before the transaction (line 192):

1. Collect all non-null `advisoryUrl` values from `records`
2. Query existing vulnerability rows for this project where `advisoryUrl IN (...)`
3. Build lookup: `Map<advisoryUrl:packageName, { dismissedAt, dismissedUntil, dismissedBy, dedupKey }>` (keyed by `advisoryUrl + packageName` tuple to avoid cross-package collisions)
4. For each record: if its `advisoryUrl + packageName` matches a lookup entry with a **different** `dedupKey` and the existing row is dismissed/snoozed, copy dismiss fields onto the record
5. Upsert proceeds with transferred state. Old rows swept normally.

Rejected alternatives:

- Post-sweep reconciliation: deleted rows already gone, requires deferred sweep or pre-delete query
- Secondary dedup index on advisory URL: schema migration, advisory URLs not always unique per vulnerability

## Insertion Point

`src/api/services/VulnerabilityService.ts`, between line 190 (records array built) and line 192 (transaction starts).

## Match Strategy

Match by `advisoryUrl` (same project, same package). Advisory URLs are stable identifiers that persist even when CVE IDs are assigned. Only transfer when dedupKeys differ — if they match, the existing ON CONFLICT upsert already preserves state.

## Edge Cases

- **Multiple old rows share same advisory URL:** Take the one with the most recent `dismissedAt` (most recent user action wins).
- **Record has null `advisoryUrl`:** Skip — no match possible without a stable secondary identifier.
- **Old row not dismissed:** Nothing to transfer. Skip.
- **Multiple new records match same old row:** All inherit the state. This handles the case where one advisory splits into multiple CVE records (each CVE gets its own row, all should carry the dismiss state).
- **DedupKeys match:** Normal upsert path. ON CONFLICT already preserves `dismissedAt`/`dismissedUntil`/`dismissedBy` (they are not in the `set` clause). No transfer needed.

## Changes

### VulnerabilityService.ts

Add a private method `transferDismissState(projectId, records)` that:

1. Extracts non-null advisory URLs from records
2. Queries existing rows: `SELECT advisoryUrl, dedupKey, packageName, dismissedAt, dismissedUntil, dismissedBy FROM vulnerabilities WHERE projectId = ? AND advisoryUrl IN (?)`
3. Filters to only dismissed/snoozed rows (`dismissedAt IS NOT NULL`)
4. Builds lookup map keyed by `advisoryUrl + packageName` (both must match)
5. Iterates records, copies dismiss fields when advisoryUrl+packageName matches but dedupKey differs
6. Mutates records in place (they are about to be consumed by the transaction)

### No schema changes

No new columns, tables, or indices.

### No frontend changes

State transfer is invisible to the UI — the vulnerability simply retains its dismiss/snooze state across the dedupKey change.

## Testing

In `VulnerabilityService.test.ts`:

1. **Dismissed vuln gets CVE assigned:** Insert vuln with hashed advisory URL dedupKey, dismiss it, rescan with same advisory URL but now with CVE ID. Verify new row has dismiss state.
2. **Snoozed vuln gets CVE assigned:** Same as above but with snooze. Verify `dismissedUntil` transfers.
3. **Null advisory URL:** Insert vuln with null advisory URL, dismiss it, rescan with different dedupKey. Verify no state transfer (null can't match).
4. **Same dedupKey (no change):** Insert vuln, dismiss it, rescan with same dedupKey. Verify normal upsert preserves state (existing behavior, regression guard).
5. **Multiple CVEs from one advisory:** Insert dismissed vuln with hashed advisory URL, rescan where OSV now reports two CVE aliases. Both new rows should inherit dismiss state.

## Scope

- Files modified: 1 (`src/api/services/VulnerabilityService.ts`)
- Files tested: 1 (`src/api/services/__tests__/VulnerabilityService.test.ts`)
- Schema changes: 0
- Frontend changes: 0
- New dependencies: 0
