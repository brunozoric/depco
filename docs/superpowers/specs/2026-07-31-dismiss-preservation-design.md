# Dismiss State Preservation Across Rescans

## Problem

`VulnerabilityService.scan()` deletes all vulnerabilities for a project then reinserts fresh records. This wipes `dismissedAt`, `dismissedUntil`, and `dismissedBy` columns — any dismiss or snooze state is lost on rescan.

## Solution

Replace the delete-then-insert pattern with upsert + stale sweep.

### How It Works

1. **Upsert** each merged vulnerability using `INSERT ... ON CONFLICT DO UPDATE` on the existing unique index `(projectId, packageName, dedupKey)`. The UPDATE sets `severity`, `title`, `advisoryUrl`, `cveId`, `vulnerableRange`, `fixVersion`, `source`, and `scannedAt`. Dismiss columns are **not** in the SET clause, so they survive.

2. **Sweep** stale rows: `DELETE WHERE projectId = ? AND scannedAt < currentScanTimestamp`. Removes vulnerabilities that no longer appear in the scan (i.e., they were fixed). Their dismiss state is intentionally discarded — a fixed vulnerability has no reason to remain dismissed.

Both steps run inside the existing transaction.

## Files Changed

- `src/api/services/VulnerabilityService.ts` — replace lines 172-177 in `scan()` with upsert loop + stale sweep
- Test file — add cases: dismiss preserved after rescan, fixed vulns removed, new vulns get null dismiss state

## No Changes Required

- No migration (unique index already exists)
- No schema change
- No API change
- No UI change

## Edge Cases

| Case                                                | Behavior                                                                    |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| Snoozed vuln reappears after temporary fix          | Dismiss state restored; if snooze expired, query-time expiry handles it     |
| dedupKey changes between scans (e.g., CVE assigned) | Old row swept as stale, new row inserted without dismiss. Rare, acceptable. |
| Concurrent scans for same project                   | Transaction serialization prevents conflicts                                |
| Vuln fixed (no longer in scan results)              | Swept by stale-timestamp delete. Dismiss state discarded — correct.         |
| First scan (no prior rows)                          | All inserts, no conflicts. Same as today.                                   |

## Performance

Upsert loop instead of single batch insert. Typical project has <100 vulns — negligible difference. Could batch via raw SQL if needed later.
