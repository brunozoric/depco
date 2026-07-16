# Security Settings — Plan 5: Presenter & Tests

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the SecuritySettingsPresenter with MobX observability and comprehensive test coverage.

**Architecture:** MobX presenter with computed `vm`, enriches DB rows with descriptions from `SECURITY_FIELD_REGISTRY`. Tests mock HTTPClient at DI level following existing presenter test patterns.

**Tech Stack:** TypeScript, MobX, Vitest, `@webiny/di`

## Global Constraints

- Presenter: `makeAutoObservable(this, { vm: computed })`, arrow method properties
- Tests: mock HTTPClient at DI level, never `new XxxImpl()`
- `selectedPackageManager` defaults to `"yarn"`
- `editingId` and `addingField` are mutually exclusive
- Error cleared on mutations and PM switch, not on cancel
- Run `yarn build` after each task

---

### Task 18: SecuritySettingsPresenter abstraction

**Files:**

- Create: `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts`

**Interfaces:**

- Consumes: `createAbstraction` from `#shared/index.js`, `PackageManagerId` from `#shared/security/index.js`
- Produces: `SecuritySettingsPresenter` with full VM and method types

- [ ] **Step 1: Create presenter abstraction**

```ts
// src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts
import { createAbstraction } from "#shared/index.js";
import type { PackageManagerId } from "#shared/security/index.js";

export interface ISecuritySettingViewModel {
  id: string;
  fieldName: string;
  configFile: string;
  description: string;
  expectedValue: string;
}

export interface IAvailableFieldViewModel {
  fieldName: string;
  configFile: string;
  description: string;
  defaultExpectedValue: string;
}

export interface ISecuritySettingsViewModel {
  loading: boolean;
  error: string | null;
  selectedPackageManager: PackageManagerId;
  settings: ISecuritySettingViewModel[];
  availableFields: IAvailableFieldViewModel[];
  editingId: string | null;
  addingField: string | null;
}

export interface ISecuritySettingsPresenter {
  get vm(): ISecuritySettingsViewModel;
  load: () => Promise<void>;
  selectPackageManager: (pm: PackageManagerId) => void;
  startAdd: (fieldName: string) => void;
  confirmAdd: (expectedValue: string) => Promise<void>;
  cancelAdd: () => void;
  startEdit: (id: string) => void;
  confirmEdit: (expectedValue: string) => Promise<void>;
  cancelEdit: () => void;
  remove: (id: string) => Promise<void>;
}

export const SecuritySettingsPresenter = createAbstraction<ISecuritySettingsPresenter>(
  "Ui/SecuritySettingsPresenter"
);

export namespace SecuritySettingsPresenter {
  export type Interface = ISecuritySettingsPresenter;
  export type ViewModel = ISecuritySettingsViewModel;
  export type SettingViewModel = ISecuritySettingViewModel;
  export type AvailableFieldViewModel = IAvailableFieldViewModel;
}
```

- [ ] **Step 2: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 3: Commit**

```bash
git add src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts
git commit -m "feat: add SecuritySettingsPresenter abstraction"
```

---

### Task 19: SecuritySettingsPresenter implementation

**Files:**

- Create: `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts`

**Interfaces:**

- Consumes: `SecuritySettingsPresenter` abstraction, all 4 use case abstractions, `SecuritySettingsRepository`, `SECURITY_FIELD_REGISTRY`
- Produces: `SecuritySettingsPresenter` implementation

- [ ] **Step 1: Create presenter implementation**

```ts
// src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts
import { computed, makeAutoObservable, runInAction } from "mobx";
import { SecuritySettingsPresenter as Abstraction } from "./abstractions/SecuritySettingsPresenter.js";
import { LoadSecuritySettingsUseCase } from "../useCases/abstractions/LoadSecuritySettingsUseCase.js";
import { CreateSecuritySettingUseCase } from "../useCases/abstractions/CreateSecuritySettingUseCase.js";
import { UpdateSecuritySettingUseCase } from "../useCases/abstractions/UpdateSecuritySettingUseCase.js";
import { RemoveSecuritySettingUseCase } from "../useCases/abstractions/RemoveSecuritySettingUseCase.js";
import { SecuritySettingsRepository } from "../../../features/settings/abstractions/SecuritySettingsRepository.js";
import { SECURITY_FIELD_REGISTRY, type PackageManagerId } from "#shared/security/index.js";

class SecuritySettingsPresenterImpl implements Abstraction.Interface {
  private loading = false;
  private error: string | null = null;
  private selectedPm: PackageManagerId = "yarn";
  private editingId: string | null = null;
  private addingField: string | null = null;

  public constructor(
    private readonly loadUseCase: LoadSecuritySettingsUseCase.Interface,
    private readonly createUseCase: CreateSecuritySettingUseCase.Interface,
    private readonly updateUseCase: UpdateSecuritySettingUseCase.Interface,
    private readonly removeUseCase: RemoveSecuritySettingUseCase.Interface,
    private readonly repository: SecuritySettingsRepository.Interface
  ) {
    makeAutoObservable(this, { vm: computed });
  }

  public get vm(): Abstraction.ViewModel {
    const allSettings = this.repository.getSettings();
    const pmSettings = allSettings.filter(s => s.packageManager === this.selectedPm);
    const registry = SECURITY_FIELD_REGISTRY[this.selectedPm];
    const usedFields = new Set(pmSettings.map(s => s.fieldName));

    const settings: Abstraction.SettingViewModel[] = pmSettings.map(s => {
      const def = registry.find(f => f.fieldName === s.fieldName);
      return {
        id: s.id,
        fieldName: s.fieldName,
        configFile: s.configFile,
        description: def?.description ?? s.fieldName,
        expectedValue: s.expectedValue
      };
    });

    const availableFields: Abstraction.AvailableFieldViewModel[] = registry
      .filter(f => !usedFields.has(f.fieldName))
      .map(f => ({
        fieldName: f.fieldName,
        configFile: f.configFile,
        description: f.description,
        defaultExpectedValue: f.defaultExpectedValue
      }));

    return {
      loading: this.loading,
      error: this.error,
      selectedPackageManager: this.selectedPm,
      settings,
      availableFields,
      editingId: this.editingId,
      addingField: this.addingField
    };
  }

  public load = async (): Promise<void> => {
    this.loading = true;
    try {
      await this.loadUseCase.execute();
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  };

  public selectPackageManager = (pm: PackageManagerId): void => {
    this.selectedPm = pm;
    this.editingId = null;
    this.addingField = null;
    this.error = null;
  };

  public startAdd = (fieldName: string): void => {
    this.editingId = null;
    this.addingField = fieldName;
  };

  public confirmAdd = async (expectedValue: string): Promise<void> => {
    if (!this.addingField) {
      return;
    }

    this.error = null;
    const fieldName = this.addingField;

    try {
      await this.createUseCase.execute(this.selectedPm, fieldName, expectedValue);
      runInAction(() => {
        this.addingField = null;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Failed to create setting";
      });
    }
  };

  public cancelAdd = (): void => {
    this.addingField = null;
  };

  public startEdit = (id: string): void => {
    this.addingField = null;
    this.editingId = id;
  };

  public confirmEdit = async (expectedValue: string): Promise<void> => {
    if (!this.editingId) {
      return;
    }

    this.error = null;
    const id = this.editingId;

    try {
      await this.updateUseCase.execute(id, expectedValue);
      runInAction(() => {
        this.editingId = null;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Failed to update setting";
      });
    }
  };

  public cancelEdit = (): void => {
    this.editingId = null;
  };

  public remove = async (id: string): Promise<void> => {
    this.error = null;
    try {
      await this.removeUseCase.execute(id);
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Failed to remove setting";
      });
    }
  };
}

export const SecuritySettingsPresenter = Abstraction.createImplementation({
  implementation: SecuritySettingsPresenterImpl,
  dependencies: [
    LoadSecuritySettingsUseCase,
    CreateSecuritySettingUseCase,
    UpdateSecuritySettingUseCase,
    RemoveSecuritySettingUseCase,
    SecuritySettingsRepository
  ]
});
```

- [ ] **Step 2: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 3: Commit**

```bash
git add src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts
git commit -m "feat: add SecuritySettingsPresenter implementation"
```

---

### Task 20: SecuritySettingsPresenter tests

**Files:**

- Create: `src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts`

**Interfaces:**

- Consumes: all abstractions, `HTTPClient` mock, `SecuritySettingsFeature`, `SecuritySettingsUseCasesFeature`
- Produces: test suite covering load, PM switch, add, edit, remove, error handling, available fields

- [ ] **Step 1: Create test file**

Follow the pattern from `src/ui/presentation/projects/ProjectDetail/__tests__/ProjectDetailPresenter.test.ts`. Mock HTTPClient at DI level with recorded calls.

```ts
// src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import {
  listSecuritySettingsRoute,
  createSecuritySettingRoute,
  updateSecuritySettingRoute,
  deleteSecuritySettingRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "../../../../httpClient/feature.js";
import { SecuritySettingsFeature } from "../../../../features/settings/feature.js";
import { SecuritySettingsUseCasesFeature } from "../../useCases/feature.js";
import { SecuritySettingsPresenter } from "../abstractions/SecuritySettingsPresenter.js";
import { SecuritySettingsPresenter as SecuritySettingsPresenterRegistration } from "../SecuritySettingsPresenter.js";

interface RecordedCall {
  route: unknown;
  args: unknown;
}

async function flushMicrotasks(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("SecuritySettingsPresenter", () => {
  let calls: RecordedCall[];
  let listResult: unknown[];
  let createResult: unknown;
  let updateResult: unknown;

  function createPresenter(): SecuritySettingsPresenter.Interface {
    const container: Container = createContainer();

    HTTPClientFeature.register(container);
    container.registerInstance(HTTPClient, {
      request: async <T>(route: unknown, args: unknown): Promise<T> => {
        calls.push({ route, args });
        switch (route) {
          case listSecuritySettingsRoute:
            return { items: listResult, total: listResult.length } as T;
          case createSecuritySettingRoute:
            return { item: createResult } as T;
          case updateSecuritySettingRoute:
            return { item: updateResult } as T;
          case deleteSecuritySettingRoute:
            return {} as T;
          default:
            throw new Error(`Unexpected route ${JSON.stringify(route)}`);
        }
      }
    });

    SecuritySettingsFeature.register(container);
    SecuritySettingsUseCasesFeature.register(container);
    container.register(SecuritySettingsPresenterRegistration);

    return container.resolve(SecuritySettingsPresenter);
  }

  beforeEach(() => {
    calls = [];
    listResult = [];
    createResult = {};
    updateResult = {};
  });

  it("starts with default idle view model", () => {
    const presenter = createPresenter();

    expect(presenter.vm.loading).toBe(false);
    expect(presenter.vm.error).toBeNull();
    expect(presenter.vm.selectedPackageManager).toBe("yarn");
    expect(presenter.vm.settings).toEqual([]);
    expect(presenter.vm.editingId).toBeNull();
    expect(presenter.vm.addingField).toBeNull();
  });

  it("shows available yarn fields when no settings exist", () => {
    const presenter = createPresenter();

    expect(presenter.vm.availableFields).toHaveLength(4);
    expect(presenter.vm.availableFields.map(f => f.fieldName)).toEqual([
      "npmPreapprovedPackages",
      "npmMinimalAgeGate",
      "enableScripts",
      "approvedGitRepositories"
    ]);
  });

  it("loads settings and updates vm", async () => {
    listResult = [
      {
        id: "s1",
        packageManager: "yarn",
        configFile: ".yarnrc.yml",
        fieldName: "enableScripts",
        expectedValue: "false"
      }
    ];

    const presenter = createPresenter();
    await presenter.load();

    expect(presenter.vm.settings).toHaveLength(1);
    expect(presenter.vm.settings[0]?.fieldName).toBe("enableScripts");
    expect(presenter.vm.settings[0]?.description).toBe(
      "Whether lifecycle scripts are allowed to run during install"
    );
    expect(presenter.vm.availableFields).toHaveLength(3);
  });

  it("filters settings by selected PM", async () => {
    listResult = [
      {
        id: "s1",
        packageManager: "yarn",
        configFile: ".yarnrc.yml",
        fieldName: "enableScripts",
        expectedValue: "false"
      }
    ];

    const presenter = createPresenter();
    await presenter.load();

    expect(presenter.vm.settings).toHaveLength(1);

    presenter.selectPackageManager("npm");

    expect(presenter.vm.settings).toHaveLength(0);
    expect(presenter.vm.availableFields).toHaveLength(0);
  });

  it("selectPackageManager clears editingId, addingField, and error", () => {
    const presenter = createPresenter();
    presenter.startAdd("enableScripts");
    expect(presenter.vm.addingField).toBe("enableScripts");

    presenter.selectPackageManager("npm");

    expect(presenter.vm.addingField).toBeNull();
    expect(presenter.vm.editingId).toBeNull();
    expect(presenter.vm.error).toBeNull();
  });

  it("startAdd sets addingField and clears editingId", () => {
    const presenter = createPresenter();
    presenter.startEdit("s1");
    presenter.startAdd("enableScripts");

    expect(presenter.vm.addingField).toBe("enableScripts");
    expect(presenter.vm.editingId).toBeNull();
  });

  it("startEdit sets editingId and clears addingField", () => {
    const presenter = createPresenter();
    presenter.startAdd("enableScripts");
    presenter.startEdit("s1");

    expect(presenter.vm.editingId).toBe("s1");
    expect(presenter.vm.addingField).toBeNull();
  });

  it("confirmAdd creates a setting and clears addingField", async () => {
    createResult = {
      id: "new-1",
      packageManager: "yarn",
      configFile: ".yarnrc.yml",
      fieldName: "enableScripts",
      expectedValue: "false"
    };

    const presenter = createPresenter();
    presenter.startAdd("enableScripts");
    await presenter.confirmAdd("false");

    expect(presenter.vm.addingField).toBeNull();
    expect(presenter.vm.settings).toHaveLength(1);
    expect(presenter.vm.settings[0]?.id).toBe("new-1");
    expect(calls.some(c => c.route === createSecuritySettingRoute)).toBe(true);
  });

  it("confirmEdit updates a setting and clears editingId", async () => {
    listResult = [
      {
        id: "s1",
        packageManager: "yarn",
        configFile: ".yarnrc.yml",
        fieldName: "enableScripts",
        expectedValue: "false"
      }
    ];
    updateResult = {
      id: "s1",
      packageManager: "yarn",
      configFile: ".yarnrc.yml",
      fieldName: "enableScripts",
      expectedValue: "true"
    };

    const presenter = createPresenter();
    await presenter.load();
    calls = [];

    presenter.startEdit("s1");
    await presenter.confirmEdit("true");

    expect(presenter.vm.editingId).toBeNull();
    expect(presenter.vm.settings[0]?.expectedValue).toBe("true");
    expect(calls.some(c => c.route === updateSecuritySettingRoute)).toBe(true);
  });

  it("remove deletes a setting", async () => {
    listResult = [
      {
        id: "s1",
        packageManager: "yarn",
        configFile: ".yarnrc.yml",
        fieldName: "enableScripts",
        expectedValue: "false"
      }
    ];

    const presenter = createPresenter();
    await presenter.load();
    calls = [];

    await presenter.remove("s1");

    expect(presenter.vm.settings).toHaveLength(0);
    expect(calls.some(c => c.route === deleteSecuritySettingRoute)).toBe(true);
  });

  it("sets error on failed confirmAdd", async () => {
    const container: Container = createContainer();
    HTTPClientFeature.register(container);
    container.registerInstance(HTTPClient, {
      request: async <T>(route: unknown): Promise<T> => {
        if (route === createSecuritySettingRoute) {
          throw new Error("Server error");
        }
        if (route === listSecuritySettingsRoute) {
          return { items: [], total: 0 } as T;
        }
        return {} as T;
      }
    });
    SecuritySettingsFeature.register(container);
    SecuritySettingsUseCasesFeature.register(container);
    container.register(SecuritySettingsPresenterRegistration);
    const failPresenter = container.resolve(SecuritySettingsPresenter);

    failPresenter.startAdd("enableScripts");
    await failPresenter.confirmAdd("false");

    expect(failPresenter.vm.error).toBe("Server error");
    expect(failPresenter.vm.addingField).toBe("enableScripts");
  });

  it("cancelAdd clears addingField but not error", () => {
    const presenter = createPresenter();
    presenter.startAdd("enableScripts");
    presenter.cancelAdd();

    expect(presenter.vm.addingField).toBeNull();
  });

  it("cancelEdit clears editingId but not error", () => {
    const presenter = createPresenter();
    presenter.startEdit("s1");
    presenter.cancelEdit();

    expect(presenter.vm.editingId).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `yarn test src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts`
Expected: all tests pass

- [ ] **Step 3: Run full pipeline**

Run: `yarn full`
Expected: all green

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts
git commit -m "test: add SecuritySettingsPresenter tests"
```
