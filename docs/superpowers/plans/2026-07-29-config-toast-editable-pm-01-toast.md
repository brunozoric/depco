# Config Error Toast Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show global toast notifications when `.dependency-upgrader.json` has parse/validation errors, regardless of which page the user is on.

**Architecture:** Renderless `ConfigErrorNotifier` component in `App.tsx` (same pattern as `JobNotificationListener`). Resolves `PmSettingsGateway` from DI container, fetches config status on mount, fires Mantine toast on error. Dedicated helper function in notifications directory.

**Tech Stack:** React, Mantine notifications, MobX-lite, `@webiny/di`

## Global Constraints

- All types must use named interfaces, never inline structural types
- This project uses yarn, not npm
- Work directly on main, no feature branches or git worktrees

---

### Task 1: Config error toast helper + ConfigErrorNotifier component

**Files:**

- Create: `src/ui/shared/notifications/configErrorNotification.ts`
- Modify: `src/ui/App.tsx`

**Interfaces:**

- Consumes: `PmSettingsGateway.Interface` (existing — `listPmConfig(): Promise<IPmConfigListResult>`)
- Consumes: `IConfigError` from `src/ui/features/settings/abstractions/PmSettingsGateway.ts` (existing — `{ type: "json" | "schema"; message: string }`)
- Produces: `showConfigErrorToast(error: IConfigError): void` — standalone function, used by `ConfigErrorNotifier`

- [ ] **Step 1: Write the test for showConfigErrorToast**

Create `src/ui/shared/notifications/__tests__/configErrorNotification.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifications } from "@mantine/notifications";
import { showConfigErrorToast } from "../configErrorNotification.js";

vi.mock("@mantine/notifications", () => ({
  notifications: {
    show: vi.fn()
  }
}));

vi.mock("../../router/router.js", () => ({
  navigate: vi.fn()
}));

describe("showConfigErrorToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows notification with yellow color and config-error id", () => {
    showConfigErrorToast({ type: "json", message: "Unexpected token" });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "config-error",
        color: "yellow",
        autoClose: false
      })
    );
  });

  it("includes error message in notification", () => {
    showConfigErrorToast({ type: "schema", message: "Unknown field" });

    const call = vi.mocked(notifications.show).mock.calls[0]![0];
    expect(call.message).toContain("Unknown field");
  });

  it("includes error type in title", () => {
    showConfigErrorToast({ type: "json", message: "bad" });

    const call = vi.mocked(notifications.show).mock.calls[0]![0];
    expect(call.title).toContain("Config file error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/ui/shared/notifications/__tests__/configErrorNotification.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement showConfigErrorToast**

Create `src/ui/shared/notifications/configErrorNotification.ts`:

```ts
import { notifications } from "@mantine/notifications";
import type { IConfigError } from "#ui/features/settings/abstractions/PmSettingsGateway.js";
import { navigate } from "../router/router.js";

export function showConfigErrorToast(error: IConfigError): void {
  notifications.show({
    id: "config-error",
    color: "yellow",
    title: "Config file error",
    message: `${error.type === "json" ? "JSON parse" : "Schema validation"} error: ${error.message}`,
    autoClose: false,
    style: { cursor: "pointer" },
    onClick: () => {
      navigate("/settings");
      notifications.hide("config-error");
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/ui/shared/notifications/__tests__/configErrorNotification.test.ts`
Expected: PASS

- [ ] **Step 5: Add ConfigErrorNotifier to App.tsx**

In `src/ui/App.tsx`, add import:

```ts
import { showConfigErrorToast } from "./shared/notifications/configErrorNotification.js";
import { PmSettingsGateway } from "#ui/features/settings/abstractions/PmSettingsGateway.js";
```

Add component after `JobNotificationListener` (before `AppRoutes`):

```ts
function ConfigErrorNotifier(): null {
  const container = useContainer();

  useEffect(() => {
    const gateway = container.resolve(PmSettingsGateway);
    gateway.listPmConfig().then(result => {
      if (result.configError) {
        showConfigErrorToast(result.configError);
      }
    });
  }, [container]);

  return null;
}
```

Add `<ConfigErrorNotifier />` in the render tree, after `<JobNotificationListener />`:

```tsx
<ContainerProvider features={ALL_FEATURES}>
    <WebSocketConnector />
    <JobNotificationListener />
    <ConfigErrorNotifier />
    <MantineProvider>
```

- [ ] **Step 6: Run full test suite**

Run: `yarn vitest run`
Expected: All tests pass (860+ tests)

- [ ] **Step 7: Run lint + format + typecheck**

Run: `yarn lint && yarn format:check && yarn build`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add src/ui/shared/notifications/configErrorNotification.ts src/ui/shared/notifications/__tests__/configErrorNotification.test.ts src/ui/App.tsx
git commit -m "feat: add global toast notification for config file errors"
```
