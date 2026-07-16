# Team Detail, Filters, and Executor DI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add team detail page, team filter on project list, vulnerability transitive/direct filter, and convert remaining job executors to DI.

**Architecture:** Four independent features implemented bottom-up. DI executor conversion is mechanical backend-only refactoring. Vulnerability filter adds client-side filtering to existing presenter. Project list team filter wires existing TeamFilterService. Team detail page composes DashboardProvider with team scope at `/teams/:id`.

**Tech Stack:** TypeScript, Vitest, MobX, Mantine UI, Fastify, Drizzle ORM, @webiny/di

## Global Constraints

- Use yarn for all package operations
- Named interfaces only — no inline structural types
- Use object params when function has 2+ params
- Work directly on main — no feature branches, no worktrees
- Never import `*Impl` outside its own file — use abstractions + DI container
- Use full words — "Vulnerability" not "Vuln", "Dependency" not "Dep"
- Commit after each task completes

---

### Task 1: Convert Simple Job Executors to DI (DependencyJobExecutor, TransientJobExecutor, PackageManagerJobExecutor)

**Files:**

- Create: `src/api/services/jobExecutors/abstractions/DependencyJobExecutor.ts`
- Create: `src/api/services/jobExecutors/abstractions/TransientJobExecutor.ts`
- Create: `src/api/services/jobExecutors/abstractions/PackageManagerJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/DependencyJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/TransientJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/PackageManagerJobExecutor.ts`
- Modify: `src/api/feature.ts`

**Interfaces:**

- Consumes: `JobExecutor.Interface` from `abstractions/JobExecutor.ts`, `createAbstraction` from `#shared/index.js`
- Produces: `DependencyJobExecutor` abstraction, `TransientJobExecutor` abstraction, `PackageManagerJobExecutor` abstraction — each with `.createImplementation()` and `.Interface` type

- [ ] **Step 1: Create DependencyJobExecutor abstraction**

```typescript
// src/api/services/jobExecutors/abstractions/DependencyJobExecutor.ts
import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IDependencyJobExecutor extends JobExecutor.Interface {}

export const DependencyJobExecutor = createAbstraction<IDependencyJobExecutor>(
  "Api/DependencyJobExecutor"
);

export namespace DependencyJobExecutor {
  export type Interface = IDependencyJobExecutor;
}
```

- [ ] **Step 2: Create TransientJobExecutor abstraction**

```typescript
// src/api/services/jobExecutors/abstractions/TransientJobExecutor.ts
import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface ITransientJobExecutor extends JobExecutor.Interface {}

export const TransientJobExecutor = createAbstraction<ITransientJobExecutor>(
  "Api/TransientJobExecutor"
);

export namespace TransientJobExecutor {
  export type Interface = ITransientJobExecutor;
}
```

- [ ] **Step 3: Create PackageManagerJobExecutor abstraction**

```typescript
// src/api/services/jobExecutors/abstractions/PackageManagerJobExecutor.ts
import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IPackageManagerJobExecutor extends JobExecutor.Interface {}

export const PackageManagerJobExecutor = createAbstraction<IPackageManagerJobExecutor>(
  "Api/PackageManagerJobExecutor"
);

export namespace PackageManagerJobExecutor {
  export type Interface = IPackageManagerJobExecutor;
}
```

- [ ] **Step 4: Convert DependencyJobExecutor implementation**

In `src/api/services/jobExecutors/DependencyJobExecutor.ts`:

- Add import: `import { DependencyJobExecutor as Abstraction } from "./abstractions/DependencyJobExecutor.js";`
- Remove `import type { UpgradeService }` — replace with abstraction import: `import { UpgradeService } from "../abstractions/UpgradeService.js";`
- Rename `DependencyJobExecutor` class to `DependencyJobExecutorImpl`
- Remove `export` from class declaration
- Add `createImplementation` export at bottom:

```typescript
export const DependencyJobExecutor = Abstraction.createImplementation({
  implementation: DependencyJobExecutorImpl,
  dependencies: [UpgradeService]
});
```

- [ ] **Step 5: Convert TransientJobExecutor implementation**

In `src/api/services/jobExecutors/TransientJobExecutor.ts`:

- Add import: `import { TransientJobExecutor as Abstraction } from "./abstractions/TransientJobExecutor.js";`
- Replace `import type { UpgradeService }` with `import { UpgradeService } from "../abstractions/UpgradeService.js";`
- Rename class to `TransientJobExecutorImpl`, remove `export` from class
- Add export:

```typescript
export const TransientJobExecutor = Abstraction.createImplementation({
  implementation: TransientJobExecutorImpl,
  dependencies: [UpgradeService]
});
```

- [ ] **Step 6: Convert PackageManagerJobExecutor implementation**

In `src/api/services/jobExecutors/PackageManagerJobExecutor.ts`:

- Add import: `import { PackageManagerJobExecutor as Abstraction } from "./abstractions/PackageManagerJobExecutor.js";`
- Replace `import type { PackageManagerService }` with `import { PackageManagerService } from "../abstractions/PackageManagerService.js";`
- Rename class to `PackageManagerJobExecutorImpl`, remove `export` from class
- Add export:

```typescript
export const PackageManagerJobExecutor = Abstraction.createImplementation({
  implementation: PackageManagerJobExecutorImpl,
  dependencies: [PackageManagerService]
});
```

- [ ] **Step 7: Register in feature.ts**

In `src/api/feature.ts`, add imports and registrations:

```typescript
import { DependencyJobExecutor } from "./services/jobExecutors/DependencyJobExecutor.js";
import { TransientJobExecutor } from "./services/jobExecutors/TransientJobExecutor.js";
import { PackageManagerJobExecutor } from "./services/jobExecutors/PackageManagerJobExecutor.js";
```

Add after `container.register(ChangelogJobExecutor);` (line 76):

```typescript
container.register(DependencyJobExecutor);
container.register(TransientJobExecutor);
container.register(PackageManagerJobExecutor);
```

- [ ] **Step 8: Run tests**

Run: `yarn test --run`
Expected: All 1639 tests pass. No behavior change — executors are still instantiated directly in JobExecutorRegistry for now.

- [ ] **Step 9: Commit**

```bash
git add src/api/services/jobExecutors/abstractions/DependencyJobExecutor.ts \
       src/api/services/jobExecutors/abstractions/TransientJobExecutor.ts \
       src/api/services/jobExecutors/abstractions/PackageManagerJobExecutor.ts \
       src/api/services/jobExecutors/DependencyJobExecutor.ts \
       src/api/services/jobExecutors/TransientJobExecutor.ts \
       src/api/services/jobExecutors/PackageManagerJobExecutor.ts \
       src/api/feature.ts
git commit -m "feat(di): convert simple job executors to createImplementation"
```

---

### Task 2: Convert Complex Job Executors to DI (InstallJobExecutor, CloneJobExecutor, AutoFixPrJobExecutor, ScanJobExecutor)

**Files:**

- Create: `src/api/services/jobExecutors/abstractions/InstallJobExecutor.ts`
- Create: `src/api/services/jobExecutors/abstractions/CloneJobExecutor.ts`
- Create: `src/api/services/jobExecutors/abstractions/AutoFixPrJobExecutor.ts`
- Create: `src/api/services/jobExecutors/abstractions/ScanJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/InstallJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/CloneJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/AutoFixPrJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/ScanJobExecutor.ts`
- Modify: `src/api/feature.ts`

**Interfaces:**

- Consumes: `JobExecutor.Interface`, `createAbstraction` from `#shared/index.js`
- Produces: `InstallJobExecutor`, `CloneJobExecutor`, `AutoFixPrJobExecutor`, `ScanJobExecutor` abstractions

- [ ] **Step 1: Create InstallJobExecutor abstraction**

```typescript
// src/api/services/jobExecutors/abstractions/InstallJobExecutor.ts
import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IInstallJobExecutor extends JobExecutor.Interface {}

export const InstallJobExecutor = createAbstraction<IInstallJobExecutor>("Api/InstallJobExecutor");

export namespace InstallJobExecutor {
  export type Interface = IInstallJobExecutor;
}
```

- [ ] **Step 2: Create CloneJobExecutor abstraction**

```typescript
// src/api/services/jobExecutors/abstractions/CloneJobExecutor.ts
import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface ICloneJobExecutor extends JobExecutor.Interface {}

export const CloneJobExecutor = createAbstraction<ICloneJobExecutor>("Api/CloneJobExecutor");

export namespace CloneJobExecutor {
  export type Interface = ICloneJobExecutor;
}
```

- [ ] **Step 3: Create AutoFixPrJobExecutor abstraction**

```typescript
// src/api/services/jobExecutors/abstractions/AutoFixPrJobExecutor.ts
import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IAutoFixPrJobExecutor extends JobExecutor.Interface {}

export const AutoFixPrJobExecutor = createAbstraction<IAutoFixPrJobExecutor>(
  "Api/AutoFixPrJobExecutor"
);

export namespace AutoFixPrJobExecutor {
  export type Interface = IAutoFixPrJobExecutor;
}
```

- [ ] **Step 4: Create ScanJobExecutor abstraction**

```typescript
// src/api/services/jobExecutors/abstractions/ScanJobExecutor.ts
import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IScanJobExecutor extends JobExecutor.Interface {}

export const ScanJobExecutor = createAbstraction<IScanJobExecutor>("Api/ScanJobExecutor");

export namespace ScanJobExecutor {
  export type Interface = IScanJobExecutor;
}
```

- [ ] **Step 5: Convert InstallJobExecutor implementation**

In `src/api/services/jobExecutors/InstallJobExecutor.ts`:

- Add: `import { InstallJobExecutor as Abstraction } from "./abstractions/InstallJobExecutor.js";`
- Change all `import type { ... }` for dependencies to value imports: `import { PackageManagerDriverRegistry } from ...`, `import { CommandRunner } from ...`, `import { WebSocketBroadcaster } from ...`, `import { FileConfigService } from ...`
- Rename class to `InstallJobExecutorImpl`, remove `export`
- Add export:

```typescript
export const InstallJobExecutor = Abstraction.createImplementation({
  implementation: InstallJobExecutorImpl,
  dependencies: [
    PackageManagerDriverRegistry,
    CommandRunner,
    WebSocketBroadcaster,
    FileConfigService
  ]
});
```

- [ ] **Step 6: Convert CloneJobExecutor implementation**

In `src/api/services/jobExecutors/CloneJobExecutor.ts`:

- Add: `import { CloneJobExecutor as Abstraction } from "./abstractions/CloneJobExecutor.js";`
- Change `import type` to value imports for: `CommandRunner`, `PackageManagerService`, `SecurityService`, `DatabaseClient`
- Rename class to `CloneJobExecutorImpl`, remove `export`
- Add export:

```typescript
export const CloneJobExecutor = Abstraction.createImplementation({
  implementation: CloneJobExecutorImpl,
  dependencies: [CommandRunner, PackageManagerService, SecurityService, DatabaseClient]
});
```

- [ ] **Step 7: Convert AutoFixPrJobExecutor implementation**

In `src/api/services/jobExecutors/AutoFixPrJobExecutor.ts`:

- Add: `import { AutoFixPrJobExecutor as Abstraction } from "./abstractions/AutoFixPrJobExecutor.js";`
- Change `import type` to value imports for: `AutoFixPrService`, `GitService`, `ForgeService`, `UpgradeService`, `DatabaseClient`, `WebSocketBroadcaster`
- Rename class to `AutoFixPrJobExecutorImpl`, remove `export`
- Add export:

```typescript
export const AutoFixPrJobExecutor = Abstraction.createImplementation({
  implementation: AutoFixPrJobExecutorImpl,
  dependencies: [
    AutoFixPrService,
    GitService,
    ForgeService,
    UpgradeService,
    DatabaseClient,
    WebSocketBroadcaster
  ]
});
```

- [ ] **Step 8: Convert ScanJobExecutor implementation**

In `src/api/services/jobExecutors/ScanJobExecutor.ts`:

- Add: `import { ScanJobExecutor as Abstraction } from "./abstractions/ScanJobExecutor.js";`
- Change `import type` to value imports for all 12 dependencies: `ScanService`, `SecurityService`, `PackageManagerService`, `DatabaseClient`, `WebSocketBroadcaster`, `ErrorReporter`, `EventBus`, `VulnerabilityService`, `DependencyGraphService`, `DependencyChangeService`, `LicenseCheckerService`, `LicensePolicyService`
- Rename class to `ScanJobExecutorImpl`, remove `export`
- Add export:

```typescript
export const ScanJobExecutor = Abstraction.createImplementation({
  implementation: ScanJobExecutorImpl,
  dependencies: [
    ScanService,
    SecurityService,
    PackageManagerService,
    DatabaseClient,
    WebSocketBroadcaster,
    ErrorReporter,
    EventBus,
    VulnerabilityService,
    DependencyGraphService,
    DependencyChangeService,
    LicenseCheckerService,
    LicensePolicyService
  ]
});
```

- [ ] **Step 9: Register in feature.ts**

In `src/api/feature.ts`, add imports:

```typescript
import { InstallJobExecutor } from "./services/jobExecutors/InstallJobExecutor.js";
import { CloneJobExecutor } from "./services/jobExecutors/CloneJobExecutor.js";
import { AutoFixPrJobExecutor } from "./services/jobExecutors/AutoFixPrJobExecutor.js";
import { ScanJobExecutor } from "./services/jobExecutors/ScanJobExecutor.js";
```

Add registrations after the 3 simple executor registrations from Task 1:

```typescript
container.register(InstallJobExecutor);
container.register(CloneJobExecutor);
container.register(AutoFixPrJobExecutor);
container.register(ScanJobExecutor);
```

- [ ] **Step 10: Run tests**

Run: `yarn test --run`
Expected: All tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/api/services/jobExecutors/abstractions/InstallJobExecutor.ts \
       src/api/services/jobExecutors/abstractions/CloneJobExecutor.ts \
       src/api/services/jobExecutors/abstractions/AutoFixPrJobExecutor.ts \
       src/api/services/jobExecutors/abstractions/ScanJobExecutor.ts \
       src/api/services/jobExecutors/InstallJobExecutor.ts \
       src/api/services/jobExecutors/CloneJobExecutor.ts \
       src/api/services/jobExecutors/AutoFixPrJobExecutor.ts \
       src/api/services/jobExecutors/ScanJobExecutor.ts \
       src/api/feature.ts
git commit -m "feat(di): convert complex job executors to createImplementation"
```

---

### Task 3: Refactor JobExecutorRegistry to Receive Executors via DI

**Files:**

- Modify: `src/api/services/jobExecutors/JobExecutorRegistry.ts`
- Modify: `src/api/services/jobExecutors/__tests__/InstallJobExecutor.test.ts` (import path update)
- Modify: `src/api/services/jobExecutors/__tests__/CloneJobExecutor.test.ts` (import path update)
- Modify: `src/api/services/jobExecutors/__tests__/AutoFixPrJobExecutor.test.ts` (import path update)
- Modify: `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts` (import path update)

**Interfaces:**

- Consumes: All 8 executor abstractions from Tasks 1-2
- Produces: Simplified `JobExecutorRegistry` with 8 constructor params instead of 19

- [ ] **Step 1: Rewrite JobExecutorRegistry**

Replace entire `src/api/services/jobExecutors/JobExecutorRegistry.ts`:

```typescript
import { JobExecutorRegistry as Abstraction } from "./abstractions/JobExecutorRegistry.js";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { DependencyJobExecutor } from "./abstractions/DependencyJobExecutor.js";
import { TransientJobExecutor } from "./abstractions/TransientJobExecutor.js";
import { PackageManagerJobExecutor } from "./abstractions/PackageManagerJobExecutor.js";
import { ScanJobExecutor } from "./abstractions/ScanJobExecutor.js";
import { CloneJobExecutor } from "./abstractions/CloneJobExecutor.js";
import { InstallJobExecutor } from "./abstractions/InstallJobExecutor.js";
import { ChangelogJobExecutor } from "./abstractions/ChangelogJobExecutor.js";
import { AutoFixPrJobExecutor } from "./abstractions/AutoFixPrJobExecutor.js";

class JobExecutorRegistryImpl implements Abstraction.Interface {
  private readonly executors = new Map<string, JobExecutor.Interface>();

  public constructor(
    dependencyJobExecutor: DependencyJobExecutor.Interface,
    transientJobExecutor: TransientJobExecutor.Interface,
    packageManagerJobExecutor: PackageManagerJobExecutor.Interface,
    scanJobExecutor: ScanJobExecutor.Interface,
    cloneJobExecutor: CloneJobExecutor.Interface,
    installJobExecutor: InstallJobExecutor.Interface,
    changelogJobExecutor: ChangelogJobExecutor.Interface,
    autoFixPrJobExecutor: AutoFixPrJobExecutor.Interface
  ) {
    const all: JobExecutor.Interface[] = [
      dependencyJobExecutor,
      transientJobExecutor,
      packageManagerJobExecutor,
      scanJobExecutor,
      cloneJobExecutor,
      installJobExecutor,
      changelogJobExecutor,
      autoFixPrJobExecutor
    ];

    for (const executor of all) {
      this.executors.set(executor.type, executor);
    }
  }

  public getExecutor(type: string): JobExecutor.Interface {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new Error(`No executor for job type: ${type}`);
    }
    return executor;
  }
}

export const JobExecutorRegistry = Abstraction.createImplementation({
  implementation: JobExecutorRegistryImpl,
  dependencies: [
    DependencyJobExecutor,
    TransientJobExecutor,
    PackageManagerJobExecutor,
    ScanJobExecutor,
    CloneJobExecutor,
    InstallJobExecutor,
    ChangelogJobExecutor,
    AutoFixPrJobExecutor
  ]
});
```

- [ ] **Step 2: Update test imports**

In each test file that imports executors directly (e.g., `import { InstallJobExecutor } from "../InstallJobExecutor.js"`), the import still works because the implementation file still exports `InstallJobExecutor` (now as `createImplementation` result). However, tests that do `new InstallJobExecutor(...)` will break because the export is no longer a class.

Check each test file. If tests instantiate executors via `new`, they need to construct the impl differently. Since tests typically create the executor manually with mock dependencies, update them to use the DI container pattern or construct the impl directly.

For tests that import and `new` the executor, switch to resolving from a test container:

```typescript
// Before:
import { InstallJobExecutor } from "../InstallJobExecutor.js";
const executor = new InstallJobExecutor(
  driverRegistry,
  commandRunner,
  broadcaster,
  fileConfigService
);

// After:
import { InstallJobExecutor as InstallJobExecutorRegistration } from "../InstallJobExecutor.js";
import { InstallJobExecutor } from "../abstractions/InstallJobExecutor.js";
// ... register deps in container, then:
container.register(InstallJobExecutorRegistration);
const executor = container.resolve(InstallJobExecutor);
```

Apply this pattern to all executor test files that directly instantiate executors. Some tests already use a container setup (like InstallJobExecutor.test.ts) — those just need the import/resolve update.

- [ ] **Step 3: Run tests**

Run: `yarn test --run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/api/services/jobExecutors/JobExecutorRegistry.ts \
       src/api/services/jobExecutors/__tests__/
git commit -m "refactor(di): simplify JobExecutorRegistry to receive executors via DI"
```

---

### Task 4: Vulnerability Transitive/Direct Filter

**Files:**

- Modify: `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts`
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts`
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts`
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx`
- Test: `src/ui/presentation/vulnerabilities/VulnerabilityList/__tests__/VulnerabilitiesPresenter.test.ts` (create or modify)

**Interfaces:**

- Consumes: `IVulnerabilityListFilters`, `IVulnerabilitiesViewModel`, `IVulnerabilitiesPresenter`, `VulnerabilitiesGateway.VulnerabilityItem`
- Produces: `dependencyType` filter on VM and presenter, `setDependencyType` method, `DependencyTypeFilter` type

- [ ] **Step 1: Add dependencyType to filter interface**

In `src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts`, add to `IVulnerabilityListFilters`:

```typescript
export interface IVulnerabilityListFilters {
  severity?: string;
  packageName?: string;
  source?: string;
  projectIds?: string[];
  includeDismissed?: boolean;
  scannedDate?: string;
  teamId?: string;
  dependencyType?: "all" | "direct" | "transitive";
}
```

- [ ] **Step 2: Add to presenter abstraction**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts`:

Add `dependencyType` to VM:

```typescript
export interface IVulnerabilitiesViewModel {
  // ... existing fields ...
  groupedVulnerabilities: IVulnerabilityProjectGroup[];
  dependencyType: "all" | "direct" | "transitive";
}
```

Add `setDependencyType` to presenter interface:

```typescript
export interface IVulnerabilitiesPresenter {
  // ... existing methods ...
  setGroupByProject(value: boolean): void;
  setDependencyType(value: "all" | "direct" | "transitive"): void;
  dispose(): void;
}
```

- [ ] **Step 3: Add filter state and logic to presenter implementation**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts`:

Add private field after `groupByProject`:

```typescript
private dependencyType: "all" | "direct" | "transitive" = "all";
```

Add setter method after `setGroupByProject`:

```typescript
public setDependencyType = (value: "all" | "direct" | "transitive"): void => {
    this.dependencyType = value;
    this.page = 1;
    this.selectedIds.clear();
};
```

Add `dependencyType` to `vm` return object:

```typescript
dependencyType: this.dependencyType,
```

Modify `vm` getter — after `const allItems = this.repository.getVulnerabilities();`, add client-side filtering:

```typescript
const filteredByType =
  this.dependencyType === "all"
    ? allItems
    : allItems.filter(item =>
        this.dependencyType === "transitive"
          ? (item.isTransitive ?? false)
          : !(item.isTransitive ?? false)
      );
const sorted = this.sortItems(filteredByType);
```

Replace `const sorted = this.sortItems(allItems);` with the above.

- [ ] **Step 4: Add Select dropdown to VulnerabilitiesPage**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx`, add a Select after the "Show dismissed" Switch (around line 251):

```tsx
<Select
  placeholder="Dependency"
  clearable
  value={vm.dependencyType === "all" ? null : vm.dependencyType}
  onChange={value => presenter.setDependencyType((value as "direct" | "transitive") ?? "all")}
  data={[
    { value: "direct", label: "Direct" },
    { value: "transitive", label: "Transitive" }
  ]}
/>
```

- [ ] **Step 5: Run tests**

Run: `yarn test --run`
Expected: All tests pass. Existing vulnerability tests should not break since dependencyType defaults to "all".

- [ ] **Step 6: Commit**

```bash
git add src/ui/features/vulnerabilities/abstractions/VulnerabilitiesGateway.ts \
       src/ui/presentation/vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts \
       src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts \
       src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx
git commit -m "feat(vulnerabilities): add transitive/direct dependency type filter"
```

---

### Task 5: Team Filter on Project List

**Files:**

- Modify: `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectList/feature.ts` (add TeamFilterFeature dependency)

**Interfaces:**

- Consumes: `TeamFilterService.Interface` from `#ui/features/teamFilter/abstractions/TeamFilterService.js`, `ProjectListPresenter.ProjectListItem` with `teams` array
- Produces: Filtered project list in `vm.projects` when team is selected

- [ ] **Step 1: Add TeamFilterService dependency to presenter**

In `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`:

Add import:

```typescript
import { TeamFilterService } from "../../../features/teamFilter/abstractions/TeamFilterService.js";
```

Add constructor param (after `filesystemGateway`):

```typescript
private readonly teamFilterService: TeamFilterService.Interface
```

Add reaction field:

```typescript
private readonly disposeTeamReaction: () => void;
```

In constructor body, add reaction (after websocket listeners):

```typescript
this.disposeTeamReaction = reaction(
  () => this.teamFilterService.selectedTeamId,
  () => {
    // No re-fetch needed — client-side filter via vm getter
  }
);
```

Add `reaction` to imports from mobx:

```typescript
import { computed, makeAutoObservable, reaction, runInAction } from "mobx";
```

- [ ] **Step 2: Filter projects in vm getter**

In the `vm` getter, replace `this.projectsRepository.getProjects().map(` with:

```typescript
const allProjects = this.projectsRepository.getProjects();
const selectedTeamId = this.teamFilterService.selectedTeamId;
const filteredProjects = selectedTeamId
  ? allProjects.filter(project => (project.teams ?? []).some(team => team.id === selectedTeamId))
  : allProjects;
```

Then use `filteredProjects.map(` instead of `this.projectsRepository.getProjects().map(`.

- [ ] **Step 3: Add TeamFilterService to dependencies array**

In the `createImplementation` call at bottom:

```typescript
export const ProjectListPresenter = Abstraction.createImplementation({
  implementation: ProjectListPresenterImpl,
  dependencies: [
    LoadProjectsUseCase,
    AddProjectUseCase,
    RemoveProjectUseCase,
    ScanProjectUseCase,
    CheckSecurityUseCase,
    CloneProjectUseCase,
    ProjectsRepository,
    ProjectsGateway,
    WebSocketListener,
    FilesystemGateway,
    TeamFilterService
  ]
});
```

- [ ] **Step 4: Add TeamFilterFeature to ProjectList feature dependencies**

Read `src/ui/presentation/projects/ProjectList/feature.ts` and add `TeamFilterFeature` to its `dependencies` array:

```typescript
import { TeamFilterFeature } from "../../../features/teamFilter/feature.js";

// In createFeature:
dependencies: [/* existing deps */, TeamFilterFeature],
```

- [ ] **Step 5: Run tests**

Run: `yarn test --run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts \
       src/ui/presentation/projects/ProjectList/feature.ts
git commit -m "feat(projects): filter project list by global team selection"
```

---

### Task 6: Team Detail Page — Presenter and Provider

**Files:**

- Create: `src/ui/presentation/teams/TeamDetail/abstractions/TeamDetailPresenter.ts`
- Create: `src/ui/presentation/teams/TeamDetail/TeamDetailPresenter.ts`
- Create: `src/ui/presentation/teams/TeamDetail/feature.ts`
- Create: `src/ui/presentation/teams/TeamDetail/TeamDetailProvider.tsx`

**Interfaces:**

- Consumes: `TeamsGateway.Interface` (getDetail), `TeamFilterService.Interface`, `DashboardPresenter.Interface`
- Produces: `TeamDetailPresenter.Interface` with `load(teamId)`, `vm` (team header data), `dispose()`

- [ ] **Step 1: Create TeamDetailPresenter abstraction**

```typescript
// src/ui/presentation/teams/TeamDetail/abstractions/TeamDetailPresenter.ts
import { createAbstraction } from "#shared/index.js";
import type { TeamsGateway } from "../../../../features/teams/abstractions/TeamsGateway.js";
import type { DashboardPresenter } from "../../../dashboard/Dashboard/abstractions/DashboardPresenter.js";

export interface ITeamDetailViewModel {
  loading: boolean;
  error: string | null;
  teamName: string;
  teamColor: string;
  projectCount: number;
}

export interface ITeamDetailPresenter {
  get vm(): ITeamDetailViewModel;
  get dashboardPresenter(): DashboardPresenter.Interface;
  load(teamId: string): Promise<void>;
  dispose(): void;
}

export const TeamDetailPresenter =
  createAbstraction<ITeamDetailPresenter>("Ui/TeamDetailPresenter");

export namespace TeamDetailPresenter {
  export type Interface = ITeamDetailPresenter;
  export type ViewModel = ITeamDetailViewModel;
}
```

- [ ] **Step 2: Create TeamDetailPresenter implementation**

```typescript
// src/ui/presentation/teams/TeamDetail/TeamDetailPresenter.ts
import { computed, makeAutoObservable, runInAction } from "mobx";
import { TeamDetailPresenter as Abstraction } from "./abstractions/TeamDetailPresenter.js";
import { TeamsGateway } from "../../../features/teams/abstractions/TeamsGateway.js";
import { TeamFilterService } from "../../../features/teamFilter/abstractions/TeamFilterService.js";
import { DashboardPresenter } from "../../dashboard/Dashboard/abstractions/DashboardPresenter.js";

class TeamDetailPresenterImpl implements Abstraction.Interface {
  private loading = false;
  private error: string | null = null;
  private teamName = "";
  private teamColor = "";
  private projectCount = 0;
  private previousTeamId: string | null = null;

  public constructor(
    private readonly teamsGateway: TeamsGateway.Interface,
    private readonly teamFilterService: TeamFilterService.Interface,
    private readonly dashboard: DashboardPresenter.Interface
  ) {
    makeAutoObservable(this, { vm: computed });
  }

  public get vm(): Abstraction.ViewModel {
    return {
      loading: this.loading,
      error: this.error,
      teamName: this.teamName,
      teamColor: this.teamColor,
      projectCount: this.projectCount
    };
  }

  public get dashboardPresenter(): DashboardPresenter.Interface {
    return this.dashboard;
  }

  public load = async (teamId: string): Promise<void> => {
    this.loading = true;
    this.error = null;
    this.previousTeamId = this.teamFilterService.selectedTeamId;
    this.teamFilterService.setSelectedTeamId(teamId);

    try {
      const detail = await this.teamsGateway.getDetail(teamId);
      runInAction(() => {
        this.teamName = detail.name;
        this.teamColor = detail.color;
        this.projectCount = detail.projects.length;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Failed to load team";
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  };

  public dispose = (): void => {
    this.teamFilterService.setSelectedTeamId(this.previousTeamId);
  };
}

export const TeamDetailPresenter = Abstraction.createImplementation({
  implementation: TeamDetailPresenterImpl,
  dependencies: [TeamsGateway, TeamFilterService, DashboardPresenter]
});
```

- [ ] **Step 3: Create feature.ts**

```typescript
// src/ui/presentation/teams/TeamDetail/feature.ts
import { createFeature } from "#shared/index.js";
import { TeamDetailPresenter as TeamDetailPresenterAbstraction } from "./abstractions/TeamDetailPresenter.js";
import { TeamDetailPresenter } from "./TeamDetailPresenter.js";
import { TeamsFeature } from "../../../features/teams/feature.js";
import { DashboardPresentationFeature } from "../../dashboard/Dashboard/feature.js";
import { TeamFilterFeature } from "../../../features/teamFilter/feature.js";

export interface ITeamDetailFeatureExports {
  presenter: TeamDetailPresenterAbstraction.Interface;
}

export const TeamDetailFeature = createFeature<void, ITeamDetailFeatureExports>({
  name: "Ui/TeamDetail",
  dependencies: [TeamsFeature, DashboardPresentationFeature, TeamFilterFeature],
  register(container) {
    container.register(TeamDetailPresenter);
  },
  resolve(container) {
    return {
      presenter: container.resolve(TeamDetailPresenterAbstraction)
    };
  }
});
```

- [ ] **Step 4: Create TeamDetailProvider**

```typescript
// src/ui/presentation/teams/TeamDetail/TeamDetailProvider.tsx
import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { TeamDetailFeature } from "./feature.js";
import type { TeamDetailPresenter } from "./abstractions/TeamDetailPresenter.js";

interface TeamDetailProviderProps {
  children: (params: { presenter: TeamDetailPresenter.Interface }) => React.ReactNode;
}

export function TeamDetailProvider({ children }: TeamDetailProviderProps): React.ReactNode {
  const { presenter } = useFeature(TeamDetailFeature);
  return children({ presenter });
}
```

- [ ] **Step 5: Run tests**

Run: `yarn test --run`
Expected: All tests pass. No existing code consumes these new files yet.

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/teams/TeamDetail/
git commit -m "feat(teams): add TeamDetailPresenter and provider"
```

---

### Task 7: Team Detail Page — UI and Routing

**Files:**

- Create: `src/ui/presentation/teams/TeamDetail/components/TeamDetailPage.tsx`
- Modify: `src/ui/App.tsx` — add route, feature, path pattern
- Modify: `src/ui/presentation/teams/TeamsPage/components/TeamsPage.tsx` — team name links to `/teams/:id`

**Interfaces:**

- Consumes: `TeamDetailPresenter.Interface`, `DashboardPresenter.Interface`, `DashboardPage` component
- Produces: `/teams/:id` route rendering team header + dashboard

- [ ] **Step 1: Create TeamDetailPage component**

```tsx
// src/ui/presentation/teams/TeamDetail/components/TeamDetailPage.tsx
import type React from "react";
import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { ColorSwatch, Group, Skeleton, Stack, Text, Title, Badge } from "@mantine/core";
import type { TeamDetailPresenter } from "../abstractions/TeamDetailPresenter.js";
import { DashboardPage } from "../../../dashboard/Dashboard/components/DashboardPage.js";

interface TeamDetailPageProps {
  presenter: TeamDetailPresenter.Interface;
  teamId: string;
}

export const TeamDetailPage = observer(function TeamDetailPage({
  presenter,
  teamId
}: TeamDetailPageProps): React.ReactNode {
  useEffect(() => {
    void presenter.load(teamId);
    return () => presenter.dispose();
  }, [presenter, teamId]);

  const { vm } = presenter;

  if (vm.loading) {
    return (
      <Stack>
        <Skeleton height={40} />
        <Skeleton height={200} />
      </Stack>
    );
  }

  if (vm.error) {
    return <Text c="red">{vm.error}</Text>;
  }

  return (
    <Stack>
      <Group gap="md">
        <ColorSwatch color={vm.teamColor} size={24} />
        <Title order={2}>{vm.teamName}</Title>
        <Badge variant="light">{vm.projectCount} projects</Badge>
      </Group>

      <DashboardPage presenter={presenter.dashboardPresenter} />
    </Stack>
  );
});
```

- [ ] **Step 2: Add route to App.tsx**

In `src/ui/App.tsx`:

Add imports:

```typescript
import { TeamDetailFeature } from "./presentation/teams/TeamDetail/feature.js";
import { TeamDetailProvider } from "./presentation/teams/TeamDetail/TeamDetailProvider.js";
import { TeamDetailPage } from "./presentation/teams/TeamDetail/components/TeamDetailPage.js";
```

Add `TeamDetailFeature` to `ALL_FEATURES` array (after `TeamsPageFeature`).

Add path pattern (after `VULNERABILITY_DETAIL_PATH_PATTERN`):

```typescript
const TEAM_DETAIL_PATH_PATTERN = /^\/teams\/([^/]+)$/;
```

Add route match in `AppRoutes` — BEFORE the existing `if (path === "/teams")` check:

```typescript
const teamDetailMatch = TEAM_DETAIL_PATH_PATTERN.exec(path);
const teamDetailId = teamDetailMatch?.[1];

if (teamDetailId) {
    return (
        <TeamDetailProvider>
            {({ presenter }) => (
                <TeamDetailPage presenter={presenter} teamId={teamDetailId} />
            )}
        </TeamDetailProvider>
    );
}
```

- [ ] **Step 3: Add team name links in TeamsPage**

In `src/ui/presentation/teams/TeamsPage/components/TeamsPage.tsx`, find where team names render in the table rows. Change the team name text to a clickable link:

```tsx
import { navigate } from "#ui/shared/router/router.js";

// In the table row where team name is displayed:
<Text
  style={{ cursor: "pointer", textDecoration: "underline" }}
  onClick={() => navigate(`/teams/${team.id}`)}
>
  {team.name}
</Text>;
```

- [ ] **Step 4: Run tests**

Run: `yarn test --run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/teams/TeamDetail/components/TeamDetailPage.tsx \
       src/ui/App.tsx \
       src/ui/presentation/teams/TeamsPage/components/TeamsPage.tsx
git commit -m "feat(teams): add team detail page with dashboard at /teams/:id"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `yarn test --run`
Expected: All tests pass.

- [ ] **Step 2: Run type check**

Run: `yarn tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Run lint and format**

Run: `yarn lint && yarn format:check`
Expected: Clean.

- [ ] **Step 4: Commit spec and plan**

```bash
git add docs/superpowers/specs/2026-08-04-team-detail-filters-executor-di-design.md \
       docs/superpowers/plans/2026-08-04-team-detail-filters-executor-di.md
git commit -m "docs: spec and plan for team detail, filters, executor DI"
```
