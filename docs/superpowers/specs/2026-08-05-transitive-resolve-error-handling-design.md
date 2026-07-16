# Per-Package Error Handling in TransitiveResolveJobExecutor

## Problem

`TransitiveResolveJobExecutor.execute()` uses `Promise.all` on batches of 10 packages (line 46). If any single `getPackageInfo` call throws (network error, registry timeout, malformed response), the entire batch fails and the job crashes. Unresolved packages stay `registryResolved: 0` permanently with no way to recover short of a full re-scan.

## Design

Wrap each `getPackageInfo` call in try/catch inside the batch map. On failure:

1. Log the error: `context.appendLog("Failed to resolve <name>: <message>")`
2. Mark the package as resolved (`registryResolved: 1`) with no version data — prevents infinite retry loop on permanently broken packages
3. Track failed count for the summary log
4. Continue processing remaining packages in the batch and subsequent batches

Failed packages get `registryResolved: 1` but keep their existing `latestVersion`/`latestInRange`/`upgradeType` values (nulls from initial scan insert). The UI already handles null version data gracefully (shows "pending" badges).

Summary log changes from `"Resolved N transitive dependencies."` to `"Resolved N transitive dependencies (M failed)."` when failures occur.

WebSocket broadcast gains an optional `failed` count: `{ projectId, resolved, failed }`. The `WSTransitiveResolveComplete` shared type gets `failed: number` added.

## Files Changed

- `src/api/services/jobExecutors/TransitiveResolveJobExecutor.ts` — try/catch per package, failed count tracking
- `src/shared/websocket/types.ts` — add `failed: number` to `WSTransitiveResolveComplete`
- `src/api/services/jobExecutors/__tests__/TransitiveResolveJobExecutor.test.ts` — test single failure in batch

## Testing

- Test: one package in batch throws, others resolve successfully — verify all packages marked `registryResolved: 1`, failed package has null version data, success packages have real version data
- Test: summary log includes failed count
- Test: broadcast includes failed count
