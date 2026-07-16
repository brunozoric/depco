# Package.json Script Discovery Part 2: UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show discovered package.json scripts on the step hooks config page with an "Add as hook" button that opens the step hook form pre-filled with script data.

**Architecture:** Gateway returns discovered scripts from API. Repository stores them. Presenter exposes them in view model. New `DiscoveredScriptsList` component renders them below configured hooks with add buttons.

**Tech Stack:** TypeScript, React, MobX, Mantine, Vitest

## Global Constraints

- Named interfaces only, no inline structural types
- yarn for all package management
- After all changes: `yarn format:fix && yarn lint:fix`
- Commit directly to main
- Depends on: package-json-scripts-01-backend plan, file-config-02-ui plan

---

### Task 1: Gateway, Repository, and Presenter — discoveredScripts

**Files:**

- Modify: `src/ui/features/stepHooks/abstractions/StepHooksGateway.ts` — add `discoveredScripts` to `IStepHooksListResult`
- Modify: `src/ui/features/stepHooks/StepHooksGateway.ts` — parse `discoveredScripts` from response
- Modify: `src/ui/features/stepHooks/abstractions/StepHooksRepository.ts` — store discovered scripts
- Modify: `src/ui/features/stepHooks/StepHooksRepository.ts` — implement storage
- Modify: `src/ui/presentation/projects/StepHooks/abstractions/StepHooksPresenter.ts` — add to view model
- Modify: `src/ui/presentation/projects/StepHooks/StepHooksPresenter.ts` — populate from repository

**Interfaces:**

- Consumes:
  - `listStepHooksRoute` response — `discoveredScripts: { name: string; command: string }[]`
- Produces:
  - `IDiscoveredScriptViewModel` — `{ name: string; command: string }`
  - `IStepHooksViewModel.discoveredScripts: IDiscoveredScriptViewModel[]`
  - `IStepHooksListResult.discoveredScripts` array

- [ ] **Step 1: Update gateway abstraction**

In `src/ui/features/stepHooks/abstractions/StepHooksGateway.ts`, add to `IStepHooksListResult`:

```typescript
export interface IDiscoveredScript {
  name: string;
  command: string;
}

export interface IStepHooksListResult {
  hooks: IStepHook[];
  configSource: "db" | "file";
  discoveredScripts: IDiscoveredScript[];
}

// Add to namespace:
export namespace StepHooksGateway {
  // ... existing exports ...
  export type DiscoveredScript = IDiscoveredScript;
}
```

- [ ] **Step 2: Update gateway implementation**

In `src/ui/features/stepHooks/StepHooksGateway.ts`, update `list`:

```typescript
public async list(projectId: string): Promise<Abstraction.ListResult> {
    const response = await this.httpClient.request(listStepHooksRoute, {
        params: { id: projectId },
        query: {}
    });
    return {
        hooks: response.items,
        configSource: response.configSource,
        discoveredScripts: response.discoveredScripts
    };
}
```

- [ ] **Step 3: Update repository abstraction**

In `src/ui/features/stepHooks/abstractions/StepHooksRepository.ts`, add:

```typescript
import type { StepHooksGateway } from "./StepHooksGateway.js";

export interface IStepHooksRepository {
  getHooks(): StepHooksGateway.StepHook[];
  setHooks(hooks: StepHooksGateway.StepHook[]): void;
  getConfigSource(): "db" | "file";
  setConfigSource(source: "db" | "file"): void;
  getDiscoveredScripts(): StepHooksGateway.DiscoveredScript[];
  setDiscoveredScripts(scripts: StepHooksGateway.DiscoveredScript[]): void;
}
```

- [ ] **Step 4: Update repository implementation**

In `src/ui/features/stepHooks/StepHooksRepository.ts`, add:

```typescript
private discoveredScripts: Abstraction.DiscoveredScript[] = [];

public getDiscoveredScripts(): Abstraction.DiscoveredScript[] {
    return this.discoveredScripts;
}

public setDiscoveredScripts(scripts: Abstraction.DiscoveredScript[]): void {
    this.discoveredScripts = scripts;
}
```

Also add `DiscoveredScript` to the `StepHooksRepository` namespace so the implementation can reference it as `Abstraction.DiscoveredScript`:

```typescript
export namespace StepHooksRepository {
  export type Interface = IStepHooksRepository;
  export type StepHook = StepHooksGateway.StepHook;
  export type DiscoveredScript = StepHooksGateway.DiscoveredScript;
}
```

- [ ] **Step 5: Update presenter abstraction**

In `src/ui/presentation/projects/StepHooks/abstractions/StepHooksPresenter.ts`, add:

```typescript
export interface IDiscoveredScriptViewModel {
  name: string;
  command: string;
}

export interface IStepHooksViewModel {
  loading: boolean;
  error: string | null;
  hooks: IStepHookViewModel[];
  formOpen: boolean;
  editingHookId: string | null;
  configSource: "db" | "file";
  discoveredScripts: IDiscoveredScriptViewModel[];
}
```

- [ ] **Step 6: Update presenter implementation**

In `src/ui/presentation/projects/StepHooks/StepHooksPresenter.ts`:

```typescript
// In vm getter, add discoveredScripts:
public get vm(): Abstraction.ViewModel {
    // ... existing hooks mapping ...

    return {
        loading: this.loading,
        error: this.error,
        hooks,
        formOpen: this.formOpen,
        editingHookId: this.editingHookId,
        configSource: this.stepHooksRepository.getConfigSource(),
        discoveredScripts: this.stepHooksRepository.getDiscoveredScripts().map(s => ({
            name: s.name,
            command: s.command
        }))
    };
}

// In load, update to store discovered scripts:
const result = await this.stepHooksGateway.list(projectId);
runInAction(() => {
    this.stepHooksRepository.setHooks(result.hooks);
    this.stepHooksRepository.setConfigSource(result.configSource);
    this.stepHooksRepository.setDiscoveredScripts(result.discoveredScripts);
});
```

- [ ] **Step 7: Run format and lint**

Run: `yarn format:fix && yarn lint:fix`

- [ ] **Step 8: Run full test suite**

Run: `yarn vitest run`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/ui/features/stepHooks/abstractions/StepHooksGateway.ts src/ui/features/stepHooks/StepHooksGateway.ts src/ui/features/stepHooks/abstractions/StepHooksRepository.ts src/ui/features/stepHooks/StepHooksRepository.ts src/ui/presentation/projects/StepHooks/abstractions/StepHooksPresenter.ts src/ui/presentation/projects/StepHooks/StepHooksPresenter.ts
git commit -m "feat: wire discovered scripts through gateway, repository, presenter"
```

---

### Task 2: DiscoveredScriptsList Component and StepHooksPage Integration

**Files:**

- Create: `src/ui/presentation/projects/StepHooks/components/DiscoveredScriptsList.tsx`
- Modify: `src/ui/presentation/projects/StepHooks/components/StepHooksPage.tsx` — add DiscoveredScriptsList, wire "Add as hook" to open pre-filled form

**Interfaces:**

- Consumes:
  - `IStepHooksViewModel.discoveredScripts` from Task 1
  - `IStepHooksViewModel.configSource` — disables add button when `"file"`
  - `StepHooksPresenter.openForm()` — to open form for new hook
- Produces:
  - `DiscoveredScriptsList` component — renders scripts with "Add as hook" buttons

- [ ] **Step 1: Create DiscoveredScriptsList component**

Create `src/ui/presentation/projects/StepHooks/components/DiscoveredScriptsList.tsx`:

```typescript
import type React from "react";
import { ActionIcon, Badge, Group, Stack, Table, Text, Tooltip } from "@mantine/core";
import type { StepHooksPresenter } from "../abstractions/StepHooksPresenter.js";

interface DiscoveredScriptsListProps {
    scripts: StepHooksPresenter.DiscoveredScriptViewModel[];
    configSource: "db" | "file";
    onAdd: (name: string, command: string) => void;
}

function truncate(value: string, max = 60): string {
    return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function DiscoveredScriptsList({
    scripts,
    configSource,
    onAdd
}: DiscoveredScriptsListProps): React.ReactNode {
    if (scripts.length === 0) {
        return null;
    }

    const addDisabled = configSource === "file";

    return (
        <Stack gap="xs">
            <Group gap="xs">
                <Text size="sm" fw={600}>
                    Detected from package.json
                </Text>
                <Badge variant="light" color="orange" size="sm">
                    {scripts.length}
                </Badge>
            </Group>
            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Script</Table.Th>
                        <Table.Th>Command</Table.Th>
                        <Table.Th>Action</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {scripts.map(script => (
                        <Table.Tr key={script.name}>
                            <Table.Td>
                                <Text size="sm" fw={500}>
                                    {script.name}
                                </Text>
                            </Table.Td>
                            <Table.Td>
                                <Text size="sm" c="dimmed" title={script.command}>
                                    {truncate(script.command)}
                                </Text>
                            </Table.Td>
                            <Table.Td>
                                {addDisabled ? (
                                    <Tooltip label="Hooks managed by config file — add scripts directly to .dependency-upgrader.json">
                                        <ActionIcon variant="subtle" size="sm" disabled>
                                            +
                                        </ActionIcon>
                                    </Tooltip>
                                ) : (
                                    <ActionIcon
                                        variant="subtle"
                                        size="sm"
                                        onClick={() => onAdd(script.name, script.command)}
                                    >
                                        +
                                    </ActionIcon>
                                )}
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </Stack>
    );
}
```

- [ ] **Step 2: Add DiscoveredScriptViewModel to presenter namespace**

In `src/ui/presentation/projects/StepHooks/abstractions/StepHooksPresenter.ts`, add to namespace:

```typescript
export namespace StepHooksPresenter {
  // ... existing exports ...
  export type DiscoveredScriptViewModel = IDiscoveredScriptViewModel;
}
```

- [ ] **Step 3: Integrate into StepHooksPage**

In `src/ui/presentation/projects/StepHooks/components/StepHooksPage.tsx`:

```typescript
// Add import:
import { DiscoveredScriptsList } from "./DiscoveredScriptsList.js";

// Add handler inside the component:
const handleAddScript = (name: string, command: string): void => {
    // Pre-fill form data will be passed via the form's initial values
    // For now, open the form — the pre-filling mechanism needs
    // a way to pass initial values. Add openFormWithDefaults to presenter.
    presenter.openForm();
};

// Add DiscoveredScriptsList after StepHookList in the JSX:
<DiscoveredScriptsList
    scripts={vm.discoveredScripts}
    configSource={vm.configSource}
    onAdd={handleAddScript}
/>
```

- [ ] **Step 4: Add openFormWithDefaults to presenter for pre-filling**

In `src/ui/presentation/projects/StepHooks/abstractions/StepHooksPresenter.ts`, add method:

```typescript
export interface IStepHooksPresenter {
  // ... existing methods ...
  openFormWithDefaults: (defaults: {
    name: string;
    command: string;
    type: "package-script";
  }) => void;
}
```

In `src/ui/presentation/projects/StepHooks/StepHooksPresenter.ts`, add:

```typescript
private formDefaults: { name: string; command: string; type: "package-script" } | null = null;

public openFormWithDefaults = (defaults: { name: string; command: string; type: "package-script" }): void => {
    this.formDefaults = defaults;
    this.formOpen = true;
    this.editingHookId = null;
};
```

Add `formDefaults` to the view model:

```typescript
export interface IStepHooksViewModel {
  // ... existing fields ...
  formDefaults: { name: string; command: string; type: "package-script" } | null;
}

// In vm getter:
formDefaults: this.formDefaults;
```

Clear `formDefaults` in `closeForm`:

```typescript
public closeForm = (): void => {
    this.formOpen = false;
    this.editingHookId = null;
    this.formDefaults = null;
};
```

- [ ] **Step 5: Update StepHookForm to accept defaults**

In `src/ui/presentation/projects/StepHooks/components/StepHookForm.tsx`, update props and `useEffect`:

```typescript
interface StepHookFormProps {
  opened: boolean;
  editingHook: StepHooksPresenter.HookViewModel | undefined;
  defaults: { name: string; command: string; type: "package-script" } | null;
  onSubmit: (input: StepHooksGateway.CreateInput) => Promise<void>;
  onClose: () => void;
}

// In useEffect, add defaults branch:
useEffect(() => {
  if (!opened) {
    return;
  }
  if (editingHook) {
    setPosition(editingHook.position);
    setName(editingHook.name);
    setCommand(editingHook.command);
    setType(editingHook.type);
    setRequired(editingHook.required);
  } else if (defaults) {
    setPosition(DEFAULT_POSITION);
    setName(defaults.name);
    setCommand(defaults.command);
    setType(defaults.type);
    setRequired(false);
  } else {
    setPosition(DEFAULT_POSITION);
    setName("");
    setCommand("");
    setType(DEFAULT_TYPE);
    setRequired(false);
  }
}, [opened, editingHook, defaults]);
```

- [ ] **Step 6: Wire everything together in StepHooksPage**

Update `StepHooksPage.tsx` to pass `defaults` prop and use `openFormWithDefaults`:

```typescript
const handleAddScript = (name: string, command: string): void => {
    presenter.openFormWithDefaults({ name, command, type: "package-script" });
};

// In StepHookForm usage:
<StepHookForm
    opened={vm.formOpen}
    editingHook={
        vm.editingHookId ? vm.hooks.find(h => h.id === vm.editingHookId) : undefined
    }
    defaults={vm.formDefaults}
    onSubmit={async input => {
        if (vm.editingHookId) {
            await presenter.update(vm.editingHookId, input);
        } else {
            await presenter.create(input);
        }
    }}
    onClose={presenter.closeForm}
/>
```

- [ ] **Step 7: Run format and lint**

Run: `yarn format:fix && yarn lint:fix`

- [ ] **Step 8: Run full test suite**

Run: `yarn vitest run`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/ui/presentation/projects/StepHooks/components/DiscoveredScriptsList.tsx src/ui/presentation/projects/StepHooks/components/StepHooksPage.tsx src/ui/presentation/projects/StepHooks/components/StepHookForm.tsx src/ui/presentation/projects/StepHooks/abstractions/StepHooksPresenter.ts src/ui/presentation/projects/StepHooks/StepHooksPresenter.ts
git commit -m "feat: discovered scripts UI with add-as-hook flow"
```
