# Auto-Fix PRs Part 4: UI Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build UI layer — AutoFixGateway, AutoFixRepository, use cases, extend ProjectDetailPresenter with auto-fix settings/PR list, add React section to project detail page, and add dashboard count.

**Architecture:** Follows Gateway → Repository → UseCase → Presenter → React pattern. No standalone page — auto-fix lives on project detail as a collapsible section.

**Tech Stack:** TypeScript, React 19, MobX, Mantine, vitest

## Global Constraints

- Use full words in identifiers — no abbreviations
- Named interfaces only — no inline structural types
- Presenter-driven UI: compute in presenter, render conditionally in page
- No dev server start — user manages that
- Tests in `src/**/__tests__/**/*.test.ts`

---

### Task 7: AutoFixGateway, AutoFixRepository, and Feature

**Files:**

- Create: `src/ui/features/autoFix/abstractions/AutoFixGateway.ts`
- Create: `src/ui/features/autoFix/AutoFixGateway.ts`
- Create: `src/ui/features/autoFix/abstractions/AutoFixRepository.ts`
- Create: `src/ui/features/autoFix/AutoFixRepository.ts`
- Create: `src/ui/features/autoFix/feature.ts`

**Interfaces:**

- Consumes: Route constants from `#shared/routes/autoFix.js`, `HttpClient` abstraction
- Produces: `AutoFixGateway.Interface` (getSettings, updateSettings, listPullRequests, getProjectPullRequests, generate, deletePullRequest), `AutoFixRepository.Interface` (get/set for settings and PR list)

Follow the `LicensesGateway`/`LicensesRepository` pattern exactly:

- Gateway: `createAbstraction` + namespace, implementation via `HttpClient.request()`
- Repository: plain class with get/set, `.inSingletonScope()`
- Feature: `createFeature({ name: "Ui/AutoFix", register(container) { ... } })`

- [ ] **Step 1: Create gateway abstraction with all interfaces**
- [ ] **Step 2: Create gateway implementation**
- [ ] **Step 3: Create repository abstraction**
- [ ] **Step 4: Create repository implementation**
- [ ] **Step 5: Create feature registration**
- [ ] **Step 6: Verify build**

Run: `yarn build`

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/autoFix/
git commit -m "feat(auto-fix): add AutoFixGateway and AutoFixRepository UI features"
```

---

### Task 8: Auto-Fix Use Cases

**Files:**

- Create: `src/ui/presentation/autoFix/useCases/abstractions/LoadAutoFixUseCase.ts`
- Create: `src/ui/presentation/autoFix/useCases/LoadAutoFixUseCase.ts`
- Create: `src/ui/presentation/autoFix/useCases/abstractions/UpdateAutoFixSettingsUseCase.ts`
- Create: `src/ui/presentation/autoFix/useCases/UpdateAutoFixSettingsUseCase.ts`
- Create: `src/ui/presentation/autoFix/useCases/abstractions/GenerateAutoFixPrsUseCase.ts`
- Create: `src/ui/presentation/autoFix/useCases/GenerateAutoFixPrsUseCase.ts`
- Create: `src/ui/presentation/autoFix/useCases/feature.ts`

**Interfaces:**

- Consumes: `AutoFixGateway.Interface`, `AutoFixRepository.Interface`
- Produces:
  - `LoadAutoFixUseCase.Interface`: `execute(projectId)` — fetches settings + PR list, stores in repository
  - `UpdateAutoFixSettingsUseCase.Interface`: `execute(projectId, input)` — updates via gateway, refreshes repository
  - `GenerateAutoFixPrsUseCase.Interface`: `execute(projectId)` — triggers generation, returns jobId

- [ ] **Step 1: Create all three use case abstractions**
- [ ] **Step 2: Create all three implementations**
- [ ] **Step 3: Create feature registration**

Dependencies: `[AutoFixFeature]`

- [ ] **Step 4: Verify build**

Run: `yarn build`

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/autoFix/
git commit -m "feat(auto-fix): add auto-fix use cases (load, update settings, generate)"
```

---

### Task 9: Extend ProjectDetailPresenter with Auto-Fix

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts` (add auto-fix VM types)
- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts` (add auto-fix data loading and actions)
- Modify: `src/ui/presentation/projects/ProjectDetail/feature.ts` (add AutoFixFeature dependency)
- Modify: `src/ui/presentation/projects/ProjectDetail/__tests__/ProjectDetailPresenter.test.ts` (add tests, fix DI)
- Modify: `src/ui/App.tsx` (add AutoFixFeature and AutoFixUseCasesFeature to ALL_FEATURES)

**Interfaces:**

- Consumes: `AutoFixGateway.Interface`, `AutoFixRepository.Interface`, `LoadAutoFixUseCase.Interface`, `UpdateAutoFixSettingsUseCase.Interface`, `GenerateAutoFixPrsUseCase.Interface`
- Produces: Extended `IProjectDetailViewModel` with:
  - `autoFixSettings: IAutoFixSettingsViewModel | null`
  - `autoFixPullRequests: IAutoFixPullRequestViewModel[]`
  - `autoFixRunning: boolean`

- [ ] **Step 1: Add VM types to abstraction**

In `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`:

```typescript
export interface IAutoFixSettingsViewModel {
  enabled: boolean;
  upgradeTypes: string[];
  groupingStrategy: string;
  branchPrefix: string;
}

export interface IAutoFixPullRequestViewModel {
  id: string;
  packageNames: string[];
  fromVersions: Record<string, string>;
  toVersions: Record<string, string>;
  upgradeType: string;
  branchName: string;
  prUrl: string | null;
  prNumber: number | null;
  status: string;
  licenseWarnings: string[];
}
```

Add to `IProjectDetailViewModel`:

```typescript
autoFixSettings: IAutoFixSettingsViewModel | null;
autoFixPullRequests: IAutoFixPullRequestViewModel[];
autoFixRunning: boolean;
```

Add to `IProjectDetailPresenter`:

```typescript
updateAutoFixSettings: (input: {
  enabled?: boolean;
  upgradeTypes?: string[];
  groupingStrategy?: string;
  branchPrefix?: string;
}) => Promise<void>;
generateAutoFixPrs: () => Promise<void>;
```

- [ ] **Step 2: Implement in presenter**

In `ProjectDetailPresenter.ts`:

1. Import `AutoFixGateway` and add as constructor dependency
2. Add `autoFixSettings` and `autoFixPullRequests` private observables
3. Add `autoFixRunning` private observable
4. In `load()`, call `autoFixGateway.getSettings()` and `autoFixGateway.getProjectPullRequests()` in the Promise.all
5. In `vm` getter, include autoFixSettings, autoFixPullRequests, autoFixRunning
6. Add `updateAutoFixSettings()` and `generateAutoFixPrs()` action methods

- [ ] **Step 3: Update feature dependencies**

In `src/ui/presentation/projects/ProjectDetail/feature.ts`, add `AutoFixFeature` to dependencies.

In `src/ui/App.tsx`, add `AutoFixFeature` and `AutoFixUseCasesFeature` to `ALL_FEATURES`.

- [ ] **Step 4: Update existing tests**

Fix any ProjectDetailPresenter tests broken by the new constructor dependency. Add new tests:

1. Auto-fix settings loaded in VM after load()
2. Auto-fix PR list populated
3. updateAutoFixSettings triggers reload
4. generateAutoFixPrs sets running state

- [ ] **Step 5: Run all tests**

Run: `yarn build && yarn test`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/projects/ProjectDetail/ src/ui/App.tsx
git commit -m "feat(auto-fix): extend ProjectDetailPresenter with auto-fix settings and PR list"
```

---

### Task 10: React Components for Auto-Fix Section

**Files:**

- Create: `src/ui/presentation/projects/ProjectDetail/components/AutoFixSection.tsx`
- Modify: `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx` (add AutoFixSection)

**Interfaces:**

- Consumes: `ProjectDetailPresenter.Interface` (vm.autoFixSettings, vm.autoFixPullRequests, vm.autoFixRunning, updateAutoFixSettings, generateAutoFixPrs)

- [ ] **Step 1: Create AutoFixSection component**

Create `AutoFixSection.tsx` with Mantine components:

- Accordion/collapsible wrapper: "Auto-Fix PRs"
- Settings panel:
  - Switch: enable/disable auto-fix after scan
  - Checkbox.Group: upgrade types (patch, minor, major)
  - Select: grouping strategy (per-package, per-project, per-upgrade-type)
  - TextInput: branch prefix
  - Save button
- "Generate PRs" Button (disabled when autoFixRunning or no settings)
- PR list table:
  - Columns: Package(s), From → To, Type, Status, PR Link
  - Status badges: pending=blue, created=green, merged=teal, closed=gray, failed=red
  - PR link: clickable external link when prUrl is non-null

- [ ] **Step 2: Add to ProjectDetailPage**

Import and render `<AutoFixSection>` in the project detail page, after the existing scan/dependency sections.

- [ ] **Step 3: Verify build**

Run: `yarn build`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/projects/ProjectDetail/components/AutoFixSection.tsx src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx
git commit -m "feat(auto-fix): add Auto-Fix PRs section to project detail page"
```

---

### Task 11: Dashboard Count and AGENTS.md

**Files:**

- Modify: `src/ui/features/dashboard/abstractions/DashboardGateway.ts` (add auto-fix PR count type)
- Modify: `src/ui/features/dashboard/DashboardGateway.ts` (implement)
- Modify: `src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts` (add to VM)
- Modify: `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts` (load + expose)
- Modify: `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx` (add count display)
- Modify: `AGENTS.md` (document auto-fix feature)

**Interfaces:**

- Consumes: `listAutoFixPullRequestsRoute` for counting open PRs

- [ ] **Step 1: Add dashboard auto-fix count**

Light touch — add "X open auto-fix PRs" stat to dashboard:

1. In DashboardGateway: add method to fetch PR list with status="created" filter, return count
2. In DashboardRepository: store count
3. In DashboardPresenter VM: expose `openAutoFixPrCount: number`
4. In DashboardPage: add count to existing health/summary section

- [ ] **Step 2: Update AGENTS.md**

Add auto-fix feature documentation:

- New tables (auto_fix_settings, auto_fix_pull_requests)
- New services (AutoFixSettingsService, AutoFixPrService, AutoFixPrJobExecutor)
- New routes (settings CRUD, PR list, generate trigger)
- Auto-chain: license-scan:completed → auto-fix-pr (when enabled)
- UI integration (ProjectDetail auto-fix section, dashboard count)

- [ ] **Step 3: Run full suite**

Run: `yarn build && yarn test`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/ui/features/dashboard/ src/ui/presentation/dashboard/ AGENTS.md
git commit -m "feat(auto-fix): add dashboard PR count and document feature in AGENTS.md"
```
