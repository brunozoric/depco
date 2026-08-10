# PmSettings Page Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 524-line `PmSettingsPage.tsx` into four focused components — `SecuritySettingsTab`, `InstallFlagsTab`, `GeneralSettingsTab`, `PmSettingsConfirmDialog` — each owning only the local state and logic relevant to its section. `PmSettingsPage` becomes a thin ~80-line shell that owns the header, PM selector, error banners, tab navigation, and wires the shared presenter down to each tab.

**Architecture:** Each extracted component receives the full `PmSettingsPresenter.Interface` as its only prop and reads its own slice of `presenter.vm` — the same pattern already used by `ScanTab` (`src/ui/presentation/Projects/ProjectList/components/ScanTab.tsx`), which takes `presenter: ProjectListPresenter.Interface` and manages its own local state. No presenter/abstraction/DI changes are made — this is a pure UI decomposition. Local UI-only state (edit buffer, add buffer, registry URL input, upgrade strategy input) moves out of `PmSettingsPage` into the tab component that actually uses it. Two-positional-argument handlers (`handleStartEdit`, `handleStartAdd`) are converted to single object-param signatures with named interfaces during the move, per project convention.

**Tech Stack:** TypeScript, React, MobX, Mantine UI, Vitest

## Global Constraints

- Use `yarn full` to verify (lint, format, build, tests)
- Named interfaces only, no inline structural types
- Object params with named keys for 2+ params
- Full words in identifiers (no abbreviations)
- Format with `yarn format:fix` and `yarn lint:fix` before commit
- Existing `src/ui/presentation/Settings/PmSettings/__tests__/PmSettingsPresenter.test.ts` must pass unchanged after each task — it tests the presenter only, not the page component, so it is unaffected by this refactor as long as the presenter abstraction is untouched
- This is extract + improve: same behavior, better structure, fix code smells during extraction
- Component props interfaces follow the existing convention in this codebase: plain `XxxProps` names (no `I` prefix) for React prop shapes — matches `PmSettingsPageProps` and `ScanTabProps` already in the codebase. Data-shape interfaces (not component props) use the `I` prefix — matches `IOutputFormatterFactoryInput` elsewhere in the codebase.
- Every tab component takes exactly one prop: `presenter: PmSettingsPresenter.Interface`. Do not add granular per-field props — this matches the existing `ScanTab` pattern and avoids prop-drilling churn every time the view model changes shape.

---

### Task 1: Extract SecuritySettingsTab

The security tab is the largest and most complex section (~258 lines): it owns `editValue`/`addValue` local state, the `handleStartEdit`/`handleStartAdd` handlers, and computes `isPmFileManaged` for its own read-only banner and disabled controls.

**Files:**

- Create: `src/ui/presentation/Settings/PmSettings/components/SecuritySettingsTab.tsx`
- Modify: `src/ui/presentation/Settings/PmSettings/components/PmSettingsPage.tsx`

**Interfaces:**

- Consumes: `PmSettingsPresenter.Interface`, `PmSettingsPresenter.ViewModel` (via `presenter.vm`) — no new types needed from the presenter
- Produces: `SecuritySettingsTab` component, plus new local interfaces `IStartEditInput` and `IStartAddInput` (file-local, not exported)

- [ ] **Step 1: Create `SecuritySettingsTab.tsx`**

Create `src/ui/presentation/Settings/PmSettings/components/SecuritySettingsTab.tsx`:

```tsx
import type React from "react";
import { useState } from "react";
import {
    ActionIcon,
    Alert,
    Badge,
    Button,
    Group,
    Menu,
    Stack,
    Switch,
    Table,
    Text,
    TextInput,
    Tooltip
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";

interface SecuritySettingsTabProps {
    presenter: PmSettingsPresenter.Interface;
}

interface IStartEditInput {
    id: string;
    currentValue: string;
}

interface IStartAddInput {
    fieldName: string;
    defaultValue: string;
}

export const SecuritySettingsTab = observer(function SecuritySettingsTab({
    presenter
}: SecuritySettingsTabProps): React.ReactNode {
    const { vm } = presenter;
    const [editValue, setEditValue] = useState("");
    const [addValue, setAddValue] = useState("");
    const isPmFileManaged = vm.fileManagedPms.includes(vm.selectedPackageManager);

    function handleStartEdit({ id, currentValue }: IStartEditInput): void {
        setEditValue(currentValue);
        presenter.startEdit(id);
    }

    function handleStartAdd({ fieldName, defaultValue }: IStartAddInput): void {
        setAddValue(defaultValue);
        presenter.startAdd(fieldName);
    }

    return (
        <Stack gap="md">
            {isPmFileManaged && (
                <Alert color="blue" title="Read-only">
                    PM settings for {vm.selectedPackageManager} are managed by{" "}
                    <Text component="code" ff="monospace">
                        .dependency-upgrader.json
                    </Text>
                    . Edit the file to change these values.
                </Alert>
            )}
            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Field Name</Table.Th>
                        <Table.Th>Config File</Table.Th>
                        <Table.Th>Expected Value</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Enabled</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {vm.settings.map(setting => (
                        <Table.Tr
                            key={setting.id}
                            style={setting.enabled ? undefined : { opacity: 0.5 }}
                            {...(setting.isOrphaned ? { bg: "orange.0" } : {})}
                        >
                            <Table.Td>
                                <Group gap="xs">
                                    <Text size="sm">{setting.description}</Text>
                                    {setting.isOrphaned && (
                                        <Tooltip label="This field is no longer in the registry. You can edit or delete it.">
                                            <Badge size="sm" color="orange">
                                                Orphaned
                                            </Badge>
                                        </Tooltip>
                                    )}
                                </Group>
                            </Table.Td>
                            <Table.Td>
                                <Text size="sm" c="dimmed">
                                    {setting.configFile}
                                </Text>
                            </Table.Td>
                            <Table.Td>
                                {setting.inputType === "exists" ? (
                                    <Text size="sm" c="dimmed" fs="italic">
                                        Field must exist
                                    </Text>
                                ) : setting.inputType === "boolean" ? (
                                    <Switch
                                        size="sm"
                                        checked={setting.expectedValue === "true"}
                                        disabled={setting.isFileManaged}
                                        onChange={event => {
                                            presenter.startEdit(setting.id);
                                            presenter.confirmEdit(
                                                event.currentTarget.checked ? "true" : "false"
                                            );
                                        }}
                                    />
                                ) : vm.editingId === setting.id ? (
                                    <Stack gap={2}>
                                        <Group gap="xs">
                                            <TextInput
                                                size="xs"
                                                value={editValue}
                                                onChange={e => setEditValue(e.currentTarget.value)}
                                            />
                                            <Button
                                                size="xs"
                                                onClick={() => presenter.confirmEdit(editValue)}
                                            >
                                                Save
                                            </Button>
                                            <Button
                                                size="xs"
                                                variant="subtle"
                                                onClick={() => presenter.cancelEdit()}
                                            >
                                                Cancel
                                            </Button>
                                        </Group>
                                        {setting.helperText && (
                                            <Text size="xs" c="dimmed">
                                                {setting.helperText}
                                            </Text>
                                        )}
                                    </Stack>
                                ) : (
                                    <Text size="sm">{setting.expectedValue}</Text>
                                )}
                            </Table.Td>
                            <Table.Td>
                                <Group justify="flex-end">
                                    <Switch
                                        size="sm"
                                        checked={setting.enabled}
                                        disabled={setting.isFileManaged}
                                        onChange={() => presenter.toggle(setting.id)}
                                        styles={{ track: { cursor: "pointer" } }}
                                    />
                                </Group>
                            </Table.Td>
                            <Table.Td style={{ textAlign: "right" }}>
                                {vm.editingId !== setting.id &&
                                    setting.inputType !== "exists" &&
                                    setting.inputType !== "boolean" &&
                                    !setting.isFileManaged && (
                                        <ActionIcon
                                            variant="subtle"
                                            size="sm"
                                            onClick={() =>
                                                handleStartEdit({
                                                    id: setting.id,
                                                    currentValue: setting.expectedValue
                                                })
                                            }
                                        >
                                            &#9998;
                                        </ActionIcon>
                                    )}
                            </Table.Td>
                        </Table.Tr>
                    ))}
                    {vm.addingField && (
                        <Table.Tr>
                            <Table.Td>
                                <Text size="sm">{vm.addingField}</Text>
                            </Table.Td>
                            <Table.Td />
                            <Table.Td>
                                {(() => {
                                    const addingDef = vm.availableFields.find(
                                        f => f.fieldName === vm.addingField
                                    );
                                    if (addingDef?.inputType === "boolean") {
                                        return (
                                            <Group gap="xs">
                                                <Switch
                                                    size="sm"
                                                    checked={addValue === "true"}
                                                    onChange={event =>
                                                        presenter.confirmAdd(
                                                            event.currentTarget.checked
                                                                ? "true"
                                                                : "false"
                                                        )
                                                    }
                                                />
                                                <Button
                                                    size="xs"
                                                    variant="subtle"
                                                    onClick={() => presenter.cancelAdd()}
                                                >
                                                    Cancel
                                                </Button>
                                            </Group>
                                        );
                                    }
                                    return (
                                        <Stack gap={2}>
                                            <Group gap="xs">
                                                <TextInput
                                                    size="xs"
                                                    value={addValue}
                                                    onChange={e => setAddValue(e.currentTarget.value)}
                                                />
                                                <Button
                                                    size="xs"
                                                    onClick={() => presenter.confirmAdd(addValue)}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    size="xs"
                                                    variant="subtle"
                                                    onClick={() => presenter.cancelAdd()}
                                                >
                                                    Cancel
                                                </Button>
                                            </Group>
                                            {addingDef?.helperText && (
                                                <Text size="xs" c="dimmed">
                                                    {addingDef.helperText}
                                                </Text>
                                            )}
                                        </Stack>
                                    );
                                })()}
                            </Table.Td>
                            <Table.Td />
                            <Table.Td />
                        </Table.Tr>
                    )}
                </Table.Tbody>
            </Table>

            <Group gap="sm">
                {vm.availableFields.length > 0 && !vm.addingField && (
                    <Menu shadow="md" width={300} disabled={isPmFileManaged}>
                        <Menu.Target>
                            <Button variant="light" disabled={isPmFileManaged}>
                                Add Setting
                            </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {vm.availableFields.map(field => (
                                <Menu.Item
                                    key={field.fieldName}
                                    onClick={() => {
                                        if (field.inputType === "exists") {
                                            presenter.startAdd(field.fieldName);
                                            presenter.confirmAdd("exists");
                                        } else {
                                            handleStartAdd({
                                                fieldName: field.fieldName,
                                                defaultValue: field.defaultExpectedValue
                                            });
                                        }
                                    }}
                                >
                                    {field.description}
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
                )}
                {vm.canReset && (
                    <Button
                        variant="light"
                        color="orange"
                        disabled={isPmFileManaged}
                        onClick={() => presenter.resetToDefaults()}
                    >
                        Reset to Defaults
                    </Button>
                )}
            </Group>
        </Stack>
    );
});
```

This is an exact move of the original `<Tabs.Panel value="security" pt="md">` content (original lines 129–386, minus the `Tabs.Panel` wrapper itself), with two improvements:

- `isPmFileManaged` is now computed locally from `vm.fileManagedPms`/`vm.selectedPackageManager` instead of being passed in — it's only used here.
- `handleStartEdit(id, currentValue)` and `handleStartAdd(fieldName, defaultValue)` become `handleStartEdit({ id, currentValue })` and `handleStartAdd({ fieldName, defaultValue })`, using the new `IStartEditInput`/`IStartAddInput` interfaces (object params with named keys per project convention — the originals took two positional string params, which is exactly what the convention forbids).

- [ ] **Step 2: Update `PmSettingsPage.tsx` imports**

In `src/ui/presentation/Settings/PmSettings/components/PmSettingsPage.tsx`, replace the top of the file:

Old:

```tsx
import type React from "react";
import { useEffect, useState } from "react";
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
import { navigate } from "#ui/infrastructure/Router/router.js";
import { observer } from "mobx-react-lite";
import type { PackageManagerId } from "#shared/security/index.js";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";
```

New:

```tsx
import type React from "react";
import { useEffect, useState } from "react";
import {
    ActionIcon,
    Alert,
    Badge,
    Button,
    Center,
    Group,
    Loader,
    Modal,
    SegmentedControl,
    Select,
    Stack,
    Switch,
    Table,
    Tabs,
    Text,
    TextInput,
    Title
} from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { observer } from "mobx-react-lite";
import type { PackageManagerId } from "#shared/security/index.js";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";
import { SecuritySettingsTab } from "./SecuritySettingsTab.js";
```

(`Menu` and `Tooltip` are removed — they were only used by the security tab. `Badge`, `Button`, `Modal`, `Select`, `Switch`, `Table`, `TextInput` are still needed by the install/general tabs and confirm dialog, which are still inline at this point in the refactor.)

- [ ] **Step 3: Remove security-only state and handlers from `PmSettingsPage.tsx`**

Old:

```tsx
    const { vm } = presenter;
    const [editValue, setEditValue] = useState("");
    const [addValue, setAddValue] = useState("");
    const [registryUrlInput, setRegistryUrlInput] = useState(vm.generalSettings.registryUrl ?? "");
    const [upgradeStrategyInput, setUpgradeStrategyInput] = useState(
        vm.generalSettings.upgradeStrategy ?? ""
    );
    const isPmFileManaged = vm.fileManagedPms.includes(vm.selectedPackageManager);

    useEffect(() => {
        presenter.load();
    }, [presenter]);

    useEffect(() => {
        setRegistryUrlInput(vm.generalSettings.registryUrl ?? "");
        setUpgradeStrategyInput(vm.generalSettings.upgradeStrategy ?? "");
    }, [
        vm.selectedPackageManager,
        vm.generalSettings.registryUrl,
        vm.generalSettings.upgradeStrategy
    ]);

    function handleStartEdit(id: string, currentValue: string): void {
        setEditValue(currentValue);
        presenter.startEdit(id);
    }

    function handleStartAdd(fieldName: string, defaultValue: string): void {
        setAddValue(defaultValue);
        presenter.startAdd(fieldName);
    }

    if (vm.loading && vm.settings.length === 0) {
```

New:

```tsx
    const { vm } = presenter;
    const [registryUrlInput, setRegistryUrlInput] = useState(vm.generalSettings.registryUrl ?? "");
    const [upgradeStrategyInput, setUpgradeStrategyInput] = useState(
        vm.generalSettings.upgradeStrategy ?? ""
    );

    useEffect(() => {
        presenter.load();
    }, [presenter]);

    useEffect(() => {
        setRegistryUrlInput(vm.generalSettings.registryUrl ?? "");
        setUpgradeStrategyInput(vm.generalSettings.upgradeStrategy ?? "");
    }, [
        vm.selectedPackageManager,
        vm.generalSettings.registryUrl,
        vm.generalSettings.upgradeStrategy
    ]);

    if (vm.loading && vm.settings.length === 0) {
```

(`registryUrlInput`/`upgradeStrategyInput` and their sync effect stay for now — they move out in Task 3.)

- [ ] **Step 4: Replace the security `Tabs.Panel` body**

Delete the entire `<Tabs.Panel value="security" pt="md">...</Tabs.Panel>` block (the content is identical to what now lives in `SecuritySettingsTab.tsx`, created in Step 1) and replace it with:

```tsx
                <Tabs.Panel value="security" pt="md">
                    <SecuritySettingsTab presenter={presenter} />
                </Tabs.Panel>
```

- [ ] **Step 5: Verify no regressions**

Run:

```bash
yarn vitest run src/ui/presentation/Settings/PmSettings/__tests__/PmSettingsPresenter.test.ts
```

Expected: all existing tests PASS unchanged (presenter is untouched).

Then run the full check:

```bash
yarn full
```

Expected: lint, format, build, and all tests PASS. The build step is what verifies the new `SecuritySettingsTab` prop wiring type-checks correctly.

- [ ] **Step 6: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/ui/presentation/Settings/PmSettings/components/SecuritySettingsTab.tsx src/ui/presentation/Settings/PmSettings/components/PmSettingsPage.tsx
git commit -m "refactor: extract SecuritySettingsTab from PmSettingsPage"
```

---

### Task 2: Extract InstallFlagsTab

The install tab is a self-contained 63-line table with no local state — a straightforward extraction.

**Files:**

- Create: `src/ui/presentation/Settings/PmSettings/components/InstallFlagsTab.tsx`
- Modify: `src/ui/presentation/Settings/PmSettings/components/PmSettingsPage.tsx`

**Interfaces:**

- Consumes: `PmSettingsPresenter.Interface` (via `presenter.vm.installFlags`, `presenter.toggleInstallFlag`)
- Produces: `InstallFlagsTab` component

- [ ] **Step 1: Create `InstallFlagsTab.tsx`**

Create `src/ui/presentation/Settings/PmSettings/components/InstallFlagsTab.tsx`:

```tsx
import type React from "react";
import { Badge, Switch, Table, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";

interface InstallFlagsTabProps {
    presenter: PmSettingsPresenter.Interface;
}

export const InstallFlagsTab = observer(function InstallFlagsTab({
    presenter
}: InstallFlagsTabProps): React.ReactNode {
    const { vm } = presenter;

    return (
        <Table striped highlightOnHover>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>Flag</Table.Th>
                    <Table.Th>Label</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Enabled</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Default</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Source</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {vm.installFlags.map(flag => (
                    <Table.Tr key={flag.flag}>
                        <Table.Td>
                            <Text size="sm" ff="monospace">
                                {flag.flag}
                            </Text>
                        </Table.Td>
                        <Table.Td>
                            <Text size="sm">{flag.label}</Text>
                        </Table.Td>
                        <Table.Td>
                            <Text size="sm" c="dimmed">
                                {flag.description}
                            </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                            <Switch
                                checked={flag.enabled}
                                onChange={() => presenter.toggleInstallFlag(flag.flag)}
                                size="sm"
                                aria-label={`Toggle ${flag.label}`}
                            />
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                            <Badge size="sm" variant="outline" color="gray">
                                {flag.defaultEnabled ? "Default on" : "Default off"}
                            </Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                            {flag.isFileManaged && (
                                <Badge size="sm" color="blue">
                                    File
                                </Badge>
                            )}
                        </Table.Td>
                    </Table.Tr>
                ))}
                {vm.installFlags.length === 0 && (
                    <Table.Tr>
                        <Table.Td colSpan={6}>
                            <Text size="sm" c="dimmed" ta="center" py="md">
                                No install flags available for {vm.selectedPackageManager}.
                            </Text>
                        </Table.Td>
                    </Table.Tr>
                )}
            </Table.Tbody>
        </Table>
    );
});
```

This is an exact move of the original `<Tabs.Panel value="install" pt="md">` content (original lines 388–450), no logic changes — it had no local state or code smells to fix.

- [ ] **Step 2: Update `PmSettingsPage.tsx` imports**

Old:

```tsx
import {
    ActionIcon,
    Alert,
    Badge,
    Button,
    Center,
    Group,
    Loader,
    Modal,
    SegmentedControl,
    Select,
    Stack,
    Switch,
    Table,
    Tabs,
    Text,
    TextInput,
    Title
} from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { observer } from "mobx-react-lite";
import type { PackageManagerId } from "#shared/security/index.js";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";
import { SecuritySettingsTab } from "./SecuritySettingsTab.js";
```

New:

```tsx
import {
    ActionIcon,
    Alert,
    Button,
    Center,
    Group,
    Loader,
    Modal,
    SegmentedControl,
    Select,
    Stack,
    Tabs,
    Text,
    TextInput,
    Title
} from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { observer } from "mobx-react-lite";
import type { PackageManagerId } from "#shared/security/index.js";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";
import { SecuritySettingsTab } from "./SecuritySettingsTab.js";
import { InstallFlagsTab } from "./InstallFlagsTab.js";
```

(`Badge`, `Switch`, `Table` are removed — after this task, nothing left inline in `PmSettingsPage.tsx` uses them: the general tab and confirm dialog use neither.)

- [ ] **Step 3: Replace the install `Tabs.Panel` body**

Delete the entire `<Tabs.Panel value="install" pt="md">...</Tabs.Panel>` block and replace it with:

```tsx
                <Tabs.Panel value="install" pt="md">
                    <InstallFlagsTab presenter={presenter} />
                </Tabs.Panel>
```

- [ ] **Step 4: Verify no regressions**

```bash
yarn vitest run src/ui/presentation/Settings/PmSettings/__tests__/PmSettingsPresenter.test.ts
yarn full
```

Expected: existing presenter tests PASS unchanged; `yarn full` PASSes (lint, format, build, tests).

- [ ] **Step 5: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/ui/presentation/Settings/PmSettings/components/InstallFlagsTab.tsx src/ui/presentation/Settings/PmSettings/components/PmSettingsPage.tsx
git commit -m "refactor: extract InstallFlagsTab from PmSettingsPage"
```

---

### Task 3: Extract GeneralSettingsTab

The general tab (41 lines) owns the registry URL and upgrade strategy inputs, their sync-on-PM-change effect, and the `UPGRADE_STRATEGY_OPTIONS` constant — which has no other consumer.

**Files:**

- Create: `src/ui/presentation/Settings/PmSettings/components/GeneralSettingsTab.tsx`
- Modify: `src/ui/presentation/Settings/PmSettings/components/PmSettingsPage.tsx`

**Interfaces:**

- Consumes: `PmSettingsPresenter.Interface` (via `presenter.vm.generalSettings`, `presenter.vm.selectedPackageManager`, `presenter.saveRegistryUrl`, `presenter.saveUpgradeStrategy`)
- Produces: `GeneralSettingsTab` component; `UPGRADE_STRATEGY_OPTIONS` constant relocates here (no longer exported from `PmSettingsPage.tsx`)

- [ ] **Step 1: Create `GeneralSettingsTab.tsx`**

Create `src/ui/presentation/Settings/PmSettings/components/GeneralSettingsTab.tsx`:

```tsx
import type React from "react";
import { useEffect, useState } from "react";
import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";

const UPGRADE_STRATEGY_OPTIONS = [
    { value: "", label: "None (default)" },
    { value: "caret", label: "Caret (^)" },
    { value: "tilde", label: "Tilde (~)" },
    { value: "exact", label: "Exact" },
    { value: "latest", label: "Latest" }
];

interface GeneralSettingsTabProps {
    presenter: PmSettingsPresenter.Interface;
}

export const GeneralSettingsTab = observer(function GeneralSettingsTab({
    presenter
}: GeneralSettingsTabProps): React.ReactNode {
    const { vm } = presenter;
    const [registryUrlInput, setRegistryUrlInput] = useState(vm.generalSettings.registryUrl ?? "");
    const [upgradeStrategyInput, setUpgradeStrategyInput] = useState(
        vm.generalSettings.upgradeStrategy ?? ""
    );

    useEffect(() => {
        setRegistryUrlInput(vm.generalSettings.registryUrl ?? "");
        setUpgradeStrategyInput(vm.generalSettings.upgradeStrategy ?? "");
    }, [
        vm.selectedPackageManager,
        vm.generalSettings.registryUrl,
        vm.generalSettings.upgradeStrategy
    ]);

    return (
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
                    data={UPGRADE_STRATEGY_OPTIONS}
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
    );
});
```

This is an exact move of the original `<Tabs.Panel value="general" pt="md">` content (original lines 452–492), plus:

- `UPGRADE_STRATEGY_OPTIONS` moves here — `GeneralSettingsTab` was already its only consumer.
- The `registryUrlInput`/`upgradeStrategyInput` local state and the effect that resyncs them when `vm.selectedPackageManager` or `vm.generalSettings` changes move here verbatim — this component is always mounted while `PmSettingsPage` is mounted (Mantine `Tabs.Panel` keeps panels mounted by default), so the effect continues to fire on PM switches exactly as before, even while a different tab is visually active.

- [ ] **Step 2: Update `PmSettingsPage.tsx` imports and remove `UPGRADE_STRATEGY_OPTIONS`**

Old:

```tsx
import type React from "react";
import { useEffect, useState } from "react";
import {
    ActionIcon,
    Alert,
    Button,
    Center,
    Group,
    Loader,
    Modal,
    SegmentedControl,
    Select,
    Stack,
    Tabs,
    Text,
    TextInput,
    Title
} from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { observer } from "mobx-react-lite";
import type { PackageManagerId } from "#shared/security/index.js";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";
import { SecuritySettingsTab } from "./SecuritySettingsTab.js";
import { InstallFlagsTab } from "./InstallFlagsTab.js";

const UPGRADE_STRATEGY_OPTIONS = [
    { value: "", label: "None (default)" },
    { value: "caret", label: "Caret (^)" },
    { value: "tilde", label: "Tilde (~)" },
    { value: "exact", label: "Exact" },
    { value: "latest", label: "Latest" }
];

interface PmSettingsPageProps {
```

New:

```tsx
import type React from "react";
import { useEffect } from "react";
import {
    ActionIcon,
    Alert,
    Button,
    Center,
    Group,
    Loader,
    Modal,
    SegmentedControl,
    Stack,
    Tabs,
    Text,
    Title
} from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { observer } from "mobx-react-lite";
import type { PackageManagerId } from "#shared/security/index.js";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";
import { SecuritySettingsTab } from "./SecuritySettingsTab.js";
import { InstallFlagsTab } from "./InstallFlagsTab.js";
import { GeneralSettingsTab } from "./GeneralSettingsTab.js";

interface PmSettingsPageProps {
```

(`useState` is dropped from the React import — after this task, `PmSettingsPage` no longer has any local state of its own. `Select` and `TextInput` are dropped — they were only used by the general tab. `Button` stays for now — it's still used by the confirm dialog's Cancel/Confirm buttons, which move in Task 4.)

- [ ] **Step 3: Remove general-settings state and effect from `PmSettingsPage.tsx`**

Old:

```tsx
    const { vm } = presenter;
    const [registryUrlInput, setRegistryUrlInput] = useState(vm.generalSettings.registryUrl ?? "");
    const [upgradeStrategyInput, setUpgradeStrategyInput] = useState(
        vm.generalSettings.upgradeStrategy ?? ""
    );

    useEffect(() => {
        presenter.load();
    }, [presenter]);

    useEffect(() => {
        setRegistryUrlInput(vm.generalSettings.registryUrl ?? "");
        setUpgradeStrategyInput(vm.generalSettings.upgradeStrategy ?? "");
    }, [
        vm.selectedPackageManager,
        vm.generalSettings.registryUrl,
        vm.generalSettings.upgradeStrategy
    ]);

    if (vm.loading && vm.settings.length === 0) {
```

New:

```tsx
    const { vm } = presenter;

    useEffect(() => {
        presenter.load();
    }, [presenter]);

    if (vm.loading && vm.settings.length === 0) {
```

- [ ] **Step 4: Replace the general `Tabs.Panel` body**

Delete the entire `<Tabs.Panel value="general" pt="md">...</Tabs.Panel>` block and replace it with:

```tsx
                <Tabs.Panel value="general" pt="md">
                    <GeneralSettingsTab presenter={presenter} />
                </Tabs.Panel>
```

- [ ] **Step 5: Verify no regressions**

```bash
yarn vitest run src/ui/presentation/Settings/PmSettings/__tests__/PmSettingsPresenter.test.ts
yarn full
```

Expected: existing presenter tests PASS unchanged; `yarn full` PASSes.

- [ ] **Step 6: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/ui/presentation/Settings/PmSettings/components/GeneralSettingsTab.tsx src/ui/presentation/Settings/PmSettings/components/PmSettingsPage.tsx
git commit -m "refactor: extract GeneralSettingsTab from PmSettingsPage"
```

---

### Task 4: Extract PmSettingsConfirmDialog and finalize PmSettingsPage

The confirmation modal is generic mutation-confirmation UI, unrelated to any specific tab. Extracting it is what brings `PmSettingsPage` down to its final ~80-line shell.

**Files:**

- Create: `src/ui/presentation/Settings/PmSettings/components/PmSettingsConfirmDialog.tsx`
- Modify: `src/ui/presentation/Settings/PmSettings/components/PmSettingsPage.tsx`

**Interfaces:**

- Consumes: `PmSettingsPresenter.Interface` (via `presenter.vm.confirmDialog`, `presenter.vm.saving`, `presenter.cancelSave`, `presenter.confirmSave`)
- Produces: `PmSettingsConfirmDialog` component

- [ ] **Step 1: Create `PmSettingsConfirmDialog.tsx`**

Create `src/ui/presentation/Settings/PmSettings/components/PmSettingsConfirmDialog.tsx`:

```tsx
import type React from "react";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";

interface PmSettingsConfirmDialogProps {
    presenter: PmSettingsPresenter.Interface;
}

export const PmSettingsConfirmDialog = observer(function PmSettingsConfirmDialog({
    presenter
}: PmSettingsConfirmDialogProps): React.ReactNode {
    const { vm } = presenter;

    return (
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
    );
});
```

This is an exact move of the original `<Modal>...</Modal>` block (original lines 495–521) — no local state, no code smells, straight extraction.

- [ ] **Step 2: Update `PmSettingsPage.tsx` imports**

Old:

```tsx
import type React from "react";
import { useEffect } from "react";
import {
    ActionIcon,
    Alert,
    Button,
    Center,
    Group,
    Loader,
    Modal,
    SegmentedControl,
    Stack,
    Tabs,
    Text,
    Title
} from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { observer } from "mobx-react-lite";
import type { PackageManagerId } from "#shared/security/index.js";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";
import { SecuritySettingsTab } from "./SecuritySettingsTab.js";
import { InstallFlagsTab } from "./InstallFlagsTab.js";
import { GeneralSettingsTab } from "./GeneralSettingsTab.js";
```

New:

```tsx
import type React from "react";
import { useEffect } from "react";
import {
    ActionIcon,
    Alert,
    Center,
    Group,
    Loader,
    SegmentedControl,
    Stack,
    Tabs,
    Text,
    Title
} from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { observer } from "mobx-react-lite";
import type { PackageManagerId } from "#shared/security/index.js";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";
import { SecuritySettingsTab } from "./SecuritySettingsTab.js";
import { InstallFlagsTab } from "./InstallFlagsTab.js";
import { GeneralSettingsTab } from "./GeneralSettingsTab.js";
import { PmSettingsConfirmDialog } from "./PmSettingsConfirmDialog.js";
```

(`Button` and `Modal` are removed — after this task nothing inline in `PmSettingsPage.tsx` uses them.)

- [ ] **Step 3: Replace the `Modal` block**

Delete the entire `<Modal>...</Modal>` block (immediately before the closing `</Stack>` at the end of the component) and replace it with:

```tsx
            <PmSettingsConfirmDialog presenter={presenter} />
```

- [ ] **Step 4: Verify the final `PmSettingsPage.tsx` matches this shape**

After Steps 1–3, `src/ui/presentation/Settings/PmSettings/components/PmSettingsPage.tsx` should read exactly as follows (~78 lines):

```tsx
import type React from "react";
import { useEffect } from "react";
import {
    ActionIcon,
    Alert,
    Center,
    Group,
    Loader,
    SegmentedControl,
    Stack,
    Tabs,
    Text,
    Title
} from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import { observer } from "mobx-react-lite";
import type { PackageManagerId } from "#shared/security/index.js";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";
import { SecuritySettingsTab } from "./SecuritySettingsTab.js";
import { InstallFlagsTab } from "./InstallFlagsTab.js";
import { GeneralSettingsTab } from "./GeneralSettingsTab.js";
import { PmSettingsConfirmDialog } from "./PmSettingsConfirmDialog.js";

interface PmSettingsPageProps {
    presenter: PmSettingsPresenter.Interface;
}

export const PmSettingsPage = observer(function PmSettingsPage({
    presenter
}: PmSettingsPageProps): React.ReactNode {
    const { vm } = presenter;

    useEffect(() => {
        presenter.load();
    }, [presenter]);

    if (vm.loading && vm.settings.length === 0) {
        return (
            <Center py="xl">
                <Loader />
            </Center>
        );
    }

    return (
        <Stack gap="md">
            <Group gap="sm">
                <ActionIcon variant="subtle" size="lg" onClick={() => navigate("/")}>
                    &larr;
                </ActionIcon>
                <Title order={2}>PM Settings</Title>
            </Group>

            <SegmentedControl
                value={vm.selectedPackageManager}
                onChange={value => presenter.selectPackageManager(value as PackageManagerId)}
                data={[
                    { label: "Yarn", value: "yarn" },
                    { label: "NPM", value: "npm" },
                    { label: "PNPM", value: "pnpm" },
                    { label: "Bun", value: "bun" }
                ]}
            />

            {vm.configError && (
                <Alert color="yellow" title="Config file error">
                    <Text size="sm">{vm.configError.message}</Text>
                    <Text size="xs" c="dimmed" mt={4}>
                        Showing database values. Fix the config file to restore file-based settings.
                    </Text>
                </Alert>
            )}

            {vm.error && (
                <Alert color="red" title="Error">
                    {vm.error}
                </Alert>
            )}

            <Tabs
                value={vm.activeTab}
                onChange={value => presenter.setActiveTab(value as PmSettingsPresenter.TabId)}
            >
                <Tabs.List>
                    <Tabs.Tab value="security">Security</Tabs.Tab>
                    <Tabs.Tab value="install">Install</Tabs.Tab>
                    <Tabs.Tab value="general">General</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="security" pt="md">
                    <SecuritySettingsTab presenter={presenter} />
                </Tabs.Panel>

                <Tabs.Panel value="install" pt="md">
                    <InstallFlagsTab presenter={presenter} />
                </Tabs.Panel>

                <Tabs.Panel value="general" pt="md">
                    <GeneralSettingsTab presenter={presenter} />
                </Tabs.Panel>
            </Tabs>

            <PmSettingsConfirmDialog presenter={presenter} />
        </Stack>
    );
});
```

Confirm: `PmSettingsRoute.tsx` imports `PmSettingsPage` from `./components/PmSettingsPage.js` and passes `presenter={presenter}` — this import path and prop contract is unchanged by the whole refactor, so `PmSettingsRoute.tsx` needs no edits.

- [ ] **Step 5: Verify no regressions**

```bash
yarn vitest run src/ui/presentation/Settings/PmSettings/__tests__/PmSettingsPresenter.test.ts
yarn full
```

Expected: existing presenter tests PASS unchanged; `yarn full` PASSes (lint, format, build, all tests).

- [ ] **Step 6: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/ui/presentation/Settings/PmSettings/components/PmSettingsConfirmDialog.tsx src/ui/presentation/Settings/PmSettings/components/PmSettingsPage.tsx
git commit -m "refactor: extract PmSettingsConfirmDialog and finalize PmSettingsPage shell"
```

---

## Post-Refactor Checklist

- [ ] `PmSettingsPage.tsx` is ~78 lines and contains no tab-specific JSX, state, or handlers
- [ ] `SecuritySettingsTab.tsx`, `InstallFlagsTab.tsx`, `GeneralSettingsTab.tsx`, `PmSettingsConfirmDialog.tsx` each take a single `presenter: PmSettingsPresenter.Interface` prop
- [ ] `UPGRADE_STRATEGY_OPTIONS` exists only in `GeneralSettingsTab.tsx`
- [ ] `handleStartEdit`/`handleStartAdd` in `SecuritySettingsTab.tsx` take a single named-interface object param, not positional strings
- [ ] `src/ui/presentation/Settings/PmSettings/__tests__/PmSettingsPresenter.test.ts` passes unchanged
- [ ] `src/ui/presentation/Settings/PmSettings/PmSettingsRoute.tsx` required no changes
- [ ] `yarn full` passes with zero lint/format/build/test failures
- [ ] Manually verify in the running app (do not start the dev server yourself — ask the user to check) that all three tabs render, edit/add/toggle flows work in Security, flags toggle in Install, and both Save buttons work in General, and the confirm modal still opens/closes correctly
