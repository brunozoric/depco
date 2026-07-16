# Job Notification Toast

Toast notifications when any job reaches a terminal status (completed, failed, cancelled).

## Dependencies

- Add `@mantine/notifications` package

No icon library needed — use Unicode characters for status indicators (e.g. `✓`, `✕`, `⚠`).

## Changes

### 1. App.tsx — Notifications provider + listener

Add `<Notifications position="top-right" />` inside `MantineProvider`.

Add `JobNotificationListener` React component:

- Uses `useContainer()` hook to resolve `WebSocketListener` (same DI access as `WebSocketConnector`)
- Uses `useEffect` to subscribe to `job:status` WS events on mount, unsubscribe on unmount
- On terminal status, calls `notifications.show()` from `@mantine/notifications` (module-level import, not a hook — it's a standalone function)
- Returns `null` (render-less component)

### 2. Notification appearance

| Status    | Color  | Title prefix | Auto-close          |
| --------- | ------ | ------------ | ------------------- |
| completed | green  | ✓            | 5000ms              |
| failed    | red    | ✕            | no (manual dismiss) |
| cancelled | yellow | ⚠            | 5000ms              |

Message format: `"{Type} job {status}"` — type humanized by capitalizing first letter and splitting camelCase on uppercase boundaries (e.g. `"packageManager"` → `"Package manager"`, `"scan"` → `"Scan"`, `"dependency"` → `"Dependency"`).

### 3. Click-to-navigate

`notifications.show()` accepts an `onClick` callback. In `onClick`:

1. Call `navigate("/jobs")` from `src/ui/shared/router/router.ts`
2. Call `notifications.hide(id)` to close the toast (the `id` is set explicitly when calling `notifications.show()`, using `jobId` from the WS event)

Style the notification message with `style={{ cursor: "pointer" }}` to indicate clickability.

### 4. No API changes

`WSJobStatus` already provides `jobId`, `projectId`, `type`, `status` — everything needed. No backend modifications.

### 5. Filtering

Only react to terminal statuses: `completed`, `failed`, `cancelled`. Ignore `pending`, `running`, and any other intermediate statuses.

## Testing

Unit test for `JobNotificationListener` as a component test:

- Mock `WebSocketListener` at DI level (existing pattern from other presenter tests)
- Mock `@mantine/notifications` module via `vi.mock()` — `notifications.show` and `notifications.hide` are standalone functions, not hooks, so module mocking works cleanly
- Mock `navigate` from `src/ui/shared/router/router.ts` via `vi.mock()`
- Simulate `job:status` events by capturing the callback passed to `ws.on("job:status", cb)` and invoking it
- Assert `notifications.show` called with correct color, auto-close, message for each terminal status
- Assert non-terminal statuses produce no `notifications.show` call
- Assert `onClick` handler calls `navigate("/jobs")` and `notifications.hide(id)`

## Not in scope

- Project name in toast (would require extra API call or cache)
- Sound/browser notifications
- Notification history/log
