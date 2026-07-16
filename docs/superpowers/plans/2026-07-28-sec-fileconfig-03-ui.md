# Security File Config Part 3: UI — Config Error and File-Managed Security Settings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend AppSettings and SecuritySettings UI layers to display config validation errors and read-only state for file-managed security settings.

**Architecture:** Gateway passes through `configError`. Repository stores it. Presenter exposes it in VM. Pages show warning banners and disable editing for file-managed content.

**Tech Stack:** MobX, React (`observer`), existing DI abstractions

## Global Constraints

- Gateway: `HTTPClient.request(route, args)` typed calls
- Repository: plain in-memory state
- Presenter: MobX `makeAutoObservable`, `vm` computed, arrow methods
- React: dumb display, `observer()` wrapped, reads `presenter.vm` only
- UI tests: mock `HTTPClient` at DI level, real everything else
- All interfaces in `abstractions/` directory
- `yarn test` / `yarn lint` / `yarn typecheck` must pass after each task

---

### Task 8: AppSettings UI — configError support

**Files:**

- Modify: `src/ui/features/appSettings/abstractions/AppSettingsGateway.ts`
- Modify: `src/ui/features/appSettings/AppSettingsGateway.ts`
- Modify: `src/ui/features/appSettings/abstractions/AppSettingsRepository.ts`
- Modify: `src/ui/features/appSettings/AppSettingsRepository.ts`
- Modify: `src/ui/presentation/settings/appSettingsUseCases/LoadAppSettingsUseCase.ts`
- Modify: `src/ui/presentation/settings/AppSettings/abstractions/AppSettingsPresenter.ts`
- Modify: `src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts`
- Test: `src/ui/presentation/settings/AppSettings/__tests__/AppSettingsPresenter.test.ts`

**Interfaces:**

- Consumes: updated `listAppSettingsRoute` response schema (configSource now includes "error", has configError)
- Produces: `configError` exposed in `IAppSettingsViewModel`

- [ ] **Step 1: Write failing test — presenter exposes configError**

In `src/ui/presentation/settings/AppSettings/__tests__/AppSettingsPresenter.test.ts`, update the repository mock to include `configError` methods:

```typescript
let storedConfigError: { type: string; message: string } | null;

// In createPresenter, add to repository mock:
container.registerInstance(AppSettingsRepository, {
  getSettings: () => storedSettings,
  setSettings: (settings: AppSettingsGateway.AppSetting[]) => {
    storedSettings = settings;
  },
  upsertSetting: (setting: AppSettingsGateway.AppSetting) => {
    const idx = storedSettings.findIndex(s => s.key === setting.key);
    if (idx >= 0) {
      storedSettings[idx] = setting;
    } else {
      storedSettings.push(setting);
    }
  },
  getConfigSource: () => "db" as const,
  setConfigSource: () => {},
  getFileManaged: () => [],
  setFileManaged: () => {},
  getConfigError: () => storedConfigError,
  setConfigError: (error: { type: string; message: string } | null) => {
    storedConfigError = error;
  }
});
```

Add `beforeEach`:

```typescript
storedConfigError = null;
```

Add test:

```typescript
it("vm.configError is null when no error stored", () => {
  const presenter = createPresenter();
  expect(presenter.vm.configError).toBeNull();
});

it("vm.configError exposes stored error", () => {
  storedConfigError = { type: "json", message: "Unexpected token" };
  const presenter = createPresenter();
  expect(presenter.vm.configError).toEqual({ type: "json", message: "Unexpected token" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/ui/presentation/settings/AppSettings/__tests__/AppSettingsPresenter.test.ts`
Expected: FAIL — `configError` not on VM type

- [ ] **Step 3: Add `IConfigError` and update gateway abstraction**

In `src/ui/features/appSettings/abstractions/AppSettingsGateway.ts`:

```typescript
export interface IConfigError {
  type: string;
  message: string;
}

export interface IAppSettingsListResult {
  settings: IAppSetting[];
  configSource: "db" | "file" | "error";
  fileManaged: string[];
  configError?: IConfigError;
}
```

Update namespace:

```typescript
export namespace AppSettingsGateway {
  export type Interface = IAppSettingsGateway;
  export type AppSetting = IAppSetting;
  export type ListResult = IAppSettingsListResult;
  export type ConfigError = IConfigError;
}
```

- [ ] **Step 4: Update gateway implementation**

In `src/ui/features/appSettings/AppSettingsGateway.ts`, update `list()`:

```typescript
public async list(): Promise<Abstraction.ListResult> {
    const response = await this.httpClient.request(listAppSettingsRoute, {
        params: {},
        query: {}
    });
    return {
        settings: response.items,
        configSource: response.configSource,
        fileManaged: response.fileManaged,
        configError: response.configError
    };
}
```

- [ ] **Step 5: Update repository abstraction**

In `src/ui/features/appSettings/abstractions/AppSettingsRepository.ts`:

Update `configSource` type to include "error":

```typescript
getConfigSource(): "db" | "file" | "error";
setConfigSource(source: "db" | "file" | "error"): void;
```

Add config error methods:

```typescript
getConfigError(): AppSettingsGateway.ConfigError | null;
setConfigError(error: AppSettingsGateway.ConfigError | null): void;
```

- [ ] **Step 6: Update repository implementation**

In `src/ui/features/appSettings/AppSettingsRepository.ts`:

Update `configSource` type:

```typescript
private configSource: "db" | "file" | "error" = "db";
```

Add config error storage:

```typescript
private configError: Abstraction.ConfigError | null = null;

public getConfigError(): Abstraction.ConfigError | null {
    return this.configError;
}

public setConfigError(error: Abstraction.ConfigError | null): void {
    this.configError = error;
}
```

Note: need to import/reference the `ConfigError` type — use `AppSettingsGateway.ConfigError` through the repository abstraction's import. The repository abstraction should import the type. Check existing pattern — if repository abstraction already imports from gateway abstraction (it does — it imports `SecuritySettingsGateway` in the security case), add a similar import.

Actually, simpler approach: define `IConfigError` in the repository abstraction file or re-export from gateway. Follow existing pattern — in `AppSettingsRepository` abstraction, it doesn't currently import from gateway. Add the type inline:

```typescript
export interface IConfigError {
  type: string;
  message: string;
}
```

Or import from gateway abstraction:

```typescript
import type { IConfigError } from "./AppSettingsGateway.js";
```

Follow the simpler path — import from gateway abstraction.

- [ ] **Step 7: Update LoadAppSettingsUseCase**

In `src/ui/presentation/settings/appSettingsUseCases/LoadAppSettingsUseCase.ts`:

```typescript
public execute = async (): Promise<void> => {
    const result = await this.gateway.list();
    this.repository.setSettings(result.settings);
    this.repository.setConfigSource(result.configSource);
    this.repository.setFileManaged(result.fileManaged);
    this.repository.setConfigError(result.configError ?? null);
};
```

- [ ] **Step 8: Update presenter abstraction**

In `src/ui/presentation/settings/AppSettings/abstractions/AppSettingsPresenter.ts`:

Import or define `IConfigError`:

```typescript
import type { IConfigError } from "../../../../features/appSettings/abstractions/AppSettingsGateway.js";
```

Update VM:

```typescript
export interface IAppSettingsViewModel {
  loading: boolean;
  error: string | null;
  settings: IAppSettingViewModel[];
  editingKey: string | null;
  configSource: "db" | "file" | "error";
  fileManaged: string[];
  configError: IConfigError | null;
}
```

- [ ] **Step 9: Update presenter implementation**

In `src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts`, add `configError` to `vm`:

```typescript
return {
  loading: this.loading,
  error: this.error,
  settings,
  editingKey: this.editingKey,
  configSource: this.repository.getConfigSource(),
  fileManaged: this.repository.getFileManaged(),
  configError: this.repository.getConfigError()
};
```

- [ ] **Step 10: Run all tests**

Run: `yarn vitest run`
Expected: all pass

- [ ] **Step 11: Commit**

```bash
git add src/ui/features/appSettings/abstractions/AppSettingsGateway.ts src/ui/features/appSettings/AppSettingsGateway.ts src/ui/features/appSettings/abstractions/AppSettingsRepository.ts src/ui/features/appSettings/AppSettingsRepository.ts src/ui/presentation/settings/appSettingsUseCases/LoadAppSettingsUseCase.ts src/ui/presentation/settings/AppSettings/abstractions/AppSettingsPresenter.ts src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts src/ui/presentation/settings/AppSettings/__tests__/AppSettingsPresenter.test.ts
git commit -m "feat: add configError support to AppSettings UI layers"
```

---

### Task 9: SecuritySettings UI — file config awareness

**Files:**

- Modify: `src/ui/features/settings/abstractions/SecuritySettingsGateway.ts`
- Modify: `src/ui/features/settings/SecuritySettingsGateway.ts`
- Modify: `src/ui/features/settings/abstractions/SecuritySettingsRepository.ts`
- Modify: `src/ui/features/settings/SecuritySettingsRepository.ts`
- Modify: `src/ui/presentation/settings/useCases/LoadSecuritySettingsUseCase.ts`
- Modify: `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts`
- Modify: `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts`
- Test: `src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts`

**Interfaces:**

- Consumes: updated `listSecuritySettingsRoute` response schema (configSource, fileManagedPms, configError)
- Produces: `configSource`, `fileManagedPms`, `configError` exposed in `ISecuritySettingsViewModel`; per-setting `isFileManaged` computed

- [ ] **Step 1: Write failing tests**

In `src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts`:

Update the mock `request` handler for `listSecuritySettingsRoute` to return new fields:

```typescript
let listConfigSource: "db" | "file" | "error";
let listFileManagedPms: string[];
let listConfigError: { type: string; message: string } | undefined;

beforeEach(() => {
  // ... existing resets ...
  listConfigSource = "db";
  listFileManagedPms = [];
  listConfigError = undefined;
});
```

Update the switch case:

```typescript
case listSecuritySettingsRoute:
    return {
        items: listResult,
        total: listResult.length,
        configSource: listConfigSource,
        fileManagedPms: listFileManagedPms,
        configError: listConfigError
    } as T;
```

Add tests:

```typescript
it("vm exposes configSource and fileManagedPms from gateway", async () => {
  listConfigSource = "file";
  listFileManagedPms = ["pnpm"];
  listResult = [
    {
      id: "1",
      packageManager: "pnpm",
      configFile: "pnpm-workspace.yaml",
      fieldName: "ignoreScripts",
      expectedValue: "true",
      enabled: true
    }
  ];

  const presenter = createPresenter();
  await presenter.load();

  expect(presenter.vm.configSource).toBe("file");
  expect(presenter.vm.fileManagedPms).toEqual(["pnpm"]);
});

it("vm exposes configError when present", async () => {
  listConfigSource = "error";
  listConfigError = { type: "json", message: "Unexpected token" };

  const presenter = createPresenter();
  await presenter.load();

  expect(presenter.vm.configError).toEqual({ type: "json", message: "Unexpected token" });
});

it("vm.settings marks isFileManaged when PM is in fileManagedPms", async () => {
  listConfigSource = "file";
  listFileManagedPms = ["pnpm"];
  listResult = [
    {
      id: "1",
      packageManager: "pnpm",
      configFile: "pnpm-workspace.yaml",
      fieldName: "ignoreScripts",
      expectedValue: "true",
      enabled: true
    }
  ];

  const presenter = createPresenter();
  presenter.selectPackageManager("pnpm");
  await presenter.load();

  expect(presenter.vm.settings[0]!.isFileManaged).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts`
Expected: FAIL — new fields don't exist

- [ ] **Step 3: Update gateway abstraction**

In `src/ui/features/settings/abstractions/SecuritySettingsGateway.ts`:

```typescript
export interface IConfigError {
  type: string;
  message: string;
}

export interface ISecuritySettingsListResult {
  settings: ISecuritySetting[];
  configSource: "db" | "file" | "error";
  fileManagedPms: string[];
  configError?: IConfigError;
}

export interface ISecuritySettingsGateway {
  list(): Promise<ISecuritySettingsListResult>;
  // ... rest unchanged
}
```

Update namespace:

```typescript
export namespace SecuritySettingsGateway {
  export type Interface = ISecuritySettingsGateway;
  export type SecuritySetting = ISecuritySetting;
  export type ListResult = ISecuritySettingsListResult;
  export type ConfigError = IConfigError;
}
```

- [ ] **Step 4: Update gateway implementation**

In `src/ui/features/settings/SecuritySettingsGateway.ts`, update `list()`:

```typescript
public async list(): Promise<Abstraction.ListResult> {
    const response = await this.httpClient.request(listSecuritySettingsRoute, { params: {} });
    return {
        settings: response.items,
        configSource: response.configSource,
        fileManagedPms: response.fileManagedPms,
        configError: response.configError
    };
}
```

- [ ] **Step 5: Update repository abstraction**

In `src/ui/features/settings/abstractions/SecuritySettingsRepository.ts`:

Import `IConfigError`:

```typescript
import type { IConfigError } from "./SecuritySettingsGateway.js";
```

Add methods:

```typescript
export interface ISecuritySettingsRepository {
  // ... existing methods ...
  getConfigSource(): "db" | "file" | "error";
  setConfigSource(source: "db" | "file" | "error"): void;
  getFileManagedPms(): string[];
  setFileManagedPms(pms: string[]): void;
  getConfigError(): IConfigError | null;
  setConfigError(error: IConfigError | null): void;
}
```

- [ ] **Step 6: Update repository implementation**

In `src/ui/features/settings/SecuritySettingsRepository.ts`:

```typescript
private configSource: "db" | "file" | "error" = "db";
private fileManagedPms: string[] = [];
private configError: Abstraction.ConfigError | null = null;

public getConfigSource(): "db" | "file" | "error" {
    return this.configSource;
}

public setConfigSource(source: "db" | "file" | "error"): void {
    this.configSource = source;
}

public getFileManagedPms(): string[] {
    return this.fileManagedPms;
}

public setFileManagedPms(pms: string[]): void {
    this.fileManagedPms = pms;
}

public getConfigError(): Abstraction.ConfigError | null {
    return this.configError;
}

public setConfigError(error: Abstraction.ConfigError | null): void {
    this.configError = error;
}
```

- [ ] **Step 7: Update LoadSecuritySettingsUseCase**

In `src/ui/presentation/settings/useCases/LoadSecuritySettingsUseCase.ts`:

```typescript
public execute = async (): Promise<void> => {
    const result = await this.gateway.list();
    this.repository.setSettings(result.settings);
    this.repository.setConfigSource(result.configSource);
    this.repository.setFileManagedPms(result.fileManagedPms);
    this.repository.setConfigError(result.configError ?? null);
};
```

- [ ] **Step 8: Update presenter abstraction**

In `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts`:

Import `IConfigError`:

```typescript
import type { IConfigError } from "../../../../features/settings/abstractions/SecuritySettingsGateway.js";
```

Add `isFileManaged` to setting VM:

```typescript
export interface ISecuritySettingViewModel {
  // ... existing fields ...
  isFileManaged: boolean;
}
```

Add new fields to main VM:

```typescript
export interface ISecuritySettingsViewModel {
  // ... existing fields ...
  configSource: "db" | "file" | "error";
  fileManagedPms: string[];
  configError: IConfigError | null;
}
```

- [ ] **Step 9: Update presenter implementation**

In `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts`:

Update setting view model mapping to include `isFileManaged`:

```typescript
const fileManagedPms = this.repository.getFileManagedPms();

const viewSettings: Abstraction.SettingViewModel[] = pmSettings.map(s => {
  const def = registry.find(f => f.fieldName === s.fieldName);
  return {
    id: s.id,
    fieldName: s.fieldName,
    configFile: s.configFile,
    description: def?.description ?? s.fieldName,
    expectedValue: s.expectedValue,
    enabled: s.enabled,
    isOrphaned: !def,
    helperText: def?.helperText ?? "",
    inputType: def?.inputType ?? "duration",
    isFileManaged: fileManagedPms.includes(s.packageManager)
  };
});
```

Add to returned VM:

```typescript
return {
  // ... existing fields ...
  configSource: this.repository.getConfigSource(),
  fileManagedPms,
  configError: this.repository.getConfigError()
};
```

- [ ] **Step 10: Run all tests**

Run: `yarn vitest run`
Expected: all pass

- [ ] **Step 11: Commit**

```bash
git add src/ui/features/settings/abstractions/SecuritySettingsGateway.ts src/ui/features/settings/SecuritySettingsGateway.ts src/ui/features/settings/abstractions/SecuritySettingsRepository.ts src/ui/features/settings/SecuritySettingsRepository.ts src/ui/presentation/settings/useCases/LoadSecuritySettingsUseCase.ts src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts
git commit -m "feat: add file config awareness to SecuritySettings UI layers"
```

---

### Task 10: UI pages — warning banners and read-only state

**Files:**

- Modify: `src/ui/presentation/settings/AppSettings/components/AppSettingsPage.tsx`
- Modify: `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx`
- Test: manual browser testing (no automated component tests for pages)

**Interfaces:**

- Consumes: `presenter.vm.configError`, `presenter.vm.configSource`, `presenter.vm.fileManagedPms`, `setting.isFileManaged`
- Produces: visual warning banner, disabled controls for file-managed content

- [ ] **Step 1: Read existing page components**

Read both page files to understand current structure before modifying:

- `src/ui/presentation/settings/AppSettings/components/AppSettingsPage.tsx`
- `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx`

- [ ] **Step 2: Add warning banner to AppSettingsPage**

When `vm.configError` is present, show a yellow warning banner at the top of the settings list:

```tsx
{
  vm.configError && (
    <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 mb-4">
      <p className="text-sm text-yellow-800">
        <strong>Config file error:</strong> {vm.configError.message}
      </p>
      <p className="text-xs text-yellow-600 mt-1">
        Showing database values. Fix the config file to restore file-based settings.
      </p>
    </div>
  );
}
```

Follow existing Tailwind class patterns used in the page. Check what CSS framework/utility classes the project uses.

- [ ] **Step 3: Add warning banner and read-only state to SecuritySettingsPage**

When `vm.configError` is present, show same yellow warning banner.

When a PM is file-managed (`vm.fileManagedPms.includes(vm.selectedPackageManager)`):

- Show read-only info banner (blue, same pattern as AppSettings):

```tsx
{
  vm.fileManagedPms.includes(vm.selectedPackageManager) && (
    <div className="rounded-md bg-blue-50 border border-blue-200 p-3 mb-4">
      <p className="text-sm text-blue-800">
        Security settings for {vm.selectedPackageManager} are managed by{" "}
        <code className="font-mono">.dependency-upgrader.json</code>. Edit the file to change these
        values.
      </p>
    </div>
  );
}
```

- Disable edit, toggle, add, and reset buttons/controls
- Pass `disabled` or `readOnly` prop to relevant interactive elements

The exact implementation depends on the existing page structure — adapt to match.

- [ ] **Step 4: Run typecheck and lint**

Run: `yarn typecheck && yarn lint`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/settings/AppSettings/components/AppSettingsPage.tsx src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx
git commit -m "feat: add config error warning banners and read-only state for file-managed settings"
```

- [ ] **Step 6: Manual testing**

Start dev server and verify:

1. No config file: both pages show DB values, editable
2. Valid config with settings: AppSettings shows file-managed keys read-only
3. Valid config with securitySettings for pnpm: SecuritySettings shows pnpm read-only, yarn editable
4. Invalid config file (bad JSON): both pages show yellow warning, DB values editable
5. Invalid config file (bad schema): same as above with schema error message
