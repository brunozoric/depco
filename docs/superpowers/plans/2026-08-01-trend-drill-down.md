# Trend Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Click a date point on VulnTrendChart to navigate to the vulnerabilities page filtered by that date.

**Architecture:** Add `scannedDate` filter to the existing vulnerability list API. Make VulnTrendChart clickable via Recharts onClick. Fix the router to handle URLs with query strings. Read the `scannedDate` query param in VulnerabilitiesPresenter to auto-apply the filter.

**Tech Stack:** Fastify, Drizzle ORM, Zod, React, Mantine, Recharts, MobX

## Global Constraints

- Named interfaces only (no inline structural types)
- Use yarn for all commands
- Use full words, not abbreviations for NEW names

---

### Task 1: Backend — scannedDate filter

**Files:**

- Modify: `src/api/services/abstractions/VulnerabilityService.ts:26-33` (add `scannedDate` to `IVulnFilters`)
- Modify: `src/api/services/VulnerabilityService.ts:78-106` (add date range condition in `buildWhere`)
- Modify: `src/shared/routes/vulnerabilities.ts:38-44` (add `scannedDate` to querystring schema of `listVulnerabilitiesRoute`)
- Modify: `src/api/routes/vulnerabilities.ts:48-66` (pass `scannedDate` through `buildFilters`)
- Test: `src/api/services/__tests__/VulnerabilityService.test.ts`

**Interfaces:**

- Consumes: existing `IVulnFilters`, `buildWhere`, `vulnerabilities.scannedAt` column (integer ms timestamp)
- Produces: `IVulnFilters.scannedDate?: string` (YYYY-MM-DD format) — filters vulns whose `scannedAt` falls within that UTC day

- [ ] **Step 1: Add `scannedDate` to `IVulnFilters`**

In `src/api/services/abstractions/VulnerabilityService.ts`, add to the `IVulnFilters` interface:

```typescript
scannedDate?: string;
```

- [ ] **Step 2: Add date range condition in `buildWhere`**

In `src/api/services/VulnerabilityService.ts`, add to `buildWhere` before the `includeDismissed` check. Import `gte` from drizzle-orm (add to existing import on line 1):

```typescript
if (filters?.scannedDate !== undefined) {
  const dayStart = new Date(filters.scannedDate + "T00:00:00Z").getTime();
  const dayEnd = dayStart + 86400000;
  conditions.push(gte(vulnerabilities.scannedAt, dayStart));
  conditions.push(lt(vulnerabilities.scannedAt, dayEnd));
}
```

- [ ] **Step 3: Add `scannedDate` to route querystring**

In `src/shared/routes/vulnerabilities.ts`, add to the `listVulnerabilitiesRoute` querystring schema:

```typescript
scannedDate: z.string().optional();
```

Also add it to `getProjectVulnerabilitiesRoute` and `exportVulnerabilitiesRoute` querystrings for consistency.

- [ ] **Step 4: Pass `scannedDate` through `buildFilters`**

In `src/api/routes/vulnerabilities.ts`, update the `IVulnQuerystring` interface and `buildFilters` function:

Add to `IVulnQuerystring`:

```typescript
scannedDate?: string | undefined;
```

Add to `buildFilters`:

```typescript
if (query.scannedDate) {
  filters.scannedDate = query.scannedDate;
}
```

- [ ] **Step 5: Write tests**

In `src/api/services/__tests__/VulnerabilityService.test.ts`, add to the `getAll` describe block:

```typescript
it("filters by scannedDate", async () => {
  const packageManagerService = createStubPackageManagerService(async () => []);
  const osvCacheService = createStubOsvCacheService(async () => new Map());
  const { service, db } = await createService(packageManagerService, osvCacheService);

  await insertProject(db, "project-1", "Project One");

  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86400000);

  await db.insert(vulnerabilities).values([
    {
      id: generateId(),
      projectId: "project-1",
      packageName: "pkg-today",
      severity: "high",
      title: "Today Issue",
      advisoryUrl: null,
      cveId: "CVE-TODAY",
      dedupKey: "CVE-TODAY",
      vulnerableRange: null,
      fixVersion: null,
      source: "audit",
      scannedAt: today.getTime()
    },
    {
      id: generateId(),
      projectId: "project-1",
      packageName: "pkg-yesterday",
      severity: "low",
      title: "Yesterday Issue",
      advisoryUrl: null,
      cveId: "CVE-YESTERDAY",
      dedupKey: "CVE-YESTERDAY",
      vulnerableRange: null,
      fixVersion: null,
      source: "audit",
      scannedAt: yesterday.getTime()
    }
  ]);

  const results = await service.getAll({ scannedDate: todayStr });

  expect(results).toHaveLength(1);
  expect(results[0]!.packageName).toBe("pkg-today");
});
```

- [ ] **Step 6: Run tests**

Run: `yarn vitest run src/api/services/__tests__/VulnerabilityService.test.ts`
Expected: ALL tests pass.

Run: `yarn vitest run`
Expected: Full suite passes.

- [ ] **Step 7: Commit**

```bash
git add src/api/services/abstractions/VulnerabilityService.ts src/api/services/VulnerabilityService.ts src/shared/routes/vulnerabilities.ts src/api/routes/vulnerabilities.ts src/api/services/__tests__/VulnerabilityService.test.ts
git commit -m "feat(vulnerabilities): add scannedDate filter for trend drill-down"
```

---

### Task 2: Frontend — chart click handler, router fix, date filter UI

**Files:**

- Modify: `src/ui/shared/router/router.ts:3-6` (fix `navigate` to handle URLs with query strings)
- Modify: `src/ui/presentation/dashboard/Dashboard/components/VulnTrendChart.tsx` (add click handler)
- Modify: `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx` (wire `onDateClick`)
- Modify: `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts` (add `scannedDate` to `IVulnListFilters`)
- Modify: `src/ui/features/vulnerabilities/VulnerabilitiesGateway.ts` (pass `scannedDate` in query)
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts` (add `scannedDate` to VM)
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts` (read URL param, expose in VM)
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx` (show date filter badge)

**Interfaces:**

- Consumes: `navigate()`, Recharts `LineChart` onClick event, `VulnerabilitiesGateway.ListFilters`, `VulnerabilitiesPresenter.ViewModel`
- Produces: `onDateClick(date: string)` prop on VulnTrendChart, `scannedDate` in VM and filter, date badge on vuln page

- [ ] **Step 1: Fix `navigate` to handle query strings**

In `src/ui/shared/router/router.ts`, update `navigate` to compare the full URL (pathname + search), not just pathname:

```typescript
export function navigate(path: string): void {
  const current = window.location.pathname + window.location.search;
  if (current === path) {
    return;
  }
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
```

- [ ] **Step 2: Add click handler to VulnTrendChart**

In `src/ui/presentation/dashboard/Dashboard/components/VulnTrendChart.tsx`:

Add `onDateClick` to props:

```typescript
interface VulnTrendChartProps {
  data: DashboardGateway.VulnTrendPoint[];
  range: string;
  onRangeChange: (range: string) => void;
  onDateClick?: (date: string) => void;
}
```

Add the click handler to `LineChart`. Recharts `onClick` receives `(data, index)` where `data.activePayload[0].payload.date` is the date string:

```typescript
<LineChart
    data={data}
    onClick={onDateClick ? (event) => {
        const date = event?.activePayload?.[0]?.payload?.date;
        if (date) {
            onDateClick(date);
        }
    } : undefined}
    style={onDateClick ? { cursor: "pointer" } : undefined}
>
```

- [ ] **Step 3: Wire onDateClick in DashboardPage**

In `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx`, add the callback:

```typescript
<VulnTrendChart
    data={vm.vulnTrend}
    range={vm.vulnTrendRange}
    onRangeChange={range => presenter.setVulnTrendRange(range)}
    onDateClick={date => navigate(`/vulnerabilities?scannedDate=${date}`)}
/>
```

Import `navigate` from `#ui/shared/router/router.js`.

- [ ] **Step 4: Add `scannedDate` to gateway filter types**

In `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts`, add to `IVulnListFilters`:

```typescript
scannedDate?: string;
```

In `src/ui/features/vulnerabilities/VulnerabilitiesGateway.ts`, add to `buildListQuery`:

```typescript
if (filters?.scannedDate) {
  query["scannedDate"] = filters.scannedDate;
}
```

- [ ] **Step 5: Add `scannedDate` to presenter VM and logic**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts`, add to `IVulnerabilitiesViewModel`:

```typescript
scannedDate: string | null;
```

Add to `IVulnerabilitiesPresenter`:

```typescript
clearScannedDate(): void;
```

In `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts`:

Add a private field:

```typescript
private scannedDate: string | null = null;
```

In the constructor or `load` method, read the URL param:

```typescript
const urlParams = new URLSearchParams(window.location.search);
this.scannedDate = urlParams.get("scannedDate");
```

Include `scannedDate` in the filters passed to `loadVulnerabilitiesUseCase.execute()`.

Add `scannedDate` to the `vm` getter return.

Implement `clearScannedDate`:

```typescript
public clearScannedDate = (): void => {
    this.scannedDate = null;
    navigate("/vulnerabilities");
    void this.reload();
};
```

Where `reload` calls `loadVulnerabilitiesUseCase.execute` with current filters.

- [ ] **Step 6: Show date filter badge on VulnerabilitiesPage**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx`, add a date filter indicator in the filters Group (after the existing filters):

```typescript
{vm.scannedDate && (
    <Badge
        variant="filled"
        color="blue"
        rightSection={
            <UnstyledButton onClick={() => presenter.clearScannedDate()}>
                ✕
            </UnstyledButton>
        }
    >
        Date: {vm.scannedDate}
    </Badge>
)}
```

- [ ] **Step 7: Run tests and type check**

Run: `yarn vitest run`
Expected: Full suite passes.

Run: `yarn tsc --noEmit`
Expected: No new type errors.

- [ ] **Step 8: Commit**

```bash
git add src/ui/shared/router/router.ts src/ui/presentation/dashboard/Dashboard/components/VulnTrendChart.tsx src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx src/ui/features/vulnerabilities/ src/ui/presentation/vulnerabilities/VulnerabilityList/
git commit -m "feat(dashboard): add trend chart drill-down to vulnerabilities page"
```
