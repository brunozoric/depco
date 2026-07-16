# Snooze Expiry Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify users when snoozed vulnerabilities expire, via WebSocket broadcast (periodic server check) and page-load check.

**Architecture:** Server-side `setInterval` queries recently expired snoozes and broadcasts via WebSocket. Frontend listens for the event and shows Mantine toast. Vuln page also checks on load as fallback.

**Tech Stack:** Fastify, Drizzle ORM, Zod, React, Mantine notifications, WebSocket

## Global Constraints

- Named interfaces only (no inline structural types)
- Use yarn for all commands
- Use full words, not abbreviations for NEW names
- WebSocket events defined in `src/shared/websocket/types.ts`
- Periodic tasks use `setInterval` in `server.ts` (existing pattern)

---

### Task 1: Backend — expired snoozes query, WebSocket event, API route, periodic check

**Files:**

- Modify: `src/shared/websocket/types.ts` (add `WSSnoozeExpired` interface and event)
- Modify: `src/api/services/abstractions/VulnerabilityService.ts` (add `getRecentlyExpiredSnoozes`)
- Modify: `src/api/services/VulnerabilityService.ts` (implement query)
- Modify: `src/shared/routes/vulnerabilities.ts` (add `getExpiredSnoozesRoute`)
- Modify: `src/api/routes/vulnerabilities.ts` (add route handler)
- Modify: `src/api/server.ts` (add periodic check interval)
- Test: `src/api/services/__tests__/VulnerabilityService.test.ts`

**Interfaces:**

- Consumes: `vulnerabilities` schema (`dismissedUntil`, `dismissedAt`), `WebSocketBroadcaster.broadcast`, `VulnerabilityService`, drizzle `and`, `isNotNull`, `lte`, `gte`
- Produces:
  - `WSSnoozeExpired { count: number; packageNames: string[] }`
  - `VulnerabilityService.getRecentlyExpiredSnoozes(sinceMs: number): Promise<IVulnerability[]>`
  - `GET /api/vulnerabilities/expired-snoozes?since=<ms timestamp>` returning `{ count: number; packageNames: string[] }`
  - Periodic broadcast of `snooze:expired` event

- [ ] **Step 1: Add WebSocket event type**

In `src/shared/websocket/types.ts`, add the interface:

```typescript
export interface WSSnoozeExpired {
  count: number;
  packageNames: string[];
}
```

Add to `WSEventMap`:

```typescript
"snooze:expired": WSSnoozeExpired;
```

- [ ] **Step 2: Add `getRecentlyExpiredSnoozes` to service abstraction**

In `src/api/services/abstractions/VulnerabilityService.ts`, add to `IVulnerabilityService`:

```typescript
getRecentlyExpiredSnoozes(sinceMs: number): Promise<IVulnerability[]>;
```

- [ ] **Step 3: Implement `getRecentlyExpiredSnoozes`**

In `src/api/services/VulnerabilityService.ts`, add to `VulnerabilityServiceImpl`:

```typescript
public async getRecentlyExpiredSnoozes(sinceMs: number): Promise<Abstraction.Vulnerability[]> {
    const now = Date.now();
    const rows = await this.databaseClient.db
        .select()
        .from(vulnerabilities)
        .where(
            and(
                isNotNull(vulnerabilities.dismissedAt),
                isNotNull(vulnerabilities.dismissedUntil),
                lte(vulnerabilities.dismissedUntil, now),
                gte(vulnerabilities.dismissedUntil, sinceMs)
            )
        )
        .all();
    return rows.map(toVulnerability);
}
```

- [ ] **Step 4: Add route definition**

In `src/shared/routes/vulnerabilities.ts`, add:

```typescript
export const getExpiredSnoozesRoute = defineRoute({
  method: "GET",
  path: "/api/vulnerabilities/expired-snoozes",
  description: "Get recently expired snoozed vulnerabilities",
  params: z.object({}),
  querystring: z.object({
    since: z.coerce.number()
  }),
  response: z.object({
    count: z.number(),
    packageNames: z.array(z.string())
  })
});
```

- [ ] **Step 5: Add route handler**

In `src/api/routes/vulnerabilities.ts`, register the handler **before** the `/:projectId` route. Import `getExpiredSnoozesRoute`:

```typescript
registerRoute(app, getExpiredSnoozesRoute, {}, async (request, reply) => {
  const { since } = request.query;
  const expired = await vulnerabilityService.getRecentlyExpiredSnoozes(since);
  const packageNames = [...new Set(expired.map(v => v.packageName))];
  reply.send({ count: expired.length, packageNames });
});
```

- [ ] **Step 6: Add periodic check in server.ts**

In `src/api/server.ts`, after the `jobWorker` poll interval setup, add:

```typescript
const broadcaster = container.resolve(WebSocketBroadcaster);
let lastSnoozeCheckMs = Date.now();
const SNOOZE_CHECK_INTERVAL_MS = 3600000;

const snoozeCheckInterval = setInterval(async () => {
  try {
    const expired = await vulnerabilityService.getRecentlyExpiredSnoozes(lastSnoozeCheckMs);
    lastSnoozeCheckMs = Date.now();
    if (expired.length > 0) {
      const packageNames = [...new Set(expired.map(v => v.packageName))];
      broadcaster.broadcast("snooze:expired", {
        count: expired.length,
        packageNames
      });
    }
  } catch {
    // Non-critical — silently skip failed checks
  }
}, SNOOZE_CHECK_INTERVAL_MS);
```

Import `WebSocketBroadcaster` from its abstraction path. Add `clearInterval(snoozeCheckInterval)` to the `onClose` hook. Also resolve `vulnerabilityService` (already resolved in the file via routes — check if it's available at the server level, otherwise resolve from container).

Note: `vulnerabilityService` is resolved inside `vulnerabilityRoutes` function scope, not at server level. Resolve it from the container in `server.ts`:

```typescript
const vulnerabilityService = container.resolve(VulnerabilityService);
```

- [ ] **Step 7: Write tests**

In `src/api/services/__tests__/VulnerabilityService.test.ts`, add a `describe("getRecentlyExpiredSnoozes")` block:

```typescript
describe("getRecentlyExpiredSnoozes", () => {
  it("returns vulnerabilities with snooze expired since the given timestamp", async () => {
    const { service, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 3);

    const now = Date.now();
    await service.bulkSnooze([vulnIds[0]!], 7);

    // Manually set dismissedUntil to a past time (simulating expiry)
    await db
      .update(vulnerabilities)
      .set({ dismissedUntil: now - 1000 })
      .where(eq(vulnerabilities.id, vulnIds[0]!));

    const expired = await service.getRecentlyExpiredSnoozes(now - 60000);

    expect(expired).toHaveLength(1);
    expect(expired[0]!.id).toBe(vulnIds[0]);
  });

  it("excludes snoozes that expired before the since timestamp", async () => {
    const { service, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 2);

    const now = Date.now();
    await service.bulkSnooze([vulnIds[0]!], 7);

    await db
      .update(vulnerabilities)
      .set({ dismissedUntil: now - 120000 })
      .where(eq(vulnerabilities.id, vulnIds[0]!));

    const expired = await service.getRecentlyExpiredSnoozes(now - 60000);

    expect(expired).toHaveLength(0);
  });

  it("excludes permanently dismissed (no dismissedUntil) vulnerabilities", async () => {
    const { service, db } = await createTestContext();
    const vulnIds = await seedVulnerabilities(db, 2);
    await service.bulkDismiss([vulnIds[0]!]);

    const expired = await service.getRecentlyExpiredSnoozes(0);

    expect(expired).toHaveLength(0);
  });
});
```

- [ ] **Step 8: Update mock/stub implementations**

Check `src/api/routes/__tests__/vulnerabilities.test.ts` and `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts` for mock VulnerabilityService — add `getRecentlyExpiredSnoozes` stub method to avoid type errors.

- [ ] **Step 9: Run tests**

Run: `yarn vitest run`
Expected: Full suite passes.

- [ ] **Step 10: Commit**

```bash
git add src/shared/websocket/types.ts src/api/services/abstractions/VulnerabilityService.ts src/api/services/VulnerabilityService.ts src/shared/routes/vulnerabilities.ts src/api/routes/vulnerabilities.ts src/api/server.ts src/api/services/__tests__/VulnerabilityService.test.ts src/api/routes/__tests__/vulnerabilities.test.ts src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts
git commit -m "feat(vulnerabilities): add snooze expiry detection, WebSocket broadcast, and API route"
```

---

### Task 2: Frontend — WebSocket listener + page-load check + toast notifications

**Files:**

- Create: `src/ui/shared/notifications/snoozeNotifications.ts`
- Modify: `src/ui/App.tsx` (add `SnoozeExpiryListener` component)
- Modify: `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts` (add `getExpiredSnoozes`)
- Modify: `src/ui/features/vulnerabilities/VulnerabilitiesGateway.ts` (implement `getExpiredSnoozes`)
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts` (check on page load)

**Interfaces:**

- Consumes: `WebSocketListener.on("snooze:expired", handler)`, `WSSnoozeExpired`, `notifications.show()` from Mantine, `getExpiredSnoozesRoute`, `navigate`
- Produces: Toast notification on snooze expiry, page-load check in presenter

- [ ] **Step 1: Create snooze notification handler**

Create `src/ui/shared/notifications/snoozeNotifications.ts`:

```typescript
import { notifications } from "@mantine/notifications";
import type { WSSnoozeExpired } from "#shared/websocket/types.js";
import { navigate } from "../router/router.js";

export function handleSnoozeExpired(data: WSSnoozeExpired): void {
  if (data.count === 0) {
    return;
  }

  const names = data.packageNames.slice(0, 3).join(", ");
  const suffix = data.packageNames.length > 3 ? ` and ${data.packageNames.length - 3} more` : "";

  notifications.show({
    color: "orange",
    title: `${data.count} snoozed ${data.count === 1 ? "vulnerability has" : "vulnerabilities have"} expired`,
    message: `${names}${suffix} — click to view`,
    autoClose: 10000,
    style: { cursor: "pointer" },
    onClick: () => {
      navigate("/vulnerabilities");
    }
  });
}
```

- [ ] **Step 2: Add SnoozeExpiryListener to App.tsx**

In `src/ui/App.tsx`, add a new component following the `JobNotificationListener` pattern:

```typescript
function SnoozeExpiryListener(): null {
  const container = useContainer();

  useEffect(() => {
    const listener = container.resolve(WebSocketListener);
    listener.on("snooze:expired", handleSnoozeExpired);
    return () => {
      listener.off("snooze:expired", handleSnoozeExpired);
    };
  }, [container]);

  return null;
}
```

Import `handleSnoozeExpired` from `./shared/notifications/snoozeNotifications.js`.

Add `<SnoozeExpiryListener />` in the `App` component alongside `<JobNotificationListener />`.

- [ ] **Step 3: Add `getExpiredSnoozes` to gateway**

In `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts`, add to `IVulnerabilitiesGateway`:

```typescript
getExpiredSnoozes(sinceMs: number): Promise<{ count: number; packageNames: string[] }>;
```

In `src/ui/features/vulnerabilities/VulnerabilitiesGateway.ts`, import `getExpiredSnoozesRoute` and implement:

```typescript
public async getExpiredSnoozes(
    sinceMs: number
): Promise<{ count: number; packageNames: string[] }> {
    return this.httpClient.request(getExpiredSnoozesRoute, {
        params: {},
        query: { since: sinceMs }
    });
}
```

- [ ] **Step 4: Add page-load check in VulnerabilitiesPresenter**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts`, in the `load` method, after loading vulnerabilities, check for expired snoozes and show notification:

```typescript
try {
  const fiveMinutesAgo = Date.now() - 300000;
  const expired = await this.gateway.getExpiredSnoozes(fiveMinutesAgo);
  if (expired.count > 0) {
    handleSnoozeExpired(expired);
  }
} catch {
  // Non-critical
}
```

Import `handleSnoozeExpired` from the shared notifications module. The 5-minute window catches recent expirations the user might not have seen via WebSocket (e.g., they just opened the page).

- [ ] **Step 5: Run tests and type check**

Run: `yarn vitest run`
Expected: Full suite passes.

Run: `yarn tsc --noEmit`
Expected: No new type errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/shared/notifications/snoozeNotifications.ts src/ui/App.tsx src/ui/features/vulnerabilities/ src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts
git commit -m "feat(vulnerabilities): add snooze expiry toast notifications via WebSocket and page load"
```
