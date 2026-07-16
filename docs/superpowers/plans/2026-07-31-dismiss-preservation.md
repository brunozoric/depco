# Dismiss State Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve dismiss/snooze state across vulnerability rescans by replacing delete+insert with upsert+stale-sweep.

**Architecture:** Replace the transaction body in `VulnerabilityService.scan()` — currently a DELETE-all then INSERT — with a per-record upsert (INSERT ON CONFLICT DO UPDATE) that leaves dismiss columns untouched, followed by a stale-row sweep that removes vulns no longer in the scan results.

**Tech Stack:** Drizzle ORM (SQLite), Vitest

## Global Constraints

- Use `lt` from drizzle-orm for stale sweep (add to existing import)
- Upsert conflict target: `[vulnerabilities.projectId, vulnerabilities.packageName, vulnerabilities.dedupKey]` (matches existing unique index `vuln_project_package_dedup_unique`)
- Do NOT include `dismissedAt`, `dismissedUntil`, `dismissedBy` in the `set` clause — that's what preserves them
- Do NOT include `id` in the `set` clause — primary key stays from original insert

---

### Task 1: Write failing tests for dismiss preservation

**Files:**

- Modify: `src/api/services/__tests__/VulnerabilityService.test.ts`

**Interfaces:**

- Consumes: existing `setupMergeFixture()`, `createTestContext()`, `seedVulnerabilities()`, `insertProject()`, `createStubPackageManagerService()`, `createStubOsvCacheService()`, `createService()`
- Produces: 3 new test cases in the `scan` describe block

- [ ] **Step 1: Add test — "preserves dismiss state when rescanning the same vulnerabilities"**

Inside `describe("scan", ...)`, add after the "clears prior vulnerability rows when a re-scan finds none" test:

```typescript
it("preserves dismiss state when rescanning the same vulnerabilities", async () => {
  const { service, db } = await setupMergeFixture();

  const firstResult = await service.scan("project-1", "/tmp/project-1", "yarn");
  expect(firstResult.total).toBe(4);

  const lodashVuln = firstResult.vulnerabilities.find(v => v.packageName === "lodash")!;
  await service.bulkDismiss([lodashVuln.id]);

  const secondResult = await service.scan("project-1", "/tmp/project-1", "yarn");

  expect(secondResult.total).toBe(4);
  const lodashAfterRescan = secondResult.vulnerabilities.find(v => v.packageName === "lodash")!;
  expect(lodashAfterRescan.dismissedAt).toBeTypeOf("number");
  expect(lodashAfterRescan.dismissedBy).toBe("user");
  expect(lodashAfterRescan.dismissedUntil).toBeNull();
});
```

- [ ] **Step 2: Add test — "preserves snooze state when rescanning the same vulnerabilities"**

```typescript
it("preserves snooze state when rescanning the same vulnerabilities", async () => {
  const { service, db } = await setupMergeFixture();

  const firstResult = await service.scan("project-1", "/tmp/project-1", "yarn");
  const lodashVuln = firstResult.vulnerabilities.find(v => v.packageName === "lodash")!;
  await service.bulkSnooze([lodashVuln.id], 30);

  const [beforeRescan] = await db
    .select()
    .from(vulnerabilities)
    .where(eq(vulnerabilities.id, lodashVuln.id))
    .all();

  const secondResult = await service.scan("project-1", "/tmp/project-1", "yarn");

  const lodashAfterRescan = secondResult.vulnerabilities.find(v => v.packageName === "lodash")!;
  expect(lodashAfterRescan.dismissedAt).toBe(beforeRescan!.dismissedAt);
  expect(lodashAfterRescan.dismissedUntil).toBe(beforeRescan!.dismissedUntil);
  expect(lodashAfterRescan.dismissedBy).toBe("user");
});
```

- [ ] **Step 3: Add test — "removes fixed vulnerabilities on rescan"**

```typescript
it("removes fixed vulnerabilities on rescan", async () => {
  const auditVulns: IAuditVulnerability[] = [
    {
      packageName: "left-pad",
      severity: "high",
      title: "Issue",
      advisoryUrl: null,
      cveId: "CVE-1111",
      vulnerableRange: "<1.3.0",
      fixVersion: "1.3.0"
    }
  ];

  let currentAuditVulns = auditVulns;
  const packageManagerService = createStubPackageManagerService(async () => currentAuditVulns);
  const osvCacheService = createStubOsvCacheService(async () => new Map());
  const { service, db } = await createService(packageManagerService, osvCacheService);

  await insertProject(db, "project-1", "Project One");
  await insertScanResult(db, "project-1", "left-pad", "1.2.0");

  const firstResult = await service.scan("project-1", "/tmp/project-1", "yarn");
  expect(firstResult.total).toBe(1);

  currentAuditVulns = [];
  const secondResult = await service.scan("project-1", "/tmp/project-1", "yarn");

  expect(secondResult.total).toBe(0);
  expect(await db.select().from(vulnerabilities).all()).toHaveLength(0);
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `yarn vitest run src/api/services/__tests__/VulnerabilityService.test.ts`
Expected: First two new tests FAIL (dismiss state lost after rescan). Third test should PASS (existing behavior already clears rows when no vulns found — this test documents the continued behavior after refactor).

- [ ] **Step 5: Commit failing tests**

```bash
git add src/api/services/__tests__/VulnerabilityService.test.ts
git commit -m "test: add failing tests for dismiss state preservation across rescans"
```

---

### Task 2: Replace delete+insert with upsert+stale-sweep

**Files:**

- Modify: `src/api/services/VulnerabilityService.ts:1` (add `lt` to import)
- Modify: `src/api/services/VulnerabilityService.ts:161-177` (replace transaction body)

**Interfaces:**

- Consumes: `vulnerabilities` schema, `mergeMapKey()`, `generateId()`, drizzle `lt` operator
- Produces: same `scan()` return type (`Abstraction.ScanResult`), same public API — internal change only

- [ ] **Step 1: Add `lt` to drizzle-orm import**

In `src/api/services/VulnerabilityService.ts` line 1, add `lt` to the import:

```typescript
import { and, eq, inArray, isNotNull, isNull, like, lt, lte, or, type SQL } from "drizzle-orm";
```

- [ ] **Step 2: Replace the transaction body in `scan()`**

Replace lines 161-177 (from `const scannedAt = Date.now();` through the transaction closing brace) with:

```typescript
const scannedAt = Date.now();
const records: Abstraction.Vulnerability[] = Array.from(merged.values()).map(entry => ({
  id: generateId(),
  projectId,
  scannedAt,
  dismissedAt: null,
  dismissedUntil: null,
  dismissedBy: null,
  ...entry
}));

await this.databaseClient.db.transaction(async tx => {
  for (const record of records) {
    await tx
      .insert(vulnerabilities)
      .values(record)
      .onConflictDoUpdate({
        target: [vulnerabilities.projectId, vulnerabilities.packageName, vulnerabilities.dedupKey],
        set: {
          severity: record.severity,
          title: record.title,
          advisoryUrl: record.advisoryUrl,
          cveId: record.cveId,
          vulnerableRange: record.vulnerableRange,
          fixVersion: record.fixVersion,
          source: record.source,
          scannedAt: record.scannedAt
        }
      })
      .run();
  }
  await tx
    .delete(vulnerabilities)
    .where(and(eq(vulnerabilities.projectId, projectId), lt(vulnerabilities.scannedAt, scannedAt)))
    .run();
});
```

**Note:** The `records` array still has `dismissedAt: null` etc. — these values are used only on first insert (no conflict). On conflict (existing row), the `set` clause fires instead, which omits dismiss columns, so the DB keeps whatever was there.

- [ ] **Step 3: Update the return value to reflect preserved dismiss state**

After the transaction, the `records` array still has `dismissedAt: null` for all entries (it was built before the upsert). For the return value to reflect preserved dismiss state, re-query the rows:

Replace lines 179-180:

```typescript
const counts = computeCounts(records);
return { vulnerabilities: records, counts, total: records.length };
```

With:

```typescript
const persisted = await this.databaseClient.db
  .select()
  .from(vulnerabilities)
  .where(eq(vulnerabilities.projectId, projectId))
  .all();
const result = persisted.map(toVulnerability);
const counts = computeCounts(result.map(v => ({ severity: v.severity })));
return { vulnerabilities: result, counts, total: result.length };
```

- [ ] **Step 4: Run all VulnerabilityService tests**

Run: `yarn vitest run src/api/services/__tests__/VulnerabilityService.test.ts`
Expected: ALL tests pass, including the two previously failing dismiss-preservation tests.

- [ ] **Step 5: Run full test suite**

Run: `yarn vitest run`
Expected: All 1309+ tests pass. No regressions.

- [ ] **Step 6: Commit**

```bash
git add src/api/services/VulnerabilityService.ts
git commit -m "feat(vulnerabilities): preserve dismiss state across rescans via upsert"
```
