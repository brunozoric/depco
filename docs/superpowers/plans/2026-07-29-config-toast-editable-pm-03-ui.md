# Editable PM Settings — UI Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable UI controls for install flags (Switch toggles), registry URL (TextInput), and upgrade strategy (Select dropdown) in the PM Settings page, with confirmation dialog before writing to `.dependency-upgrader.json`.

**Architecture:** New `SavePmConfigUseCase` calls gateway, which hits `PUT /api/settings/pm/:pm`. Presenter gets edit methods + confirmation dialog state. Page component renders interactive controls + Mantine Modal for confirmation.

**Tech Stack:** React, Mantine (Switch, TextInput, Select, Modal), MobX, `@webiny/di`

## Global Constraints

- All types must use named interfaces, never inline structural types
- This project uses yarn, not npm
- Work directly on main, no feature branches or git worktrees
- Depends on Plan 02 (write API) being complete

---

### Task 1: Gateway + Use Case for saving PM config

**Files:**

- Modify: `src/ui/features/settings/abstractions/PmSettingsGateway.ts`
- Modify: `src/ui/features/settings/PmSettingsGateway.ts`
- Create: `src/ui/presentation/settings/useCases/abstractions/SavePmConfigUseCase.ts`
- Create: `src/ui/presentation/settings/useCases/SavePmConfigUseCase.ts`
- Modify: `src/ui/presentation/settings/useCases/feature.ts`

**Interfaces:**

- Consumes: `HTTPClient.Interface` (existing — `request()`)
- Consumes: `updatePmConfigRoute` from `#shared/routes/index.js` (from Plan 02)
- Consumes: `PmSettingsRepository.Interface` (existing — `setPmConfigs()`)
- Produces: `IPmSettingsGateway.updatePmConfig(pm: string, settings: IUpdatePmConfigBody): Promise<IPmConfigItem>` — added to gateway
- Produces: `ISavePmConfigUseCase.execute(pm: string, settings: IUpdatePmConfigBody): Promise<void>` — new use case

- [ ] **Step 1: Add IUpdatePmConfigBody interface and updatePmConfig to gateway abstraction**

In `src/ui/features/settings/abstractions/PmSettingsGateway.ts`, add interface:

```ts
export interface IUpdatePmConfigBody {
  installFlags?: { [flag: string]: boolean };
  registryUrl?: string;
  upgradeStrategy?: "caret" | "tilde" | "exact" | "latest";
}
```

Add to `IPmSettingsGateway`:

```ts
updatePmConfig(pm: string, settings: IUpdatePmConfigBody): Promise<IPmConfigItem>;
```

Add to namespace:

```ts
export type UpdatePmConfigBody = IUpdatePmConfigBody;
```

- [ ] **Step 2: Implement updatePmConfig in gateway**

In `src/ui/features/settings/PmSettingsGateway.ts`, add import for `updatePmConfigRoute`:

```ts
import {
  listSecuritySettingsRoute,
  createSecuritySettingRoute,
  updateSecuritySettingRoute,
  toggleSecuritySettingRoute,
  resetSecuritySettingsRoute,
  listPmSettingsRoute,
  updatePmConfigRoute
} from "#shared/routes/index.js";
```

Add method to `PmSettingsGatewayImpl`:

```ts
public async updatePmConfig(
    pm: string,
    settings: Abstraction.UpdatePmConfigBody
): Promise<Abstraction.PmConfigItem> {
    const response = await this.httpClient.request(updatePmConfigRoute, {
        params: { pm: pm as "yarn" | "npm" | "pnpm" | "bun" },
        body: settings
    });
    return response.item;
}
```

- [ ] **Step 3: Create SavePmConfigUseCase abstraction**

Create `src/ui/presentation/settings/useCases/abstractions/SavePmConfigUseCase.ts`:

```ts
import { createAbstraction } from "#shared/index.js";
import type { PmSettingsGateway } from "../../../../features/settings/abstractions/PmSettingsGateway.js";

export interface ISavePmConfigUseCase {
  execute(pm: string, settings: PmSettingsGateway.UpdatePmConfigBody): Promise<void>;
}

export const SavePmConfigUseCase =
  createAbstraction<ISavePmConfigUseCase>("Ui/SavePmConfigUseCase");

export namespace SavePmConfigUseCase {
  export type Interface = ISavePmConfigUseCase;
}
```

- [ ] **Step 4: Create SavePmConfigUseCase implementation**

Create `src/ui/presentation/settings/useCases/SavePmConfigUseCase.ts`:

```ts
import { SavePmConfigUseCase as Abstraction } from "./abstractions/SavePmConfigUseCase.js";
import { PmSettingsGateway } from "../../../features/settings/abstractions/PmSettingsGateway.js";
import { PmSettingsRepository } from "../../../features/settings/abstractions/PmSettingsRepository.js";

class SavePmConfigUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: PmSettingsGateway.Interface,
    private readonly repository: PmSettingsRepository.Interface
  ) {}

  public execute = async (
    pm: string,
    settings: PmSettingsGateway.UpdatePmConfigBody
  ): Promise<void> => {
    const updatedItem = await this.gateway.updatePmConfig(pm, settings);
    const currentConfigs = this.repository.getPmConfigs();
    const updatedConfigs = currentConfigs.map(config =>
      config.packageManager === pm ? updatedItem : config
    );
    this.repository.setPmConfigs(updatedConfigs);
  };
}

export const SavePmConfigUseCase = Abstraction.createImplementation({
  implementation: SavePmConfigUseCaseImpl,
  dependencies: [PmSettingsGateway, PmSettingsRepository]
});
```

- [ ] **Step 5: Register SavePmConfigUseCase in feature**

In `src/ui/presentation/settings/useCases/feature.ts`, add import and registration:

```ts
import { SavePmConfigUseCase } from "./SavePmConfigUseCase.js";
```

Inside `register(container)`:

```ts
container.register(SavePmConfigUseCase);
```

- [ ] **Step 6: Run lint + typecheck**

Run: `yarn lint && yarn build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/settings/abstractions/PmSettingsGateway.ts src/ui/features/settings/PmSettingsGateway.ts src/ui/presentation/settings/useCases/abstractions/SavePmConfigUseCase.ts src/ui/presentation/settings/useCases/SavePmConfigUseCase.ts src/ui/presentation/settings/useCases/feature.ts
git commit -m "feat: add SavePmConfigUseCase and gateway updatePmConfig method"
```

---

### Task 2: Presenter edit methods + confirmation dialog state

**Files:**

- Modify: `src/ui/presentation/settings/PmSettings/abstractions/PmSettingsPresenter.ts`
- Modify: `src/ui/presentation/settings/PmSettings/PmSettingsPresenter.ts`
- Modify: `src/ui/presentation/settings/PmSettings/feature.ts`

**Interfaces:**

- Consumes: `SavePmConfigUseCase.Interface` (from Task 1 — `execute(pm, settings)`)
- Consumes: `LoadPmConfigUseCase.Interface` (existing — `execute()`)
- Produces: `IPmSettingsPresenter.toggleInstallFlag(flag: string): void`
- Produces: `IPmSettingsPresenter.saveRegistryUrl(url: string): void`
- Produces: `IPmSettingsPresenter.saveUpgradeStrategy(strategy: string): void`
- Produces: `IPmSettingsPresenter.confirmSave(): Promise<void>`
- Produces: `IPmSettingsPresenter.cancelSave(): void`
- Produces: `IPmSettingsViewModel.confirmDialog: IConfirmDialogViewModel | null`
- Produces: `IPmSettingsViewModel.saving: boolean`

- [ ] **Step 1: Add confirm dialog and edit methods to presenter abstraction**

In `src/ui/presentation/settings/PmSettings/abstractions/PmSettingsPresenter.ts`, add interface:

```ts
export interface IConfirmDialogViewModel {
  description: string;
  changes: Record<string, unknown>;
}
```

Add to `IPmSettingsViewModel`:

```ts
confirmDialog: IConfirmDialogViewModel | null;
saving: boolean;
```

Add to `IPmSettingsPresenter`:

```ts
toggleInstallFlag: (flag: string) => void;
saveRegistryUrl: (url: string) => void;
saveUpgradeStrategy: (strategy: string) => void;
confirmSave: () => Promise<void>;
cancelSave: () => void;
```

Add to namespace:

```ts
export type ConfirmDialogViewModel = IConfirmDialogViewModel;
```

- [ ] **Step 2: Implement edit methods in PmSettingsPresenterImpl**

In `src/ui/presentation/settings/PmSettings/PmSettingsPresenter.ts`:

Add import for `SavePmConfigUseCase`:

```ts
import { SavePmConfigUseCase } from "../useCases/abstractions/SavePmConfigUseCase.js";
```

Add import for `notifications`:

```ts
import { notifications } from "@mantine/notifications";
```

Add private fields:

```ts
private pendingChanges: PmSettingsGateway.UpdatePmConfigBody | null = null;
private pendingDescription = "";
private saving = false;
```

Add to `vm` getter, in the returned object:

```ts
confirmDialog: this.pendingChanges
    ? { description: this.pendingDescription, changes: this.pendingChanges as Record<string, unknown> }
    : null,
saving: this.saving,
```

Add methods:

```ts
public toggleInstallFlag = (flag: string): void => {
    const pmConfig = this.pmConfigs.find(c => c.packageManager === this.selectedPm);
    if (!pmConfig) {
        return;
    }
    const currentFlag = pmConfig.installFlags.find(f => f.flag === flag);
    if (!currentFlag) {
        return;
    }
    const allFlags: Record<string, boolean> = {};
    for (const f of pmConfig.installFlags) {
        allFlags[f.flag] = f.flag === flag ? !f.enabled : f.enabled;
    }
    this.pendingChanges = { installFlags: allFlags };
    this.pendingDescription = `Toggle ${flag} to ${!currentFlag.enabled ? "enabled" : "disabled"}`;
};

public saveRegistryUrl = (url: string): void => {
    this.pendingChanges = { registryUrl: url };
    this.pendingDescription = url
        ? `Set registry URL to ${url}`
        : "Clear registry URL";
};

public saveUpgradeStrategy = (strategy: string): void => {
    this.pendingChanges = { upgradeStrategy: strategy as "caret" | "tilde" | "exact" | "latest" };
    this.pendingDescription = `Set upgrade strategy to ${strategy}`;
};

public confirmSave = async (): Promise<void> => {
    if (!this.pendingChanges) {
        return;
    }
    this.saving = true;
    const changes = this.pendingChanges;
    try {
        await this.saveUseCase.execute(this.selectedPm, changes);
        runInAction(() => {
            this.pendingChanges = null;
            this.pendingDescription = "";
            this.syncFromRepository();
        });
    } catch (err) {
        runInAction(() => {
            this.pendingChanges = null;
            this.pendingDescription = "";
            notifications.show({
                color: "red",
                title: "Save failed",
                message: err instanceof Error ? err.message : "Failed to save PM settings",
                autoClose: 5000
            });
        });
    } finally {
        runInAction(() => {
            this.saving = false;
        });
    }
};

public cancelSave = (): void => {
    this.pendingChanges = null;
    this.pendingDescription = "";
};
```

Add `SavePmConfigUseCase` to the constructor:

```ts
public constructor(
    private readonly loadUseCase: LoadSecuritySettingsUseCase.Interface,
    private readonly loadPmConfigUseCase: LoadPmConfigUseCase.Interface,
    private readonly createUseCase: CreateSecuritySettingUseCase.Interface,
    private readonly updateUseCase: UpdateSecuritySettingUseCase.Interface,
    private readonly toggleUseCase: ToggleSecuritySettingUseCase.Interface,
    private readonly resetUseCase: ResetSecuritySettingsUseCase.Interface,
    private readonly repository: PmSettingsRepository.Interface,
    private readonly saveUseCase: SavePmConfigUseCase.Interface
) {
    makeAutoObservable(this, { vm: computed });
}
```

Update the dependencies array at the bottom:

```ts
export const PmSettingsPresenter = Abstraction.createImplementation({
  implementation: PmSettingsPresenterImpl,
  dependencies: [
    LoadSecuritySettingsUseCase,
    LoadPmConfigUseCase,
    CreateSecuritySettingUseCase,
    UpdateSecuritySettingUseCase,
    ToggleSecuritySettingUseCase,
    ResetSecuritySettingsUseCase,
    PmSettingsRepository,
    SavePmConfigUseCase
  ]
});
```

- [ ] **Step 3: Run lint + typecheck**

Run: `yarn lint && yarn build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/settings/PmSettings/abstractions/PmSettingsPresenter.ts src/ui/presentation/settings/PmSettings/PmSettingsPresenter.ts
git commit -m "feat: add edit methods and confirmation dialog to PmSettingsPresenter"
```

---

### Task 3: PmSettingsPage interactive controls + confirmation modal

**Files:**

- Modify: `src/ui/presentation/settings/PmSettings/components/PmSettingsPage.tsx`

**Interfaces:**

- Consumes: `IPmSettingsPresenter` (with new methods: `toggleInstallFlag`, `saveRegistryUrl`, `saveUpgradeStrategy`, `confirmSave`, `cancelSave`)
- Consumes: `IPmSettingsViewModel` (with new fields: `confirmDialog`, `saving`)

- [ ] **Step 1: Add imports for new Mantine components**

In `src/ui/presentation/settings/PmSettings/components/PmSettingsPage.tsx`, update the Mantine import to include `Modal`, `Select`, and `Switch`:

```ts
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip
} from "@mantine/core";
```

- [ ] **Step 2: Add local state for registry URL and upgrade strategy inputs**

Add `useState` hooks inside the component, after the existing ones:

```ts
const [registryUrlInput, setRegistryUrlInput] = useState(vm.generalSettings.registryUrl ?? "");
const [upgradeStrategyInput, setUpgradeStrategyInput] = useState(
  vm.generalSettings.upgradeStrategy ?? ""
);
```

Add a `useEffect` to sync these inputs when the selected PM changes:

```ts
useEffect(() => {
  setRegistryUrlInput(vm.generalSettings.registryUrl ?? "");
  setUpgradeStrategyInput(vm.generalSettings.upgradeStrategy ?? "");
}, [vm.selectedPackageManager, vm.generalSettings.registryUrl, vm.generalSettings.upgradeStrategy]);
```

- [ ] **Step 3: Replace Install tab Badge with Switch toggles**

Replace the install flag row's Enabled column (the `<Badge>` at around line 394-398) with:

```tsx
<Table.Td style={{ textAlign: "right" }}>
  <Switch
    checked={flag.enabled}
    onChange={() => presenter.toggleInstallFlag(flag.flag)}
    size="sm"
  />
</Table.Td>
```

Keep the Default and Source columns unchanged.

- [ ] **Step 4: Replace General tab read-only display with editable controls**

Replace the entire General `Tabs.Panel` content (lines ~427-458) with:

```tsx
<Tabs.Panel value="general" pt="md">
  <Stack gap="md">
    <Group align="end">
      <TextInput
        label="Registry URL"
        placeholder="https://registry.npmjs.org"
        value={registryUrlInput}
        onChange={e => setRegistryUrlInput(e.currentTarget.value)}
        style={{ flex: 1 }}
      />
      <Button
        size="sm"
        onClick={() => presenter.saveRegistryUrl(registryUrlInput)}
        disabled={registryUrlInput === (vm.generalSettings.registryUrl ?? "")}
      >
        Save
      </Button>
    </Group>
    <Group align="end">
      <Select
        label="Upgrade Strategy"
        data={[
          { value: "caret", label: "Caret (^)" },
          { value: "tilde", label: "Tilde (~)" },
          { value: "exact", label: "Exact" },
          { value: "latest", label: "Latest" }
        ]}
        value={upgradeStrategyInput}
        onChange={value => setUpgradeStrategyInput(value ?? "")}
        style={{ flex: 1 }}
      />
      <Button
        size="sm"
        onClick={() => presenter.saveUpgradeStrategy(upgradeStrategyInput)}
        disabled={upgradeStrategyInput === (vm.generalSettings.upgradeStrategy ?? "")}
      >
        Save
      </Button>
    </Group>
  </Stack>
</Tabs.Panel>
```

- [ ] **Step 5: Add confirmation modal**

Add the Modal component right before the closing `</Stack>` at the end of the component's return statement:

```tsx
<Modal
  opened={vm.confirmDialog !== null}
  onClose={() => presenter.cancelSave()}
  title="Confirm changes"
  centered
>
  <Stack gap="md">
    <Text size="sm">{vm.confirmDialog?.description}</Text>
    <Text size="xs" c="dimmed">
      This will modify{" "}
      <Text component="code" ff="monospace" size="xs">
        .dependency-upgrader.json
      </Text>
    </Text>
    <pre style={{ fontSize: 12, overflow: "auto", maxHeight: 200 }}>
      {JSON.stringify(vm.confirmDialog?.changes, null, 2)}
    </pre>
    <Group justify="flex-end">
      <Button variant="default" onClick={() => presenter.cancelSave()}>
        Cancel
      </Button>
      <Button onClick={() => presenter.confirmSave()} loading={vm.saving}>
        Confirm
      </Button>
    </Group>
  </Stack>
</Modal>
```

- [ ] **Step 6: Run lint + format + typecheck**

Run: `yarn lint && yarn format:check && yarn build`
Expected: PASS (fix any format issues with `yarn format:fix` if needed)

- [ ] **Step 7: Run full test suite**

Run: `yarn vitest run`
Expected: All tests pass (860+ tests)

- [ ] **Step 8: Commit**

```bash
git add src/ui/presentation/settings/PmSettings/components/PmSettingsPage.tsx
git commit -m "feat: add editable controls and confirmation dialog to PM Settings page"
```
