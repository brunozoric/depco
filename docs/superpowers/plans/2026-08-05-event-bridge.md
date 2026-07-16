# UI EventBridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple all UI presenter WebSocket subscriptions via a source-agnostic EventBridge abstraction, fix 5 subscription leaks, and migrate changelog components to route events through presenters.

**Architecture:** New `EventBridge` abstraction (same pattern as API-side `EventBus`) sits between event sources and consumers. `WebSocketListener` becomes an adapter that pushes into EventBridge. All 10 presenters swap from `WebSocketListener` to `EventBridge`. Changelog components lose direct event access and read state from presenters.

**Tech Stack:** TypeScript, MobX, Vitest, project DI (`createAbstraction`/`createImplementation`/`createFeature`)

## Global Constraints

- Use `yarn full` for all verification (lint, format, typecheck, build, tests)
- Named interfaces only — no inline structural types
- Object params with named keys when function has 2+ params
- Never import `*Impl` outside its file — use abstractions + DI container
- Full words in identifiers — "EventBridge" not "EB"
- Commit all files after each task — never leave dirty working tree

---

### Task 1: EventBridge Core

**Files:**

- Create: `src/ui/events/abstractions/EventBridge.ts`
- Create: `src/ui/events/abstractions/index.ts`
- Create: `src/ui/events/EventBridge.ts`
- Create: `src/ui/events/eventMap.ts`
- Create: `src/ui/events/feature.ts`
- Create: `src/ui/events/index.ts`
- Create: `src/ui/events/__tests__/EventBridge.test.ts`

**Interfaces:**

- Consumes: `createAbstraction` from `#shared/index.js`, `WSEventMap` from `#shared/websocket/types.js`
- Produces: `EventBridge` abstraction token, `IEventBridge` interface (`on`, `off`, `emit`), `IEventMap` augmentable interface, `EventName` type, `EventBridgeFeature` DI feature

- [ ] **Step 1: Write EventBridge unit tests**

```typescript
// src/ui/events/__tests__/EventBridge.test.ts
import { describe, it, expect, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { EventBridgeFeature } from "../feature.js";
import { EventBridge } from "../abstractions/EventBridge.js";
import "../eventMap.js";

describe("EventBridge", () => {
  function createEventBridge(): EventBridge.Interface {
    const container = createContainer();
    container.register(EventBridgeFeature);
    return container.resolve(EventBridge);
  }

  it("should fire registered handler on emit", () => {
    const bridge = createEventBridge();
    const handler = vi.fn();

    bridge.on("scan:complete", handler);
    bridge.emit("scan:complete", { projectId: "p1", warning: null });

    expect(handler).toHaveBeenCalledWith({ projectId: "p1", warning: null });
  });

  it("should not fire handler after off", () => {
    const bridge = createEventBridge();
    const handler = vi.fn();

    bridge.on("scan:complete", handler);
    bridge.off("scan:complete", handler);
    bridge.emit("scan:complete", { projectId: "p1", warning: null });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should support multiple handlers per event", () => {
    const bridge = createEventBridge();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bridge.on("scan:complete", handler1);
    bridge.on("scan:complete", handler2);
    bridge.emit("scan:complete", { projectId: "p1", warning: null });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it("should not crosstalk between event types", () => {
    const bridge = createEventBridge();
    const scanHandler = vi.fn();
    const jobHandler = vi.fn();

    bridge.on("scan:complete", scanHandler);
    bridge.on("job:status", jobHandler);
    bridge.emit("scan:complete", { projectId: "p1", warning: null });

    expect(scanHandler).toHaveBeenCalledOnce();
    expect(jobHandler).not.toHaveBeenCalled();
  });

  it("should not throw when emitting with no handlers", () => {
    const bridge = createEventBridge();

    expect(() => {
      bridge.emit("scan:complete", { projectId: "p1", warning: null });
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/ui/events/__tests__/EventBridge.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create EventBridge abstraction**

```typescript
// src/ui/events/abstractions/EventBridge.ts
import { createAbstraction } from "#shared/index.js";

export interface IEventMap {}

export type EventName = keyof IEventMap & string;

export interface IEventBridge {
  on<K extends EventName>(event: K, handler: (data: IEventMap[K]) => void): void;
  off<K extends EventName>(event: K, handler: (data: IEventMap[K]) => void): void;
  emit<K extends EventName>(event: K, data: IEventMap[K]): void;
}

export const EventBridge = createAbstraction<IEventBridge>("Ui/EventBridge");

export namespace EventBridge {
  export type Interface = IEventBridge;
  export type EventMap = IEventMap;
  export type EventName = import("./EventBridge.js").EventName;
}
```

```typescript
// src/ui/events/abstractions/index.ts
export { EventBridge } from "./EventBridge.js";
export type { IEventBridge, IEventMap, EventName } from "./EventBridge.js";
```

- [ ] **Step 4: Create EventBridge implementation**

```typescript
// src/ui/events/EventBridge.ts
import { EventBridge as Abstraction } from "./abstractions/EventBridge.js";
import type { EventName, IEventMap } from "./abstractions/EventBridge.js";

type AnyHandler = (data: unknown) => void;

class EventBridgeImpl implements Abstraction.Interface {
  private readonly handlers = new Map<string, Set<AnyHandler>>();

  public on<K extends EventName>(event: K, handler: (data: IEventMap[K]) => void): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as AnyHandler);
  }

  public off<K extends EventName>(event: K, handler: (data: IEventMap[K]) => void): void {
    this.handlers.get(event)?.delete(handler as AnyHandler);
  }

  public emit<K extends EventName>(event: K, data: IEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    for (const handler of set) {
      handler(data);
    }
  }
}

export const EventBridge = Abstraction.createImplementation({
  implementation: EventBridgeImpl,
  dependencies: []
});
```

- [ ] **Step 5: Create event map augmentation**

```typescript
// src/ui/events/eventMap.ts
import type { WSEventMap } from "#shared/websocket/types.js";

declare module "./abstractions/EventBridge.js" {
  interface IEventMap {
    "scan:progress": WSEventMap["scan:progress"];
    "scan:complete": WSEventMap["scan:complete"];
    "scan:failed": WSEventMap["scan:failed"];
    "job:status": WSEventMap["job:status"];
    "job:log": WSEventMap["job:log"];
    "job:progress": WSEventMap["job:progress"];
    "install:complete": WSEventMap["install:complete"];
    notification: WSEventMap["notification"];
    "upgrade-session:step-progress": WSEventMap["upgrade-session:step-progress"];
    "upgrade-session:step-complete": WSEventMap["upgrade-session:step-complete"];
    "log:created": WSEventMap["log:created"];
    "changelog:resolved": WSEventMap["changelog:resolved"];
    "snooze:expired": WSEventMap["snooze:expired"];
    "license-scan:progress": WSEventMap["license-scan:progress"];
    "license-scan:complete": WSEventMap["license-scan:complete"];
    "auto-fix:progress": WSEventMap["auto-fix:progress"];
    "auto-fix:complete": WSEventMap["auto-fix:complete"];
    "transitive-resolve:complete": WSEventMap["transitive-resolve:complete"];
  }
}
```

- [ ] **Step 6: Create DI feature and barrel exports**

```typescript
// src/ui/events/feature.ts
import { createFeature } from "#shared/index.js";
import { EventBridge } from "./EventBridge.js";

export const EventBridgeFeature = createFeature({
  name: "Ui/EventBridge",
  register(container) {
    container.register(EventBridge).inSingletonScope();
  }
});
```

```typescript
// src/ui/events/index.ts
export { EventBridge } from "./abstractions/index.js";
export type { IEventBridge, IEventMap, EventName } from "./abstractions/index.js";
export { EventBridgeFeature } from "./feature.js";
```

Register `EventBridgeFeature` in the app's root feature list — find where `WebSocketFeature` is registered (likely `src/ui/features.ts` or similar) and add `EventBridgeFeature` alongside it.

- [ ] **Step 7: Run tests to verify they pass**

Run: `yarn vitest run src/ui/events/__tests__/EventBridge.test.ts`
Expected: PASS — all 5 tests green

- [ ] **Step 8: Commit**

```bash
git add src/ui/events/
git commit -m "feat(ui): add EventBridge abstraction with source-agnostic event dispatch"
```

---

### Task 2: WebSocketListener Refactor

**Files:**

- Modify: `src/ui/websocket/abstractions/WebSocketListener.ts`
- Modify: `src/ui/websocket/WebSocketListener.ts`
- Modify: `src/ui/websocket/feature.ts`
- Modify: `src/ui/websocket/__tests__/WebSocketListener.test.ts`

**Interfaces:**

- Consumes: `EventBridge` abstraction from Task 1
- Produces: Slimmed `IWebSocketListener` with only `connect()` and `disconnect()`

- [ ] **Step 1: Update WebSocketListener tests**

Read `src/ui/websocket/__tests__/WebSocketListener.test.ts` to understand current test structure.

Update tests to verify:

- `handleMessage` calls `eventBridge.emit(type, data)` instead of dispatching to callbacks
- No `on`/`off` methods exist on the listener
- Connection lifecycle (connect, disconnect, reconnect) still works

The test should create a fake EventBridge (object with `on`, `off`, `emit` as `vi.fn()`) and inject it via DI, then verify `emit` is called when a WebSocket message is received.

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/ui/websocket/__tests__/WebSocketListener.test.ts`
Expected: FAIL — tests expect new behavior

- [ ] **Step 3: Shrink WebSocketListener abstraction**

```typescript
// src/ui/websocket/abstractions/WebSocketListener.ts
import { createAbstraction } from "#shared/index.js";

export interface IWebSocketListener {
  connect(): void;
  disconnect(): void;
}

export const WebSocketListener = createAbstraction<IWebSocketListener>("Ui/WebSocketListener");

export namespace WebSocketListener {
  export type Interface = IWebSocketListener;
}
```

- [ ] **Step 4: Update WebSocketListener implementation**

Modify `src/ui/websocket/WebSocketListener.ts`:

- Remove `callbacksByType` map
- Remove `on` and `off` methods
- Add `EventBridge` as constructor dependency
- In `handleMessage`, replace the callback iteration with `this.eventBridge.emit(message.type as EventName, message.data)`
- Import `EventBridge` from `../events/abstractions/EventBridge.js` and `../events/eventMap.js`

The constructor signature becomes:

```typescript
public constructor(private readonly eventBridge: EventBridge.Interface) { ... }
```

Dependencies array becomes:

```typescript
dependencies: [EventBridge];
```

- [ ] **Step 5: Update WebSocket feature registration**

In `src/ui/websocket/feature.ts`, the `WebSocketListener` implementation now depends on `EventBridge`, so `EventBridgeFeature` must be registered before `WebSocketFeature`. Verify the registration order in the app root, or add `EventBridgeFeature` as a dependency of `WebSocketFeature` if the feature system supports it.

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn vitest run src/ui/websocket/__tests__/WebSocketListener.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/websocket/ src/ui/events/
git commit -m "refactor(ui): make WebSocketListener push events through EventBridge"
```

---

### Task 3: Presenter Migration — Dependency Swap + Leak Fixes

Migrate all 10 presenters from `WebSocketListener` to `EventBridge`. For 5 presenters that already clean up subscriptions, this is a mechanical swap. For 5 presenters that leak subscriptions, also add `dispose()` with proper `off()` cleanup.

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`
- Modify: `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts`
- Modify: `src/ui/presentation/packages/PackageList/PackagesPresenter.ts`
- Modify: `src/ui/presentation/dependencyGraph/GraphPage/DependencyGraphPresenter.ts`
- Modify: `src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts`
- Modify: `src/ui/presentation/jobs/JobManager/JobManagerPresenter.ts`
- Modify: `src/ui/presentation/jobs/JobManager/abstractions/JobManagerPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`
- Modify: `src/ui/presentation/projects/UpgradeWizard/UpgradeWizardPresenter.ts`
- Modify: `src/ui/presentation/projects/UpgradeWizard/abstractions/UpgradeWizardPresenter.ts`
- Modify: `src/ui/presentation/logs/LogBrowser/LogBrowserPresenter.ts`
- Modify: `src/ui/presentation/logs/LogBrowser/abstractions/LogBrowserPresenter.ts`
- Modify: `src/ui/presentation/licenses/LicensesList/LicensesPresenter.ts`
- Modify: `src/ui/presentation/licenses/LicensesList/abstractions/LicensesPresenter.ts`
- Modify: 10 test files (see below)

**Interfaces:**

- Consumes: `EventBridge` from Task 1
- Produces: All presenters use `EventBridge` instead of `WebSocketListener`; 5 presenters gain `dispose(): void`

#### Sub-task 3a: Presenters with existing cleanup (mechanical swap)

For each of these 5 presenters, apply the same pattern:

1. Replace `import { WebSocketListener } from "../../../websocket/abstractions/WebSocketListener.js"` with `import { EventBridge } from "../../../events/abstractions/EventBridge.js"` and `import "../../../events/eventMap.js"`
2. Constructor param: `webSocketListener: WebSocketListener.Interface` → `eventBridge: EventBridge.Interface`
3. All `this.webSocketListener.on(` → `this.eventBridge.on(`
4. All `this.webSocketListener.off(` → `this.eventBridge.off(`
5. Handler type annotations: `WebSocketListener.Callback<"...">` → `EventBridge.Callback<"...">` (add `Callback` to EventBridge namespace if not present — alias it as `type Callback<K extends EventName> = (data: IEventMap[K]) => void`)
6. Dependencies array: `WebSocketListener` → `EventBridge`

**Presenters:**

- `ProjectDetailPresenter` — has `dispose()` with 5 `off()` calls
- `DashboardPresenter` — has `dispose()` with 2 `off()` calls
- `PackagesPresenter` — has `dispose()` with 2 `off()` calls
- `DependencyGraphPresenter` — has `dispose()` with 2 `off()` calls
- `JobProgressPresenter` — has `untrackJob()` with 3 `off()` calls

- [ ] **Step 1: Add `Callback` type to EventBridge namespace**

In `src/ui/events/abstractions/EventBridge.ts`, add to the namespace:

```typescript
export namespace EventBridge {
  export type Interface = IEventBridge;
  export type EventMap = IEventMap;
  export type EventName = import("./EventBridge.js").EventName;
  export type Callback<K extends EventName> = (data: IEventMap[K]) => void;
}
```

- [ ] **Step 2: Swap all 5 presenters**

Apply the mechanical replacement pattern above to each file. Read each file first to understand exact import paths and field names.

- [ ] **Step 3: Update test files for these 5 presenters**

3 test files use `createFakeWebSocketListener()` pattern:

- `src/ui/presentation/projects/ProjectDetail/__tests__/ProjectDetailPresenter.test.ts`
- `src/ui/presentation/packages/PackageList/__tests__/PackagesPresenter.test.ts`
- `src/ui/presentation/jobs/JobProgress/__tests__/JobProgressPresenter.test.ts`

For each, replace `createFakeWebSocketListener` with `createFakeEventBridge`:

```typescript
function createFakeEventBridge(): {
  bridge: EventBridge.Interface;
  emit: <K extends EventBridge.EventName>(event: K, data: EventBridge.EventMap[K]) => void;
  listenerCount: (event: EventBridge.EventName) => number;
} {
  const handlers = new Map<string, Set<(data: unknown) => void>>();

  const bridge: EventBridge.Interface = {
    on: (event, handler) => {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler as (data: unknown) => void);
    },
    off: (event, handler) => {
      handlers.get(event)?.delete(handler as (data: unknown) => void);
    },
    emit: (event, data) => {
      for (const handler of handlers.get(event) ?? []) {
        handler(data);
      }
    }
  };

  function listenerCount(event: EventBridge.EventName): number {
    return handlers.get(event)?.size ?? 0;
  }

  return { bridge, emit: bridge.emit, listenerCount };
}
```

Then in each test file:

1. Replace `import { WebSocketListener }` with `import { EventBridge }` and the eventMap import (adjust relative path per file depth — e.g. `../../../../events/eventMap.js` for 4-level-deep tests)
2. Replace `fakeWebSocket = createFakeWebSocketListener()` with `fakeEventBridge = createFakeEventBridge()`
3. Replace `container.registerInstance(WebSocketListener, fakeWebSocket.listener)` with `container.registerInstance(EventBridge, fakeEventBridge.bridge)`
4. Replace `fakeWebSocket.emit(` with `fakeEventBridge.emit(` and `fakeWebSocket.listenerCount(` with `fakeEventBridge.listenerCount(`

2 test files use `wsMock` pattern (vi.fn() mocks):

- `src/ui/presentation/dashboard/Dashboard/__tests__/DashboardPresenter.test.ts`
- `src/ui/presentation/dependencyGraph/__tests__/DependencyGraphPresenter.test.ts`

For wsMock-pattern tests:

1. Replace `WebSocketListener` import with `EventBridge` import and the eventMap import (adjust relative path per file depth — e.g. `../../../../events/eventMap.js` for 4-level-deep tests like Dashboard, `../../../events/eventMap.js` for 3-level-deep tests like DependencyGraph)
2. Replace `MockWebSocketListener` type with `MockEventBridge` — add `emit: ReturnType<typeof vi.fn>` to the interface
3. Rename `wsMock` to `eventBridgeMock` throughout
4. Replace `container.registerInstance(WebSocketListener, wsMock ...)` with `container.registerInstance(EventBridge, eventBridgeMock ...)`

- [ ] **Step 4: Run tests for these 5 presenters**

Run: `yarn vitest run src/ui/presentation/projects/ProjectDetail/__tests__ src/ui/presentation/dashboard/Dashboard/__tests__ src/ui/presentation/packages/PackageList/__tests__ src/ui/presentation/dependencyGraph/__tests__ src/ui/presentation/jobs/JobProgress/__tests__`
Expected: PASS

#### Sub-task 3b: Presenters needing dispose (swap + add dispose)

For each of these 5 presenters:

1. Apply the same import/constructor/dependency swap as 3a
2. Extract inline lambdas to named handler fields (class properties with arrow functions)
3. Add `dispose(): void` method that calls `off()` for each handler
4. Add `dispose(): void` to the abstraction interface

**JobManagerPresenter** (`src/ui/presentation/jobs/JobManager/JobManagerPresenter.ts`):

Current constructor has inline lambda for `job:status`. Extract to named field:

```typescript
private readonly handleJobStatus: EventBridge.Callback<"job:status">;

constructor(...) {
    this.handleJobStatus = data => {
        runInAction(() => {
            this.jobsRepository.updateJobStatus(data.jobId, data.status);
        });
        this.debouncedRefresh();
    };
    this.eventBridge.on("job:status", this.handleJobStatus);
}

public dispose = (): void => {
    this.eventBridge.off("job:status", this.handleJobStatus);
    if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
    }
};
```

Add to `src/ui/presentation/jobs/JobManager/abstractions/JobManagerPresenter.ts`:

```typescript
dispose: () => void;
```

**ProjectListPresenter** (`src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`):

Has 3 named handlers (`handleScanProgress`, `handleScanComplete`, `handleScanFailed`) + 2 inline (`install:complete`, `job:status`). Extract the 2 inlines to named fields, add dispose:

```typescript
private readonly handleInstallComplete: EventBridge.Callback<"install:complete">;
private readonly handleJobStatus: EventBridge.Callback<"job:status">;

// In constructor, assign these, then subscribe all 5

public dispose = (): void => {
    this.eventBridge.off("scan:progress", this.handleScanProgress);
    this.eventBridge.off("scan:complete", this.handleScanComplete);
    this.eventBridge.off("scan:failed", this.handleScanFailed);
    this.eventBridge.off("install:complete", this.handleInstallComplete);
    this.eventBridge.off("job:status", this.handleJobStatus);
};
```

Add `dispose(): void` to `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`.

**UpgradeWizardPresenter** (`src/ui/presentation/projects/UpgradeWizard/UpgradeWizardPresenter.ts`):

Has 2 inline lambdas for `upgrade-session:step-progress` and `upgrade-session:step-complete`. Extract to named fields, add dispose:

```typescript
private readonly handleStepProgress: EventBridge.Callback<"upgrade-session:step-progress">;
private readonly handleStepComplete: EventBridge.Callback<"upgrade-session:step-complete">;

public dispose = (): void => {
    this.eventBridge.off("upgrade-session:step-progress", this.handleStepProgress);
    this.eventBridge.off("upgrade-session:step-complete", this.handleStepComplete);
};
```

Add `dispose(): void` to `src/ui/presentation/projects/UpgradeWizard/abstractions/UpgradeWizardPresenter.ts`.

**LogBrowserPresenter** (`src/ui/presentation/logs/LogBrowser/LogBrowserPresenter.ts`):

Has 1 inline lambda for `log:created`. Extract to named field, add dispose:

```typescript
private readonly handleLogCreated: EventBridge.Callback<"log:created">;

public dispose = (): void => {
    this.eventBridge.off("log:created", this.handleLogCreated);
};
```

Add `dispose(): void` to `src/ui/presentation/logs/LogBrowser/abstractions/LogBrowserPresenter.ts`.

**LicensesPresenter** (`src/ui/presentation/licenses/LicensesList/LicensesPresenter.ts`):

Has 1 inline lambda for `license-scan:complete`. Has existing `dispose()` that only cleans reaction + urlListener. Extract to named field, extend dispose:

```typescript
private readonly handleLicenseScanComplete: EventBridge.Callback<"license-scan:complete">;

public dispose = (): void => {
    this.eventBridge.off("license-scan:complete", this.handleLicenseScanComplete);
    this.disposeTeamReaction();
    this.disposeUrlListener();
};
```

Add `dispose(): void` to `src/ui/presentation/licenses/LicensesList/abstractions/LicensesPresenter.ts` (if not already present — check; LicensesPresenter already has dispose in implementation so it may already be in the abstraction).

- [ ] **Step 5: Update test files for these 5 presenters**

3 test files use `createFakeWebSocketListener()` pattern:

- `src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts`
- `src/ui/presentation/projects/UpgradeWizard/__tests__/UpgradeWizardPresenter.test.ts`
- `src/ui/presentation/jobs/JobManager/__tests__/JobManagerPresenter.test.ts`

Apply the same `createFakeEventBridge` swap as in Sub-task 3a Step 3.

2 test files use `wsMock`/inline mock pattern:

- `src/ui/presentation/logs/LogBrowser/__tests__/LogBrowserPresenter.test.ts`
- `src/ui/presentation/licenses/__tests__/LicensesPresenter.test.ts`

Apply the same wsMock-to-EventBridge swap as in Sub-task 3a Step 3 (wsMock pattern).

**Add dispose tests** for each of the 5 presenters. In each test file, add a test:

```typescript
it("should unsubscribe from all events on dispose", () => {
  const presenter = createPresenter();
  presenter.dispose();

  // Emit events after dispose — handler should not fire
  fakeEventBridge.emit("job:status", {
    jobId: "j1",
    referenceId: "r1",
    referenceType: "project",
    type: "scan",
    status: "completed"
  });

  // Verify no side effects occurred (specific to each presenter)
});
```

- [ ] **Step 6: Run all presenter tests**

Run: `yarn vitest run src/ui/presentation/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/presentation/ src/ui/events/abstractions/EventBridge.ts
git commit -m "refactor(ui): migrate all presenters from WebSocketListener to EventBridge

Add dispose() to JobManager, ProjectList, UpgradeWizard, LogBrowser,
and Licenses presenters to fix subscription leaks."
```

---

### Task 4: App.tsx + Changelog Component Migration

**Files:**

- Modify: `src/ui/App.tsx`
- Modify: `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`
- Modify: `src/ui/presentation/projects/ProjectDetail/components/ChangelogModal.tsx`
- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`
- Modify: `src/ui/presentation/packages/PackageList/components/PackagesPage.tsx`
- Modify: `src/ui/presentation/packages/PackageList/PackagesPresenter.ts`
- Modify: `src/ui/presentation/packages/PackageList/abstractions/PackagesPresenter.ts`
- Modify: `src/ui/presentation/projects/UpgradeWizard/components/SelectPackagesStep.tsx`
- Modify: `src/ui/presentation/projects/UpgradeWizard/components/ChangelogDrawer.tsx`
- Modify: `src/ui/presentation/projects/UpgradeWizard/UpgradeWizardPresenter.ts`
- Modify: `src/ui/presentation/projects/UpgradeWizard/abstractions/UpgradeWizardPresenter.ts`

**Interfaces:**

- Consumes: `EventBridge` from Task 1, migrated presenters from Task 3
- Produces: No React component imports `WebSocketListener` or `EventBridge`; all event subscriptions route through presenters or App.tsx cross-cutting listeners

#### Sub-task 4a: App.tsx event subscribers

- [ ] **Step 1: Update App.tsx**

In `src/ui/App.tsx`:

1. Replace `import { WebSocketListener }` with `import { EventBridge }` and `import "./events/eventMap.js"`
2. In `JobNotificationListener`:
   - Replace `container.resolve(WebSocketListener)` with `container.resolve(EventBridge)`
   - Replace `listener.on("job:status", handler)` with `eventBridge.on("job:status", handler)`
   - Replace `listener.off("job:status", handler)` with `eventBridge.off("job:status", handler)`
3. Apply same pattern to `SnoozeExpiryListener` (find it in App.tsx — likely subscribes to `snooze:expired`)
4. `WebSocketConnector` component still resolves `WebSocketListener` for `connect()`/`disconnect()` — keep that unchanged

- [ ] **Step 2: Verify App.tsx compiles**

Run: `yarn vitest run src/ui/ --passWithNoTests` (or just typecheck via `yarn full`)

#### Sub-task 4b: Changelog component migration

The `ChangelogModal` and `ChangelogDrawer` components subscribe to `changelog:resolved` and `job:status` events via a `webSocketListener` prop. This logic moves into the parent presenters. The components lose the WS prop and instead receive observable changelog state from the presenter.

**Pattern for each presenter that uses changelogs:**

Each presenter (ProjectDetail, Packages, UpgradeWizard) needs to:

1. Subscribe to `changelog:resolved` via EventBridge (already subscribed to EventBridge from Task 3)
2. Subscribe to `job:status` for changelog job completion
3. Expose observable state: `changelogEntries`, `changelogResolving`, `changelogResolvedCount`, `changelogTotalToResolve`
4. Provide methods to start/stop tracking changelog for a specific package

Since this logic is identical across 3 presenters, read the current ChangelogModal implementation to understand the exact state shape and event handling, then replicate it in each presenter's VM and handler logic.

- [ ] **Step 3: Add changelog state to ProjectDetailPresenter**

Read `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts` fully to understand current structure.

Add to the presenter implementation:

1. Observable fields: `changelogPackageName: string | null`, `changelogResolving: boolean`, `changelogResolvedCount: number`, `changelogTotalToResolve: number`, `changelogEntries: ChangelogEntry[]`
2. Named handlers: `handleChangelogResolved` and `handleChangelogJobStatus`
3. In `handleChangelogResolved`: filter by `changelogPackageName`, update entries (same logic as ChangelogModal's useEffect)
4. In `handleChangelogJobStatus`: check for terminal changelog job status, set `changelogResolving = false`
5. Subscribe to both events in constructor via `this.eventBridge.on(...)`
6. Add `off()` calls in existing `dispose()`
7. Add methods: `startChangelogTracking(packageName: string, entries: ChangelogEntry[], resolving: boolean)` and `stopChangelogTracking()`
8. Expose changelog state in `vm` getter

Add to `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`:

- `IChangelogTrackingState` interface with `entries`, `resolving`, `resolvedCount`, `totalToResolve`
- Add `changelogState: IChangelogTrackingState | null` to `IProjectDetailViewModel`
- Add `startChangelogTracking` and `stopChangelogTracking` to interface

- [ ] **Step 4: Update ChangelogModal to read from presenter**

Modify `src/ui/presentation/projects/ProjectDetail/components/ChangelogModal.tsx`:

1. Remove `webSocketListener` from props interface
2. Remove both `useEffect` hooks that subscribe to `changelog:resolved` and `job:status`
3. Add a `changelogState` prop (or pass the relevant VM fields) with the `resolving`, `resolvedCount`, `totalToResolve` state
4. The `entries` state management stays local (for the initial load), BUT the real-time updates come from the presenter's observable state
5. Use `observer()` wrapper if not already applied, so it reacts to presenter state changes

Alternatively, simplify: the component keeps its own `entries` state for the initial load, and receives an `onChangelogEvent` callback from the parent that gets called whenever a changelog entry resolves. The parent component wires this to the presenter.

**Recommended approach:** Keep ChangelogModal simple — add an `updates` prop that is an observable array of resolved changelog entries from the presenter. The component merges these into its local state. Remove all WS-related imports and props.

- [ ] **Step 5: Update ProjectDetailPage to stop resolving WebSocketListener**

Modify `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`:

1. Remove `import { WebSocketListener }`
2. Remove `const webSocketListener = container.resolve(WebSocketListener)`
3. Remove `webSocketListener={webSocketListener}` prop from `<ChangelogModal>`
4. Pass changelog state from presenter's VM instead

- [ ] **Step 6: Apply same pattern to PackagesPresenter + PackagesPage**

Repeat Steps 3-5 for:

- `src/ui/presentation/packages/PackageList/PackagesPresenter.ts` — add changelog event handlers + state
- `src/ui/presentation/packages/PackageList/abstractions/PackagesPresenter.ts` — add changelog state to VM
- `src/ui/presentation/packages/PackageList/components/PackagesPage.tsx` — remove WS resolution

- [ ] **Step 7: Apply same pattern to UpgradeWizardPresenter + SelectPackagesStep + ChangelogDrawer**

Repeat for:

- `src/ui/presentation/projects/UpgradeWizard/UpgradeWizardPresenter.ts` — add changelog event handlers + state
- `src/ui/presentation/projects/UpgradeWizard/abstractions/UpgradeWizardPresenter.ts` — add to VM
- `src/ui/presentation/projects/UpgradeWizard/components/SelectPackagesStep.tsx` — remove WS resolution
- `src/ui/presentation/projects/UpgradeWizard/components/ChangelogDrawer.tsx` — remove WS prop, read from presenter state (same pattern as ChangelogModal)

- [ ] **Step 8: Update presenter tests**

Update tests for ProjectDetail, Packages, and UpgradeWizard presenters to verify:

- Changelog events via EventBridge update presenter state correctly
- `dispose()` unsubscribes changelog handlers

- [ ] **Step 9: Run all tests**

Run: `yarn full`
Expected: All checks green — lint, format, typecheck, build, tests

- [ ] **Step 10: Commit**

```bash
git add src/ui/
git commit -m "refactor(ui): migrate App.tsx and changelog components to EventBridge

App.tsx event subscribers use EventBridge directly (cross-cutting concerns).
Changelog event subscriptions move from ChangelogModal/ChangelogDrawer
into parent presenters. No React component resolves WebSocketListener
or EventBridge directly."
```

---

### Task 5: Cleanup + Verification

**Files:**

- Possibly modify: `src/ui/websocket/abstractions/WebSocketListener.ts` (remove stale namespace exports)
- Possibly modify: `src/ui/websocket/index.ts` (clean re-exports)

**Interfaces:**

- Consumes: Everything from Tasks 1-4
- Produces: Clean codebase with zero `WebSocketListener` usage in presenters/components

- [ ] **Step 1: Verify no WebSocketListener imports remain in presenters or components**

Run: `grep -rn "WebSocketListener" src/ui/presentation/ --include="*.ts" --include="*.tsx" | grep -v "__tests__" | grep -v "node_modules"`

Expected: Zero results. If any remain, fix them.

Also verify App.tsx only imports WebSocketListener in the `WebSocketConnector` component (for `connect`/`disconnect`):

Run: `grep -n "WebSocketListener" src/ui/App.tsx`

Expected: Only the `WebSocketConnector` import and usage.

- [ ] **Step 2: Clean up WebSocketListener namespace**

The `WebSocketListener` namespace previously exported `EventMap`, `EventType`, `Callback` types used by presenters. Since presenters no longer import `WebSocketListener`, these namespace members may be unused. Check and remove if so:

Run: `grep -rn "WebSocketListener\.\(EventMap\|EventType\|Callback\)" src/ui/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"`

If zero results, remove those namespace exports from `src/ui/websocket/abstractions/WebSocketListener.ts`.

- [ ] **Step 3: Run full verification**

Run: `yarn full`

Expected: All checks pass — lint, format, typecheck, build, all tests green.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "refactor(ui): clean up unused WebSocketListener type exports"
```
