# Custom Steps Part 3: Config UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the project settings UI for managing custom pre/post step hooks — CRUD operations, source badges, enable/disable, and reordering.

**Architecture:** Full MVP stack: API routes for step hooks CRUD, UI gateway/repository, use cases, presenter, and page component. Integrated into existing project detail navigation.

**Tech Stack:** TypeScript, React, Mantine, MobX, Fastify, Drizzle ORM, Vitest

## Global Constraints

- Named interfaces only, no inline structural types
- yarn for all package management
- Follow existing patterns: Gateway (abstraction + implementation), Repository, UseCase, Presenter
- Abstractions and implementations in separate files, separate directories

**Depends on:** `2026-07-27-custom-steps-01-backend-core.md` — requires `project_step_hooks` table and `StepHookService`.

---

### Task 1: API Routes for Step Hooks

**Files:**

- Create: `src/shared/routes/stepHooks.ts`
- Create: `src/api/routes/stepHooks.ts`
- Create: `src/api/routes/__tests__/stepHooks.test.ts`
- Modify: `src/shared/routes/index.ts` (add exports)
- Modify: `src/api/server.ts` or route registration (add routes)

**Interfaces:**

- Consumes: `projectStepHooks` table from schema, `DatabaseClient`
- Produces:
  - `GET /api/projects/:id/step-hooks` — list hooks for project
  - `POST /api/projects/:id/step-hooks` — create hook
  - `PUT /api/projects/:id/step-hooks/:hookId` — update hook
  - `DELETE /api/projects/:id/step-hooks/:hookId` — delete hook

- [ ] **Step 1: Define route schemas**

Create `src/shared/routes/stepHooks.ts`:

```typescript
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const stepHookSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  position: z.string(),
  name: z.string(),
  command: z.string(),
  type: z.enum(["command", "script", "package-script"]),
  required: z.boolean(),
  enabled: z.boolean(),
  sortOrder: z.number(),
  source: z.enum(["db", "file", "package-json"]),
  createdAt: z.number(),
  updatedAt: z.number()
});

export const listStepHooksRoute = defineRoute({
  method: "GET",
  path: "/api/projects/:id/step-hooks",
  description: "List step hooks for a project",
  params: z.object({ id: z.string() }),
  querystring: z.object({}),
  response: z.object({ items: z.array(stepHookSchema) })
});

export const createStepHookRoute = defineRoute({
  method: "POST",
  path: "/api/projects/:id/step-hooks",
  description: "Create a step hook for a project",
  params: z.object({ id: z.string() }),
  body: z.object({
    position: z.string(),
    name: z.string(),
    command: z.string(),
    type: z.enum(["command", "script", "package-script"]),
    required: z.boolean().default(false)
  }),
  response: z.object({ item: stepHookSchema })
});

export const updateStepHookRoute = defineRoute({
  method: "PUT",
  path: "/api/projects/:id/step-hooks/:hookId",
  description: "Update a step hook",
  params: z.object({ id: z.string(), hookId: z.string() }),
  body: z.object({
    name: z.string().optional(),
    command: z.string().optional(),
    type: z.enum(["command", "script", "package-script"]).optional(),
    required: z.boolean().optional(),
    enabled: z.boolean().optional(),
    sortOrder: z.number().optional()
  }),
  response: z.object({ item: stepHookSchema })
});

export const deleteStepHookRoute = defineRoute({
  method: "DELETE",
  path: "/api/projects/:id/step-hooks/:hookId",
  description: "Delete a step hook",
  params: z.object({ id: z.string(), hookId: z.string() }),
  body: z.object({}),
  response: z.object({ deleted: z.boolean() })
});
```

- [ ] **Step 2: Add exports to routes index**

In `src/shared/routes/index.ts`, add:

```typescript
export {
  listStepHooksRoute,
  createStepHookRoute,
  updateStepHookRoute,
  deleteStepHookRoute
} from "./stepHooks.js";
```

- [ ] **Step 3: Write failing route tests**

Create `src/api/routes/__tests__/stepHooks.test.ts` following the pattern from existing route tests (e.g. `upgradeSessions.test.ts`). Test:

- List returns empty array for project with no hooks
- Create adds a hook and returns it
- Update modifies an existing hook
- Delete removes a hook
- List returns hooks ordered by position and sortOrder

- [ ] **Step 4: Implement route handlers**

Create `src/api/routes/stepHooks.ts` with Fastify route handlers that perform CRUD on `projectStepHooks` table using `DatabaseClient`. Map DB integer booleans (`required`, `enabled`) to/from JSON booleans.

- [ ] **Step 5: Register routes**

Add `stepHooks` routes to the route registration in `src/api/server.ts` or wherever routes are registered (follow existing pattern).

- [ ] **Step 6: Run route tests**

Run: `yarn vitest run src/api/routes/__tests__/stepHooks.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/shared/routes/stepHooks.ts src/shared/routes/index.ts src/api/routes/stepHooks.ts src/api/routes/__tests__/stepHooks.test.ts
git commit -m "feat: add CRUD API routes for project step hooks"
```

---

### Task 2: UI Feature Layer (Gateway + Repository)

**Files:**

- Create: `src/ui/features/stepHooks/abstractions/StepHooksGateway.ts`
- Create: `src/ui/features/stepHooks/StepHooksGateway.ts`
- Create: `src/ui/features/stepHooks/abstractions/StepHooksRepository.ts`
- Create: `src/ui/features/stepHooks/StepHooksRepository.ts`
- Create: `src/ui/features/stepHooks/feature.ts`

**Interfaces:**

- Consumes: Route schemas from `src/shared/routes/stepHooks.ts`, `HTTPClient`
- Produces:
  - `IStepHooksGateway` — `list(projectId)`, `create(projectId, input)`, `update(projectId, hookId, input)`, `remove(projectId, hookId)`
  - `IStepHooksRepository` — `getHooks()`, `setHooks(hooks)`, observable store

- [ ] **Step 1: Create gateway abstraction**

Create `src/ui/features/stepHooks/abstractions/StepHooksGateway.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IStepHook {
  id: string;
  projectId: string;
  position: string;
  name: string;
  command: string;
  type: "command" | "script" | "package-script";
  required: boolean;
  enabled: boolean;
  sortOrder: number;
  source: "db" | "file" | "package-json";
  createdAt: number;
  updatedAt: number;
}

export interface ICreateStepHookInput {
  position: string;
  name: string;
  command: string;
  type: "command" | "script" | "package-script";
  required: boolean;
}

export interface IUpdateStepHookInput {
  name?: string;
  command?: string;
  type?: "command" | "script" | "package-script";
  required?: boolean;
  enabled?: boolean;
  sortOrder?: number;
}

export interface IStepHooksGateway {
  list(projectId: string): Promise<IStepHook[]>;
  create(projectId: string, input: ICreateStepHookInput): Promise<IStepHook>;
  update(projectId: string, hookId: string, input: IUpdateStepHookInput): Promise<IStepHook>;
  remove(projectId: string, hookId: string): Promise<void>;
}

export const StepHooksGateway = createAbstraction<IStepHooksGateway>("Ui/StepHooksGateway");

export namespace StepHooksGateway {
  export type Interface = IStepHooksGateway;
  export type StepHook = IStepHook;
  export type CreateInput = ICreateStepHookInput;
  export type UpdateInput = IUpdateStepHookInput;
}
```

- [ ] **Step 2: Implement gateway**

Create `src/ui/features/stepHooks/StepHooksGateway.ts` following the pattern from `ProjectsGateway.ts`. Use `HTTPClient` to call the route schemas defined in Step 1 of Task 1.

- [ ] **Step 3: Create repository abstraction and implementation**

Create `src/ui/features/stepHooks/abstractions/StepHooksRepository.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import { StepHooksGateway } from "./StepHooksGateway.js";

export interface IStepHooksRepository {
  getHooks(): StepHooksGateway.StepHook[];
  setHooks(hooks: StepHooksGateway.StepHook[]): void;
}

export const StepHooksRepository =
  createAbstraction<IStepHooksRepository>("Ui/StepHooksRepository");

export namespace StepHooksRepository {
  export type Interface = IStepHooksRepository;
  export type StepHook = StepHooksGateway.StepHook;
}
```

Create `src/ui/features/stepHooks/StepHooksRepository.ts` — simple array-backed store following `ProjectsRepository.ts` pattern.

- [ ] **Step 4: Create feature registration**

Create `src/ui/features/stepHooks/feature.ts` following existing feature pattern. Register gateway and repository.

- [ ] **Step 5: Verify it compiles**

Run: `yarn tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/ui/features/stepHooks/
git commit -m "feat: add step hooks UI gateway and repository"
```

---

### Task 3: Presenter and Settings Page

**Files:**

- Create: `src/ui/presentation/projects/StepHooks/abstractions/StepHooksPresenter.ts`
- Create: `src/ui/presentation/projects/StepHooks/StepHooksPresenter.ts`
- Create: `src/ui/presentation/projects/StepHooks/components/StepHooksPage.tsx`
- Create: `src/ui/presentation/projects/StepHooks/components/StepHookForm.tsx`
- Create: `src/ui/presentation/projects/StepHooks/components/StepHookList.tsx`
- Modify: `src/ui/App.tsx` (add route)

**Interfaces:**

- Consumes:
  - `StepHooksGateway.Interface` — CRUD operations
  - `StepHooksRepository.Interface` — local state
- Produces:
  - `IStepHooksPresenter` — `vm`, `load(projectId)`, `create(input)`, `update(hookId, input)`, `remove(hookId)`, `toggleEnabled(hookId)`
  - `StepHooksPage` component routed at `/projects/:id/step-hooks`

- [ ] **Step 1: Create presenter abstraction**

Create `src/ui/presentation/projects/StepHooks/abstractions/StepHooksPresenter.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { StepHooksGateway } from "../../../../features/stepHooks/abstractions/StepHooksGateway.js";

export interface IStepHookViewModel {
  id: string;
  position: string;
  name: string;
  command: string;
  type: "command" | "script" | "package-script";
  required: boolean;
  enabled: boolean;
  sortOrder: number;
  source: "db" | "file" | "package-json";
}

export interface IStepHooksViewModel {
  loading: boolean;
  error: string | null;
  hooks: IStepHookViewModel[];
  formOpen: boolean;
  editingHookId: string | null;
}

export interface IStepHooksPresenter {
  get vm(): IStepHooksViewModel;
  load: (projectId: string) => Promise<void>;
  create: (input: StepHooksGateway.CreateInput) => Promise<void>;
  update: (hookId: string, input: StepHooksGateway.UpdateInput) => Promise<void>;
  remove: (hookId: string) => Promise<void>;
  toggleEnabled: (hookId: string) => Promise<void>;
  openForm: (hookId?: string) => void;
  closeForm: () => void;
}

export const StepHooksPresenter = createAbstraction<IStepHooksPresenter>("Ui/StepHooksPresenter");

export namespace StepHooksPresenter {
  export type Interface = IStepHooksPresenter;
  export type ViewModel = IStepHooksViewModel;
  export type HookViewModel = IStepHookViewModel;
}
```

- [ ] **Step 2: Implement presenter**

Create `src/ui/presentation/projects/StepHooks/StepHooksPresenter.ts` using MobX `makeAutoObservable`. Follow `JobManagerPresenter.ts` as pattern reference. Key behaviors:

- `load` fetches hooks via gateway, stores in repository
- `create` calls gateway, reloads
- `update` calls gateway, reloads
- `remove` calls gateway, reloads
- `toggleEnabled` calls `update(hookId, { enabled: !current })`

- [ ] **Step 3: Create StepHookList component**

Create `src/ui/presentation/projects/StepHooks/components/StepHookList.tsx` — Mantine Table displaying hooks grouped by position. Each row shows: position badge, name, command (truncated), type badge, required/optional badge, source badge ("db"/"file"/"package-json"), enabled switch, edit button, delete button.

- [ ] **Step 4: Create StepHookForm component**

Create `src/ui/presentation/projects/StepHooks/components/StepHookForm.tsx` — Mantine Modal with form fields:

- Position: Select from available hook positions (`pre:select-packages`, `post:select-packages`, `pre:branch`, etc.)
- Name: TextInput
- Command: TextInput
- Type: Select (`command`, `script`, `package-script`)
- Required: Switch

- [ ] **Step 5: Create StepHooksPage**

Create `src/ui/presentation/projects/StepHooks/components/StepHooksPage.tsx`:

```tsx
import type React from "react";
import { useEffect } from "react";
import { Button, Group, Stack, Title } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { StepHooksPresenter } from "../abstractions/StepHooksPresenter.js";
import { StepHookList } from "./StepHookList.js";
import { StepHookForm } from "./StepHookForm.js";

interface StepHooksPageProps {
  presenter: StepHooksPresenter.Interface;
  projectId: string;
}

export const StepHooksPage = observer(function StepHooksPage({
  presenter,
  projectId
}: StepHooksPageProps): React.ReactNode {
  const { vm } = presenter;

  useEffect(() => {
    presenter.load(projectId);
  }, [presenter, projectId]);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Step Hooks</Title>
        <Button onClick={() => presenter.openForm()}>Add Hook</Button>
      </Group>

      <StepHookList
        hooks={vm.hooks}
        onToggleEnabled={presenter.toggleEnabled}
        onEdit={id => presenter.openForm(id)}
        onDelete={presenter.remove}
      />

      <StepHookForm
        opened={vm.formOpen}
        editingHook={vm.editingHookId ? vm.hooks.find(h => h.id === vm.editingHookId) : undefined}
        onSubmit={async input => {
          if (vm.editingHookId) {
            await presenter.update(vm.editingHookId, input);
          } else {
            await presenter.create(input);
          }
        }}
        onClose={presenter.closeForm}
      />
    </Stack>
  );
});
```

- [ ] **Step 6: Add route in App.tsx**

Add route for `/projects/:id/step-hooks` pointing to `StepHooksPage` with resolved presenter. Add navigation link on project detail page.

- [ ] **Step 7: Register feature and presenter in DI**

Update relevant feature files to register `StepHooksGateway`, `StepHooksRepository`, `StepHooksPresenter`.

- [ ] **Step 8: Verify it compiles and tests pass**

Run: `yarn tsc --noEmit && yarn vitest run`
Expected: No type errors, all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/ui/presentation/projects/StepHooks/ src/ui/features/stepHooks/ src/ui/App.tsx
git commit -m "feat: add step hooks config UI with CRUD and routing

Settings page to manage custom pre/post steps per project.
Supports add/edit/remove hooks, enable/disable toggle,
and source badges for DB/file/package-json origins."
```
