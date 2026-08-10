# Vulnerabilities Page + Presenter Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 449-line `VulnerabilitiesPresenter.ts` and the 496-line `VulnerabilitiesPage.tsx` into focused, single-responsibility modules — without changing any observable behavior — while fixing the code smells noted in the design spec along the way.

**Architecture:** The presenter becomes a thin compositor that instantiates four plain (non-DI) helper classes — `VulnerabilityFilterManager`, `VulnerabilitySelectionManager`, `VulnerabilityBulkActions`, `VulnerabilityExportActions` — and delegates its public interface methods to them. The page component becomes a thin layout compositor that wires five new presentational components — `VulnerabilityFilters`, `VulnerabilityBulkBar`, `VulnerabilityTable`, `VulnerabilityGroupedView` (which both render `VulnerabilityRow`), and `VulnerabilityConfirmDialogs` — passing view-model slices and callbacks as props. `isSafeAdvisoryUrl` and `SOURCE_COLORS` move to shared vulnerability utilities; `computeProjectGroups`/`toRowViewModel` become standalone pure functions.

**Tech Stack:** TypeScript, React, MobX, Mantine UI, Vitest

## Global Constraints

- Use `yarn full` to verify (lint, format, build, tests) — run it at the end of every task, no exceptions
- Named interfaces only, no inline structural types
- Object params with named keys for 2+ params (applies to the new sub-manager constructors below)
- Full words in identifiers (no abbreviations)
- Format with `yarn format:fix` and `yarn lint:fix` before commit (both run as part of `yarn full`)
- Existing `VulnerabilitiesPresenter.test.ts` must pass unchanged after each task — its assertions define the contract this refactor must preserve
- This is extract + improve: same behavior, better structure, fix code smells during extraction — do not change business logic, only where it lives
- Only commit when a task's `yarn full` run is green

### MobX reactivity gotcha (read before starting Task 2 and Task 3)

`VulnerabilitiesPresenterImpl.vm` is a MobX `computed`. MobX only re-runs a computed when one of the **observable** values it read during its last evaluation changes. Today `selectedIds` and `bulkActionRunning` are observable because they are fields on `this` inside a class wrapped with `makeAutoObservable(this)`.

When these fields move into `VulnerabilitySelectionManager` and `VulnerabilityBulkActions`, those classes **must also call `makeAutoObservable(this)` in their own constructors**. If you skip this, `vm` will silently return stale cached values the second time it's read after a mutation (the first read is never cached, so simple single-read tests can pass while multi-read tests — like `sets bulkActionRunning true while a bulk action is in flight` and `toggleSelected adds/removes from selection` — fail non-obviously). `VulnerabilityFilterManager` and `VulnerabilityExportActions` hold no mutable state of their own, so they do **not** need `makeAutoObservable`.

---

## Task 1: Extract `VulnerabilityFilterManager` + standalone view-model mapping functions

**Files:**

- Create: `src/ui/presentation/Vulnerabilities/VulnerabilityList/vulnerabilityListConstants.ts`
- Create: `src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilityFilterManager.ts`
- Create: `src/ui/presentation/Vulnerabilities/VulnerabilityList/vulnerabilityViewModelMapping.ts`
- Modify: `src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts`
- Test (no changes expected, run only): `src/ui/presentation/Vulnerabilities/VulnerabilityList/__tests__/VulnerabilitiesPresenter.test.ts`

**Interfaces:**

- Produces: `DEFAULT_PAGE_SIZE: number` (from `vulnerabilityListConstants.ts`)
- Produces: `IVulnerabilityUrlFilters` interface, `VulnerabilityFilterManager` class with methods `read(): IVulnerabilityUrlFilters`, `setSeverity(value: string | null): void`, `setPackageName(value: string): void`, `setSource(value: string | null): void`, `setPage(page: number): void`, `setSortBy(sortBy: string): void`, `setProjectIds(ids: string[]): void`, `setIncludeDismissed(value: boolean): void`, `setDependencyType(value: "all" | "direct" | "transitive"): void`, `clearScannedDate(): void` (from `VulnerabilityFilterManager.ts`)
- Produces: `toVulnerabilityRowViewModel(item: VulnerabilitiesGateway.VulnerabilityItem): Abstraction.VulnerabilityRow`, `computeVulnerabilityProjectGroups(items: Abstraction.VulnerabilityRow[]): Abstraction.ProjectGroup[]` (from `vulnerabilityViewModelMapping.ts`)
- Consumes (Task 2 onward relies on this): `filterManager.read()` is the single source of truth for URL-derived filter state; the presenter no longer reads `UrlFilterService` directly

- [ ] **Step 1: Create the constants file**

```ts
// src/ui/presentation/Vulnerabilities/VulnerabilityList/vulnerabilityListConstants.ts
export const DEFAULT_PAGE_SIZE = 25;
```

- [ ] **Step 2: Create `VulnerabilityFilterManager.ts`**

```ts
// src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilityFilterManager.ts
import type { z } from "zod";
import { listVulnerabilitiesRoute } from "#shared/routes/index.js";
import { UrlFilterService } from "../../../features/UrlFilter/abstractions/UrlFilterService.js";

const FILTER_SCHEMA = listVulnerabilitiesRoute.querystring as NonNullable<
  typeof listVulnerabilitiesRoute.querystring
> &
  z.ZodObject<z.ZodRawShape>;

export interface IVulnerabilityUrlFilters {
  severity?: string;
  packageName?: string;
  source?: string;
  projectIds?: string;
  includeDismissed?: "true" | "false";
  scannedDate?: string;
  teamId?: string;
  dependencyType?: "all" | "direct" | "transitive";
  page?: number;
  pageSize?: number;
  sortBy?: "severity" | "packageName" | "projectName";
  sortOrder?: "asc" | "desc";
}

export interface IVulnerabilityFilterManagerDependencies {
  urlFilterService: UrlFilterService.Interface;
  onFilterChange: () => void;
}

export class VulnerabilityFilterManager {
  private readonly urlFilterService: UrlFilterService.Interface;
  private readonly onFilterChange: () => void;

  public constructor(dependencies: IVulnerabilityFilterManagerDependencies) {
    this.urlFilterService = dependencies.urlFilterService;
    this.onFilterChange = dependencies.onFilterChange;
  }

  public read(): IVulnerabilityUrlFilters {
    return this.urlFilterService.read(FILTER_SCHEMA);
  }

  public setSeverity(value: string | null): void {
    this.onFilterChange();
    this.urlFilterService.update(FILTER_SCHEMA, { severity: value, page: null });
  }

  public setPackageName(value: string): void {
    this.onFilterChange();
    this.urlFilterService.update(FILTER_SCHEMA, { packageName: value || null, page: null });
  }

  public setSource(value: string | null): void {
    this.onFilterChange();
    this.urlFilterService.update(FILTER_SCHEMA, { source: value, page: null });
  }

  public setPage(page: number): void {
    this.onFilterChange();
    this.urlFilterService.update(FILTER_SCHEMA, { page: String(page) });
  }

  public setSortBy(sortBy: string): void {
    const urlFilters = this.read();
    const currentSortBy = urlFilters.sortBy ?? "severity";
    const newSortOrder =
      currentSortBy === sortBy
        ? (urlFilters.sortOrder ?? "desc") === "asc"
          ? "desc"
          : "asc"
        : "desc";
    this.onFilterChange();
    this.urlFilterService.update(FILTER_SCHEMA, {
      sortBy,
      sortOrder: newSortOrder,
      page: null
    });
  }

  public setProjectIds(ids: string[]): void {
    this.onFilterChange();
    this.urlFilterService.update(FILTER_SCHEMA, {
      projectIds: ids.length > 0 ? ids.join(",") : null,
      page: null
    });
  }

  public setIncludeDismissed(value: boolean): void {
    this.onFilterChange();
    this.urlFilterService.update(FILTER_SCHEMA, {
      includeDismissed: value ? "true" : null,
      page: null
    });
  }

  public setDependencyType(value: "all" | "direct" | "transitive"): void {
    this.onFilterChange();
    this.urlFilterService.update(FILTER_SCHEMA, {
      dependencyType: value === "all" ? null : value,
      page: null
    });
  }

  public clearScannedDate(): void {
    this.urlFilterService.update(FILTER_SCHEMA, { scannedDate: null, page: null });
  }
}
```

Note: `clearScannedDate` does **not** call `onFilterChange()` — the original `clearScannedDate` never cleared selection either. Preserve that exactly.

- [ ] **Step 3: Create `vulnerabilityViewModelMapping.ts`**

```ts
// src/ui/presentation/Vulnerabilities/VulnerabilityList/vulnerabilityViewModelMapping.ts
import type { VulnerabilitiesPresenter as Abstraction } from "./abstractions/VulnerabilitiesPresenter.js";
import type { VulnerabilitiesGateway } from "../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";
import type { VulnerabilitySeverityCounts } from "#shared/vulnerabilities/types.js";

export function toVulnerabilityRowViewModel(
  item: VulnerabilitiesGateway.VulnerabilityItem
): Abstraction.VulnerabilityRow {
  const isDismissed =
    item.dismissedAt != null && (item.dismissedUntil == null || item.dismissedUntil > Date.now());
  const dismissLabel =
    item.dismissedAt == null
      ? null
      : item.dismissedUntil != null
        ? `Snoozed until ${new Date(item.dismissedUntil).toLocaleDateString()}`
        : "Dismissed";

  return {
    id: item.id,
    projectId: item.projectId,
    projectName: item.projectName,
    packageName: item.packageName,
    severity: item.severity,
    title: item.title,
    advisoryUrl: item.advisoryUrl,
    cveId: item.cveId,
    fixVersion: item.fixVersion,
    source: item.source,
    installedVersion: item.installedVersion,
    dependencyKind: item.dependencyKind ?? "dependency",
    scannedAt: item.scannedAt,
    dismissedAt: item.dismissedAt,
    dismissedUntil: item.dismissedUntil,
    isDismissed,
    dismissLabel
  };
}

interface IProjectGroupAccumulator {
  projectId: string;
  projectName: string;
  counts: VulnerabilitySeverityCounts;
  vulnerabilities: Abstraction.VulnerabilityRow[];
}

export function computeVulnerabilityProjectGroups(
  items: Abstraction.VulnerabilityRow[]
): Abstraction.ProjectGroup[] {
  const groupMap = new Map<string, IProjectGroupAccumulator>();

  for (const item of items) {
    let group = groupMap.get(item.projectId);
    if (!group) {
      group = {
        projectId: item.projectId,
        projectName: item.projectName,
        counts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
        vulnerabilities: []
      };
      groupMap.set(item.projectId, group);
    }
    group.counts[item.severity]++;
    group.vulnerabilities.push(item);
  }

  return Array.from(groupMap.values()).sort(
    (a, b) => b.vulnerabilities.length - a.vulnerabilities.length
  );
}
```

This is a straight move of the two private methods out of the class body — logic is byte-for-byte identical, only `this.` prefixes are removed and the anonymous inline accumulator type gets the named interface `IProjectGroupAccumulator` (fixes the "no inline structural types" violation that existed in the original).

- [ ] **Step 4: Update `VulnerabilitiesPresenter.ts` — imports**

Remove:

```ts
import type { z } from "zod";
import { listVulnerabilitiesRoute } from "#shared/routes/index.js";
import type { VulnerabilitySeverityCounts } from "#shared/vulnerabilities/types.js";
```

Add:

```ts
import { VulnerabilityFilterManager } from "./VulnerabilityFilterManager.js";
import { DEFAULT_PAGE_SIZE } from "./vulnerabilityListConstants.js";
import {
  toVulnerabilityRowViewModel,
  computeVulnerabilityProjectGroups
} from "./vulnerabilityViewModelMapping.js";
```

Keep everything else (`computed`, `makeAutoObservable`, `reaction`, `runInAction`, the `Abstraction` import, all use case/gateway/repository/service imports, `handleSnoozeExpired`).

- [ ] **Step 5: Update `VulnerabilitiesPresenter.ts` — remove the module-level constants that moved**

Delete these two lines (the third, `EXPIRED_SNOOZE_LOOKBACK_MS`, and the `FILTER_SCHEMA` block stay removed too — `FILTER_SCHEMA` moved into `VulnerabilityFilterManager.ts`, `DEFAULT_PAGE_SIZE` moved into `vulnerabilityListConstants.ts`):

```ts
const DEFAULT_PAGE_SIZE = 25;

const FILTER_SCHEMA = listVulnerabilitiesRoute.querystring as NonNullable<
  typeof listVulnerabilitiesRoute.querystring
> &
  z.ZodObject<z.ZodRawShape>;
```

Keep `const EXPIRED_SNOOZE_LOOKBACK_MS = 300_000;` — it is only used by `checkExpiredSnoozes`, which stays on the main presenter, so it is not shared and does not need to move.

- [ ] **Step 6: Update `VulnerabilitiesPresenter.ts` — constructor**

Replace:

```ts
    public constructor(
        private readonly loadVulnerabilities: LoadVulnerabilitiesUseCase.Interface,
        private readonly repository: VulnerabilitiesRepository.Interface,
        private readonly bulkActionUseCase: BulkVulnerabilityActionUseCase.Interface,
        private readonly bulkRescanUseCase: BulkRescanVulnerabilitiesUseCase.Interface,
        private readonly exportUseCase: ExportVulnerabilitiesUseCase.Interface,
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly gateway: VulnerabilitiesGateway.Interface,
        private readonly teamFilterService: TeamFilterService.Interface,
        private readonly urlFilterService: UrlFilterService.Interface
    ) {
        makeAutoObservable(this, { vm: computed });

        this.disposeTeamReaction = reaction(
            () => this.teamFilterService.selectedTeamId,
            () => {
                void this.load();
            }
        );

        this.disposeUrlListener = this.urlFilterService.onChange(() => {
            void this.load();
        });
    }
```

with:

```ts
    private readonly filterManager: VulnerabilityFilterManager;

    public constructor(
        private readonly loadVulnerabilities: LoadVulnerabilitiesUseCase.Interface,
        private readonly repository: VulnerabilitiesRepository.Interface,
        private readonly bulkActionUseCase: BulkVulnerabilityActionUseCase.Interface,
        private readonly bulkRescanUseCase: BulkRescanVulnerabilitiesUseCase.Interface,
        private readonly exportUseCase: ExportVulnerabilitiesUseCase.Interface,
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly gateway: VulnerabilitiesGateway.Interface,
        private readonly teamFilterService: TeamFilterService.Interface,
        urlFilterService: UrlFilterService.Interface
    ) {
        makeAutoObservable(this, { vm: computed });

        this.filterManager = new VulnerabilityFilterManager({
            urlFilterService,
            onFilterChange: () => this.selectedIds.clear()
        });

        this.disposeTeamReaction = reaction(
            () => this.teamFilterService.selectedTeamId,
            () => {
                void this.load();
            }
        );

        this.disposeUrlListener = urlFilterService.onChange(() => {
            void this.load();
        });
    }
```

Note the `urlFilterService` constructor parameter drops `private readonly` — it is only needed during construction now (passed into `VulnerabilityFilterManager` and used for the `onChange` listener), so storing it as a field would be dead state. `this.selectedIds.clear()` in `onFilterChange` still refers to the presenter's own field for now — Task 2 changes this line to `this.selectionManager.clearSelection()`.

- [ ] **Step 7: Update `VulnerabilitiesPresenter.ts` — `vm` getter**

Replace the body of `public get vm()` so it starts with:

```ts
    public get vm(): Abstraction.ViewModel {
        const urlFilters = this.filterManager.read();
        const pageSize = urlFilters.pageSize ?? DEFAULT_PAGE_SIZE;
        const totalCount = this.repository.getTotal();
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        const vulnerabilities = this.repository
            .getVulnerabilities()
            .map(toVulnerabilityRowViewModel);

        return {
            loading: this.loading,
            error: this.error,
            vulnerabilities,
            totalCount,
            severity: urlFilters.severity ?? null,
            packageName: urlFilters.packageName ?? "",
            source: urlFilters.source ?? null,
            sortBy: urlFilters.sortBy ?? "severity",
            sortOrder: urlFilters.sortOrder ?? "desc",
            page: urlFilters.page ?? 1,
            pageSize,
            totalPages,
            projectIds: urlFilters.projectIds ? urlFilters.projectIds.split(",") : [],
            includeDismissed: urlFilters.includeDismissed === "true",
            selectedIds: [...this.selectedIds],
            selectedCount: this.selectedIds.size,
            allOnPageSelected:
                vulnerabilities.length > 0 &&
                vulnerabilities.every(v => this.selectedIds.has(v.id)),
            bulkActionRunning: this.bulkActionRunning,
            availableProjects: this.projectsRepository.getProjects().map(project => ({
                value: project.id,
                label: project.name
            })),
            scannedDate: urlFilters.scannedDate ?? null,
            groupByProject: this.groupByProject,
            groupedVulnerabilities: this.groupByProject
                ? computeVulnerabilityProjectGroups(vulnerabilities)
                : [],
            dependencyType: urlFilters.dependencyType ?? "all"
        };
    }
```

Everything except the first line (`this.urlFilterService.read(FILTER_SCHEMA)` → `this.filterManager.read()`) and the `.map(item => this.toRowViewModel(item))` → `.map(toVulnerabilityRowViewModel)` and `this.computeProjectGroups(...)` → `computeVulnerabilityProjectGroups(...)` stays exactly the same as the original — `selectedIds`/`bulkActionRunning` still live on the presenter until Tasks 2–3.

- [ ] **Step 8: Update `VulnerabilitiesPresenter.ts` — `load()`**

The only line that changes inside `load()`:

```ts
const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
```

becomes

```ts
const urlFilters = this.filterManager.read();
```

Everything else in `load()` is unchanged.

- [ ] **Step 9: Update `VulnerabilitiesPresenter.ts` — delegate the nine filter setters**

Replace the nine methods `setSeverity`, `setPackageName`, `setSource`, `setPage`, `setSortBy`, `setProjectIds`, `setIncludeDismissed`, `setDependencyType`, `clearScannedDate` (currently each reading/writing `this.urlFilterService`/`this.selectedIds` directly) with one-line delegations:

```ts
    public setSeverity = (value: string | null): void => this.filterManager.setSeverity(value);

    public setPackageName = (value: string): void => this.filterManager.setPackageName(value);

    public setSource = (value: string | null): void => this.filterManager.setSource(value);

    public setPage = (page: number): void => this.filterManager.setPage(page);

    public setSortBy = (sortBy: string): void => this.filterManager.setSortBy(sortBy);

    public setProjectIds = (ids: string[]): void => this.filterManager.setProjectIds(ids);

    public setIncludeDismissed = (value: boolean): void =>
        this.filterManager.setIncludeDismissed(value);

    public setDependencyType = (value: "all" | "direct" | "transitive"): void =>
        this.filterManager.setDependencyType(value);

    public clearScannedDate = (): void => this.filterManager.clearScannedDate();
```

- [ ] **Step 10: Update `VulnerabilitiesPresenter.ts` — remove the two private helper methods that moved**

Delete `private toRowViewModel(...)` and `private computeProjectGroups(...)` from the class body entirely (their logic now lives in `vulnerabilityViewModelMapping.ts`, called from `vm` in Step 7).

- [ ] **Step 11: Update `VulnerabilitiesPresenter.ts` — `currentFilters()`**

The only line that changes:

```ts
const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
```

becomes

```ts
const urlFilters = this.filterManager.read();
```

The rest of `currentFilters()` (the spread-based filter object construction) is unchanged, including its `pageSize: urlFilters.pageSize ?? DEFAULT_PAGE_SIZE` line, which now resolves to the imported constant.

- [ ] **Step 12: Run the full verification pipeline**

Run: `yarn full`
Expected: lint, format, build, and all tests (including `VulnerabilitiesPresenter.test.ts` unchanged) pass. If `yarn lint:fix`/`yarn format:fix` report unused imports (e.g. leftover `z` or `listVulnerabilitiesRoute` imports in the presenter), remove them and re-run.

- [ ] **Step 13: Commit**

```bash
git add src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilityFilterManager.ts \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/vulnerabilityListConstants.ts \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/vulnerabilityViewModelMapping.ts
git commit -m "refactor: extract VulnerabilityFilterManager and view-model mapping from VulnerabilitiesPresenter"
```

---

## Task 2: Extract `VulnerabilitySelectionManager`

**Files:**

- Create: `src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitySelectionManager.ts`
- Modify: `src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts`

**Interfaces:**

- Consumes: nothing from Task 1 directly, but the `onFilterChange` callback wired in Task 1's constructor (`() => this.selectedIds.clear()`) is rewired here to call the new manager
- Produces: `IVulnerabilitySelectableItem { id: string }`, `VulnerabilitySelectionManager` class with `get ids(): string[]`, `get size(): number`, `toggleSelected(id: string): void`, `selectAllOnPage(items: readonly IVulnerabilitySelectableItem[]): void`, `isAllSelected(items: readonly IVulnerabilitySelectableItem[]): boolean`, `clearSelection(): void`

- [ ] **Step 1: Create `VulnerabilitySelectionManager.ts`**

```ts
// src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitySelectionManager.ts
import { makeAutoObservable } from "mobx";

export interface IVulnerabilitySelectableItem {
  id: string;
}

export class VulnerabilitySelectionManager {
  private readonly selectedIds = new Set<string>();

  public constructor() {
    makeAutoObservable(this);
  }

  public get ids(): string[] {
    return [...this.selectedIds];
  }

  public get size(): number {
    return this.selectedIds.size;
  }

  public toggleSelected(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  public selectAllOnPage(items: readonly IVulnerabilitySelectableItem[]): void {
    const allSelected = this.isAllSelected(items);
    if (allSelected) {
      items.forEach(item => this.selectedIds.delete(item.id));
    } else {
      items.forEach(item => this.selectedIds.add(item.id));
    }
  }

  public isAllSelected(items: readonly IVulnerabilitySelectableItem[]): boolean {
    return items.length > 0 && items.every(item => this.selectedIds.has(item.id));
  }

  public clearSelection(): void {
    this.selectedIds.clear();
  }
}
```

This is a faithful extraction of `toggleSelected`, `selectAllOnPage`, `clearSelection`, and the `allOnPageSelected` predicate (pulled out as `isAllSelected` so both `selectAllOnPage` and the presenter's `vm` getter can reuse it instead of duplicating the `.every(...)` check). **`makeAutoObservable(this)` in the constructor is required** — see the "MobX reactivity gotcha" note in Global Constraints.

- [ ] **Step 2: Update `VulnerabilitiesPresenter.ts` — imports**

Add:

```ts
import { VulnerabilitySelectionManager } from "./VulnerabilitySelectionManager.js";
```

- [ ] **Step 3: Update `VulnerabilitiesPresenter.ts` — remove the `selectedIds` field, add `selectionManager`**

Replace:

```ts
    private readonly selectedIds = new Set<string>();
```

with:

```ts
    private readonly selectionManager: VulnerabilitySelectionManager;
```

- [ ] **Step 4: Update `VulnerabilitiesPresenter.ts` — constructor wiring**

Replace:

```ts
this.filterManager = new VulnerabilityFilterManager({
  urlFilterService,
  onFilterChange: () => this.selectedIds.clear()
});
```

with:

```ts
this.selectionManager = new VulnerabilitySelectionManager();
this.filterManager = new VulnerabilityFilterManager({
  urlFilterService,
  onFilterChange: () => this.selectionManager.clearSelection()
});
```

- [ ] **Step 5: Update `VulnerabilitiesPresenter.ts` — `vm` getter**

Replace these four lines:

```ts
            selectedIds: [...this.selectedIds],
            selectedCount: this.selectedIds.size,
            allOnPageSelected:
                vulnerabilities.length > 0 &&
                vulnerabilities.every(v => this.selectedIds.has(v.id)),
```

with:

```ts
            selectedIds: this.selectionManager.ids,
            selectedCount: this.selectionManager.size,
            allOnPageSelected: this.selectionManager.isAllSelected(vulnerabilities),
```

- [ ] **Step 6: Update `VulnerabilitiesPresenter.ts` — delegate selection methods**

Replace:

```ts
    public toggleSelected = (id: string): void => {
        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
        } else {
            this.selectedIds.add(id);
        }
    };

    public selectAllOnPage = (): void => {
        const items = this.vm.vulnerabilities;
        const allSelected = items.length > 0 && items.every(v => this.selectedIds.has(v.id));
        if (allSelected) {
            items.forEach(v => this.selectedIds.delete(v.id));
        } else {
            items.forEach(v => this.selectedIds.add(v.id));
        }
    };

    public clearSelection = (): void => {
        this.selectedIds.clear();
    };
```

with:

```ts
    public toggleSelected = (id: string): void => this.selectionManager.toggleSelected(id);

    public selectAllOnPage = (): void =>
        this.selectionManager.selectAllOnPage(this.vm.vulnerabilities);

    public clearSelection = (): void => this.selectionManager.clearSelection();
```

- [ ] **Step 7: Update `VulnerabilitiesPresenter.ts` — bulk action methods (temporary)**

The four bulk action methods (`bulkDismiss`, `bulkSnooze`, `bulkUndismiss`, `bulkRescan`) still reference `this.selectedIds` in this task — update each occurrence of `[...this.selectedIds]` to `this.selectionManager.ids` and each `this.selectedIds.clear()` to `this.selectionManager.clearSelection()`. Example for `bulkDismiss` (apply the same substitution to `bulkSnooze`, `bulkUndismiss`, `bulkRescan`):

```ts
    public bulkDismiss = async (): Promise<void> => {
        this.bulkActionRunning = true;
        try {
            await this.bulkActionUseCase.execute({
                ids: this.selectionManager.ids,
                action: "dismiss"
            });
            runInAction(() => {
                this.selectionManager.clearSelection();
            });
            await this.load();
        } finally {
            runInAction(() => {
                this.bulkActionRunning = false;
            });
        }
    };
```

These four methods move wholesale into `VulnerabilityBulkActions` in Task 3 — this step only keeps them compiling and passing tests in between.

- [ ] **Step 8: Run the full verification pipeline**

Run: `yarn full`
Expected: all checks pass, `VulnerabilitiesPresenter.test.ts` unchanged and green — in particular `toggleSelected adds/removes from selection`, `selectAllOnPage selects all visible vulnerability ids`, `selectAllOnPage deselects when everything is already selected`, and the two "clears selection on ..." tests.

- [ ] **Step 9: Commit**

```bash
git add src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitySelectionManager.ts
git commit -m "refactor: extract VulnerabilitySelectionManager from VulnerabilitiesPresenter"
```

---

## Task 3: Extract `VulnerabilityBulkActions`

**Files:**

- Create: `src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilityBulkActions.ts`
- Modify: `src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts`

**Interfaces:**

- Consumes: `VulnerabilitySelectionManager` from Task 2 (`.ids`, `.clearSelection()`)
- Produces: `IVulnerabilityBulkActionsDependencies { selectionManager: VulnerabilitySelectionManager; bulkActionUseCase: BulkVulnerabilityActionUseCase.Interface; bulkRescanUseCase: BulkRescanVulnerabilitiesUseCase.Interface; reload: () => Promise<void>; }`, `VulnerabilityBulkActions` class with `get isRunning(): boolean`, `bulkDismiss(): Promise<void>`, `bulkSnooze(days: 7 | 30 | 90): Promise<void>`, `bulkUndismiss(): Promise<void>`, `bulkRescan(): Promise<void>`

- [ ] **Step 1: Create `VulnerabilityBulkActions.ts`**

```ts
// src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilityBulkActions.ts
import { makeAutoObservable, runInAction } from "mobx";
import { BulkVulnerabilityActionUseCase } from "../useCases/abstractions/BulkVulnerabilityActionUseCase.js";
import { BulkRescanVulnerabilitiesUseCase } from "../useCases/abstractions/BulkRescanVulnerabilitiesUseCase.js";
import type { VulnerabilitySelectionManager } from "./VulnerabilitySelectionManager.js";

export interface IVulnerabilityBulkActionsDependencies {
  selectionManager: VulnerabilitySelectionManager;
  bulkActionUseCase: BulkVulnerabilityActionUseCase.Interface;
  bulkRescanUseCase: BulkRescanVulnerabilitiesUseCase.Interface;
  reload: () => Promise<void>;
}

export class VulnerabilityBulkActions {
  private running = false;
  private readonly selectionManager: VulnerabilitySelectionManager;
  private readonly bulkActionUseCase: BulkVulnerabilityActionUseCase.Interface;
  private readonly bulkRescanUseCase: BulkRescanVulnerabilitiesUseCase.Interface;
  private readonly reload: () => Promise<void>;

  public constructor(dependencies: IVulnerabilityBulkActionsDependencies) {
    this.selectionManager = dependencies.selectionManager;
    this.bulkActionUseCase = dependencies.bulkActionUseCase;
    this.bulkRescanUseCase = dependencies.bulkRescanUseCase;
    this.reload = dependencies.reload;
    makeAutoObservable(this);
  }

  public get isRunning(): boolean {
    return this.running;
  }

  public bulkDismiss = async (): Promise<void> => {
    this.running = true;
    try {
      await this.bulkActionUseCase.execute({
        ids: this.selectionManager.ids,
        action: "dismiss"
      });
      this.selectionManager.clearSelection();
      await this.reload();
    } finally {
      runInAction(() => {
        this.running = false;
      });
    }
  };

  public bulkSnooze = async (days: 7 | 30 | 90): Promise<void> => {
    this.running = true;
    try {
      await this.bulkActionUseCase.execute({
        ids: this.selectionManager.ids,
        action: "snooze",
        snoozeDays: days
      });
      this.selectionManager.clearSelection();
      await this.reload();
    } finally {
      runInAction(() => {
        this.running = false;
      });
    }
  };

  public bulkUndismiss = async (): Promise<void> => {
    this.running = true;
    try {
      await this.bulkActionUseCase.execute({
        ids: this.selectionManager.ids,
        action: "undismiss"
      });
      this.selectionManager.clearSelection();
      await this.reload();
    } finally {
      runInAction(() => {
        this.running = false;
      });
    }
  };

  public bulkRescan = async (): Promise<void> => {
    this.running = true;
    try {
      await this.bulkRescanUseCase.execute(this.selectionManager.ids);
      this.selectionManager.clearSelection();
      await this.reload();
    } finally {
      runInAction(() => {
        this.running = false;
      });
    }
  };
}
```

Two intentional, behavior-preserving simplifications versus the original:

1. `this.selectionManager.clearSelection()` is called directly (not wrapped in `runInAction`) — `clearSelection()` is itself a MobX action (because `VulnerabilitySelectionManager` calls `makeAutoObservable(this)`), so it already batches its own state change correctly regardless of call site.
2. `runInAction` is still required around `this.running = false` because that is a direct field assignment on `this` happening after an `await`, outside any action's synchronous call stack — dropping it would reproduce the exact staleness bug described in the Global Constraints reactivity note.

- [ ] **Step 2: Update `VulnerabilitiesPresenter.ts` — imports and field**

Add:

```ts
import { VulnerabilityBulkActions } from "./VulnerabilityBulkActions.js";
```

Replace:

```ts
    private bulkActionRunning = false;
```

with:

```ts
    private readonly bulkActions: VulnerabilityBulkActions;
```

- [ ] **Step 3: Update `VulnerabilitiesPresenter.ts` — constructor**

The `bulkActionUseCase` and `bulkRescanUseCase` constructor parameters drop `private readonly` (they are consumed only during construction now). Update the parameter list:

```ts
    public constructor(
        private readonly loadVulnerabilities: LoadVulnerabilitiesUseCase.Interface,
        private readonly repository: VulnerabilitiesRepository.Interface,
        bulkActionUseCase: BulkVulnerabilityActionUseCase.Interface,
        bulkRescanUseCase: BulkRescanVulnerabilitiesUseCase.Interface,
        private readonly exportUseCase: ExportVulnerabilitiesUseCase.Interface,
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly gateway: VulnerabilitiesGateway.Interface,
        private readonly teamFilterService: TeamFilterService.Interface,
        urlFilterService: UrlFilterService.Interface
    ) {
```

And add the instantiation alongside `selectionManager`/`filterManager`:

```ts
this.selectionManager = new VulnerabilitySelectionManager();
this.bulkActions = new VulnerabilityBulkActions({
  selectionManager: this.selectionManager,
  bulkActionUseCase,
  bulkRescanUseCase,
  reload: () => this.load()
});
this.filterManager = new VulnerabilityFilterManager({
  urlFilterService,
  onFilterChange: () => this.selectionManager.clearSelection()
});
```

- [ ] **Step 4: Update `VulnerabilitiesPresenter.ts` — `vm` getter**

Replace:

```ts
            bulkActionRunning: this.bulkActionRunning,
```

with:

```ts
            bulkActionRunning: this.bulkActions.isRunning,
```

- [ ] **Step 5: Update `VulnerabilitiesPresenter.ts` — delegate bulk methods**

Replace the four full method bodies of `bulkDismiss`, `bulkSnooze`, `bulkUndismiss`, `bulkRescan` with:

```ts
    public bulkDismiss = (): Promise<void> => this.bulkActions.bulkDismiss();

    public bulkSnooze = (days: 7 | 30 | 90): Promise<void> => this.bulkActions.bulkSnooze(days);

    public bulkUndismiss = (): Promise<void> => this.bulkActions.bulkUndismiss();

    public bulkRescan = (): Promise<void> => this.bulkActions.bulkRescan();
```

- [ ] **Step 6: Run the full verification pipeline**

Run: `yarn full`
Expected: all checks pass, including the `describe("bulk actions", ...)` block and specifically `sets bulkActionRunning true while a bulk action is in flight` (the reactivity-sensitive test called out in Global Constraints).

- [ ] **Step 7: Commit**

```bash
git add src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilityBulkActions.ts
git commit -m "refactor: extract VulnerabilityBulkActions from VulnerabilitiesPresenter"
```

---

## Task 4: Extract `VulnerabilityExportActions`

**Files:**

- Create: `src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilityExportActions.ts`
- Modify: `src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts`

**Interfaces:**

- Consumes: `VulnerabilitySelectionManager` from Task 2 (`.ids`)
- Produces: `IVulnerabilityExportActionsDependencies { selectionManager: VulnerabilitySelectionManager; exportUseCase: ExportVulnerabilitiesUseCase.Interface; getFilters: () => VulnerabilitiesGateway.ListFilters; getTeamId: () => string | undefined; }`, `VulnerabilityExportActions` class with `exportSelected(format: "csv" | "json"): void`, `exportAll(format: "csv" | "json"): void`

This is the last of the four presenter sub-modules. After this task, `VulnerabilitiesPresenter.ts` should contain only: state fields (`loading`, `error`, `loadSequence`, `groupByProject`, the two dispose functions), the four manager fields, the constructor, `vm`, `load`, thin one-line delegations for every public method, `dispose`, and the two private helpers `checkExpiredSnoozes` and `currentFilters`.

- [ ] **Step 1: Create `VulnerabilityExportActions.ts`**

```ts
// src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilityExportActions.ts
import { ExportVulnerabilitiesUseCase } from "../useCases/abstractions/ExportVulnerabilitiesUseCase.js";
import type { VulnerabilitiesGateway } from "../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";
import type { VulnerabilitySelectionManager } from "./VulnerabilitySelectionManager.js";

export interface IVulnerabilityExportActionsDependencies {
  selectionManager: VulnerabilitySelectionManager;
  exportUseCase: ExportVulnerabilitiesUseCase.Interface;
  getFilters: () => VulnerabilitiesGateway.ListFilters;
  getTeamId: () => string | undefined;
}

export class VulnerabilityExportActions {
  private readonly selectionManager: VulnerabilitySelectionManager;
  private readonly exportUseCase: ExportVulnerabilitiesUseCase.Interface;
  private readonly getFilters: () => VulnerabilitiesGateway.ListFilters;
  private readonly getTeamId: () => string | undefined;

  public constructor(dependencies: IVulnerabilityExportActionsDependencies) {
    this.selectionManager = dependencies.selectionManager;
    this.exportUseCase = dependencies.exportUseCase;
    this.getFilters = dependencies.getFilters;
    this.getTeamId = dependencies.getTeamId;
  }

  public exportSelected(format: "csv" | "json"): void {
    const teamId = this.getTeamId();
    this.exportUseCase.execute({
      filters: this.getFilters(),
      format,
      ids: this.selectionManager.ids,
      ...(teamId ? { teamId } : {})
    });
  }

  public exportAll(format: "csv" | "json"): void {
    const teamId = this.getTeamId();
    this.exportUseCase.execute({
      filters: this.getFilters(),
      format,
      ...(teamId ? { teamId } : {})
    });
  }
}
```

No `makeAutoObservable` needed — this class holds no mutable state.

- [ ] **Step 2: Update `VulnerabilitiesPresenter.ts` — imports and field**

Add:

```ts
import { VulnerabilityExportActions } from "./VulnerabilityExportActions.js";
```

Add a field next to the other three managers:

```ts
    private readonly exportActions: VulnerabilityExportActions;
```

- [ ] **Step 3: Update `VulnerabilitiesPresenter.ts` — constructor**

`exportUseCase` drops `private readonly`:

```ts
    public constructor(
        private readonly loadVulnerabilities: LoadVulnerabilitiesUseCase.Interface,
        private readonly repository: VulnerabilitiesRepository.Interface,
        bulkActionUseCase: BulkVulnerabilityActionUseCase.Interface,
        bulkRescanUseCase: BulkRescanVulnerabilitiesUseCase.Interface,
        exportUseCase: ExportVulnerabilitiesUseCase.Interface,
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly gateway: VulnerabilitiesGateway.Interface,
        private readonly teamFilterService: TeamFilterService.Interface,
        urlFilterService: UrlFilterService.Interface
    ) {
```

Add the instantiation:

```ts
this.exportActions = new VulnerabilityExportActions({
  selectionManager: this.selectionManager,
  exportUseCase,
  getFilters: () => this.currentFilters(),
  getTeamId: () => this.teamFilterService.selectedTeamId ?? undefined
});
```

- [ ] **Step 4: Update `VulnerabilitiesPresenter.ts` — delegate export methods**

Replace:

```ts
    public exportSelected = (format: "csv" | "json"): void => {
        const teamId = this.teamFilterService.selectedTeamId ?? undefined;
        this.exportUseCase.execute({
            filters: this.currentFilters(),
            format,
            ids: [...this.selectedIds],
            ...(teamId ? { teamId } : {})
        });
    };

    public exportAll = (format: "csv" | "json"): void => {
        const teamId = this.teamFilterService.selectedTeamId ?? undefined;
        this.exportUseCase.execute({
            filters: this.currentFilters(),
            format,
            ...(teamId ? { teamId } : {})
        });
    };
```

with:

```ts
    public exportSelected = (format: "csv" | "json"): void =>
        this.exportActions.exportSelected(format);

    public exportAll = (format: "csv" | "json"): void => this.exportActions.exportAll(format);
```

- [ ] **Step 5: Verify final presenter shape**

At this point `VulnerabilitiesPresenter.ts` should have no remaining references to `this.selectedIds`, `this.bulkActionRunning`, `this.urlFilterService`, `this.bulkActionUseCase`, `this.bulkRescanUseCase`, or `this.exportUseCase` as fields — grep to confirm:

```bash
grep -n "this\.selectedIds\|this\.bulkActionRunning\|this\.urlFilterService\|this\.bulkActionUseCase\|this\.bulkRescanUseCase\|this\.exportUseCase" src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts
```

Expected: no output.

- [ ] **Step 6: Run the full verification pipeline**

Run: `yarn full`
Expected: all checks pass, including the `describe("export", ...)` block.

- [ ] **Step 7: Commit**

```bash
git add src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/VulnerabilityExportActions.ts
git commit -m "refactor: extract VulnerabilityExportActions from VulnerabilitiesPresenter"
```

---

## Task 5: Extract `VulnerabilityFilters` component

**Files:**

- Create: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityFilters.tsx`
- Modify: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx`

**Interfaces:**

- Consumes: `VulnerabilitiesPresenter.ViewModel` from `../abstractions/VulnerabilitiesPresenter.js` (unchanged, Task 1–4 did not touch it)
- Produces: `VulnerabilityFiltersProps` interface, `VulnerabilityFilters` component

- [ ] **Step 1: Create `VulnerabilityFilters.tsx`**

```tsx
// src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityFilters.tsx
import type React from "react";
import {
  Group,
  Select,
  TextInput,
  MultiSelect,
  Switch,
  Badge,
  UnstyledButton
} from "@mantine/core";
import type { VulnerabilitiesPresenter } from "../abstractions/VulnerabilitiesPresenter.js";

interface VulnerabilityFiltersProps {
  viewModel: VulnerabilitiesPresenter.ViewModel;
  onSeverityChange: (value: string | null) => void;
  onPackageNameChange: (value: string) => void;
  onSourceChange: (value: string | null) => void;
  onProjectIdsChange: (ids: string[]) => void;
  onIncludeDismissedChange: (value: boolean) => void;
  onGroupByProjectChange: (value: boolean) => void;
  onDependencyTypeChange: (value: "all" | "direct" | "transitive") => void;
  onClearScannedDate: () => void;
}

export function VulnerabilityFilters({
  viewModel,
  onSeverityChange,
  onPackageNameChange,
  onSourceChange,
  onProjectIdsChange,
  onIncludeDismissedChange,
  onGroupByProjectChange,
  onDependencyTypeChange,
  onClearScannedDate
}: VulnerabilityFiltersProps): React.ReactNode {
  return (
    <Group>
      <Select
        placeholder="Severity"
        clearable
        value={viewModel.severity}
        onChange={onSeverityChange}
        data={[
          { value: "critical", label: "Critical" },
          { value: "high", label: "High" },
          { value: "moderate", label: "Moderate" },
          { value: "low", label: "Low" },
          { value: "info", label: "Info" }
        ]}
      />
      <TextInput
        placeholder="Package name"
        value={viewModel.packageName}
        onChange={event => onPackageNameChange(event.currentTarget.value)}
      />
      <Select
        placeholder="Source"
        clearable
        value={viewModel.source}
        onChange={onSourceChange}
        data={[
          { value: "audit", label: "Audit" },
          { value: "osv", label: "OSV" },
          { value: "both", label: "Both" }
        ]}
      />
      <MultiSelect
        placeholder="Projects"
        data={viewModel.availableProjects}
        value={viewModel.projectIds}
        onChange={onProjectIdsChange}
        clearable
        searchable
      />
      <Switch
        label="Show dismissed"
        checked={viewModel.includeDismissed}
        onChange={event => onIncludeDismissedChange(event.currentTarget.checked)}
      />
      <Switch
        label="Group by project"
        checked={viewModel.groupByProject}
        onChange={event => onGroupByProjectChange(event.currentTarget.checked)}
      />
      <Select
        placeholder="Dependency"
        clearable
        value={viewModel.dependencyType === "all" ? null : viewModel.dependencyType}
        onChange={value => onDependencyTypeChange((value as "direct" | "transitive") ?? "all")}
        data={[
          { value: "direct", label: "Direct" },
          { value: "transitive", label: "Transitive" }
        ]}
      />
      {viewModel.scannedDate && (
        <Badge
          variant="filled"
          color="blue"
          rightSection={<UnstyledButton onClick={onClearScannedDate}>✕</UnstyledButton>}
        >
          Date: {viewModel.scannedDate}
        </Badge>
      )}
    </Group>
  );
}
```

- [ ] **Step 2: Update `VulnerabilitiesPage.tsx` — imports**

The `@mantine/core` import currently reads:

```ts
import {
  Stack,
  Title,
  Group,
  Table,
  Badge,
  Text,
  Select,
  MultiSelect,
  Switch,
  Menu,
  Checkbox,
  Button,
  TextInput,
  Pagination,
  Skeleton,
  Anchor,
  UnstyledButton,
  Accordion
} from "@mantine/core";
```

`Select`, `MultiSelect`, `Switch`, `TextInput`, and `UnstyledButton` are used **only** inside the filters block being deleted in Step 3 — after this task nothing else in `VulnerabilitiesPage.tsx` references them, so remove all five names now (leaving them in place would fail `yarn lint` with `--deny-warnings` on unused imports). Change the import to:

```ts
import {
  Stack,
  Title,
  Group,
  Table,
  Badge,
  Text,
  Menu,
  Checkbox,
  Button,
  Pagination,
  Skeleton,
  Anchor,
  Accordion
} from "@mantine/core";
```

`Table`, `Badge`, `Checkbox`, `Anchor`, and `Accordion` stay for now — they are still used by `renderVulnerabilityRow` and the flat-table/accordion blocks inside this file until Task 7 extracts them.

Add:

```ts
import { VulnerabilityFilters } from "./VulnerabilityFilters.js";
```

- [ ] **Step 3: Update `VulnerabilitiesPage.tsx` — replace the filters `<Group>` block**

Replace the entire `<Group>...</Group>` block (originally lines 182–255, immediately after the header `<Group justify="space-between">`) with:

```tsx
<VulnerabilityFilters
  viewModel={vm}
  onSeverityChange={presenter.setSeverity}
  onPackageNameChange={presenter.setPackageName}
  onSourceChange={presenter.setSource}
  onProjectIdsChange={presenter.setProjectIds}
  onIncludeDismissedChange={presenter.setIncludeDismissed}
  onGroupByProjectChange={presenter.setGroupByProject}
  onDependencyTypeChange={presenter.setDependencyType}
  onClearScannedDate={presenter.clearScannedDate}
/>
```

Passing `presenter.setSeverity` etc. directly (instead of wrapping in an inline arrow) is safe here because every presenter method is already an arrow-function class field (bound to `this` at construction), matching how the original page already passed `presenter.setPage` directly to `<Pagination onChange={...}>`.

- [ ] **Step 4: Run the full verification pipeline**

Run: `yarn full`
Expected: build and lint pass (there is no dedicated component test file for the page — `VulnerabilitiesPresenter.test.ts` is unaffected by this task and must still pass).

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityFilters.tsx
git commit -m "refactor: extract VulnerabilityFilters component from VulnerabilitiesPage"
```

---

## Task 6: Extract `VulnerabilityBulkBar` component

**Files:**

- Create: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityBulkBar.tsx`
- Modify: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx`

**Interfaces:**

- Consumes: `VulnerabilitiesPresenter.ViewModel`
- Produces: `VulnerabilityBulkBarProps` interface, `VulnerabilityBulkBar` component (returns `null` when `viewModel.selectedCount === 0`, so the parent can render it unconditionally)

- [ ] **Step 1: Create `VulnerabilityBulkBar.tsx`**

```tsx
// src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityBulkBar.tsx
import type React from "react";
import { Group, Text, Button, Menu } from "@mantine/core";
import type { VulnerabilitiesPresenter } from "../abstractions/VulnerabilitiesPresenter.js";

interface VulnerabilityBulkBarProps {
  viewModel: VulnerabilitiesPresenter.ViewModel;
  onDismissClick: () => void;
  onSnoozeSelect: (days: 7 | 30 | 90) => void;
  onUndismissClick: () => void;
  onRescanClick: () => void;
  onExportSelected: (format: "csv" | "json") => void;
  onClearSelection: () => void;
}

export function VulnerabilityBulkBar({
  viewModel,
  onDismissClick,
  onSnoozeSelect,
  onUndismissClick,
  onRescanClick,
  onExportSelected,
  onClearSelection
}: VulnerabilityBulkBarProps): React.ReactNode {
  if (viewModel.selectedCount === 0) {
    return null;
  }

  return (
    <Group bg="blue.0" p="xs" style={{ borderRadius: 4 }}>
      <Text size="sm" fw={500}>
        {viewModel.selectedCount} selected
      </Text>
      <Button
        size="xs"
        variant="outline"
        loading={viewModel.bulkActionRunning}
        onClick={onDismissClick}
      >
        Dismiss
      </Button>
      <Menu>
        <Menu.Target>
          <Button size="xs" variant="outline" loading={viewModel.bulkActionRunning}>
            Snooze
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => onSnoozeSelect(7)}>7 days</Menu.Item>
          <Menu.Item onClick={() => onSnoozeSelect(30)}>30 days</Menu.Item>
          <Menu.Item onClick={() => onSnoozeSelect(90)}>90 days</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {viewModel.includeDismissed && (
        <Button
          size="xs"
          variant="outline"
          loading={viewModel.bulkActionRunning}
          onClick={onUndismissClick}
        >
          Undismiss
        </Button>
      )}
      <Button
        size="xs"
        variant="outline"
        loading={viewModel.bulkActionRunning}
        onClick={onRescanClick}
      >
        Rescan
      </Button>
      <Menu>
        <Menu.Target>
          <Button size="xs" variant="outline">
            Export Selected
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => onExportSelected("csv")}>CSV</Menu.Item>
          <Menu.Item onClick={() => onExportSelected("json")}>JSON</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Button size="xs" variant="subtle" onClick={onClearSelection}>
        Clear
      </Button>
    </Group>
  );
}
```

- [ ] **Step 2: Update `VulnerabilitiesPage.tsx` — imports**

Add:

```ts
import { VulnerabilityBulkBar } from "./VulnerabilityBulkBar.js";
```

- [ ] **Step 3: Update `VulnerabilitiesPage.tsx` — replace the bulk-actions block**

Replace the `{vm.selectedCount > 0 && (<Group bg="blue.0" ...>...</Group>)}` block (originally lines 257–319) with:

```tsx
<VulnerabilityBulkBar
  viewModel={vm}
  onDismissClick={() => setShowDismissConfirm(true)}
  onSnoozeSelect={setSnoozeConfirm}
  onUndismissClick={() => setShowUndismissConfirm(true)}
  onRescanClick={() => setShowRescanConfirm(true)}
  onExportSelected={presenter.exportSelected}
  onClearSelection={presenter.clearSelection}
/>
```

`onSnoozeSelect={setSnoozeConfirm}` works directly because `setSnoozeConfirm` (the `useState` setter for `snoozeConfirmDays: 7 | 30 | 90 | null`) already accepts exactly `7 | 30 | 90` as an argument — no wrapping needed.

- [ ] **Step 4: Run the full verification pipeline**

Run: `yarn full`

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityBulkBar.tsx
git commit -m "refactor: extract VulnerabilityBulkBar component from VulnerabilitiesPage"
```

---

## Task 7: Extract `VulnerabilityRow`, `VulnerabilityTable`, `VulnerabilityGroupedView`

This is the largest UI task: it moves `SOURCE_COLORS` and `isSafeAdvisoryUrl` to shared utilities, converts the inline `renderVulnerabilityRow` function into a real `VulnerabilityRow` component, and then builds the flat-table and grouped-accordion views on top of it.

**Files:**

- Create: `src/ui/infrastructure/Shared/vulnerabilities/sourceColors.ts`
- Create: `src/ui/infrastructure/Shared/vulnerabilities/isSafeAdvisoryUrl.ts`
- Create: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityRow.tsx`
- Create: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityTable.tsx`
- Create: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityGroupedView.tsx`
- Modify: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx`

**Interfaces:**

- Produces: `SOURCE_COLORS: Record<string, string>`, `isSafeAdvisoryUrl(url: string): boolean`
- Produces: `VulnerabilityRowProps { vulnerability: VulnerabilitiesPresenter.VulnerabilityRow; selected: boolean; onToggleSelected: (id: string) => void; }`, `VulnerabilityRow` component (a `<Table.Tr>`)
- Produces: `VulnerabilityTableProps { vulnerabilities: VulnerabilitiesPresenter.VulnerabilityRow[]; selectedIds: string[]; allOnPageSelected: boolean; selectedCount: number; sortBy: string; sortOrder: string; onToggleSelected: (id: string) => void; onSelectAllOnPage: () => void; onSort: (field: string) => void; }`, `VulnerabilityTable` component
- Produces: `VulnerabilityGroupedViewProps { groups: VulnerabilitiesPresenter.ProjectGroup[]; selectedIds: string[]; allOnPageSelected: boolean; selectedCount: number; expandedGroups: string[]; onExpandedGroupsChange: (values: string[]) => void; onToggleSelected: (id: string) => void; onSelectAllOnPage: () => void; }`, `VulnerabilityGroupedView` component

- [ ] **Step 1: Create the shared `SOURCE_COLORS` utility**

```ts
// src/ui/infrastructure/Shared/vulnerabilities/sourceColors.ts
export const SOURCE_COLORS: Record<string, string> = {
  audit: "blue",
  osv: "violet",
  both: "teal"
};
```

- [ ] **Step 2: Create the shared `isSafeAdvisoryUrl` utility**

```ts
// src/ui/infrastructure/Shared/vulnerabilities/isSafeAdvisoryUrl.ts
export function isSafeAdvisoryUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}
```

These sit alongside the existing `src/ui/infrastructure/Shared/vulnerabilities/severityColors.ts`, following the same convention (one small, focused, plain export per file).

- [ ] **Step 3: Create `VulnerabilityRow.tsx`**

```tsx
// src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityRow.tsx
import type React from "react";
import { Table, Checkbox, Badge, Group, Text, Anchor } from "@mantine/core";
import type { VulnerabilitiesPresenter } from "../abstractions/VulnerabilitiesPresenter.js";
import { SEVERITY_COLORS } from "#ui/infrastructure/Shared/vulnerabilities/severityColors.js";
import { SOURCE_COLORS } from "#ui/infrastructure/Shared/vulnerabilities/sourceColors.js";
import { isSafeAdvisoryUrl } from "#ui/infrastructure/Shared/vulnerabilities/isSafeAdvisoryUrl.js";
import { navigate } from "#ui/infrastructure/Router/router.js";

interface VulnerabilityRowProps {
  vulnerability: VulnerabilitiesPresenter.VulnerabilityRow;
  selected: boolean;
  onToggleSelected: (id: string) => void;
}

export function VulnerabilityRow({
  vulnerability,
  selected,
  onToggleSelected
}: VulnerabilityRowProps): React.ReactNode {
  return (
    <Table.Tr opacity={vulnerability.isDismissed ? 0.5 : 1}>
      <Table.Td>
        <Checkbox checked={selected} onChange={() => onToggleSelected(vulnerability.id)} />
      </Table.Td>
      <Table.Td>
        <Badge color={SEVERITY_COLORS[vulnerability.severity]}>{vulnerability.severity}</Badge>
      </Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <Text size="sm">{vulnerability.packageName}</Text>
          {vulnerability.dependencyKind === "transitive" && (
            <Badge size="xs" variant="light" color="gray">
              transitive
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td>{vulnerability.installedVersion ?? "—"}</Table.Td>
      <Table.Td>
        <Anchor
          component="button"
          size="sm"
          onClick={() => navigate(`/Projects/${vulnerability.projectId}`)}
        >
          {vulnerability.projectName}
        </Anchor>
      </Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <Anchor
            component="button"
            size="sm"
            onClick={() => navigate(`/vulnerabilities/${vulnerability.id}`)}
            style={{ maxWidth: 300 }}
            truncate
          >
            {vulnerability.title}
          </Anchor>
          {vulnerability.dismissLabel && (
            <Badge size="xs" color="gray">
              {vulnerability.dismissLabel}
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        {vulnerability.cveId &&
        vulnerability.advisoryUrl &&
        isSafeAdvisoryUrl(vulnerability.advisoryUrl) ? (
          <Anchor href={vulnerability.advisoryUrl} target="_blank" size="sm">
            {vulnerability.cveId}
          </Anchor>
        ) : (
          (vulnerability.cveId ?? "—")
        )}
      </Table.Td>
      <Table.Td>{vulnerability.fixVersion ?? "—"}</Table.Td>
      <Table.Td>
        <Badge color={SOURCE_COLORS[vulnerability.source] ?? "gray"} variant="light">
          {vulnerability.source}
        </Badge>
      </Table.Td>
    </Table.Tr>
  );
}
```

Note the `key={vulnerability.id}` from the original `<Table.Tr key={...}>` is **not** set inside `VulnerabilityRow` itself — React keys must be set by the parent that renders the list (`VulnerabilityTable`/`VulnerabilityGroupedView` in the next steps), not by the component being mapped. This is a correctness fix versus copy-pasting the original inline function as-is.

- [ ] **Step 4: Create `VulnerabilityTable.tsx`**

```tsx
// src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityTable.tsx
import type React from "react";
import { Table, Checkbox } from "@mantine/core";
import type { VulnerabilitiesPresenter } from "../abstractions/VulnerabilitiesPresenter.js";
import { SortableHeader } from "#ui/infrastructure/Shared/components/SortableHeader.js";
import { VulnerabilityRow } from "./VulnerabilityRow.js";

interface VulnerabilityTableProps {
  vulnerabilities: VulnerabilitiesPresenter.VulnerabilityRow[];
  selectedIds: string[];
  allOnPageSelected: boolean;
  selectedCount: number;
  sortBy: string;
  sortOrder: string;
  onToggleSelected: (id: string) => void;
  onSelectAllOnPage: () => void;
  onSort: (field: string) => void;
}

export function VulnerabilityTable({
  vulnerabilities,
  selectedIds,
  allOnPageSelected,
  selectedCount,
  sortBy,
  sortOrder,
  onToggleSelected,
  onSelectAllOnPage,
  onSort
}: VulnerabilityTableProps): React.ReactNode {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>
            <Checkbox
              checked={allOnPageSelected}
              indeterminate={selectedCount > 0 && !allOnPageSelected}
              onChange={onSelectAllOnPage}
            />
          </Table.Th>
          <Table.Th>
            <SortableHeader
              label="Severity"
              sortKey="severity"
              currentSortBy={sortBy}
              currentSortOrder={sortOrder}
              onSort={onSort}
            />
          </Table.Th>
          <Table.Th>
            <SortableHeader
              label="Package"
              sortKey="packageName"
              currentSortBy={sortBy}
              currentSortOrder={sortOrder}
              onSort={onSort}
            />
          </Table.Th>
          <Table.Th>Version</Table.Th>
          <Table.Th>
            <SortableHeader
              label="Project"
              sortKey="projectName"
              currentSortBy={sortBy}
              currentSortOrder={sortOrder}
              onSort={onSort}
            />
          </Table.Th>
          <Table.Th>Title</Table.Th>
          <Table.Th>CVE</Table.Th>
          <Table.Th>Fix</Table.Th>
          <Table.Th>Source</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {vulnerabilities.map(vulnerability => (
          <VulnerabilityRow
            key={vulnerability.id}
            vulnerability={vulnerability}
            selected={selectedIds.includes(vulnerability.id)}
            onToggleSelected={onToggleSelected}
          />
        ))}
      </Table.Tbody>
    </Table>
  );
}
```

- [ ] **Step 5: Create `VulnerabilityGroupedView.tsx`**

```tsx
// src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityGroupedView.tsx
import type React from "react";
import { Accordion, Group, Text, Badge, Table, Checkbox } from "@mantine/core";
import type { VulnerabilitiesPresenter } from "../abstractions/VulnerabilitiesPresenter.js";
import { VulnerabilityRow } from "./VulnerabilityRow.js";

interface VulnerabilityGroupedViewProps {
  groups: VulnerabilitiesPresenter.ProjectGroup[];
  selectedIds: string[];
  allOnPageSelected: boolean;
  selectedCount: number;
  expandedGroups: string[];
  onExpandedGroupsChange: (values: string[]) => void;
  onToggleSelected: (id: string) => void;
  onSelectAllOnPage: () => void;
}

export function VulnerabilityGroupedView({
  groups,
  selectedIds,
  allOnPageSelected,
  selectedCount,
  expandedGroups,
  onExpandedGroupsChange,
  onToggleSelected,
  onSelectAllOnPage
}: VulnerabilityGroupedViewProps): React.ReactNode {
  return (
    <Accordion multiple value={expandedGroups} onChange={onExpandedGroupsChange}>
      {groups.map(group => (
        <Accordion.Item key={group.projectId} value={group.projectId}>
          <Accordion.Control>
            <Group gap="sm">
              <Text fw={600}>{group.projectName}</Text>
              <Text size="sm" c="dimmed">
                ({group.vulnerabilities.length})
              </Text>
              {group.counts.critical > 0 && (
                <Badge color="red" size="sm">
                  {group.counts.critical} critical
                </Badge>
              )}
              {group.counts.high > 0 && (
                <Badge color="orange" size="sm">
                  {group.counts.high} high
                </Badge>
              )}
              {group.counts.moderate > 0 && (
                <Badge color="yellow" size="sm">
                  {group.counts.moderate} moderate
                </Badge>
              )}
              {group.counts.low > 0 && (
                <Badge color="blue" size="sm">
                  {group.counts.low} low
                </Badge>
              )}
              {group.counts.info > 0 && (
                <Badge color="gray" size="sm">
                  {group.counts.info} info
                </Badge>
              )}
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    <Checkbox
                      checked={allOnPageSelected}
                      indeterminate={selectedCount > 0 && !allOnPageSelected}
                      onChange={onSelectAllOnPage}
                    />
                  </Table.Th>
                  <Table.Th>Severity</Table.Th>
                  <Table.Th>Package</Table.Th>
                  <Table.Th>Version</Table.Th>
                  <Table.Th>Project</Table.Th>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>CVE</Table.Th>
                  <Table.Th>Fix</Table.Th>
                  <Table.Th>Source</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {group.vulnerabilities.map(vulnerability => (
                  <VulnerabilityRow
                    key={vulnerability.id}
                    vulnerability={vulnerability}
                    selected={selectedIds.includes(vulnerability.id)}
                    onToggleSelected={onToggleSelected}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
```

Note: `allOnPageSelected`/`selectedCount` are the same page-level values passed identically to every group's "select all" checkbox — this reproduces the original file's existing behavior (lines 363–369 in the original used the same `vm.allOnPageSelected`/`vm.selectedCount` inside the `.map(group => ...)` loop for every group). This is a pre-existing quirk, not something this refactor changes — do not "fix" it, that would be scope creep beyond what the spec asked for.

- [ ] **Step 6: Update `VulnerabilitiesPage.tsx` — imports**

After Task 5, the `@mantine/core` import in this file reads:

```ts
import {
  Stack,
  Title,
  Group,
  Table,
  Badge,
  Text,
  Menu,
  Checkbox,
  Button,
  Pagination,
  Skeleton,
  Anchor,
  Accordion
} from "@mantine/core";
```

`Table`, `Badge`, `Checkbox`, `Anchor`, and `Accordion` were only used by `renderVulnerabilityRow` and the flat-table/accordion blocks — all of that is moving into `VulnerabilityRow`/`VulnerabilityTable`/`VulnerabilityGroupedView` in this task, so none of the five remain referenced anywhere else in the page. Remove all five, leaving:

```ts
import { Stack, Title, Group, Text, Menu, Button, Pagination, Skeleton } from "@mantine/core";
```

Also remove these three imports, which move into `VulnerabilityRow.tsx` (Step 3) and `VulnerabilityTable.tsx` (Step 4):

```ts
import { SEVERITY_COLORS } from "#ui/infrastructure/Shared/vulnerabilities/severityColors.js";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { SortableHeader } from "#ui/infrastructure/Shared/components/SortableHeader.js";
```

Add:

```ts
import { VulnerabilityTable } from "./VulnerabilityTable.js";
import { VulnerabilityGroupedView } from "./VulnerabilityGroupedView.js";
```

Delete the module-level `SOURCE_COLORS` constant and `isSafeAdvisoryUrl` function from the top of `VulnerabilitiesPage.tsx` entirely — they now live in `#ui/infrastructure/Shared/vulnerabilities/`.

- [ ] **Step 7: Update `VulnerabilitiesPage.tsx` — delete `renderVulnerabilityRow`**

Delete the entire `function renderVulnerabilityRow(...) {...}` function (originally lines 90–163) from inside the component body.

- [ ] **Step 8: Update `VulnerabilitiesPage.tsx` — replace the conditional table/accordion block**

Replace the whole `{vm.groupByProject ? (<Accordion ...>...</Accordion>) : (<Table ...>...</Table>)}` block (originally lines 321–437) with:

```tsx
{
  vm.groupByProject ? (
    <VulnerabilityGroupedView
      groups={vm.groupedVulnerabilities}
      selectedIds={vm.selectedIds}
      allOnPageSelected={vm.allOnPageSelected}
      selectedCount={vm.selectedCount}
      expandedGroups={expandedGroups}
      onExpandedGroupsChange={setExpandedGroups}
      onToggleSelected={presenter.toggleSelected}
      onSelectAllOnPage={presenter.selectAllOnPage}
    />
  ) : (
    <VulnerabilityTable
      vulnerabilities={vm.vulnerabilities}
      selectedIds={vm.selectedIds}
      allOnPageSelected={vm.allOnPageSelected}
      selectedCount={vm.selectedCount}
      sortBy={vm.sortBy}
      sortOrder={vm.sortOrder}
      onToggleSelected={presenter.toggleSelected}
      onSelectAllOnPage={presenter.selectAllOnPage}
      onSort={presenter.setSortBy}
    />
  );
}
```

- [ ] **Step 9: Run the full verification pipeline**

Run: `yarn full`
Expected: `yarn lint:fix`/`yarn format:fix` will flag and can auto-remove any now-unused imports left over in `VulnerabilitiesPage.tsx`; re-run until clean, then confirm the full pipeline (including `VulnerabilitiesPresenter.test.ts`) is green.

- [ ] **Step 10: Commit**

```bash
git add src/ui/infrastructure/Shared/vulnerabilities/sourceColors.ts \
        src/ui/infrastructure/Shared/vulnerabilities/isSafeAdvisoryUrl.ts \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityRow.tsx \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityTable.tsx \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityGroupedView.tsx \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx
git commit -m "refactor: extract VulnerabilityRow/Table/GroupedView, move SOURCE_COLORS and isSafeAdvisoryUrl to shared"
```

---

## Task 8: Extract `VulnerabilityConfirmDialogs` + final cleanup

**Files:**

- Create: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityConfirmDialogs.tsx`
- Modify: `src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx`

**Interfaces:**

- Produces: `VulnerabilityConfirmDialogsProps` interface, `VulnerabilityConfirmDialogs` component (renders the 4 `ConfirmDialog`s)

By the end of this task `VulnerabilitiesPage.tsx` should be roughly 80–120 lines and contain only: the two `useState`/`useEffect` blocks for dialog state and data loading, the loading/error early returns, the header with the Export menu, and the five extracted components wired together.

- [ ] **Step 1: Create `VulnerabilityConfirmDialogs.tsx`**

```tsx
// src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityConfirmDialogs.tsx
import type React from "react";
import { ConfirmDialog } from "#ui/infrastructure/Shared/components/ConfirmDialog.js";

interface VulnerabilityConfirmDialogsProps {
  selectedCount: number;
  showDismissConfirm: boolean;
  onConfirmDismiss: () => void;
  onCancelDismiss: () => void;
  snoozeConfirmDays: 7 | 30 | 90 | null;
  onConfirmSnooze: () => void;
  onCancelSnooze: () => void;
  showRescanConfirm: boolean;
  onConfirmRescan: () => void;
  onCancelRescan: () => void;
  showUndismissConfirm: boolean;
  onConfirmUndismiss: () => void;
  onCancelUndismiss: () => void;
}

export function VulnerabilityConfirmDialogs({
  selectedCount,
  showDismissConfirm,
  onConfirmDismiss,
  onCancelDismiss,
  snoozeConfirmDays,
  onConfirmSnooze,
  onCancelSnooze,
  showRescanConfirm,
  onConfirmRescan,
  onCancelRescan,
  showUndismissConfirm,
  onConfirmUndismiss,
  onCancelUndismiss
}: VulnerabilityConfirmDialogsProps): React.ReactNode {
  return (
    <>
      <ConfirmDialog
        opened={showDismissConfirm}
        title="Dismiss Vulnerabilities"
        message={`Dismiss ${selectedCount} selected vulnerabilities? They will be hidden from the default view.`}
        confirmLabel="Dismiss"
        onConfirm={onConfirmDismiss}
        onCancel={onCancelDismiss}
      />
      <ConfirmDialog
        opened={snoozeConfirmDays !== null}
        title="Snooze Vulnerabilities"
        message={`Snooze ${selectedCount} vulnerabilities for ${snoozeConfirmDays} days?`}
        confirmLabel="Snooze"
        onConfirm={onConfirmSnooze}
        onCancel={onCancelSnooze}
      />
      <ConfirmDialog
        opened={showRescanConfirm}
        title="Rescan Projects"
        message={`Trigger vulnerability rescan for projects associated with ${selectedCount} selected vulnerabilities?`}
        confirmLabel="Rescan"
        onConfirm={onConfirmRescan}
        onCancel={onCancelRescan}
      />
      <ConfirmDialog
        opened={showUndismissConfirm}
        title="Undismiss Vulnerabilities"
        message={`Undismiss ${selectedCount} selected vulnerabilities?`}
        confirmLabel="Undismiss"
        onConfirm={onConfirmUndismiss}
        onCancel={onCancelUndismiss}
      />
    </>
  );
}
```

The four `onConfirm*` callbacks take no arguments — the caller (`VulnerabilitiesPage`) already owns `snoozeConfirmDays` in its own state, so it closes over that value when building the callback rather than passing it back down and up again.

- [ ] **Step 2: Update `VulnerabilitiesPage.tsx` — imports**

Remove:

```ts
import { ConfirmDialog } from "#ui/infrastructure/Shared/components/ConfirmDialog.js";
```

Add:

```ts
import { VulnerabilityConfirmDialogs } from "./VulnerabilityConfirmDialogs.js";
```

- [ ] **Step 3: Update `VulnerabilitiesPage.tsx` — replace the four `<ConfirmDialog>` blocks**

Replace the four `<ConfirmDialog .../>` elements (originally lines 447–493) with:

```tsx
<VulnerabilityConfirmDialogs
  selectedCount={vm.selectedCount}
  showDismissConfirm={showDismissConfirm}
  onConfirmDismiss={() => {
    setShowDismissConfirm(false);
    void presenter.bulkDismiss();
  }}
  onCancelDismiss={() => setShowDismissConfirm(false)}
  snoozeConfirmDays={snoozeConfirmDays}
  onConfirmSnooze={() => {
    const days = snoozeConfirmDays;
    setSnoozeConfirm(null);
    if (days !== null) {
      void presenter.bulkSnooze(days);
    }
  }}
  onCancelSnooze={() => setSnoozeConfirm(null)}
  showRescanConfirm={showRescanConfirm}
  onConfirmRescan={() => {
    setShowRescanConfirm(false);
    void presenter.bulkRescan();
  }}
  onCancelRescan={() => setShowRescanConfirm(false)}
  showUndismissConfirm={showUndismissConfirm}
  onConfirmUndismiss={() => {
    setShowUndismissConfirm(false);
    void presenter.bulkUndismiss();
  }}
  onCancelUndismiss={() => setShowUndismissConfirm(false)}
/>
```

- [ ] **Step 4: Verify the final `VulnerabilitiesPage.tsx` shape**

Read through the file top to bottom and confirm it now contains, in order: imports; the `VulnerabilitiesPageProps` interface; the `VulnerabilitiesPage` component with its 5 `useState` hooks (`showDismissConfirm`, `snoozeConfirmDays`, `showRescanConfirm`, `showUndismissConfirm`, `expandedGroups`) and 2 `useEffect` hooks (load/dispose, auto-expand groups); the loading/error early returns; and the final render tree: header `Group` with title + Export `Menu`, `<VulnerabilityFilters>`, `<VulnerabilityBulkBar>`, the `vm.groupByProject` ternary rendering `<VulnerabilityGroupedView>`/`<VulnerabilityTable>`, the `vm.totalPages > 1` `<Pagination>`, and `<VulnerabilityConfirmDialogs>`. No inline row-rendering, filter-rendering, or dialog-rendering logic should remain — every remaining piece of JSX in this file should be either layout structure or a call to one of the five new components.

Run:

```bash
wc -l src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx
```

Expected: roughly 80–120 lines (per the design spec's target). If it's noticeably larger, check for leftover dead imports or duplicated JSX that should have been deleted in Task 5–7.

- [ ] **Step 5: Run the full verification pipeline**

Run: `yarn full`
Expected: lint, format, build, and all tests pass — including the full `VulnerabilitiesPresenter.test.ts` suite, unchanged since before Task 1.

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx \
        src/ui/presentation/Vulnerabilities/VulnerabilityList/components/VulnerabilityConfirmDialogs.tsx
git commit -m "refactor: extract VulnerabilityConfirmDialogs, finish VulnerabilitiesPage decomposition"
```

---

## Post-refactor verification checklist

After Task 8's commit, do one final pass:

- [ ] `git diff main -- src/ui/presentation/Vulnerabilities/VulnerabilityList/__tests__/VulnerabilitiesPresenter.test.ts` shows no changes — the public presenter contract was preserved exactly as required.
- [ ] `src/ui/presentation/Vulnerabilities/VulnerabilityList/feature.ts` needed no changes — it only imports `VulnerabilitiesPresenter` (the DI-registered compositor) and `VulnerabilitiesPresenter as VulnerabilitiesPresenterAbstraction`, neither of which changed shape or name. Confirm with `git diff main -- src/ui/presentation/Vulnerabilities/VulnerabilityList/feature.ts` (expect no output).
- [ ] `src/ui/presentation/Vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts` is untouched — `git diff main -- src/ui/presentation/Vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts` (expect no output).
- [ ] Final `yarn full` run from a clean working tree passes end to end.
