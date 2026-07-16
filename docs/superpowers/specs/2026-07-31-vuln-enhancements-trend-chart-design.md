# Vulnerability Enhancements & Trend Chart Design

## Overview

Two feature areas extending the existing vulnerability frontend:

1. **Vuln page enhancements**: project dropdown filter, bulk actions (dismiss/snooze/rescan/export), CSV/JSON export
2. **Dashboard trend chart**: historical vulnerability counts over time using existing `healthSnapshots` data

## Data Model

### Migration: Add dismiss columns to `vulnerabilities` table

```sql
dismissedAt    INTEGER  -- unix timestamp, null = active
dismissedUntil INTEGER  -- unix timestamp for snooze expiry, null = permanent dismiss
dismissedBy    TEXT     -- "user" (future-proofing for auto-dismiss)
```

### Snooze expiry logic

Query-time evaluation, no background job:

- Active vuln: `dismissedAt IS NULL OR (dismissedUntil IS NOT NULL AND dismissedUntil <= now())`
- Permanently dismissed: `dismissedAt IS NOT NULL AND dismissedUntil IS NULL`
- Snoozed: `dismissedAt IS NOT NULL AND dismissedUntil IS NOT NULL AND dismissedUntil > now()`
- Un-dismiss: set all three columns to null

### Trend chart data

No new tables. `healthSnapshots` already stores daily `vulnCritical`, `vulnHigh`, `vulnModerate`, `vulnLow` counts.

## API Changes

### Modified endpoints

- `GET /api/vulnerabilities` — add `projectIds` filter (comma-separated UUIDs), `includeDismissed` boolean (default false). Response includes `dismissedAt`/`dismissedUntil` fields.
- `GET /api/vulnerabilities/:projectId` — add `includeDismissed` param.
- `GET /api/vulnerabilities/summary` — exclude dismissed from counts by default.

### New endpoints

#### `PATCH /api/vulnerabilities/bulk`

Bulk dismiss, snooze, or undismiss vulnerabilities.

```typescript
// Request
{ ids: string[], action: "dismiss" | "snooze" | "undismiss", snoozeDays?: 7 | 30 | 90 }
// snoozeDays required when action is "snooze", ignored otherwise. Zod discriminated union validates this.

// Response
{ updatedCount: number }
```

- `dismiss`: sets `dismissedAt` to now, `dismissedUntil` to null, `dismissedBy` to "user"
- `snooze`: sets `dismissedAt` to now, `dismissedUntil` to now + snoozeDays, `dismissedBy` to "user"
- `undismiss`: sets all three columns to null

#### `POST /api/vulnerabilities/bulk/rescan`

Trigger scans for projects associated with selected vulns.

```typescript
// Request
{ ids: string[] }

// Response
{ projectsQueued: number }
```

Resolves unique `projectId` values from selected vuln IDs, queues scan job per project.

#### `GET /api/vulnerabilities/export`

Export filtered vulnerabilities as CSV or JSON.

Accepts all existing filter params plus:

- `format`: `"csv"` | `"json"` (required)
- `ids`: optional comma-separated vuln IDs (for selected-only export)

CSV: comma delimiter, quoted fields, header row. JSON: array of vuln objects matching list response shape. Sets `Content-Disposition: attachment` header with appropriate filename and content type.

#### `GET /api/dashboard/vuln-trend`

Historical vulnerability counts for trend chart.

```typescript
// Query
{ days?: 7 | 30 | 90 }  // omit for all

// Response
{ points: Array<{ date: string, critical: number, high: number, moderate: number, low: number }> }
```

Reads from `healthSnapshots` table, filtered by date range.

### Shared route definitions

New vulnerability routes defined in `src/shared/routes/vulnerabilities.ts`, vuln-trend route in `src/shared/routes/dashboard.ts`. All via `defineRoute` with Zod schemas, registered in route handlers via `registerRoute(app, routeDef, opts, handler)`.

## UI: Vuln Page Enhancements

### Project filter

- Multi-select dropdown alongside existing severity/source/package filters
- Options populated from projects list (reuse existing projects gateway)
- Empty selection = all projects (consistent with other filters)
- Presenter gets `projectIds: string[]` state, debounced like other filters

### Bulk selection

- Checkbox column (leftmost) on vuln table
- Header checkbox for select-all on current page
- Selection state in presenter: `selectedIds: Set<string>`
- Clears on filter change or page change

### Bulk action bar

- Appears when `selectedIds.size > 0`, positioned above table
- Shows count: "N selected"
- Buttons: Dismiss, Snooze (dropdown: 7d / 30d / 90d), Rescan, Export Selected
- Dismiss, Snooze, and Rescan require `ConfirmDialog` per project conventions
- After action completes: clear selection, reload list

### Dismissed toggle

- "Show dismissed" toggle in filter area, default off
- When on, dismissed vulns appear with visual indicator (muted row styling, "Dismissed" or "Snoozed until [date]" badge)
- Undismiss available via bulk action when dismissed vulns are visible

### Export (full list)

- Export button in toolbar, separate from bulk action bar
- Dropdown: CSV / JSON
- Exports current filtered results (all pages, not just current page)
- Server-side rendering — pagination means client doesn't hold all rows
- Client triggers download via blob URL from response

## UI: Dashboard Trend Chart

### VulnTrendChart widget

- New widget in dashboard grid, same card styling as existing widgets
- Recharts `LineChart` with 4 severity lines using existing `SEVERITY_COLORS` constant:
  - Critical (red), High (orange), Moderate (yellow), Low (blue)
- Time range toggle: Mantine `SegmentedControl` with 7d / 30d / 90d / all (matches `HealthTrendChart` pattern)
- X-axis: dates. Y-axis: count. Tooltip shows all 4 values on hover.
- Empty state: "No vulnerability data yet — run a scan to start tracking trends"

### Dashboard grid

- VulnSummaryWidget stays (compact counts/badges)
- VulnTrendChart added below as full-width row (trend charts benefit from width)
- Both vuln-related widgets grouped together

### Data flow

- New `LoadVulnTrendUseCase` fetches trend data from gateway
- `LoadDashboardUseCase` adds parallel fetch for trend endpoint
- `DashboardPresenter` gets `vulnTrend` view model + `trendRange` state for toggle
- `DashboardGateway` gets `getVulnTrend(days?: 7 | 30 | 90)` method (endpoint is under `/api/dashboard/`, omit for all-time)

## Testing

### Backend

- `VulnerabilityService`: dismiss/undismiss/snooze sets correct columns; snooze expiry (query returns snoozed vulns past expiry as active); bulk rescan resolves unique projects
- Bulk endpoint validation: invalid IDs, empty array, mixed dismiss states
- Export endpoint: CSV format (quoting, comma escaping), JSON structure matches list, filters applied, `Content-Disposition` header
- Vuln trend endpoint: correct aggregation from `healthSnapshots`, `days` param filtering, empty data returns empty array
- `projectIds` filter: single, multiple, non-existent project returns empty

### Frontend

- `VulnerabilitiesPresenter`: projectIds filter, selectedIds management (add/remove/clear/select-all), clears on filter change, dismiss/snooze/undismiss call gateway and reload
- `LoadVulnerabilitiesUseCase`: passes projectIds and includeDismissed
- `LoadVulnTrendUseCase`: fetches trend, stores in repository
- `DashboardPresenter`: vulnTrend view model, trendRange state
- `VulnerabilitiesGateway`: bulk dismiss/snooze/rescan/export calls correct routes
- Export: blob download triggered with correct format

### Conventions

- Backend: in-memory SQLite, real services, mock only CommandRunner
- Frontend: mock HTTPClient + WebSocketListener at DI level, real everything else
- Never `new XxxImpl()` — resolve via DI container
