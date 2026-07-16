# Snooze Expiry Notifications

## Problem

When snoozed vulnerabilities expire, users have no way to know without visiting the vulnerabilities page. Expired snoozes silently become active again (query-time expiry) with no notification.

## Solution

Server-side periodic check + WebSocket broadcast + page-load check.

## Backend

### Detecting expired snoozes

Query: `dismissedUntil IS NOT NULL AND dismissedUntil <= now AND dismissedUntil > (now - checkInterval)`. This finds snoozes that expired within the last check window, avoiding re-notification.

### New service method

`VulnerabilityService.getRecentlyExpiredSnoozes(sinceMs: number): Promise<IVulnerability[]>` — returns vulnerabilities where `dismissedUntil` is between `sinceMs` and `Date.now()`.

### Periodic check

In `server.ts`, alongside the existing `jobWorker` poll interval:

- New `setInterval` at configurable interval (default: 1 hour = 3600000ms)
- Calls `getRecentlyExpiredSnoozes(lastCheckTime)`
- If any found, broadcasts `snooze:expired` via WebSocket with count and package names
- Updates `lastCheckTime`

### New WebSocket event

Add `snooze:expired` to `WSEventMap` in `src/shared/websocket/types.ts`:

```typescript
export interface WSSnoozeExpired {
  count: number;
  packageNames: string[];
}
```

### Page-load check

New API endpoint `GET /api/vulnerabilities/expired-snoozes?since=<timestamp>` — returns recently expired snooze count. Frontend calls on vuln page load.

## Frontend

### WebSocket listener

New listener (similar to `JobNotificationListener`) that subscribes to `snooze:expired` events and shows Mantine toast: "N snoozed vulnerabilities have expired: pkg-a, pkg-b, ..."

### Page-load fallback

`VulnerabilitiesPresenter.load()` calls the expired-snoozes endpoint on load. If any found, shows notification via Mantine `notifications.show()`.

## Files changed

Backend:

- `src/shared/websocket/types.ts` — add `WSSnoozeExpired` and `snooze:expired` event
- `src/api/services/abstractions/VulnerabilityService.ts` — add `getRecentlyExpiredSnoozes`
- `src/api/services/VulnerabilityService.ts` — implement query
- `src/shared/routes/vulnerabilities.ts` — add `getExpiredSnoozesRoute`
- `src/api/routes/vulnerabilities.ts` — add route handler
- `src/api/server.ts` — add periodic check interval

Frontend:

- `src/ui/App.tsx` — add `SnoozeExpiryListener` component
- `src/ui/shared/notifications/snoozeNotifications.ts` — handler for snooze:expired events
- `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts` — check on page load

Tests for backend service method and route.
