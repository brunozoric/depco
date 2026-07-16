# File Config Extension — Part 3: UI (AppSettings Page + UpgradeWizard Templates)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AppSettings page shows read-only banner for file-managed keys. UpgradeWizard reads templates from file config (via AppSettings API which now returns file-merged values).

**Architecture:** AppSettingsGateway `list()` response gains `configSource` and `fileManaged`. Repository stores these. Presenter exposes them in VM. Page component shows banner + disables edit on file-managed keys. UpgradeWizardPresenter already reads templates from AppSettingsGateway — the merged response from Part 2 means templates automatically reflect file config with no wizard changes needed.

**Tech Stack:** React 19, Mantine UI, MobX, TypeScript, Vitest

## Global Constraints

- Yarn 4, oxlint, oxfmt
- Named interfaces only
- DI abstractions in `abstractions/`, one file per token
- Work directly on main

---

### Task 1: AppSettings Gateway/Repository — configSource and fileManaged

**Files:**

- Modify: `src/ui/features/appSettings/abstractions/AppSettingsGateway.ts:1-17`
- Modify: `src/ui/features/appSettings/AppSettingsGateway.ts:1-28`
- Modify: `src/ui/features/appSettings/abstractions/AppSettingsRepository.ts:1-17`
- Modify: `src/ui/features/appSettings/AppSettingsRepository.ts` (add configSource/fileManaged storage)
- Modify: `src/ui/presentation/settings/appSettingsUseCases/LoadAppSettingsUseCase.ts:1-20`

**Interfaces:**

- Consumes: API `GET /api/settings/app` now returns `{ items, total, configSource, fileManaged }` (from Part 2)
- Produces: `AppSettingsGateway.list()` returns `IAppSettingsListResult { settings, configSource, fileManaged }`. `AppSettingsRepository` stores/returns `configSource` and `fileManaged`.

- [ ] **Step 1: Update AppSettingsGateway abstraction**

In `src/ui/features/appSettings/abstractions/AppSettingsGateway.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IAppSetting {
  key: string;
  value: string;
}

export interface IAppSettingsListResult {
  settings: IAppSetting[];
  configSource: "db" | "file";
  fileManaged: string[];
}

export interface IAppSettingsGateway {
  list(): Promise<IAppSettingsListResult>;
  upsert(key: string, value: string): Promise<IAppSetting>;
}

export const AppSettingsGateway = createAbstraction<IAppSettingsGateway>("Ui/AppSettingsGateway");

export namespace AppSettingsGateway {
  export type Interface = IAppSettingsGateway;
  export type AppSetting = IAppSetting;
  export type ListResult = IAppSettingsListResult;
}
```

- [ ] **Step 2: Update AppSettingsGateway implementation**

In `src/ui/features/appSettings/AppSettingsGateway.ts` (the shared route schema was already extended in Part 2 to include `configSource` and `fileManaged`, so these fields are typed and available):

```typescript
public async list(): Promise<Abstraction.ListResult> {
    const response = await this.httpClient.request(listAppSettingsRoute, {
        params: {},
        query: {}
    });
    return {
        settings: response.items,
        configSource: response.configSource,
        fileManaged: response.fileManaged
    };
}
```

- [ ] **Step 3: Update AppSettingsRepository abstraction**

In `src/ui/features/appSettings/abstractions/AppSettingsRepository.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import { AppSettingsGateway } from "./AppSettingsGateway.js";

export interface IAppSettingsRepository {
  getSettings(): AppSettingsGateway.AppSetting[];
  setSettings(settings: AppSettingsGateway.AppSetting[]): void;
  upsertSetting(setting: AppSettingsGateway.AppSetting): void;
  getConfigSource(): "db" | "file";
  setConfigSource(source: "db" | "file"): void;
  getFileManaged(): string[];
  setFileManaged(keys: string[]): void;
}

export const AppSettingsRepository = createAbstraction<IAppSettingsRepository>(
  "Ui/AppSettingsRepository"
);

export namespace AppSettingsRepository {
  export type Interface = IAppSettingsRepository;
  export type AppSetting = AppSettingsGateway.AppSetting;
}
```

- [ ] **Step 4: Update AppSettingsRepository implementation**

Add `configSource` and `fileManaged` fields with get/set methods to the implementation class.

- [ ] **Step 5: Update LoadAppSettingsUseCase**

In `src/ui/presentation/settings/appSettingsUseCases/LoadAppSettingsUseCase.ts`:

```typescript
public execute = async (): Promise<void> => {
    const result = await this.gateway.list();
    this.repository.setSettings(result.settings);
    this.repository.setConfigSource(result.configSource);
    this.repository.setFileManaged(result.fileManaged);
};
```

- [ ] **Step 6: Run tests**

Run: `yarn test`
Expected: All pass (existing tests may need minor updates for the new `list()` return shape).

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/appSettings/
git add src/ui/presentation/settings/appSettingsUseCases/LoadAppSettingsUseCase.ts
git commit -m "feat: AppSettings gateway/repository carry configSource and fileManaged"
```

### Task 2: AppSettings Presenter + Page — read-only banner

**Files:**

- Modify: `src/ui/presentation/settings/AppSettings/abstractions/AppSettingsPresenter.ts:1-38`
- Modify: `src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts:1-127`
- Modify: `src/ui/presentation/settings/AppSettings/components/AppSettingsPage.tsx:1-165`

**Interfaces:**

- Consumes: `AppSettingsRepository.getConfigSource()`, `AppSettingsRepository.getFileManaged()` (from Task 1)
- Produces: VM gains `configSource: "db" | "file"` and `fileManaged: string[]`. Page renders banner and disables edit for file-managed keys.

- [ ] **Step 1: Update AppSettingsPresenter abstraction VM**

In `src/ui/presentation/settings/AppSettings/abstractions/AppSettingsPresenter.ts`, add to `IAppSettingsViewModel`:

```typescript
export interface IAppSettingsViewModel {
  loading: boolean;
  error: string | null;
  settings: IAppSettingViewModel[];
  editingKey: string | null;
  configSource: "db" | "file";
  fileManaged: string[];
}
```

- [ ] **Step 2: Update AppSettingsPresenter implementation**

In `src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts`, read from repository in `vm` getter:

```typescript
public get vm(): Abstraction.ViewModel {
    // ... existing settings logic ...

    return {
        loading: this.loading,
        error: this.error,
        settings,
        editingKey: this.editingKey,
        configSource: this.repository.getConfigSource(),
        fileManaged: this.repository.getFileManaged()
    };
}
```

- [ ] **Step 3: Update AppSettingsPage — banner and disabled edit**

In `src/ui/presentation/settings/AppSettings/components/AppSettingsPage.tsx`:

Add banner after the description text:

```tsx
{
  vm.configSource === "file" && (
    <Alert color="yellow" title="File Config Active">
      Some settings managed by .dependency-upgrader.json
    </Alert>
  );
}
```

In the table row, disable edit button for file-managed keys:

```tsx
<Table.Td>
  {vm.editingKey !== setting.key && !vm.fileManaged.includes(setting.key) && (
    <ActionIcon
      variant="subtle"
      size="sm"
      onClick={() => handleStartEdit(setting.key, setting.value)}
    >
      &#9998;
    </ActionIcon>
  )}
</Table.Td>
```

- [ ] **Step 4: Run full pipeline**

Run: `yarn full`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/settings/AppSettings/
git commit -m "feat: AppSettings page read-only banner for file-managed keys"
```
