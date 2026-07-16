# Dashboard UI Feature Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the DashboardGateway and DashboardRepository UI feature layer with abstractions, implementations, and feature registration.

**Architecture:** Follows existing MVP pattern: abstractions in `abstractions/` directory with namespace exports, implementations as separate files using `createAbstraction`/`createImplementation` from `@webiny/di`, feature registered via `createFeature`.

**Tech Stack:** TypeScript, `@webiny/di`, Vitest

## Global Constraints

- Yarn 4, not npm
- oxlint for linting, oxfmt for formatting
- Named interfaces only, no inline structural types
- UI tests mock HTTPClient at DI level, real everything else
- Never `new XxxImpl()` — always resolve through DI container
- Path aliases: `#ui/*`, `#shared/*`, `#testing/*`

## Prerequisite

Plans 02-03 (route definitions) must be completed first — gateway imports route definitions.

---

### Task 1: DashboardGateway abstraction and implementation

**Files:**

- Create: `src/ui/features/dashboard/abstractions/DashboardGateway.ts`
- Create: `src/ui/features/dashboard/abstractions/DashboardRepository.ts`
- Create: `src/ui/features/dashboard/abstractions/index.ts`
- Create: `src/ui/features/dashboard/DashboardGateway.ts`
- Create: `src/ui/features/dashboard/__tests__/DashboardGateway.test.ts`

**Interfaces:**

- Produces: `DashboardGateway.Interface` consumed by plan 05

- [ ] **Step 1: Create gateway abstraction**

Create `src/ui/features/dashboard/abstractions/DashboardGateway.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IHealthProject {
  projectId: string;
  projectName: string;
  score: number;
  scoreDelta: number | null;
  totalPackages: number;
  upToDate: number;
  patchOutdated: number;
  minorOutdated: number;
  majorOutdated: number;
  lastScannedAt: number | null;
}

export interface IWorstProject {
  id: string;
  name: string;
  score: number;
}

export interface IHealthSummary {
  totalProjects: number;
  averageScore: number;
  worstProject: IWorstProject | null;
}

export interface IHealthResponse {
  summary: IHealthSummary;
  projects: IHealthProject[];
}

export interface ITrendSnapshot {
  date: string;
  score: number;
}

export interface ITrendProject {
  projectId: string;
  projectName: string;
  snapshots: ITrendSnapshot[];
}

export interface ITrendResponse {
  items: ITrendProject[];
}

export interface IActivityJob {
  id: string;
  type: string;
  referenceId: string;
  referenceType: string;
  status: string;
  startedAt: number | null;
  completedAt: number | null;
}

export interface IStalenessProject {
  projectId: string;
  projectName: string;
  lastScannedAt: number | null;
}

export interface ISecurityProject {
  projectId: string;
  projectName: string;
  totalChecks: number;
  passingChecks: number;
}

export interface IDashboardGateway {
  getHealth(): Promise<IHealthResponse>;
  getTrend(range: string): Promise<ITrendResponse>;
  getActivity(): Promise<{ items: IActivityJob[] }>;
  getStaleness(): Promise<{ items: IStalenessProject[] }>;
  getSecurity(): Promise<{ items: ISecurityProject[] }>;
}

export const DashboardGateway = createAbstraction<IDashboardGateway>("Ui/DashboardGateway");

export namespace DashboardGateway {
  export type Interface = IDashboardGateway;
  export type HealthResponse = IHealthResponse;
  export type HealthProject = IHealthProject;
  export type WorstProject = IWorstProject;
  export type HealthSummary = IHealthSummary;
  export type TrendResponse = ITrendResponse;
  export type TrendProject = ITrendProject;
  export type TrendSnapshot = ITrendSnapshot;
  export type ActivityJob = IActivityJob;
  export type StalenessProject = IStalenessProject;
  export type SecurityProject = ISecurityProject;
}
```

- [ ] **Step 2: Create repository abstraction**

Create `src/ui/features/dashboard/abstractions/DashboardRepository.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { DashboardGateway } from "./DashboardGateway.js";

export interface IDashboardRepository {
  getHealthResponse(): DashboardGateway.HealthResponse | null;
  setHealthResponse(response: DashboardGateway.HealthResponse): void;
  getTrendResponse(): DashboardGateway.TrendResponse | null;
  setTrendResponse(response: DashboardGateway.TrendResponse): void;
  getActivity(): DashboardGateway.ActivityJob[];
  setActivity(jobs: DashboardGateway.ActivityJob[]): void;
  getStaleness(): DashboardGateway.StalenessProject[];
  setStaleness(projects: DashboardGateway.StalenessProject[]): void;
  getSecurity(): DashboardGateway.SecurityProject[];
  setSecurity(projects: DashboardGateway.SecurityProject[]): void;
}

export const DashboardRepository =
  createAbstraction<IDashboardRepository>("Ui/DashboardRepository");

export namespace DashboardRepository {
  export type Interface = IDashboardRepository;
}
```

- [ ] **Step 3: Create abstractions barrel export**

Create `src/ui/features/dashboard/abstractions/index.ts`:

```typescript
export { DashboardGateway } from "./DashboardGateway.js";
export { DashboardRepository } from "./DashboardRepository.js";
```

- [ ] **Step 4: Create gateway implementation**

Create `src/ui/features/dashboard/DashboardGateway.ts`:

```typescript
import { DashboardGateway as Abstraction } from "./abstractions/DashboardGateway.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import {
  dashboardHealthRoute,
  dashboardTrendRoute,
  dashboardActivityRoute,
  dashboardStalenessRoute,
  dashboardSecurityRoute
} from "#shared/routes/index.js";

class DashboardGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async getHealth(): Promise<Abstraction.HealthResponse> {
    return this.httpClient.request(dashboardHealthRoute, { params: {}, query: {} });
  }

  public async getTrend(range: string): Promise<Abstraction.TrendResponse> {
    return this.httpClient.request(dashboardTrendRoute, {
      params: {},
      query: { range }
    });
  }

  public async getActivity(): Promise<{ items: Abstraction.ActivityJob[] }> {
    return this.httpClient.request(dashboardActivityRoute, { params: {}, query: {} });
  }

  public async getStaleness(): Promise<{ items: Abstraction.StalenessProject[] }> {
    return this.httpClient.request(dashboardStalenessRoute, { params: {}, query: {} });
  }

  public async getSecurity(): Promise<{ items: Abstraction.SecurityProject[] }> {
    return this.httpClient.request(dashboardSecurityRoute, { params: {}, query: {} });
  }
}

export const DashboardGateway = Abstraction.createImplementation({
  implementation: DashboardGatewayImpl,
  dependencies: [HTTPClient]
});
```

- [ ] **Step 5: Write gateway tests**

Create `src/ui/features/dashboard/__tests__/DashboardGateway.test.ts`. Follow the exact same mock HTTPClient + DI container pattern used in other gateway tests (e.g., `src/ui/features/appSettings/__tests__/AppSettingsGateway.test.ts`). Test all 5 methods:

- `getHealth` calls `dashboardHealthRoute` and returns response
- `getTrend` calls `dashboardTrendRoute` with range query param
- `getActivity` calls `dashboardActivityRoute` and returns items
- `getStaleness` calls `dashboardStalenessRoute` and returns items
- `getSecurity` calls `dashboardSecurityRoute` and returns items

- [ ] **Step 6: Run tests**

Run: `yarn test src/ui/features/dashboard/__tests__/DashboardGateway.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/dashboard/
git commit -m "feat: add DashboardGateway abstraction and implementation"
```

---

### Task 2: DashboardRepository implementation and feature registration

**Files:**

- Create: `src/ui/features/dashboard/DashboardRepository.ts`
- Create: `src/ui/features/dashboard/feature.ts`
- Create: `src/ui/features/dashboard/index.ts`
- Create: `src/ui/features/dashboard/__tests__/DashboardRepository.test.ts`

**Interfaces:**

- Consumes: Abstractions from Task 1
- Produces: `DashboardFeature` used by plan 05

- [ ] **Step 1: Create repository implementation**

Create `src/ui/features/dashboard/DashboardRepository.ts`:

```typescript
import { DashboardRepository as Abstraction } from "./abstractions/DashboardRepository.js";
import type { DashboardGateway } from "./abstractions/DashboardGateway.js";

class DashboardRepositoryImpl implements Abstraction.Interface {
  private healthResponse: DashboardGateway.HealthResponse | null = null;
  private trendResponse: DashboardGateway.TrendResponse | null = null;
  private activity: DashboardGateway.ActivityJob[] = [];
  private staleness: DashboardGateway.StalenessProject[] = [];
  private security: DashboardGateway.SecurityProject[] = [];

  public getHealthResponse(): DashboardGateway.HealthResponse | null {
    return this.healthResponse;
  }

  public setHealthResponse(response: DashboardGateway.HealthResponse): void {
    this.healthResponse = response;
  }

  public getTrendResponse(): DashboardGateway.TrendResponse | null {
    return this.trendResponse;
  }

  public setTrendResponse(response: DashboardGateway.TrendResponse): void {
    this.trendResponse = response;
  }

  public getActivity(): DashboardGateway.ActivityJob[] {
    return this.activity;
  }

  public setActivity(jobs: DashboardGateway.ActivityJob[]): void {
    this.activity = jobs;
  }

  public getStaleness(): DashboardGateway.StalenessProject[] {
    return this.staleness;
  }

  public setStaleness(projects: DashboardGateway.StalenessProject[]): void {
    this.staleness = projects;
  }

  public getSecurity(): DashboardGateway.SecurityProject[] {
    return this.security;
  }

  public setSecurity(projects: DashboardGateway.SecurityProject[]): void {
    this.security = projects;
  }
}

export const DashboardRepository = Abstraction.createImplementation({
  implementation: DashboardRepositoryImpl,
  dependencies: []
});
```

- [ ] **Step 2: Create feature registration**

Create `src/ui/features/dashboard/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { DashboardGateway } from "./DashboardGateway.js";
import { DashboardRepository } from "./DashboardRepository.js";

export const DashboardFeature = createFeature({
  name: "Ui/Dashboard",
  register(container) {
    container.register(DashboardGateway).inSingletonScope();
    container.register(DashboardRepository).inSingletonScope();
  }
});
```

- [ ] **Step 3: Create barrel export**

Create `src/ui/features/dashboard/index.ts`:

```typescript
export { DashboardGateway } from "./abstractions/index.js";
export { DashboardRepository } from "./abstractions/index.js";
export { DashboardFeature } from "./feature.js";
```

- [ ] **Step 4: Write repository tests**

Create `src/ui/features/dashboard/__tests__/DashboardRepository.test.ts`. Follow the pattern from `src/ui/features/appSettings/__tests__/AppSettingsRepository.test.ts`. Test:

- Returns null for health response initially
- Stores and retrieves health response
- Returns null for trend response initially
- Stores and retrieves trend response
- Returns empty array for activity initially
- Stores and retrieves activity
- Returns empty array for staleness initially
- Stores and retrieves staleness
- Returns empty array for security initially
- Stores and retrieves security

- [ ] **Step 5: Run tests**

Run: `yarn test src/ui/features/dashboard/`
Expected: PASS

- [ ] **Step 6: Lint and format**

Run: `yarn lint:fix && yarn format:fix`

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/dashboard/
git commit -m "feat: add DashboardRepository, feature registration, and barrel exports"
```
