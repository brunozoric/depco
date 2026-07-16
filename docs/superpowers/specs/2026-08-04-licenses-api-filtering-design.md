# Licenses API-Side Filtering with URL Sync

## Problem

Licenses page filters entirely client-side in `LicensesPresenter.applyFilters()`. Filters are not reflected in URL, so filtered views cannot be shared. The API already supports `projectId`, `riskTier`, `packageName`, `spdxId`, `teamId` server-side — the presenter fetches all data and filters in memory.

## Solution

1. Create a reusable, DI-injectable `UrlFilterService` that two-way syncs filter state with URL search params, using Zod schemas for type safety
2. Migrate the licenses presenter from client-side filtering to API-side filtering via the existing gateway pipeline
3. Add `violationAction` server-side filter (the only filter missing from the API)

## UrlFilterService

### Abstraction

```typescript
interface IUrlFilterService {
  read<TSchema extends z.ZodObject<z.ZodRawShape>>(schema: TSchema): Partial<z.infer<TSchema>>;

  update<TSchema extends z.ZodObject<z.ZodRawShape>>(
    schema: TSchema,
    params: Partial<Record<keyof z.infer<TSchema>, string | null>>
  ): void;

  onChange(callback: () => void): () => void;
}
```

### Behavior

- `read(schema)` — reads `window.location.search`, runs `schema.partial().safeParse()` on the parsed params. Returns only keys that exist in the schema and pass validation. Unknown params are ignored (preserved in URL but not returned).
- `update(schema, params)` — reads current URL search params, merges new values (null removes a key), validates keys exist in schema at type level, calls `navigate(pathname + "?" + newParams)` to push state. Preserves any URL params not in the schema (e.g., params from other features).
- `onChange(callback)` — registers a `popstate` listener for browser back/forward. Returns a dispose function that removes the listener.

### Type Safety

The Zod schema constrains both `read` and `update` at the TypeScript level:

```typescript
import { listLicensesRoute } from "#shared/routes/licenses.js";
const schema = listLicensesRoute.querystring;

// Type-safe reads
const filters = urlFilterService.read(schema);
filters.projectId; // string | undefined  ✓
filters.bogusKey; // ✗ type error

// Type-safe writes
urlFilterService.update(schema, { riskTier: "copyleft" }); // ✓
urlFilterService.update(schema, { foo: "bar" }); // ✗ type error
```

Runtime validation via `safeParse` catches malformed URL params (e.g., user manually edits URL with garbage values).

### Files

- `src/ui/features/urlFilter/abstractions/UrlFilterService.ts` — abstraction + createAbstraction
- `src/ui/features/urlFilter/UrlFilterService.ts` — implementation
- `src/ui/features/urlFilter/__tests__/UrlFilterService.test.ts` — tests

### DI Registration

Register in `src/ui/App.tsx` (or wherever the DI container is configured) as a singleton — one instance shared across all presenters.

## Violation Filter API Support

### Current State

The licenses list API has no `violationAction` filter. The presenter currently derives violation status client-side by joining `license_violations` data from the repository.

### Change

Add `violationAction` query param to the licenses list route. The API handler joins the `license_violations` table using a subquery that computes the primary action per license (deny takes priority over warn, matching current client-side logic). The filter matches licenses whose primary violation action equals the filter value. A license with both warn and deny violations only matches the `deny` filter — same behavior as the current client-side filter.

SQL approach: subquery groups `license_violations` by `license_id`, selects `MAX(CASE WHEN action = 'deny' THEN 2 WHEN action = 'warn' THEN 1 END)` to compute priority, then filters by the requested action.

### Files

- `src/shared/routes/licenses.ts` — add `violationAction: z.enum(["warn", "deny"]).optional()` to `listLicensesRoute` querystring
- `src/api/routes/licenses.ts` — add `violationAction` to `ILicenseQuerystring`, add SQL join/condition in `buildLicenseConditions()`
- `src/ui/features/licenses/abstractions/LicensesGateway.ts` — add `violationAction` to `ILicenseListFilters`
- `src/ui/features/licenses/LicensesGateway.ts` — add `violationAction` to `buildLicenseListQuery()`

## Licenses Presenter Migration

### Current Flow (client-side)

1. `load()` calls `loadLicensesUseCase.execute(teamId)` — fetches ALL licenses
2. `vm` getter calls `buildRows()` to get all rows, then `applyFilters()` to filter in memory
3. Filter setters (`setRiskTierFilter`, `setPackageNameFilter`, etc.) update local state — no API call

### New Flow (API-side + URL sync)

1. `load()` reads filters from `urlFilterService.read(schema)`, passes to `loadLicensesUseCase.execute(filters)`
2. `vm` getter returns rows directly from repository — no `applyFilters()` step
3. Filter setters call `urlFilterService.update(schema, { key: value })` then `this.load()`
4. Constructor registers `urlFilterService.onChange(() => this.load())` for browser back/forward
5. `dispose()` cleans up the onChange listener

### Removed Code

- `applyFilters()` method — deleted entirely
- Client-side filter state fields (`riskTierFilter`, `packageNameFilter`, `projectIdFilter`, `violationFilter`) — replaced by URL params
- Filter matching logic in `buildRows()` — server handles it

### ViewModel Changes

Filter values in ViewModel now come from `urlFilterService.read(schema)` instead of private fields. The ViewModel interface stays the same — components don't know whether filters are from local state or URL.

### Files

- `src/ui/presentation/licenses/LicensesList/LicensesPresenter.ts` — inject UrlFilterService, remove applyFilters, read/write URL params
- `src/ui/presentation/licenses/LicensesList/abstractions/LicensesPresenter.ts` — no interface change needed (filter getters/setters stay)

## Out of Scope

- Migrating packages or vulnerabilities pages to UrlFilterService (future work, same pattern)
- Server-side pagination for licenses (separate concern)
- Sort params in URL (separate concern)
