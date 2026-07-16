# Job Notification Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show toast notifications when any job reaches a terminal status (completed/failed/cancelled), with click-to-navigate to /jobs.

**Architecture:** Add `@mantine/notifications` package. Extract notification handler logic into a standalone utility (`jobNotifications.ts`) so it can be unit-tested without React. Thin `JobNotificationListener` component in App.tsx wires WS subscription to the handler. `<Notifications />` provider mounted in app tree.

**Tech Stack:** `@mantine/notifications`, Mantine `<Notifications />`, existing `WebSocketListener` DI abstraction, `navigate()` router function.

## Global Constraints

- Named interfaces only — no inline structural types
- Yarn 4 for package management
- oxlint + oxfmt for lint/format
- Vitest for tests
- All DI resolved through container, never `new XxxImpl()`

---

### Task 1: Add `@mantine/notifications` dependency

**Files:**

- Modify: `package.json`

**Interfaces:**

- Consumes: nothing
- Produces: `@mantine/notifications` available for import

- [ ] **Step 1: Install package**

```bash
yarn add @mantine/notifications
```

- [ ] **Step 2: Verify install**

```bash
yarn adio
```

Expected: clean (no unused/missing dep warnings for `@mantine/notifications`)

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add @mantine/notifications dependency"
```

---

### Task 2: Create `jobNotifications` utility + tests

**Files:**

- Create: `src/ui/shared/notifications/jobNotifications.ts`
- Create: `src/ui/shared/notifications/__tests__/jobNotifications.test.ts`

**Interfaces:**

- Consumes: `@mantine/notifications` module (`notifications.show`, `notifications.hide`), `navigate` from `src/ui/shared/router/router.ts`, `WSJobStatus` from `#shared/websocket/types.js`
- Produces: `handleJobStatusNotification(data: WSJobStatus): void` — the function that `JobNotificationListener` will call on each WS event

- [ ] **Step 1: Write failing tests**

Create `src/ui/shared/notifications/__tests__/jobNotifications.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { WSJobStatus } from "#shared/websocket/types.js";

vi.mock("@mantine/notifications", () => ({
  notifications: {
    show: vi.fn(),
    hide: vi.fn()
  }
}));

vi.mock("../../router/router.js", () => ({
  navigate: vi.fn()
}));

import { handleJobStatusNotification } from "../jobNotifications.js";
import { notifications } from "@mantine/notifications";
import { navigate } from "../../router/router.js";

describe("handleJobStatusNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows green notification on completed job", () => {
    handleJobStatusNotification({
      jobId: "job-1",
      projectId: "proj-1",
      type: "dependency",
      status: "completed"
    });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "job-1",
        color: "green",
        title: "✓ Dependency job completed",
        autoClose: 5000
      })
    );
  });

  it("shows red sticky notification on failed job", () => {
    handleJobStatusNotification({
      jobId: "job-2",
      projectId: "proj-1",
      type: "scan",
      status: "failed"
    });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "job-2",
        color: "red",
        title: "✕ Scan job failed",
        autoClose: false
      })
    );
  });

  it("shows yellow notification on cancelled job", () => {
    handleJobStatusNotification({
      jobId: "job-3",
      projectId: "proj-1",
      type: "install",
      status: "cancelled"
    });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "job-3",
        color: "yellow",
        title: "⚠ Install job cancelled",
        autoClose: 5000
      })
    );
  });

  it("humanizes camelCase job types", () => {
    handleJobStatusNotification({
      jobId: "job-4",
      projectId: "proj-1",
      type: "packageManager",
      status: "completed"
    });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "✓ Package manager job completed"
      })
    );
  });

  it("ignores non-terminal statuses", () => {
    handleJobStatusNotification({
      jobId: "job-5",
      projectId: "proj-1",
      type: "scan",
      status: "pending"
    });

    handleJobStatusNotification({
      jobId: "job-6",
      projectId: "proj-1",
      type: "scan",
      status: "running"
    });

    expect(notifications.show).not.toHaveBeenCalled();
  });

  it("navigates to /jobs and hides notification on click", () => {
    handleJobStatusNotification({
      jobId: "job-7",
      projectId: "proj-1",
      type: "dependency",
      status: "completed"
    });

    const call = vi.mocked(notifications.show).mock.calls[0][0] as {
      onClick: () => void;
    };
    call.onClick();

    expect(navigate).toHaveBeenCalledWith("/jobs");
    expect(notifications.hide).toHaveBeenCalledWith("job-7");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
yarn test src/ui/shared/notifications/__tests__/jobNotifications.test.ts
```

Expected: FAIL — `handleJobStatusNotification` does not exist yet.

- [ ] **Step 3: Write implementation**

Create `src/ui/shared/notifications/jobNotifications.ts`:

```typescript
import { notifications } from "@mantine/notifications";
import type { WSJobStatus } from "#shared/websocket/types.js";
import { navigate } from "../router/router.js";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

interface NotificationConfig {
  color: string;
  prefix: string;
  autoClose: number | false;
}

const STATUS_CONFIG: Record<string, NotificationConfig> = {
  completed: { color: "green", prefix: "✓", autoClose: 5000 },
  failed: { color: "red", prefix: "✕", autoClose: false },
  cancelled: { color: "yellow", prefix: "⚠", autoClose: 5000 }
};

function humanizeJobType(type: string): string {
  const spaced = type.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function handleJobStatusNotification(data: WSJobStatus): void {
  if (!TERMINAL_STATUSES.has(data.status)) {
    return;
  }

  const config = STATUS_CONFIG[data.status];
  if (!config) {
    return;
  }

  const label = humanizeJobType(data.type);

  notifications.show({
    id: data.jobId,
    color: config.color,
    title: `${config.prefix} ${label} job ${data.status}`,
    message: "Click to view jobs",
    autoClose: config.autoClose,
    style: { cursor: "pointer" },
    onClick: () => {
      navigate("/jobs");
      notifications.hide(data.jobId);
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
yarn test src/ui/shared/notifications/__tests__/jobNotifications.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Lint + format**

```bash
yarn lint:fix && yarn format:fix
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/shared/notifications/
git commit -m "feat: add job notification handler with tests"
```

---

### Task 3: Wire `<Notifications />` provider + `JobNotificationListener` into App.tsx

**Files:**

- Modify: `src/ui/App.tsx`

**Interfaces:**

- Consumes: `handleJobStatusNotification` from `src/ui/shared/notifications/jobNotifications.ts` (Task 2), `@mantine/notifications` `<Notifications />` component (Task 1), `WebSocketListener` from DI
- Produces: Toast notifications visible in browser when jobs complete/fail/cancel

- [ ] **Step 1: Add imports to App.tsx**

Add at top of `src/ui/App.tsx`:

```typescript
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";
import { handleJobStatusNotification } from "./shared/notifications/jobNotifications.js";
```

- [ ] **Step 2: Add `JobNotificationListener` component**

Add after `WebSocketConnector` in `src/ui/App.tsx`:

```tsx
function JobNotificationListener(): null {
  const container = useContainer();

  useEffect(() => {
    const listener = container.resolve(WebSocketListener);
    listener.on("job:status", handleJobStatusNotification);
    return () => {
      listener.off("job:status", handleJobStatusNotification);
    };
  }, [container]);

  return null;
}
```

- [ ] **Step 3: Mount components in App tree**

In the `App` function, add `<JobNotificationListener />` after `<WebSocketConnector />` and `<Notifications />` right after `<MantineProvider>`:

```tsx
export function App(): React.ReactNode {
    return (
        <ContainerProvider features={ALL_FEATURES}>
            <WebSocketConnector />
            <JobNotificationListener />
            <MantineProvider>
                <Notifications position="top-right" />
                <AppShell header={{ height: 60 }} padding="md">
```

- [ ] **Step 4: Run full pipeline**

```bash
yarn full
```

Expected: adio + lint + format + build + all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/App.tsx
git commit -m "feat: wire job notification toast into app shell"
```
