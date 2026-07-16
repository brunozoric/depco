# Changelog Dedup Range Comparison

## Problem

The POST `/api/changelogs/:packageName/re-resolve` endpoint uses simple active-job dedup: if any changelog job is pending/running for the package, skip enqueue entirely. The GET handler already has smarter logic that compares version ranges and enqueues a supplementary job for the uncovered portion. The POST handler should match.

## Approach

Extract a shared file-local helper `enqueueChangelogIfNeeded` used by both GET and POST handlers in `src/api/routes/changelogs.ts`.

## Helper Design

```typescript
interface EnqueueChangelogDeps {
  db: DatabaseClient.Interface["db"];
  jobWorker: JobWorker.Interface;
}

async function enqueueChangelogIfNeeded(
  deps: EnqueueChangelogDeps,
  packageName: string,
  from: string,
  to: string
): Promise<void>;
```

### Logic

1. Query for active changelog job (pending/running) matching `referenceId = packageName`.
2. No active job: enqueue `{ packageName, from, to }`.
3. Active job found, parse its `packages` JSON:
   - `activeJob.to < requested.to`: enqueue supplementary `{ packageName, from: activeJob.to, to }`.
   - `activeJob.to >= requested.to`: skip (range covered).
4. Malformed packages JSON: enqueue fresh full-range job (safety fallback).

## Handler Changes

### GET handler

Replace inline dedup block (current lines 37-82) with:

- Keep `hasUnfetched` guard.
- Call `enqueueChangelogIfNeeded(deps, packageName, from, to)`.
- Set `resolving = true`.

### POST handler

Replace inline dedup block (current lines 100-119) with:

- Call `enqueueChangelogIfNeeded(deps, packageName, from, to)` after `resetFailed`, before `getChangelogs`.

## Behavioral Decision

When an active job covers the requested range, POST re-resolve skips enqueue even though `resetFailed()` just cleared source='none' entries. The active job will pick up those now-fetchable entries.

## Tests

Existing coverage (no changes needed):

- GET: no active job, active job covers range, active job extends beyond, supplementary job enqueue.
- POST: no active job enqueues, active job exists skips.

New tests for POST:

- Active job doesn't cover requested range: enqueues supplementary job for gap.
- Active job covers requested range: skips enqueue.
- Active job has malformed packages JSON: enqueues fresh full-range job.
