# Dashboard UI Presentation Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the DashboardPresenter, LoadDashboardUseCase, provider, and feature registration for the presentation layer.

**Architecture:** MobX presenter with computed `vm` getter. UseCase calls all 5 gateway methods in parallel. WS event subscriptions for auto-refresh. Feature registered and wired into `ALL_FEATURES` in `App.tsx`.

**Tech Stack:** TypeScript, MobX, `@webiny/di`, Vitest

## Global Constraints

- Yarn 4, not npm
- oxlint for linting, oxfmt for formatting
- Named interfaces only, no inline structural types
- UI tests mock HTTPClient and WebSocketListener at DI level
- Never `new XxxImpl()` — always resolve through DI container
- Presenters: `makeAutoObservable(this, { vm: computed })`, arrow method properties
- Path aliases: `#ui/*`, `#shared/*`, `#testing/*`

## Prerequisite

Plan 04 (UI feature layer) must be completed first.

---

### Task 1: LoadDashboardUseCase

**Files:**

- Create: `src/ui/presentation/dashboard/useCases/abstractions/LoadDashboardUseCase.ts`
- Create: `src/ui/presentation/dashboard/useCases/LoadDashboardUseCase.ts`
- Create: `src/ui/presentation/dashboard/useCases/feature.ts`
- Create: `src/ui/presentation/dashboard/useCases/__tests__/LoadDashboardUseCase.test.ts`

**Interfaces:**

- Consumes: `DashboardGateway.Interface`, `DashboardRepository.Interface` from plan 04
- Produces: `LoadDashboardUseCase.Interface` consumed by Task 2

- [ ] **Step 1: Create use case abstraction**

Create `src/ui/presentation/dashboard/useCases/abstractions/LoadDashboardUseCase.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface ILoadDashboardUseCase {
  execute(trendRange: string): Promise<void>;
  refreshHealth(): Promise<void>;
  refreshActivity(): Promise<void>;
}

export const LoadDashboardUseCase =
  createAbstraction<ILoadDashboardUseCase>("Ui/LoadDashboardUseCase");

export namespace LoadDashboardUseCase {
  export type Interface = ILoadDashboardUseCase;
}
```

- [ ] **Step 2: Create use case implementation**

Create `src/ui/presentation/dashboard/useCases/LoadDashboardUseCase.ts`:

```typescript
import { LoadDashboardUseCase as Abstraction } from "./abstractions/LoadDashboardUseCase.js";
import { DashboardGateway } from "../../../../features/dashboard/abstractions/DashboardGateway.js";
import { DashboardRepository } from "../../../../features/dashboard/abstractions/DashboardRepository.js";

class LoadDashboardUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: DashboardGateway.Interface,
    private readonly repository: DashboardRepository.Interface
  ) {}

  public execute = async (trendRange: string): Promise<void> => {
    const [health, trend, activity, staleness, security] = await Promise.all([
      this.gateway.getHealth(),
      this.gateway.getTrend(trendRange),
      this.gateway.getActivity(),
      this.gateway.getStaleness(),
      this.gateway.getSecurity()
    ]);

    this.repository.setHealthResponse(health);
    this.repository.setTrendResponse(trend);
    this.repository.setActivity(activity.items);
    this.repository.setStaleness(staleness.items);
    this.repository.setSecurity(security.items);
  };

  public refreshHealth = async (): Promise<void> => {
    const [health, staleness] = await Promise.all([
      this.gateway.getHealth(),
      this.gateway.getStaleness()
    ]);
    this.repository.setHealthResponse(health);
    this.repository.setStaleness(staleness.items);
  };

  public refreshActivity = async (): Promise<void> => {
    const activity = await this.gateway.getActivity();
    this.repository.setActivity(activity.items);
  };
}

export const LoadDashboardUseCase = Abstraction.createImplementation({
  implementation: LoadDashboardUseCaseImpl,
  dependencies: [DashboardGateway, DashboardRepository]
});
```

- [ ] **Step 3: Create use case feature**

Create `src/ui/presentation/dashboard/useCases/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { LoadDashboardUseCase } from "./LoadDashboardUseCase.js";
import { DashboardFeature } from "../../../../features/dashboard/feature.js";

export const DashboardUseCasesFeature = createFeature({
  name: "Ui/DashboardUseCases",
  dependencies: [DashboardFeature],
  register(container) {
    container.register(LoadDashboardUseCase);
  }
});
```

- [ ] **Step 4: Write use case tests**

Create `src/ui/presentation/dashboard/useCases/__tests__/LoadDashboardUseCase.test.ts`. Follow existing use case test patterns. Test:

- `execute` calls all 5 gateway methods and stores results in repository
- `refreshHealth` calls health + staleness and updates repository
- `refreshActivity` calls activity and updates repository

Use DI container with mock HTTPClient, resolve use case and repository through container.

- [ ] **Step 5: Run tests**

Run: `yarn test src/ui/presentation/dashboard/useCases/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/dashboard/
git commit -m "feat: add LoadDashboardUseCase"
```

---

### Task 2: DashboardPresenter

**Files:**

- Create: `src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts`
- Create: `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts`
- Create: `src/ui/presentation/dashboard/Dashboard/__tests__/DashboardPresenter.test.ts`

**Interfaces:**

- Consumes: `LoadDashboardUseCase.Interface`, `DashboardRepository.Interface`, `WebSocketListener.Interface`
- Produces: `DashboardPresenter.Interface` consumed by plan 06

- [ ] **Step 1: Create presenter abstraction**

Create `src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { DashboardGateway } from "../../../../../features/dashboard/abstractions/DashboardGateway.js";

export interface IDashboardViewModel {
  loading: boolean;
  error: string | null;
  trendRange: string;
  summary: DashboardGateway.HealthSummary | null;
  projects: DashboardGateway.HealthProject[];
  trendData: DashboardGateway.TrendProject[];
  activity: DashboardGateway.ActivityJob[];
  staleness: DashboardGateway.StalenessProject[];
  security: DashboardGateway.SecurityProject[];
}

export interface IDashboardPresenter {
  readonly vm: IDashboardViewModel;
  load(): Promise<void>;
  setTrendRange(range: string): void;
  dispose(): void;
}

export const DashboardPresenter = createAbstraction<IDashboardPresenter>("Ui/DashboardPresenter");

export namespace DashboardPresenter {
  export type Interface = IDashboardPresenter;
  export type ViewModel = IDashboardViewModel;
}
```

- [ ] **Step 2: Create presenter implementation**

Create `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts`:

```typescript
import { computed, makeAutoObservable, runInAction } from "mobx";
import { DashboardPresenter as Abstraction } from "./abstractions/DashboardPresenter.js";
import { DashboardRepository } from "../../../../features/dashboard/abstractions/DashboardRepository.js";
import { LoadDashboardUseCase } from "../useCases/abstractions/LoadDashboardUseCase.js";
import { WebSocketListener } from "../../../../websocket/abstractions/WebSocketListener.js";

class DashboardPresenterImpl implements Abstraction.Interface {
  private loading = false;
  private error: string | null = null;
  private trendRange = "30d";
  private unsubscribers: Array<() => void> = [];

  public constructor(
    private readonly repository: DashboardRepository.Interface,
    private readonly loadDashboard: LoadDashboardUseCase.Interface,
    private readonly webSocketListener: WebSocketListener.Interface
  ) {
    makeAutoObservable(this, { vm: computed });

    this.unsubscribers.push(
      this.webSocketListener.on("scan:complete", () => {
        this.loadDashboard.refreshHealth().catch(() => {});
      }),
      this.webSocketListener.on("job:status", () => {
        this.loadDashboard.refreshActivity().catch(() => {});
      })
    );
  }

  public get vm(): Abstraction.ViewModel {
    const healthResponse = this.repository.getHealthResponse();
    const trendResponse = this.repository.getTrendResponse();

    return {
      loading: this.loading,
      error: this.error,
      trendRange: this.trendRange,
      summary: healthResponse?.summary ?? null,
      projects: healthResponse?.projects ?? [],
      trendData: trendResponse?.items ?? [],
      activity: this.repository.getActivity(),
      staleness: this.repository.getStaleness(),
      security: this.repository.getSecurity()
    };
  }

  public load = async (): Promise<void> => {
    this.loading = true;
    this.error = null;
    try {
      await this.loadDashboard.execute(this.trendRange);
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Failed to load dashboard";
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  };

  public setTrendRange = (range: string): void => {
    this.trendRange = range;
    void this.loadDashboard.execute(range);
  };

  public dispose = (): void => {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
  };
}

export const DashboardPresenter = Abstraction.createImplementation({
  implementation: DashboardPresenterImpl,
  dependencies: [DashboardRepository, LoadDashboardUseCase, WebSocketListener]
});
```

- [ ] **Step 3: Write presenter tests**

Create `src/ui/presentation/dashboard/Dashboard/__tests__/DashboardPresenter.test.ts`. Follow existing presenter test patterns (e.g., `LogBrowserPresenter.test.ts`). Test:

- Default vm state (loading false, error null, trendRange "30d", empty arrays, null summary)
- `load` sets loading, calls use case, clears loading
- `load` error handling (Error throw, non-Error throw)
- `setTrendRange` updates trendRange and triggers reload
- WS `scan:complete` triggers health refresh
- WS `job:status` triggers activity refresh
- `dispose` unsubscribes WS listeners
- vm reads from repository correctly

- [ ] **Step 4: Run tests**

Run: `yarn test src/ui/presentation/dashboard/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/dashboard/Dashboard/
git commit -m "feat: add DashboardPresenter with WS auto-refresh"
```

---

### Task 3: Provider, feature registration, and ALL_FEATURES wiring

**Files:**

- Create: `src/ui/presentation/dashboard/Dashboard/DashboardProvider.tsx`
- Create: `src/ui/presentation/dashboard/Dashboard/feature.ts`
- Modify: `src/ui/App.tsx` (add to ALL_FEATURES array)

**Interfaces:**

- Consumes: `DashboardPresenter.Interface` from Task 2
- Produces: `DashboardProvider` component and `DashboardPresentationFeature` used by plan 06

- [ ] **Step 1: Create provider**

Create `src/ui/presentation/dashboard/Dashboard/DashboardProvider.tsx`:

```typescript
import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { DashboardPresentationFeature } from "./feature.js";
import type { DashboardPresenter } from "./abstractions/DashboardPresenter.js";

interface DashboardProviderProps {
  children: (params: { presenter: DashboardPresenter.Interface }) => React.ReactNode;
}

export function DashboardProvider({ children }: DashboardProviderProps): React.ReactNode {
  const { presenter } = useFeature(DashboardPresentationFeature);
  return children({ presenter });
}
```

- [ ] **Step 2: Create presentation feature**

Create `src/ui/presentation/dashboard/Dashboard/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { DashboardPresenter as DashboardPresenterAbstraction } from "./abstractions/DashboardPresenter.js";
import { DashboardPresenter } from "./DashboardPresenter.js";
import { DashboardUseCasesFeature } from "../useCases/feature.js";
import { WebSocketFeature } from "../../../../websocket/feature.js";

export interface IDashboardPresentationFeatureExports {
  presenter: DashboardPresenterAbstraction.Interface;
}

export const DashboardPresentationFeature = createFeature<
  void,
  IDashboardPresentationFeatureExports
>({
  name: "Ui/DashboardPresentation",
  dependencies: [DashboardUseCasesFeature, WebSocketFeature],
  register(container) {
    container.register(DashboardPresenter);
  },
  resolve(container) {
    return {
      presenter: container.resolve(DashboardPresenterAbstraction)
    };
  }
});
```

- [ ] **Step 3: Add to ALL_FEATURES in App.tsx**

In `src/ui/App.tsx`, add import:

```typescript
import { DashboardPresentationFeature } from "./presentation/dashboard/Dashboard/feature.js";
```

Add `DashboardPresentationFeature` to the `ALL_FEATURES` array.

- [ ] **Step 4: Verify build passes**

Run: `yarn build`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `yarn test`
Expected: All PASS

- [ ] **Step 6: Lint and format**

Run: `yarn lint:fix && yarn format:fix`

- [ ] **Step 7: Commit**

```bash
git add src/ui/presentation/dashboard/ src/ui/App.tsx
git commit -m "feat: add DashboardProvider, feature registration, wire into ALL_FEATURES"
```
