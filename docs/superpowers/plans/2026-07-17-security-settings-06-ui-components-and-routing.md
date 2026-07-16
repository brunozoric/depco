# Security Settings — Plan 6: UI Components & Routing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the React components, feature registration, provider, and wire up routing in `App.tsx`.

**Architecture:** Dumb React components wrapped in `observer()`, reading `presenter.vm`. Provider resolves presenter from DI. App header gets a Settings link. `/settings` route matched before project detail regex.

**Tech Stack:** React 19, Mantine UI, MobX, mobx-react-lite

## Global Constraints

- React components are dumb display, `observer()` wrapped, reads `presenter.vm` only
- Mantine UI components for all UI elements
- No direct state in React — all state lives in presenter
- Run `yarn build` after each task

---

### Task 21: SecuritySettingsPresentationFeature + Provider

**Files:**

- Create: `src/ui/presentation/settings/SecuritySettings/feature.ts`
- Create: `src/ui/presentation/settings/SecuritySettings/SecuritySettingsProvider.tsx`

**Interfaces:**

- Consumes: `SecuritySettingsPresenter` abstraction, `SecuritySettingsUseCasesFeature`, `useFeature`
- Produces: `SecuritySettingsPresentationFeature`, `SecuritySettingsProvider`

- [ ] **Step 1: Create presentation feature**

```tsx
// src/ui/presentation/settings/SecuritySettings/feature.ts
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { SecuritySettingsPresenter as SecuritySettingsPresenterAbstraction } from "./abstractions/SecuritySettingsPresenter.js";
import { SecuritySettingsPresenter } from "./SecuritySettingsPresenter.js";
import { SecuritySettingsUseCasesFeature } from "../useCases/feature.js";

export interface ISecuritySettingsPresentationFeatureExports {
  presenter: SecuritySettingsPresenterAbstraction.Interface;
}

export const SecuritySettingsPresentationFeature = createFeature<
  void,
  ISecuritySettingsPresentationFeatureExports
>({
  name: "Ui/SecuritySettingsPresentation",
  dependencies: [SecuritySettingsUseCasesFeature],
  register(container: Container) {
    container.register(SecuritySettingsPresenter);
  },
  resolve(container: Container): ISecuritySettingsPresentationFeatureExports {
    return {
      presenter: container.resolve(SecuritySettingsPresenterAbstraction)
    };
  }
});
```

- [ ] **Step 2: Create provider**

```tsx
// src/ui/presentation/settings/SecuritySettings/SecuritySettingsProvider.tsx
import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { SecuritySettingsPresentationFeature } from "./feature.js";
import type { SecuritySettingsPresenter } from "./abstractions/SecuritySettingsPresenter.js";

interface SecuritySettingsProviderProps {
  children: (params: { presenter: SecuritySettingsPresenter.Interface }) => React.ReactNode;
}

export function SecuritySettingsProvider({
  children
}: SecuritySettingsProviderProps): React.ReactNode {
  const { presenter } = useFeature(SecuritySettingsPresentationFeature);
  return children({ presenter });
}
```

- [ ] **Step 3: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/settings/SecuritySettings/feature.ts src/ui/presentation/settings/SecuritySettings/SecuritySettingsProvider.tsx
git commit -m "feat: add SecuritySettingsPresentationFeature and Provider"
```

---

### Task 22: SecuritySettingsPage component

**Files:**

- Create: `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx`

**Interfaces:**

- Consumes: `SecuritySettingsPresenter.Interface`
- Produces: `SecuritySettingsPage` React component

- [ ] **Step 1: Create page component**

```tsx
// src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx
import type React from "react";
import { useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { navigate } from "#ui/shared/router/router.js";
import { observer } from "mobx-react-lite";
import type { SecuritySettingsPresenter } from "../abstractions/SecuritySettingsPresenter.js";

interface SecuritySettingsPageProps {
  presenter: SecuritySettingsPresenter.Interface;
}

export const SecuritySettingsPage = observer(function SecuritySettingsPage({
  presenter
}: SecuritySettingsPageProps): React.ReactNode {
  const { vm } = presenter;
  const [editValue, setEditValue] = useState("");
  const [addValue, setAddValue] = useState("");

  useEffect(() => {
    presenter.load();
  }, [presenter]);

  function handleStartEdit(id: string, currentValue: string): void {
    setEditValue(currentValue);
    presenter.startEdit(id);
  }

  function handleStartAdd(fieldName: string, defaultValue: string): void {
    setAddValue(defaultValue);
    presenter.startAdd(fieldName);
  }

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
        <Title order={2}>Security Settings</Title>
      </Group>

      <SegmentedControl
        value={vm.selectedPackageManager}
        onChange={value => presenter.selectPackageManager(value as "yarn" | "npm" | "pnpm")}
        data={[
          { label: "Yarn", value: "yarn" },
          { label: "NPM", value: "npm" },
          { label: "PNPM", value: "pnpm" }
        ]}
      />

      {vm.error && (
        <Alert color="red" title="Error">
          {vm.error}
        </Alert>
      )}

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Field Name</Table.Th>
            <Table.Th>Config File</Table.Th>
            <Table.Th>Expected Value</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {vm.settings.map(setting => (
            <Table.Tr key={setting.id}>
              <Table.Td>
                <Text size="sm">{setting.description}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {setting.configFile}
                </Text>
              </Table.Td>
              <Table.Td>
                {vm.editingId === setting.id ? (
                  <Group gap="xs">
                    <TextInput
                      size="xs"
                      value={editValue}
                      onChange={e => setEditValue(e.currentTarget.value)}
                    />
                    <Button size="xs" onClick={() => presenter.confirmEdit(editValue)}>
                      Save
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => presenter.cancelEdit()}>
                      Cancel
                    </Button>
                  </Group>
                ) : (
                  <Text size="sm">{setting.expectedValue}</Text>
                )}
              </Table.Td>
              <Table.Td>
                {vm.editingId !== setting.id && (
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      onClick={() => handleStartEdit(setting.id, setting.expectedValue)}
                    >
                      &#9998;
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color="red"
                      onClick={() => presenter.remove(setting.id)}
                    >
                      &#10005;
                    </ActionIcon>
                  </Group>
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
                <Group gap="xs">
                  <TextInput
                    size="xs"
                    value={addValue}
                    onChange={e => setAddValue(e.currentTarget.value)}
                  />
                  <Button size="xs" onClick={() => presenter.confirmAdd(addValue)}>
                    Save
                  </Button>
                  <Button size="xs" variant="subtle" onClick={() => presenter.cancelAdd()}>
                    Cancel
                  </Button>
                </Group>
              </Table.Td>
              <Table.Td />
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      {vm.availableFields.length > 0 && !vm.addingField && (
        <Menu shadow="md" width={300}>
          <Menu.Target>
            <Button variant="light">Add Setting</Button>
          </Menu.Target>
          <Menu.Dropdown>
            {vm.availableFields.map(field => (
              <Menu.Item
                key={field.fieldName}
                onClick={() => handleStartAdd(field.fieldName, field.defaultExpectedValue)}
              >
                {field.description}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </Stack>
  );
});
```

- [ ] **Step 2: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 3: Commit**

```bash
git add src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx
git commit -m "feat: add SecuritySettingsPage component"
```

---

### Task 23: Wire up routing in App.tsx

**Files:**

- Modify: `src/ui/App.tsx`

**Interfaces:**

- Consumes: `SecuritySettingsFeature`, `SecuritySettingsUseCasesFeature`, `SecuritySettingsPresentationFeature`, `SecuritySettingsProvider`, `SecuritySettingsPage`
- Produces: `/settings` route, Settings link in header

- [ ] **Step 1: Add imports to App.tsx**

Add these imports at the top of `src/ui/App.tsx`:

```ts
import { SecuritySettingsFeature } from "#ui/features/settings/index.js";
import { SecuritySettingsUseCasesFeature } from "./presentation/settings/useCases/feature.js";
import { SecuritySettingsPresentationFeature } from "./presentation/settings/SecuritySettings/feature.js";
import { SecuritySettingsProvider } from "./presentation/settings/SecuritySettings/SecuritySettingsProvider.js";
import { SecuritySettingsPage } from "./presentation/settings/SecuritySettings/components/SecuritySettingsPage.js";
```

- [ ] **Step 2: Add features to ALL_FEATURES array**

Add to the `ALL_FEATURES` array (before `WebSocketFeature`):

```ts
    SecuritySettingsFeature,
    SecuritySettingsUseCasesFeature,
    SecuritySettingsPresentationFeature,
```

- [ ] **Step 3: Add /settings route to AppRoutes**

In the `AppRoutes` function, add the `/settings` check **before** the `projectDetailMatch`:

```tsx
function AppRoutes(): React.ReactNode {
    const path = useCurrentPath();

    if (path === "/settings") {
        return (
            <SecuritySettingsProvider>
                {({ presenter }) => <SecuritySettingsPage presenter={presenter} />}
            </SecuritySettingsProvider>
        );
    }

    const projectDetailMatch = PROJECT_DETAIL_PATH_PATTERN.exec(path);
    // ... rest stays the same
```

- [ ] **Step 4: Add Settings link to header**

In the `AppShell.Header`, add a link after the title. Also import `navigate` and `Anchor`:

```tsx
// Add to Mantine imports:
import { AppShell, Anchor, MantineProvider, Title, Group } from "@mantine/core";
// Add navigate import:
import { navigate, useCurrentPath } from "#ui/shared/router/router.js";

// In the header:
<AppShell.Header>
  <Group h="100%" px="md" justify="space-between">
    <Title order={3}>Dependency Upgrader</Title>
    <Anchor component="button" onClick={() => navigate("/settings")}>
      Settings
    </Anchor>
  </Group>
</AppShell.Header>;
```

- [ ] **Step 5: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 6: Run full pipeline**

Run: `yarn full`
Expected: all green

- [ ] **Step 7: Commit**

```bash
git add src/ui/App.tsx
git commit -m "feat: wire up /settings route and header link"
```
