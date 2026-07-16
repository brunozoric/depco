# Vulnerability Trend Drill-Down

## Problem

Clicking a date point on VulnTrendChart does nothing. Users want to drill down from the trend chart to see which vulnerabilities existed on a specific date.

## Solution

Click a date point on VulnTrendChart, navigate to `/vulnerabilities?scannedDate=2026-07-30`. The vulnerabilities page filters to show only vulnerabilities whose `scannedAt` timestamp falls on that date.

## Backend

### Filter extension

Add `scannedDate?: string` (YYYY-MM-DD format) to:

- `IVulnFilters` in `src/api/services/abstractions/VulnerabilityService.ts`
- `buildWhere()` in `src/api/services/VulnerabilityService.ts` — convert date string to start/end timestamps, add `scannedAt >= start AND scannedAt < end`
- Route querystring in `src/shared/routes/vulnerabilities.ts` — add `scannedDate: z.string().optional()` to `listVulnerabilitiesRoute`
- `buildFilters()` in `src/api/routes/vulnerabilities.ts` — pass through `scannedDate`

### No new route needed

Reuses existing `GET /api/vulnerabilities` with the new querystring param.

## Frontend

### VulnTrendChart

Add Recharts `onClick` handler on the `LineChart`. Recharts fires click events with the data point's payload. Extract `date` from the clicked point and call a new `onDateClick(date: string)` callback prop.

### Dashboard presenter/page

Wire `onDateClick` to `navigate(`/vulnerabilities?scannedDate=${date}`)`.

### VulnerabilitiesPresenter

On load, check URL search params for `scannedDate`. If present, include it in the filter sent to the gateway. Show a "Filtered by date: X" indicator with a clear button that removes the param and reloads.

## Files changed

- `src/api/services/abstractions/VulnerabilityService.ts` — add `scannedDate` to `IVulnFilters`
- `src/api/services/VulnerabilityService.ts` — add date range condition in `buildWhere`
- `src/shared/routes/vulnerabilities.ts` — add `scannedDate` to querystring schema
- `src/api/routes/vulnerabilities.ts` — pass `scannedDate` through `buildFilters`
- `src/ui/presentation/dashboard/Dashboard/components/VulnTrendChart.tsx` — add `onDateClick` prop and click handler
- `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx` — wire `onDateClick` to navigate
- `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts` — read `scannedDate` from URL, add to filters
- `src/ui/presentation/vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts` — add `scannedDate` to VM
- `src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx` — show date filter badge with clear button
- Tests for the backend filter
