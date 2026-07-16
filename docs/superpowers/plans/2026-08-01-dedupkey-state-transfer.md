# DedupKey State Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve dismiss/snooze state when a vulnerability's dedupKey changes across rescans (e.g., CVE assigned after initial scan).

**Architecture:** Add a `transferDismissState()` method to `VulnerabilityServiceImpl` that runs between record construction and the upsert transaction. It queries existing dismissed/snoozed rows that share an advisory URL + package name with incoming records but have a different dedupKey, then copies the dismiss fields onto the new records before upsert.

**Tech Stack:** TypeScript, Drizzle ORM, SQLite, Vitest

## Global Constraints

- Use `yarn` for dependency management
- Use full words in identifiers (e.g., "Vulnerability" not "Vuln")
- No frontend changes
- No schema changes
- TDD: write failing tests first

---

### Task 1: Add transferDismissState and tests for dedupKey change scenarios

**Files:**

- Modify: `src/api/services/VulnerabilityService.ts:182-191` (insert call between record construction and transaction)
- Test: `src/api/services/__tests__/VulnerabilityService.test.ts`

**Interfaces:**

- Consumes: `this.databaseClient.db` (Drizzle), `vulnerabilities` schema table, existing `Abstraction.Vulnerability` type
- Produces: No new public interfaces — `transferDismissState` is a private method

- [ ] **Step 1: Write failing test — dismissed vuln gets CVE assigned**

Add a new `describe("dedupKey state transfer")` block inside the existing `describe("scan")` block (after the "removes fixed vulnerabilities on rescan" test around line 425). The test creates a vuln with a hashed advisory URL dedupKey, dismisses it, then rescans where the same advisory URL now has a CVE ID:

```typescript
describe("dedupKey state transfer", () => {
  it("transfers dismiss state when dedupKey changes from hashed advisory URL to CVE", async () => {
    const advisoryUrl = "https://example.com/GHSA-test-1";

    let currentAuditVulns: IAuditVulnerability[] = [
      {
        packageName: "left-pad",
        severity: "high",
        title: "Prototype Pollution",
        advisoryUrl,
        cveId: null,
        vulnerableRange: "<1.3.0",
        fixVersion: "1.3.0"
      }
    ];

    const packageManagerService = createStubPackageManagerService(async () => currentAuditVulns);
    const osvCacheService = createStubOsvCacheService(async () => new Map());
    const { service, db } = await createService(packageManagerService, osvCacheService);

    await insertProject(db, "project-1", "Project One");
    await insertScanResult(db, "project-1", "left-pad", "1.2.0");

    const firstResult = await service.scan("project-1", "/tmp/project-1", "yarn");
    expect(firstResult.total).toBe(1);

    const vuln = firstResult.vulnerabilities[0]!;
    expect(vuln.cveId).toBeNull();
    await service.bulkDismiss([vuln.id]);

    currentAuditVulns = [
      {
        packageName: "left-pad",
        severity: "high",
        title: "Prototype Pollution",
        advisoryUrl,
        cveId: "CVE-2024-9999",
        vulnerableRange: "<1.3.0",
        fixVersion: "1.3.0"
      }
    ];

    const secondResult = await service.scan("project-1", "/tmp/project-1", "yarn");

    expect(secondResult.total).toBe(1);
    const updated = secondResult.vulnerabilities[0]!;
    expect(updated.cveId).toBe("CVE-2024-9999");
    expect(updated.dedupKey).toBe("CVE-2024-9999");
    expect(updated.dismissedAt).toBeTypeOf("number");
    expect(updated.dismissedBy).toBe("user");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
yarn test src/api/services/__tests__/VulnerabilityService.test.ts
```

Expected: FAIL — `updated.dismissedAt` is `null` because the new dedupKey creates a fresh row with no dismiss state.

- [ ] **Step 3: Write failing test — snoozed vuln gets CVE assigned**

Add inside the same `describe("dedupKey state transfer")` block:

```typescript
it("transfers snooze state when dedupKey changes", async () => {
  const advisoryUrl = "https://example.com/GHSA-test-2";

  let currentAuditVulns: IAuditVulnerability[] = [
    {
      packageName: "left-pad",
      severity: "high",
      title: "Prototype Pollution",
      advisoryUrl,
      cveId: null,
      vulnerableRange: "<1.3.0",
      fixVersion: "1.3.0"
    }
  ];

  const packageManagerService = createStubPackageManagerService(async () => currentAuditVulns);
  const osvCacheService = createStubOsvCacheService(async () => new Map());
  const { service, db } = await createService(packageManagerService, osvCacheService);

  await insertProject(db, "project-1", "Project One");
  await insertScanResult(db, "project-1", "left-pad", "1.2.0");

  const firstResult = await service.scan("project-1", "/tmp/project-1", "yarn");
  const vuln = firstResult.vulnerabilities[0]!;
  await service.bulkSnooze([vuln.id], 30);

  const [snoozedRow] = await db
    .select()
    .from(vulnerabilities)
    .where(eq(vulnerabilities.id, vuln.id))
    .all();

  currentAuditVulns = [
    {
      packageName: "left-pad",
      severity: "high",
      title: "Prototype Pollution",
      advisoryUrl,
      cveId: "CVE-2024-8888",
      vulnerableRange: "<1.3.0",
      fixVersion: "1.3.0"
    }
  ];

  const secondResult = await service.scan("project-1", "/tmp/project-1", "yarn");

  const updated = secondResult.vulnerabilities[0]!;
  expect(updated.dedupKey).toBe("CVE-2024-8888");
  expect(updated.dismissedAt).toBe(snoozedRow!.dismissedAt);
  expect(updated.dismissedUntil).toBe(snoozedRow!.dismissedUntil);
  expect(updated.dismissedBy).toBe("user");
});
```

- [ ] **Step 4: Write failing test — null advisory URL skips transfer**

```typescript
it("does not transfer state when advisory URL is null", async () => {
  let currentAuditVulns: IAuditVulnerability[] = [
    {
      packageName: "left-pad",
      severity: "high",
      title: "Some Issue",
      advisoryUrl: null,
      cveId: null,
      vulnerableRange: "<1.3.0",
      fixVersion: "1.3.0"
    }
  ];

  const packageManagerService = createStubPackageManagerService(async () => currentAuditVulns);
  const osvCacheService = createStubOsvCacheService(async () => new Map());
  const { service, db } = await createService(packageManagerService, osvCacheService);

  await insertProject(db, "project-1", "Project One");
  await insertScanResult(db, "project-1", "left-pad", "1.2.0");

  const firstResult = await service.scan("project-1", "/tmp/project-1", "yarn");
  const vuln = firstResult.vulnerabilities[0]!;
  await service.bulkDismiss([vuln.id]);

  currentAuditVulns = [
    {
      packageName: "left-pad",
      severity: "high",
      title: "Different Issue",
      advisoryUrl: null,
      cveId: "CVE-2024-7777",
      vulnerableRange: "<1.3.0",
      fixVersion: "1.3.0"
    }
  ];

  const secondResult = await service.scan("project-1", "/tmp/project-1", "yarn");

  const updated = secondResult.vulnerabilities[0]!;
  expect(updated.dedupKey).toBe("CVE-2024-7777");
  expect(updated.dismissedAt).toBeNull();
});
```

**Note:** This test's `insertProject` and `insertScanResult` calls need `db` not `service` — the helper takes a db instance. The implementer should use the `{ service, db }` destructuring from `createService` as in the other tests.

- [ ] **Step 5: Write failing test — multiple CVEs from one advisory inherit state**

```typescript
it("transfers dismiss state to multiple CVE records split from one advisory", async () => {
  const advisoryUrl = "https://example.com/GHSA-test-3";

  let currentAuditVulns: IAuditVulnerability[] = [
    {
      packageName: "lodash",
      severity: "high",
      title: "Prototype Pollution",
      advisoryUrl,
      cveId: null,
      vulnerableRange: "<4.17.21",
      fixVersion: "4.17.21"
    }
  ];

  const osvResults = new Map<string, IOsvAdvisory[]>();

  const packageManagerService = createStubPackageManagerService(async () => currentAuditVulns);
  const osvCacheService = createStubOsvCacheService(async () => osvResults);
  const { service, db } = await createService(packageManagerService, osvCacheService);

  await insertProject(db, "project-1", "Project One");
  await insertScanResult(db, "project-1", "lodash", "4.0.0");

  const firstResult = await service.scan("project-1", "/tmp/project-1", "yarn");
  expect(firstResult.total).toBe(1);
  await service.bulkDismiss([firstResult.vulnerabilities[0]!.id]);

  currentAuditVulns = [];
  osvResults.set(osvCacheKey("lodash", "4.0.0"), [
    {
      id: "GHSA-lodash-split",
      summary: "Prototype Pollution in lodash",
      severity: "high",
      aliases: ["CVE-2024-1111", "CVE-2024-2222", "GHSA-lodash-split"],
      advisoryUrl,
      vulnerableRange: "<4.17.21",
      fixVersion: "4.17.21"
    }
  ]);

  const secondResult = await service.scan("project-1", "/tmp/project-1", "yarn");

  expect(secondResult.total).toBe(2);
  for (const vuln of secondResult.vulnerabilities) {
    expect(vuln.dismissedAt).toBeTypeOf("number");
    expect(vuln.dismissedBy).toBe("user");
  }
});
```

- [ ] **Step 6: Run all new tests to verify they fail**

Run:

```bash
yarn test src/api/services/__tests__/VulnerabilityService.test.ts
```

Expected: 4 new tests FAIL (dismiss state not transferred). Existing tests still pass.

- [ ] **Step 7: Implement transferDismissState method**

Add this private method to `VulnerabilityServiceImpl` in `src/api/services/VulnerabilityService.ts` (after the `mergeOsvAdvisory` method, around line 285):

```typescript
private async transferDismissState(
    projectId: string,
    records: Abstraction.Vulnerability[]
): Promise<void> {
    const advisoryUrls = records
        .map(r => r.advisoryUrl)
        .filter((url): url is string => url !== null);

    if (advisoryUrls.length === 0) {
        return;
    }

    const existingRows = await this.databaseClient.db
        .select({
            advisoryUrl: vulnerabilities.advisoryUrl,
            packageName: vulnerabilities.packageName,
            dedupKey: vulnerabilities.dedupKey,
            dismissedAt: vulnerabilities.dismissedAt,
            dismissedUntil: vulnerabilities.dismissedUntil,
            dismissedBy: vulnerabilities.dismissedBy
        })
        .from(vulnerabilities)
        .where(
            and(
                eq(vulnerabilities.projectId, projectId),
                inArray(vulnerabilities.advisoryUrl, advisoryUrls),
                isNotNull(vulnerabilities.dismissedAt)
            )
        )
        .all();

    if (existingRows.length === 0) {
        return;
    }

    const lookup = new Map<string, typeof existingRows[number]>();
    for (const row of existingRows) {
        if (!row.advisoryUrl) {
            continue;
        }
        const key = `${row.advisoryUrl}::${row.packageName}`;
        const existing = lookup.get(key);
        if (!existing || (row.dismissedAt ?? 0) > (existing.dismissedAt ?? 0)) {
            lookup.set(key, row);
        }
    }

    for (const record of records) {
        if (!record.advisoryUrl) {
            continue;
        }
        const key = `${record.advisoryUrl}::${record.packageName}`;
        const match = lookup.get(key);
        if (match && match.dedupKey !== record.dedupKey) {
            record.dismissedAt = match.dismissedAt;
            record.dismissedUntil = match.dismissedUntil;
            record.dismissedBy = match.dismissedBy;
        }
    }
}
```

- [ ] **Step 8: Call transferDismissState in scan()**

In `src/api/services/VulnerabilityService.ts`, add the call between record construction (line 190) and the transaction (line 192):

```typescript
// After: const records: Abstraction.Vulnerability[] = ...
await this.transferDismissState(projectId, records);
// Before: await this.databaseClient.db.transaction(async tx => {
```

The exact edit: insert `await this.transferDismissState(projectId, records);` on a new line between line 190 (`...entry }));`) and line 192 (`await this.databaseClient.db.transaction`).

- [ ] **Step 9: Run all tests**

Run:

```bash
yarn test src/api/services/__tests__/VulnerabilityService.test.ts
```

Expected: All tests pass — both new dedupKey transfer tests and all existing tests (dismiss preservation, snooze preservation, stale sweep, merge).

- [ ] **Step 10: Run lint and type check**

Run:

```bash
yarn lint && yarn tsc --noEmit
```

Expected: No errors.

- [ ] **Step 11: Run full test suite**

Run:

```bash
yarn test
```

Expected: All 1349+ tests pass.

- [ ] **Step 12: Commit**

```bash
git add src/api/services/VulnerabilityService.ts src/api/services/__tests__/VulnerabilityService.test.ts
git commit -m "feat(vulnerabilities): transfer dismiss/snooze state across dedupKey changes

When a CVE is assigned after initial scan, the dedupKey changes from
hashed advisory URL to CVE ID. transferDismissState() detects this via
advisory URL + package name matching and copies dismiss fields to the
new records before upsert. Old rows are swept normally."
```
