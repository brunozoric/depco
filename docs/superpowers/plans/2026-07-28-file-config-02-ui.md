# File-Based Config Part 2: UI Read-Only Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a project uses `.dependency-upgrader.json` for step hooks, the step hooks config page shows hooks as read-only with a banner explaining that hooks are file-managed.

**Architecture:** Gateway parses new `configSource` field from API response. Repository stores it. Presenter exposes it in view model. StepHooksPage conditionally hides edit controls and shows banner.

**Tech Stack:** TypeScript, React, MobX, Mantine, Vitest

## Global Constraints

- Named interfaces only, no inline structural types
- yarn for all package management
- After all changes: `yarn format:fix && yarn lint:fix`
- Commit directly to main

---

### Task 1: Gateway and Repository — configSource Support

**Files:**

- Modify: `src/ui/features/stepHooks/abstractions/StepHooksGateway.ts` — add `configSource` to list response
- Modify: `src/ui/features/stepHooks/StepHooksGateway.ts` — parse and return `configSource`
- Modify: `src/ui/features/stepHooks/abstractions/StepHooksRepository.ts` — store `configSource`
- Modify: `src/ui/features/stepHooks/StepHooksRepository.ts` — implement `configSource` storage

**Interfaces:**

- Consumes:
  - `listStepHooksRoute` response — now includes `configSource: "db" | "file"` (from backend plan Task 3)
- Produces:
  - `IStepHooksListResult` — `{ hooks: IStepHook[]; configSource: "db" | "file" }`
  - `IStepHooksGateway.list` returns `IStepHooksListResult` instead of `IStepHook[]` — **breaking change**: update all callers (StepHooksPresenter.load reads `.hooks` instead of direct array)
  - `IStepHooksRepository.getConfigSource(): "db" | "file"`
  - `IStepHooksRepository.setConfigSource(source: "db" | "file"): void`

- [ ] **Step 1: Update gateway abstraction**

In `src/ui/features/stepHooks/abstractions/StepHooksGateway.ts`, add result type and update `list` return:

```typescript
// Add new interface:
export interface IStepHooksListResult {
  hooks: IStepHook[];
  configSource: "db" | "file";
}

// Update IStepHooksGateway.list:
export interface IStepHooksGateway {
  list(projectId: string): Promise<IStepHooksListResult>;
  create(projectId: string, input: ICreateStepHookInput): Promise<IStepHook>;
  update(projectId: string, hookId: string, input: IUpdateStepHookInput): Promise<IStepHook>;
  remove(projectId: string, hookId: string): Promise<void>;
}

// Add to namespace:
export namespace StepHooksGateway {
  // ... existing exports ...
  export type ListResult = IStepHooksListResult;
}
```

- [ ] **Step 2: Update gateway implementation**

In `src/ui/features/stepHooks/StepHooksGateway.ts`, update `list` method:

```typescript
public async list(projectId: string): Promise<Abstraction.ListResult> {
    const response = await this.httpClient.request(listStepHooksRoute, {
        params: { id: projectId },
        query: {}
    });
    return {
        hooks: response.items,
        configSource: response.configSource
    };
}
```

- [ ] **Step 3: Update repository abstraction**

In `src/ui/features/stepHooks/abstractions/StepHooksRepository.ts`, add config source methods:

```typescript
export interface IStepHooksRepository {
  getHooks(): StepHooksGateway.StepHook[];
  setHooks(hooks: StepHooksGateway.StepHook[]): void;
  getConfigSource(): "db" | "file";
  setConfigSource(source: "db" | "file"): void;
}
```

- [ ] **Step 4: Update repository implementation**

In `src/ui/features/stepHooks/StepHooksRepository.ts`, add:

```typescript
class StepHooksRepositoryImpl implements Abstraction.Interface {
  private hooks: Abstraction.StepHook[] = [];
  private configSource: "db" | "file" = "db";

  public getHooks(): Abstraction.StepHook[] {
    return this.hooks;
  }

  public setHooks(hooks: Abstraction.StepHook[]): void {
    this.hooks = hooks;
  }

  public getConfigSource(): "db" | "file" {
    return this.configSource;
  }

  public setConfigSource(source: "db" | "file"): void {
    this.configSource = source;
  }
}
```

- [ ] **Step 5: Run format and lint**

Run: `yarn format:fix && yarn lint:fix`

- [ ] **Step 6: Run full test suite**

Run: `yarn vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/stepHooks/abstractions/StepHooksGateway.ts src/ui/features/stepHooks/StepHooksGateway.ts src/ui/features/stepHooks/abstractions/StepHooksRepository.ts src/ui/features/stepHooks/StepHooksRepository.ts
git commit -m "feat: add configSource support to step hooks gateway and repository"
```

---

### Task 2: Presenter and UI — Read-Only Mode

**Files:**

- Modify: `src/ui/presentation/projects/StepHooks/abstractions/StepHooksPresenter.ts` — add `configSource` to view model
- Modify: `src/ui/presentation/projects/StepHooks/StepHooksPresenter.ts` — populate from repository, update load to use new list return
- Modify: `src/ui/presentation/projects/StepHooks/components/StepHooksPage.tsx` — read-only mode + banner
- Modify: `src/ui/presentation/projects/StepHooks/components/StepHookList.tsx` — respect read-only mode

**Interfaces:**

- Consumes:
  - `IStepHooksListResult` from Task 1
  - `IStepHooksRepository.getConfigSource()` / `setConfigSource()` from Task 1
- Produces:
  - `IStepHooksViewModel.configSource: "db" | "file"` — UI reads this to toggle read-only

- [ ] **Step 1: Update presenter abstraction**

In `src/ui/presentation/projects/StepHooks/abstractions/StepHooksPresenter.ts`, add to view model:

```typescript
export interface IStepHooksViewModel {
  loading: boolean;
  error: string | null;
  hooks: IStepHookViewModel[];
  formOpen: boolean;
  editingHookId: string | null;
  configSource: "db" | "file";
}
```

- [ ] **Step 2: Update presenter implementation**

In `src/ui/presentation/projects/StepHooks/StepHooksPresenter.ts`, update `vm` getter and `load`:

```typescript
// In vm getter, add configSource:
public get vm(): Abstraction.ViewModel {
    const hooks: Abstraction.HookViewModel[] = this.stepHooksRepository
        .getHooks()
        .map(hook => ({
            id: hook.id,
            position: hook.position,
            name: hook.name,
            command: hook.command,
            type: hook.type,
            required: hook.required,
            enabled: hook.enabled,
            sortOrder: hook.sortOrder,
            source: hook.source
        }));

    return {
        loading: this.loading,
        error: this.error,
        hooks,
        formOpen: this.formOpen,
        editingHookId: this.editingHookId,
        configSource: this.stepHooksRepository.getConfigSource()
    };
}

// In load method, update to use new list result:
public load = async (projectId: string): Promise<void> => {
    this.projectId = projectId;
    this.loading = true;
    this.error = null;
    try {
        const result = await this.stepHooksGateway.list(projectId);
        runInAction(() => {
            this.stepHooksRepository.setHooks(result.hooks);
            this.stepHooksRepository.setConfigSource(result.configSource);
        });
    } catch (err) {
        runInAction(() => {
            this.error = err instanceof Error ? err.message : "Failed to load step hooks";
        });
    } finally {
        runInAction(() => {
            this.loading = false;
        });
    }
};
```

- [ ] **Step 3: Update StepHooksPage — read-only mode**

In `src/ui/presentation/projects/StepHooks/components/StepHooksPage.tsx`:

```typescript
// Add Alert import if not already present
import { ActionIcon, Alert, Button, Group, Stack, Text, Title } from "@mantine/core";

// In the component, after const { vm } = presenter:
const readOnly = vm.configSource === "file";

// Replace the "Add Hook" button section:
<Group justify="space-between">
    <Group gap="sm">
        <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => navigate(`/projects/${projectId}`)}
        >
            &larr;
        </ActionIcon>
        <Title order={3}>Step Hooks</Title>
    </Group>
    {!readOnly && <Button onClick={() => presenter.openForm()}>Add Hook</Button>}
</Group>

{readOnly && (
    <Alert color="blue" title="File-managed hooks">
        Step hooks are managed by .dependency-upgrader.json. Edit the config file to modify hooks.
    </Alert>
)}
```

- [ ] **Step 4: Update StepHookList — pass readOnly**

In `src/ui/presentation/projects/StepHooks/components/StepHookList.tsx`, the row already checks `hook.source === "db"` for editability (line 109: `const editable = hook.source === "db"`). When file config is active, all hooks will have `source: "file"`, so edit/delete/toggle controls will already be disabled. No change needed in StepHookList.

- [ ] **Step 5: Hide StepHookForm when read-only**

In `StepHooksPage.tsx`, wrap the form in a condition:

```typescript
{!readOnly && (
    <StepHookForm
        opened={vm.formOpen}
        editingHook={
            vm.editingHookId ? vm.hooks.find(h => h.id === vm.editingHookId) : undefined
        }
        onSubmit={async input => {
            if (vm.editingHookId) {
                await presenter.update(vm.editingHookId, input);
            } else {
                await presenter.create(input);
            }
        }}
        onClose={presenter.closeForm}
    />
)}
```

- [ ] **Step 6: Run format and lint**

Run: `yarn format:fix && yarn lint:fix`

- [ ] **Step 7: Run full test suite**

Run: `yarn vitest run`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/ui/presentation/projects/StepHooks/abstractions/StepHooksPresenter.ts src/ui/presentation/projects/StepHooks/StepHooksPresenter.ts src/ui/presentation/projects/StepHooks/components/StepHooksPage.tsx
git commit -m "feat: step hooks page read-only mode when config file active"
```
