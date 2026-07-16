# UI EventBridge Design

## Problem

All 10 UI presenters directly depend on `WebSocketListener` for real-time event subscriptions. This creates tight coupling between the presentation layer and the WebSocket transport. Five presenters subscribe in their constructor but never call `off()`, leaking handlers. Three React components resolve `WebSocketListener` to pass as a prop to changelog components (`ChangelogModal`, `ChangelogDrawer`), which subscribe to events in their own `useEffect`. This bypasses the presenter layer, breaking MVP separation.

## Goals

1. Introduce a source-agnostic `EventBridge` abstraction that decouples presenters from any specific transport
2. Fix subscription leaks in 5 presenters by adding proper `dispose()` methods
3. Migrate 4 React components with direct WebSocket access to route events through their presenter
4. Follow the existing API-side `EventBus` pattern (`IEventMap` interface augmentation via `declare module`)

## Non-Goals

- Translating WS event names to domain events (future work)
- Adding new event sources (SSE, polling) — only establishing the architecture for them
- Changing the API-side `WebSocketBroadcaster` or `EventBus`

## Design

### EventBridge Abstraction

New abstraction at `src/ui/events/abstractions/EventBridge.ts`, mirroring the API-side `EventBus` pattern:

```typescript
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
}
```

Difference from API-side `EventBus`: single `data` argument instead of `...args` spread. WS events always carry one payload object.

### EventBridge Implementation

At `src/ui/events/EventBridge.ts`:

```typescript
class EventBridgeImpl implements IEventBridge {
  private readonly handlers = new Map<string, Set<(data: unknown) => void>>();

  public on<K extends EventName>(event: K, handler: (data: IEventMap[K]) => void): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as (data: unknown) => void);
  }

  public off<K extends EventName>(event: K, handler: (data: IEventMap[K]) => void): void {
    this.handlers.get(event)?.delete(handler as (data: unknown) => void);
  }

  public emit<K extends EventName>(event: K, data: IEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(data);
    }
  }
}
```

Registered as a DI singleton via `createImplementation` with no dependencies.

### Event Map Registration

Single file `src/ui/events/eventMap.ts` centralizes all event type augmentations:

```typescript
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

### WebSocketListener Changes

`WebSocketListener` keeps connection lifecycle (`connect`, `disconnect`, reconnect logic) but stops dispatching events itself:

**Interface shrinks:**

```typescript
export interface IWebSocketListener {
  connect(): void;
  disconnect(): void;
}
```

**Implementation changes:**

- Removes `callbacksByType` map and `on`/`off` methods
- Adds `EventBridge` as constructor dependency
- `handleMessage()` calls `this.eventBridge.emit(type, data)` instead of iterating its own callback set

`App.tsx WebSocketConnector` continues to resolve `WebSocketListener` for `connect()`/`disconnect()` lifecycle management — unchanged.

### Presenter Migration

All 10 presenters swap `WebSocketListener` dependency for `EventBridge`:

1. Import `EventBridge` instead of `WebSocketListener`
2. Constructor param: `eventBridge: EventBridge.Interface`
3. `this.webSocketListener.on(...)` becomes `this.eventBridge.on(...)`
4. `this.webSocketListener.off(...)` becomes `this.eventBridge.off(...)`
5. DI dependencies array: `EventBridge` replaces `WebSocketListener`

**Presenters (dependency swap only — already clean up subscriptions):**

- `ProjectDetailPresenter` — 5 events, has `dispose()`
- `DashboardPresenter` — 2 events, has `dispose()`
- `PackagesPresenter` — 2 events + gains `changelog:resolved` from component migration, has `dispose()`
- `DependencyGraphPresenter` — 2 events, has `dispose()`
- `JobProgressPresenter` — 3 events, uses dynamic `trackJob()`/`untrackJob()` (no `dispose()` needed)

### Subscription Leak Fixes

Five presenters subscribe in their constructor but never unsubscribe. Each gets:

1. Named handler references stored as class fields (not inline lambdas)
2. `dispose(): void` method that calls `off()` for each handler
3. `dispose(): void` added to the abstraction interface

| Presenter                | Events                                                                            | Notes                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `JobManagerPresenter`    | `job:status`                                                                      | Currently inline lambda in constructor                                                                               |
| `ProjectListPresenter`   | `scan:progress`, `scan:complete`, `scan:failed`, `install:complete`, `job:status` | 3 named + 2 inline                                                                                                   |
| `UpgradeWizardPresenter` | `upgrade-session:step-progress`, `upgrade-session:step-complete`                  | Both inline                                                                                                          |
| `LogBrowserPresenter`    | `log:created`                                                                     | Inline                                                                                                               |
| `LicensesPresenter`      | `license-scan:complete`                                                           | Inline; existing `dispose()` only cleans reaction + urlListener — must be extended to also `off()` the event handler |

### React Component Migration

Three React components (`ProjectDetailPage`, `PackagesPage`, `SelectPackagesStep`) resolve `WebSocketListener` only to pass it as a prop to `ChangelogModal` or `ChangelogDrawer`. Those changelog components subscribe to `changelog:resolved` in their own `useEffect`. The subscription logic moves into the parent presenter; the components stop resolving or receiving `WebSocketListener`.

| Component                | Current role                                 | Migration                                                                      |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------ |
| `ProjectDetailPage.tsx`  | Resolves WS, passes to `ChangelogModal`      | Stop resolving WS; `ProjectDetailPresenter` subscribes to `changelog:resolved` |
| `PackagesPage.tsx`       | Resolves WS, passes to `ChangelogModal`      | Stop resolving WS; `PackagesPresenter` subscribes to `changelog:resolved`      |
| `SelectPackagesStep.tsx` | Resolves WS, passes to `ChangelogDrawer`     | Stop resolving WS; `UpgradeWizardPresenter` subscribes to `changelog:resolved` |
| `ChangelogModal.tsx`     | Receives WS as prop, subscribes in useEffect | Remove WS prop; receive changelog data from presenter                          |
| `ChangelogDrawer.tsx`    | Receives WS as prop, subscribes in useEffect | Remove WS prop; receive changelog data from presenter                          |

After migration, no React component resolves `WebSocketListener` or `EventBridge` directly. All event subscriptions flow through presenters.

### App.tsx Event Subscribers

`JobNotificationListener` and `SnoozeExpiryListener` in `App.tsx` use `WebSocketListener` via `useEffect`. These switch to `EventBridge`:

```typescript
function JobNotificationListener(): null {
  const container = useContainer();
  useEffect(() => {
    const eventBridge = container.resolve(EventBridge);
    const handler = createJobStatusNotificationHandler(container);
    eventBridge.on("job:status", handler);
    return () => {
      eventBridge.off("job:status", handler);
    };
  }, [container]);
  return null;
}
```

These are app-level cross-cutting concerns (toast notifications), not page presenters. Direct `EventBridge` usage in `App.tsx` is acceptable — they have no presenter.

## File Structure

### New Files

```
src/ui/events/
    abstractions/
        EventBridge.ts      # IEventBridge, IEventMap, EventName
        index.ts            # re-export
    EventBridge.ts          # EventBridgeImpl
    eventMap.ts             # declare module augmentation for all WS events
    feature.ts              # DI feature registration
    index.ts                # re-export
```

### Modified Files

**WebSocket layer (2 files):**

- `src/ui/websocket/abstractions/WebSocketListener.ts` — remove `on`/`off`, keep `connect`/`disconnect`
- `src/ui/websocket/WebSocketListener.ts` — remove `callbacksByType`, inject EventBridge, `emit` on message

**Presenters — dependency swap only (5 files + abstractions):**

- `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`
- `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts`
- `src/ui/presentation/packages/PackageList/PackagesPresenter.ts`
- `src/ui/presentation/dependencyGraph/GraphPage/DependencyGraphPresenter.ts`
- `src/ui/presentation/jobs/JobProgress/JobProgressPresenter.ts`

**Presenters — dependency swap + add dispose (5 files + abstractions):**

- `src/ui/presentation/jobs/JobManager/JobManagerPresenter.ts`
- `src/ui/presentation/jobs/JobManager/abstractions/JobManagerPresenter.ts`
- `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`
- `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`
- `src/ui/presentation/projects/UpgradeWizard/UpgradeWizardPresenter.ts`
- `src/ui/presentation/projects/UpgradeWizard/abstractions/UpgradeWizardPresenter.ts`
- `src/ui/presentation/logs/LogBrowser/LogBrowserPresenter.ts`
- `src/ui/presentation/logs/LogBrowser/abstractions/LogBrowserPresenter.ts`
- `src/ui/presentation/licenses/LicensesList/LicensesPresenter.ts`
- `src/ui/presentation/licenses/LicensesList/abstractions/LicensesPresenter.ts`

**React components — remove direct WS access (4 files):**

- `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`
- `src/ui/presentation/packages/PackageList/components/PackagesPage.tsx`
- `src/ui/presentation/projects/UpgradeWizard/components/SelectPackagesStep.tsx`
- `src/ui/presentation/projects/ProjectDetail/components/ChangelogModal.tsx`
- `src/ui/presentation/projects/UpgradeWizard/components/ChangelogDrawer.tsx`

**App-level subscribers (1 file):**

- `src/ui/App.tsx` — `JobNotificationListener` + `SnoozeExpiryListener` swap to EventBridge

**Test files (~15 files):**

- All presenter test files swap `createFakeWebSocketListener()` for `createFakeEventBridge()`
- `WebSocketListener.test.ts` — verify `emit` delegation to EventBridge
- New `EventBridge.test.ts` — unit tests for on/off/emit

## Testing Strategy

**EventBridge unit tests:**

- `on` + `emit` fires handler with correct data
- `off` removes handler, no longer fires
- Multiple handlers per event type
- No crosstalk between event types
- `emit` with no handlers does not throw

**Presenter tests:**

- Existing tests swap `createFakeWebSocketListener()` for `createFakeEventBridge()` with `on/off/emit`
- Tests that simulate events call `eventBridge.emit("event", data)` directly
- Five newly-disposed presenters get tests verifying `dispose()` calls `off()` for all registered events

**WebSocketListener tests:**

- Verify `handleMessage` calls `eventBridge.emit(type, data)`
- No longer tests callback dispatch (EventBridge's responsibility)

**No integration test changes** — EventBridge is transparent re-dispatch with same events and payloads.
