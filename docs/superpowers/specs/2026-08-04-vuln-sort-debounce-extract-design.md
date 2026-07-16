# Vulnerability Sort/Page, URL Debounce, Sort Extraction

Three independent improvements:

1. Add sort/page to per-project vulnerability route
2. Add debounce to UrlFilterService.update()
3. Extract vulnerability sort/enrich into VulnerabilityService

## Task 1: Per-project vulnerability sort/page

### Route definition

Add `page`, `pageSize`, `sortBy`, `sortOrder` to `getProjectVulnerabilitiesRoute` querystring schema — same types as `listVulnerabilitiesRoute`.

### Handler

After `enrichWithProjectNames()`, apply `sortEnrichedVulnerabilities()` + pagination (same pattern as main list handler lines 269-280).

### UI

`getByProject()` in `VulnerabilitiesGateway` already calls `buildListQuery(filters)` which maps all filter fields including sort/page. No gateway change needed. `IVulnerabilityListFilters` already has `sortBy`, `sortOrder`, `page`, `pageSize`. Caller (ProjectDetailPresenter) may need to pass sort/page if it wants to use them — otherwise server defaults apply.

## Task 2: UrlFilterService debounce

### Problem

Every keystroke in text inputs calls `update()` → `pushState` → `popstate` → `load()`. Three text inputs fire API requests on every character.

### Solution

Add debounce inside `UrlFilterService.update()` at 300ms. All updates go through this method, so one debounce covers everything.

### Implementation

- Add private `debounceTimer: ReturnType<typeof setTimeout> | null` field
- In `update()`: clear existing timer, set new 300ms timer that executes the URL push + popstate dispatch
- No interface change — `update()` signature stays the same
- No presenter or page changes needed

### Testing

- Unit test: call `update()` twice rapidly, verify URL only changes once after 300ms
- Uses `vi.useFakeTimers()` for deterministic testing

## Task 3: Extract enrichAndSort into VulnerabilityService

### Current state

Three free functions in `src/api/routes/vulnerabilities.ts`:

- `enrichWithProjectNames()` — hydrates projectName + isTransitive
- `filterByDependencyType()` — filters by direct/transitive
- `sortEnrichedVulnerabilities()` — sorts by severity/projectName/packageName

These are called by the main list route, export route, and will be called by per-project route.

### Target

New method on `IVulnerabilityService`:

```typescript
interface IEnrichAndSortOptions {
    dependencyType?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    pageSize?: number;
}

interface IEnrichedVulnerabilityResult {
    items: IEnrichedVulnerability[];
    total: number;
}

enrichAndSort(
    items: IVulnerability[],
    options: IEnrichAndSortOptions
): Promise<IEnrichedVulnerabilityResult>;
```

Method enriches items with project names, filters by dependency type, sorts, and paginates. Returns paginated items + total (pre-pagination count).

### Move IEnrichedVulnerability

Currently in routes file. Move to `abstractions/VulnerabilityService.ts` since service method returns it.

### Route handlers

Replace inline calls with single `vulnerabilityService.enrichAndSort(items, options)`. Export route passes no page/pageSize (gets all sorted items).

### VulnerabilityService needs db access

`enrichWithProjectNames()` queries `projects` and `scanResults` tables. VulnerabilityService already has db access via constructor injection.

## Files changed

### Task 1

- `src/shared/routes/vulnerabilities.ts` — add sort/page params to getProjectVulnerabilitiesRoute
- `src/api/routes/vulnerabilities.ts` — add sort/paginate to per-project handler

### Task 2

- `src/ui/features/urlFilter/UrlFilterService.ts` — add debounce to update()
- `src/ui/features/urlFilter/__tests__/UrlFilterService.test.ts` — debounce tests

### Task 3

- `src/api/services/abstractions/VulnerabilityService.ts` — add IEnrichedVulnerability, IEnrichAndSortOptions, enrichAndSort to interface
- `src/api/services/VulnerabilityService.ts` — implement enrichAndSort()
- `src/api/routes/vulnerabilities.ts` — replace inline calls with service method
- Existing route tests should still pass (behavior unchanged)
