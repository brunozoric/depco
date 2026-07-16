# License Compliance Part 4: UI Features and Licenses Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the UI layer — Gateway, Repository, UseCases, Presenter, and React components for the dedicated Licenses page, plus integrate license data into Project Detail and Dashboard.

**Architecture:** Follows Gateway → Repository → UseCase → Presenter → React pattern. DI features registered in App.tsx. Presenter drives all view model computation; React components are pure renders.

**Tech Stack:** TypeScript, React 19, MobX, Mantine, vitest

## Global Constraints

- Use full words in identifiers
- Named interfaces only
- Presenter-driven UI: compute in presenter, render conditionally in page
- No server starts — user manages dev server
- Abstraction and implementation in separate files/directories

---

### Task 9: LicensesGateway and LicensesRepository

**Files:**

- Create: `src/ui/features/licenses/abstractions/LicensesGateway.ts`
- Create: `src/ui/features/licenses/LicensesGateway.ts`
- Create: `src/ui/features/licenses/abstractions/LicensesRepository.ts`
- Create: `src/ui/features/licenses/LicensesRepository.ts`
- Create: `src/ui/features/licenses/feature.ts`

**Interfaces:**

- Consumes: Route constants from `#shared/routes/licenses.js`, `HttpClient` abstraction from `#ui/shared/http/abstractions/HttpClient.js`
- Produces: `LicensesGateway.Interface` (list, getByProject, getSummary, scan, listPolicies, createPolicy, updatePolicy, deletePolicy, listViolations, getViolationsSummary), `LicensesRepository.Interface` (get/set for licenses, policies, violations, summary)

- [ ] **Step 1: Create Gateway abstraction**

Create `src/ui/features/licenses/abstractions/LicensesGateway.ts` with interfaces for:

- `ILicenseItem` — mirrors license schema (id, projectId, packageName, licenseName, spdxId, source, riskTier, licenseUrl, scannedAt)
- `ILicensePolicyRule` — mirrors policy rule schema
- `ILicenseViolation` — mirrors violation schema
- `ILicenseSummaryData` — totalPackages, compliantPercent, riskTierCounts, violationCounts, projectSummaries
- `ILicenseListFilters` — optional projectId, riskTier, packageName, spdxId
- `ILicenseListResponse` — items + total
- `IViolationsSummaryData` — total, warnCount, denyCount, byProject
- `ILicensesGateway` — all HTTP methods matching the routes

Use `createAbstraction()` + namespace pattern. Export namespace aliases for all types.

- [ ] **Step 2: Create Gateway implementation**

Create `src/ui/features/licenses/LicensesGateway.ts` implementing all methods via `HttpClient.request()` with the shared route constants. Follow `VulnerabilitiesGateway` pattern.

- [ ] **Step 3: Create Repository abstraction**

Create `src/ui/features/licenses/abstractions/LicensesRepository.ts` with get/set pairs for:

- licenses (items + total)
- policies (items array)
- violations (items + total)
- summary (LicenseSummaryData)
- violationsSummary (ViolationsSummaryData)

- [ ] **Step 4: Create Repository implementation**

Create `src/ui/features/licenses/LicensesRepository.ts` with MobX-observable private fields and public get/set methods. Follow `VulnerabilitiesRepository` pattern.

- [ ] **Step 5: Create feature registration**

Create `src/ui/features/licenses/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { LicensesGateway } from "./LicensesGateway.js";
import { LicensesRepository } from "./LicensesRepository.js";

export const LicensesFeature = createFeature({
  name: "Ui/Licenses",
  register(container) {
    container.register(LicensesGateway).inSingletonScope();
    container.register(LicensesRepository).inSingletonScope();
  }
});
```

- [ ] **Step 6: Verify build**

Run: `yarn build`
Expected: clean

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/licenses/
git commit -m "feat(licenses): add LicensesGateway and LicensesRepository UI features"
```

---

### Task 10: License UseCases

**Files:**

- Create: `src/ui/presentation/licenses/useCases/abstractions/LoadLicensesUseCase.ts`
- Create: `src/ui/presentation/licenses/useCases/LoadLicensesUseCase.ts`
- Create: `src/ui/presentation/licenses/useCases/abstractions/ManagePolicyRulesUseCase.ts`
- Create: `src/ui/presentation/licenses/useCases/ManagePolicyRulesUseCase.ts`
- Create: `src/ui/presentation/licenses/useCases/abstractions/ScanLicensesUseCase.ts`
- Create: `src/ui/presentation/licenses/useCases/ScanLicensesUseCase.ts`
- Create: `src/ui/presentation/licenses/useCases/feature.ts`

**Interfaces:**

- Consumes: `LicensesGateway.Interface`, `LicensesRepository.Interface`
- Produces: `LoadLicensesUseCase.Interface` (execute with filters), `ManagePolicyRulesUseCase.Interface` (create, update, delete), `ScanLicensesUseCase.Interface` (execute with projectId)

- [ ] **Step 1: Create use case abstractions**

One file per use case in `abstractions/` directory. Each uses `createAbstraction()` + namespace pattern.

- `LoadLicensesUseCase`: `execute(filters?: LicensesGateway.ListFilters): Promise<void>` — fetches licenses, violations, summary, stores in repository
- `ManagePolicyRulesUseCase`: `create(input), update(id, input), remove(id): Promise<void>` — CRUD via gateway, refreshes repository
- `ScanLicensesUseCase`: `execute(projectId: string): Promise<{ jobId: string }>` — triggers scan via gateway

- [ ] **Step 2: Create use case implementations**

Each implementation follows existing pattern: inject gateway + repository, call gateway methods, store results in repository.

- [ ] **Step 3: Create use cases feature**

```typescript
import { createFeature } from "#shared/index.js";
import { LicensesFeature } from "../../../features/licenses/feature.js";
import { LoadLicensesUseCase as LoadAbstraction } from "./abstractions/LoadLicensesUseCase.js";
import { LoadLicensesUseCase } from "./LoadLicensesUseCase.js";
import { ManagePolicyRulesUseCase as ManageAbstraction } from "./abstractions/ManagePolicyRulesUseCase.js";
import { ManagePolicyRulesUseCase } from "./ManagePolicyRulesUseCase.js";
import { ScanLicensesUseCase as ScanAbstraction } from "./abstractions/ScanLicensesUseCase.js";
import { ScanLicensesUseCase } from "./ScanLicensesUseCase.js";

export const LicensesUseCasesFeature = createFeature({
  name: "Ui/LicensesUseCases",
  dependencies: [LicensesFeature],
  register(container) {
    container.register(LoadLicensesUseCase);
    container.register(ManagePolicyRulesUseCase);
    container.register(ScanLicensesUseCase);
  }
});
```

- [ ] **Step 4: Verify build**

Run: `yarn build`

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/licenses/
git commit -m "feat(licenses): add license use cases (load, manage policies, scan)"
```

---

### Task 11: LicensesPresenter and Tests

**Files:**

- Create: `src/ui/presentation/licenses/LicensesList/abstractions/LicensesPresenter.ts`
- Create: `src/ui/presentation/licenses/LicensesList/LicensesPresenter.ts`
- Create: `src/ui/presentation/licenses/LicensesList/feature.ts`
- Create: `src/ui/presentation/licenses/__tests__/LicensesPresenter.test.ts`

**Interfaces:**

- Consumes: Use cases from Task 10, `LicensesRepository.Interface`, `WebSocketListener.Interface`
- Produces: `LicensesPresenter.Interface` with computed `vm` (ILicensesViewModel) and action methods (load, setFilter, createRule, updateRule, deleteRule, scanProject)

- [ ] **Step 1: Create presenter abstraction**

Create `src/ui/presentation/licenses/LicensesList/abstractions/LicensesPresenter.ts` with:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { LicenseRiskTier, LicensePolicyAction } from "#shared/licenses/types.js";

export interface ILicenseRowViewModel {
  id: string;
  projectId: string;
  packageName: string;
  licenseName: string;
  spdxId: string | null;
  riskTier: LicenseRiskTier;
  source: string;
  violationAction: "warn" | "deny" | null;
}

export interface IPolicyRuleViewModel {
  id: string;
  action: LicensePolicyAction;
  licensePattern: string | null;
  packagePattern: string | null;
  projectId: string | null;
  priority: number;
  reason: string | null;
}

export interface IComplianceSummaryViewModel {
  totalPackages: number;
  compliantPercent: number;
  riskTierCounts: Record<LicenseRiskTier, number>;
  warnCount: number;
  denyCount: number;
}

export interface ILicensesViewModel {
  loading: boolean;
  error: string | null;
  licenses: ILicenseRowViewModel[];
  totalCount: number;
  summary: IComplianceSummaryViewModel | null;
  policyRules: IPolicyRuleViewModel[];
  riskTierFilter: string | null;
  packageNameFilter: string;
  projectIdFilter: string | null;
  violationFilter: string | null;
}

export interface ILicensesPresenter {
  get vm(): ILicensesViewModel;
  load(): Promise<void>;
  setRiskTierFilter(tier: string | null): void;
  setPackageNameFilter(name: string): void;
  setProjectIdFilter(projectId: string | null): void;
  setViolationFilter(action: string | null): void;
  createRule(input: {
    action: LicensePolicyAction;
    licensePattern?: string | null;
    packagePattern?: string | null;
    projectId?: string | null;
    priority: number;
    reason?: string | null;
  }): Promise<void>;
  updateRule(
    id: string,
    input: Partial<{
      action: LicensePolicyAction;
      licensePattern: string | null;
      packagePattern: string | null;
      projectId: string | null;
      priority: number;
      reason: string | null;
    }>
  ): Promise<void>;
  deleteRule(id: string): Promise<void>;
  scanProject(projectId: string): Promise<void>;
}

export const LicensesPresenter = createAbstraction<ILicensesPresenter>("Ui/LicensesPresenter");

export namespace LicensesPresenter {
  export type Interface = ILicensesPresenter;
  export type ViewModel = ILicensesViewModel;
  export type LicenseRow = ILicenseRowViewModel;
  export type PolicyRule = IPolicyRuleViewModel;
  export type ComplianceSummary = IComplianceSummaryViewModel;
}
```

- [ ] **Step 2: Write presenter tests**

Create `src/ui/presentation/licenses/__tests__/LicensesPresenter.test.ts` covering:

1. Initial state — loading true, empty arrays
2. After load — licenses populated, summary computed
3. Risk tier filter — only matching licenses shown
4. Package name filter — search substring match
5. Violation filter — only warn or deny shown
6. Compliance summary computation — correct percentages and counts
7. Policy rule list populated after load

- [ ] **Step 3: Write presenter implementation**

Create `src/ui/presentation/licenses/LicensesList/LicensesPresenter.ts` with MobX observables. Follow `VulnerabilitiesPresenter` pattern:

- `makeAutoObservable(this, { vm: computed })`
- Filter state as private observables
- `get vm()` computes filtered/sorted view model from repository data
- Action methods delegate to use cases then reload

- [ ] **Step 4: Create feature registration**

Create `src/ui/presentation/licenses/LicensesList/feature.ts` registering the presenter.

- [ ] **Step 5: Run tests**

Run: `yarn test src/ui/presentation/licenses/__tests__/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/licenses/ src/ui/presentation/licenses/__tests__/
git commit -m "feat(licenses): add LicensesPresenter with filtering, sorting, and policy management"
```

---

### Task 12: React Components, Provider, and App Integration

**Files:**

- Create: `src/ui/presentation/licenses/LicensesList/LicensesProvider.tsx`
- Create: `src/ui/presentation/licenses/LicensesList/components/LicensesPage.tsx`
- Modify: `src/ui/App.tsx` (add nav item, feature registration, route)

**Interfaces:**

- Consumes: `LicensesPresenter.Interface` from Task 11, `LicensesListFeature` from Task 11
- Produces: `/licenses` route rendering `LicensesPage`

- [ ] **Step 1: Create Provider**

Create `src/ui/presentation/licenses/LicensesList/LicensesProvider.tsx`:

```typescript
import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { LicensesListFeature } from "./feature.js";
import type { LicensesPresenter } from "./abstractions/LicensesPresenter.js";

interface LicensesProviderProps {
  children: (params: { presenter: LicensesPresenter.Interface }) => React.ReactNode;
}

export function LicensesProvider({ children }: LicensesProviderProps): React.ReactNode {
  const { presenter } = useFeature(LicensesListFeature);
  return children({ presenter });
}
```

- [ ] **Step 2: Create LicensesPage component**

Create `src/ui/presentation/licenses/LicensesList/components/LicensesPage.tsx` with:

- Compliance summary cards at top (total, compliant %, deny count, warn count)
- License table with columns: Package, License, SPDX, Risk Tier, Project, Violation
- Filter controls: risk tier select, package name search, project select, violation filter
- Policy rules management section (collapsible): list rules, add/edit/delete
- "Scan" button per project
- Risk tier color coding using existing `SEVERITY_COLORS` pattern adapted for risk tiers
- Mantine components: Table, Badge, Select, TextInput, Button, Card, Group, Stack, Accordion

- [ ] **Step 3: Integrate into App.tsx**

In `src/ui/App.tsx`:

1. Import `LicensesFeature`, `LicensesUseCasesFeature`, `LicensesListFeature`, `LicensesProvider`, `LicensesPage`
2. Add all three features to `ALL_FEATURES` array
3. Add nav link: `{ label: "Licenses", path: "/licenses", icon: ... }` after Vulnerabilities
4. Add route: `/licenses` renders `<LicensesProvider>{({ presenter }) => <LicensesPage presenter={presenter} />}</LicensesProvider>`

- [ ] **Step 4: Verify build**

Run: `yarn build`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/licenses/ src/ui/App.tsx
git commit -m "feat(licenses): add Licenses page with React components and navigation"
```

---

### Task 13: Project Detail and Dashboard Integration

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts` (add license fields to DependencyViewModel)
- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts` (fetch license data, populate fields)
- Modify: `src/ui/features/dashboard/abstractions/DashboardGateway.ts` (add getLicenseSummary type)
- Modify: `src/ui/features/dashboard/DashboardGateway.ts` (implement getLicenseSummary)
- Modify: `src/ui/features/dashboard/abstractions/DashboardRepository.ts` (add license summary storage)
- Modify: `src/ui/features/dashboard/DashboardRepository.ts` (implement storage)
- Modify: `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts` (add license compliance VM section)
- Modify: `src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts` (add license types to VM)
- Modify: `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx` (add license compliance card)

**Interfaces:**

- Consumes: `LicensesGateway.Interface` for project detail license lookup, `getLicenseSummaryRoute` for dashboard
- Produces: Extended `DependencyViewModel` with `license: string | null` and `licenseRiskTier: LicenseRiskTier | null`, dashboard license compliance widget VM

- [ ] **Step 1: Extend ProjectDetailPresenter**

In the abstraction, add to `IProjectDetailDependencyViewModel`:

```typescript
license: string | null;
licenseRiskTier: string | null;
```

In the implementation:

1. Add `LicensesGateway` as a dependency
2. In `load()`, call `licensesGateway.getByProject(projectId)` alongside other loads
3. Build `licenseByPackage` map from results
4. In `vm` getter, populate `license` and `licenseRiskTier` on each dependency from the map

- [ ] **Step 2: Add dashboard license summary**

1. In `DashboardGateway` abstraction, add `ILicenseComplianceSummary` interface and `getLicenseSummary(): Promise<ILicenseComplianceSummary>`
2. Implement in gateway using `getLicenseSummaryRoute`
3. Add storage in `DashboardRepository`
4. Load in dashboard use case
5. Add to dashboard presenter view model
6. Add "License Compliance" card to dashboard page — total packages, compliant %, deny count, risk tier mini bar

- [ ] **Step 3: Run all tests**

Run: `yarn test`
Expected: all pass (existing presenter tests may need updates for new required fields)

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts src/ui/features/dashboard/abstractions/DashboardGateway.ts src/ui/features/dashboard/DashboardGateway.ts src/ui/features/dashboard/abstractions/DashboardRepository.ts src/ui/features/dashboard/DashboardRepository.ts src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx
git commit -m "feat(licenses): integrate license data into project detail and dashboard"
```

---

### Task 14: Update AGENTS.md

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Add license compliance documentation**

Update AGENTS.md with:

- New tables (licenses, license_policy_rules, license_violations)
- New services (LicenseCheckerService, LicensePolicyService, LicenseScanJobExecutor)
- New routes (license data, policy CRUD, violations)
- New UI features (LicensesGateway, LicensesRepository, use cases, LicensesPresenter)
- New shared types (`src/shared/licenses/types.ts`)
- WebSocket events (license-scan:progress, license-scan:complete)
- Auto-chain: dependency scan → license scan via EventBus

- [ ] **Step 2: Run full test suite**

Run: `yarn test`
Expected: all pass

- [ ] **Step 3: Run build + lint**

Run: `yarn build`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add license compliance feature to AGENTS.md"
```
