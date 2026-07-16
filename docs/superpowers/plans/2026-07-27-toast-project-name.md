# Toast Project Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show project name in job notification toasts (e.g. "✓ Dependency job completed — MyProject").

**Architecture:** Replace `handleJobStatusNotification` with a `createJobStatusNotificationHandler` factory that receives the DI container, resolves `ProjectsRepository`, and returns a handler closure. The closure looks up project name on each event.

**Tech Stack:** TypeScript, @mantine/notifications, @webiny/di, Vitest

## Global Constraints

- Named interfaces only, no inline structural types
- yarn for all package management
- Follow existing DI patterns (createAbstraction / createImplementation)

---

### Task 1: Factory and Tests

**Files:**

- Modify: `src/ui/shared/notifications/jobNotifications.ts`
- Modify: `src/ui/shared/notifications/__tests__/jobNotifications.test.ts`
- Modify: `src/ui/App.tsx:110-122`

**Interfaces:**

- Consumes: `ProjectsRepository` from `src/ui/features/projects/abstractions/ProjectsRepository.ts` — `getProject(id: string): Project | undefined`
- Consumes: `Container` from `@webiny/di` — `resolve<T>(abstraction): T`
- Produces: `createJobStatusNotificationHandler(container: Container): (data: WSJobStatus) => void`

- [ ] **Step 1: Write failing tests for factory pattern**

Update the test file to use the factory. Add two new test cases for project name.

```typescript
// src/ui/shared/notifications/__tests__/jobNotifications.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@mantine/notifications", () => ({
  notifications: {
    show: vi.fn(),
    hide: vi.fn()
  }
}));

vi.mock("../../router/router.js", () => ({
  navigate: vi.fn()
}));

import { createJobStatusNotificationHandler } from "../jobNotifications.js";
import { notifications } from "@mantine/notifications";
import { navigate } from "../../router/router.js";
import { ProjectsRepository } from "#ui/features/projects/abstractions/ProjectsRepository.js";

interface NotificationClickHandler {
  onClick: () => void;
}

interface MockContainer {
  resolve: (abstraction: unknown) => unknown;
}

function createMockContainer(projectName?: string): MockContainer {
  return {
    resolve: (abstraction: unknown) => {
      if (abstraction === ProjectsRepository) {
        return {
          getProject: () => (projectName !== undefined ? { name: projectName } : undefined)
        };
      }
      return undefined;
    }
  };
}

describe("createJobStatusNotificationHandler", () => {
  let handler: (data: { jobId: string; projectId: string; type: string; status: string }) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = createJobStatusNotificationHandler(createMockContainer() as never);
  });

  it("shows green notification on completed job", () => {
    handler({
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
    handler({
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
    handler({
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
    handler({
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
    handler({
      jobId: "job-5",
      projectId: "proj-1",
      type: "scan",
      status: "pending"
    });

    handler({
      jobId: "job-6",
      projectId: "proj-1",
      type: "scan",
      status: "running"
    });

    expect(notifications.show).not.toHaveBeenCalled();
  });

  it("navigates to /jobs and hides notification on click", () => {
    handler({
      jobId: "job-7",
      projectId: "proj-1",
      type: "dependency",
      status: "completed"
    });

    const firstCall = vi.mocked(notifications.show).mock.calls[0];
    if (!firstCall) {
      throw new Error("Expected notifications.show to have been called");
    }
    const call = firstCall[0] as unknown as NotificationClickHandler;
    call.onClick();

    expect(navigate).toHaveBeenCalledWith("/jobs");
    expect(notifications.hide).toHaveBeenCalledWith("job-7");
  });

  it("includes project name in title when available", () => {
    const handlerWithProject = createJobStatusNotificationHandler(
      createMockContainer("MyProject") as never
    );

    handlerWithProject({
      jobId: "job-8",
      projectId: "proj-1",
      type: "dependency",
      status: "completed"
    });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "✓ Dependency job completed — MyProject"
      })
    );
  });

  it("omits project name when repository returns undefined", () => {
    handler({
      jobId: "job-9",
      projectId: "proj-unknown",
      type: "scan",
      status: "completed"
    });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "✓ Scan job completed"
      })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/ui/shared/notifications/__tests__/jobNotifications.test.ts`
Expected: FAIL — `createJobStatusNotificationHandler` is not exported

- [ ] **Step 3: Implement factory in jobNotifications.ts**

Replace the entire file content:

```typescript
// src/ui/shared/notifications/jobNotifications.ts
import type { Container } from "@webiny/di";
import { notifications } from "@mantine/notifications";
import type { WSJobStatus } from "#shared/websocket/types.js";
import { ProjectsRepository } from "#ui/features/projects/abstractions/ProjectsRepository.js";
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
  const spaced = type.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function createJobStatusNotificationHandler(
  container: Container
): (data: WSJobStatus) => void {
  const projectsRepository = container.resolve(ProjectsRepository);

  return (data: WSJobStatus): void => {
    if (!TERMINAL_STATUSES.has(data.status)) {
      return;
    }

    const config = STATUS_CONFIG[data.status];
    if (!config) {
      return;
    }

    const label = humanizeJobType(data.type);
    const projectName = projectsRepository.getProject(data.projectId)?.name;
    const suffix = projectName ? ` — ${projectName}` : "";

    notifications.show({
      id: data.jobId,
      color: config.color,
      title: `${config.prefix} ${label} job ${data.status}${suffix}`,
      message: "Click to view jobs",
      autoClose: config.autoClose,
      style: { cursor: "pointer" },
      onClick: () => {
        navigate("/jobs");
        notifications.hide(data.jobId);
      }
    });
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/ui/shared/notifications/__tests__/jobNotifications.test.ts`
Expected: PASS — all 8 tests green

- [ ] **Step 5: Update App.tsx to use factory**

In `src/ui/App.tsx`, update the import and `JobNotificationListener` component:

Change the import from:

```typescript
import { handleJobStatusNotification } from "#ui/shared/notifications/jobNotifications.js";
```

to:

```typescript
import { createJobStatusNotificationHandler } from "#ui/shared/notifications/jobNotifications.js";
```

Replace `JobNotificationListener` (lines 110-122):

```typescript
function JobNotificationListener(): null {
  const container = useContainer();

  useEffect(() => {
    const listener = container.resolve(WebSocketListener);
    const handler = createJobStatusNotificationHandler(container);
    listener.on("job:status", handler);
    return () => {
      listener.off("job:status", handler);
    };
  }, [container]);

  return null;
}
```

- [ ] **Step 6: Run full test suite and type check**

Run: `yarn vitest run && yarn tsc --noEmit`
Expected: All tests pass, no type errors

- [ ] **Step 7: Commit**

```bash
git add src/ui/shared/notifications/jobNotifications.ts src/ui/shared/notifications/__tests__/jobNotifications.test.ts src/ui/App.tsx
git commit -m "feat: show project name in job notification toasts

Factory pattern replaces standalone handler. Resolves ProjectsRepository
from DI container to look up project name by ID. Falls back gracefully
when project not loaded yet."
```
