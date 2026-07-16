# PM Name, Reset to Defaults, Orphaned Badge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PM name display to project pages, reset-to-defaults for security settings, and orphaned row badges.

**Architecture:** Three independent features sharing no dependencies between them. Feature 1 threads existing API data through UI layers. Feature 2 adds a new API endpoint + UI use case. Feature 3 is a pure presenter/page change.

**Tech Stack:** TypeScript, React, Mantine UI, MobX, Fastify, Drizzle ORM, Vitest, @webiny/di

## Global Constraints

- oxfmt formatting: 4-space indent for .ts/.tsx, double quotes, no trailing comma
- oxlint with `--deny-warnings`
- All DI abstractions in `abstractions/` directory, one file per token
- Never `new XxxImpl()` — always resolve through DI container
- Tests mock `HTTPClient` at DI level (UI) or use in-memory SQLite (API)
- `Impl` suffix only on class declaration, never on exports
- Arrow method properties on presenter/use-case public methods
- Run `yarn test` after each task to verify green

---

## Feature 1: Show PM Name

### Task 1: Add `packageManager` to gateway abstraction and impl

**Files:**

- Modify: `src/ui/features/projects/abstractions/ProjectsGateway.ts:3-11`
- Modify: `src/ui/features/projects/ProjectsGateway.ts:15-33`

**Interfaces:**

- Consumes: API response with `packageManager: string | null` (already present in `projectSchema`)
- Produces: `IProject.packageManager: string | null` — used by presenters in Tasks 2, 3

- [ ] **Step 1: Add `packageManager` to `IProject` interface**

In `src/ui/features/projects/abstractions/ProjectsGateway.ts`, add after line 6 (`path: string;`):

```typescript
packageManager: string | null;
```

- [ ] **Step 2: Add `packageManager` to `toProject()` parameter type and mapping**

In `src/ui/features/projects/ProjectsGateway.ts`, add `packageManager: string | null;` to the `toProject` parameter type (after `path: string;` at line 18), and add to the return object (after `path: item.path,` at line 27):

```typescript
packageManager: item.packageManager,
```

- [ ] **Step 3: Run tests**

Run: `yarn test`
Expected: All 244 tests pass. Some tests supply project data without `packageManager` — TypeScript may flag these. If so, the test fixtures need `packageManager: null` added. But since the mock HTTPClient returns raw objects (not typed), this should pass without changes.

- [ ] **Step 4: Commit**

```bash
git add src/ui/features/projects/abstractions/ProjectsGateway.ts src/ui/features/projects/ProjectsGateway.ts
git commit -m "feat: thread packageManager through ProjectsGateway"
```

---

### Task 2: Add `packageManager` to ProjectDetail VM + presenter + page

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts:3-8`
- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts:111-117`
- Modify: `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx:80`
- Modify: `src/ui/presentation/projects/ProjectDetail/__tests__/ProjectDetailPresenter.test.ts`

**Interfaces:**

- Consumes: `IProject.packageManager` from Task 1
- Produces: `IProjectDetailProjectViewModel.packageManager: string | null`

- [ ] **Step 1: Add `packageManager` to `IProjectDetailProjectViewModel`**

In `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`, add after line 7 (`pmVersion: string | null;`):

```typescript
packageManager: string | null;
```

- [ ] **Step 2: Map `packageManager` in presenter VM**

In `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`, in the `vm` getter's project mapping (around line 111-117), add after `pmVersion: project.pmVersion`:

```typescript
packageManager: project.packageManager ?? null,
```

The full block becomes:

```typescript
project: project
    ? {
          id: project.id,
          name: project.name,
          path: project.path,
          pmVersion: project.pmVersion,
          packageManager: project.packageManager ?? null
      }
    : null,
```

- [ ] **Step 3: Update `ProjectDetailPage` display**

In `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`, replace line 80:

```tsx
<Text size="sm">Package Manager: {project.pmVersion ?? "Unknown"}</Text>
```

with:

```tsx
<Text size="sm">
  {project.packageManager
    ? `${project.packageManager.charAt(0).toUpperCase()}${project.packageManager.slice(1)} ${project.pmVersion ?? ""}`.trim()
    : `Package Manager: ${project.pmVersion ?? "Unknown"}`}
</Text>
```

- [ ] **Step 4: Update test — add `packageManager` to project fixture and assertion**

In `src/ui/presentation/projects/ProjectDetail/__tests__/ProjectDetailPresenter.test.ts`:

In the `projectsListResult` fixture at line 210, add `packageManager: "yarn"` after `pmVersion: "4.1.0"`.

Update the assertion at line 240 to include `packageManager: "yarn"`:

```typescript
expect(presenter.vm.project).toEqual({
  id: "p1",
  name: "test-project",
  path: "/tmp/test-project",
  pmVersion: "4.1.0",
  packageManager: "yarn"
});
```

Also update the empty initial VM assertion at line 174 — `project: null` already covers it since null has no fields.

- [ ] **Step 5: Run tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/projects/ProjectDetail/
git commit -m "feat: show PM name in ProjectDetailPage"
```

---

### Task 3: Add `packageManager` to ProjectList VM + presenter + ProjectRow

**Files:**

- Modify: `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts:5-13`
- Modify: `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts:64-73`
- Modify: `src/ui/presentation/projects/ProjectList/components/ProjectRow.tsx:41`
- Modify: `src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts`

**Interfaces:**

- Consumes: `IProject.packageManager` from Task 1
- Produces: `IProjectListItem.packageManager: string | null`

- [ ] **Step 1: Add `packageManager` to `IProjectListItem`**

In `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`, add after line 9 (`pmVersion: string | null;`):

```typescript
packageManager: string | null;
```

- [ ] **Step 2: Map in presenter VM**

In `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`, in the VM getter's project mapping (line 64-73), add after `pmVersion: project.pmVersion,` (line 69):

```typescript
packageManager: project.packageManager ?? null,
```

- [ ] **Step 3: Update `ProjectRow` display**

In `src/ui/presentation/projects/ProjectList/components/ProjectRow.tsx`, replace line 41:

```tsx
<Table.Td>{project.pmVersion ?? "Unknown"}</Table.Td>
```

with:

```tsx
<Table.Td>
  {project.packageManager
    ? `${project.packageManager.charAt(0).toUpperCase()}${project.packageManager.slice(1)} ${project.pmVersion ?? ""}`.trim()
    : (project.pmVersion ?? "Unknown")}
</Table.Td>
```

- [ ] **Step 4: Update tests**

In `src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts`:

Add `packageManager: "yarn"` to project fixtures at lines 160, 163, 170, 214, 219, 263, 271, 293, 299, 308, 332, 371, 389.

Update assertion at line 180 to include `packageManager: "yarn"` in first project, `packageManager: null` in second.

Update assertion at line 234 to include `packageManager: null`.

- [ ] **Step 5: Run tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/projects/ProjectList/ src/ui/presentation/projects/ProjectList/__tests__/
git commit -m "feat: show PM name in project list"
```

---

## Feature 2: Reset to Defaults

### Task 4: Add `resetSecuritySettingsRoute` shared route definition

**Files:**

- Modify: `src/shared/routes/settings.ts`

**Interfaces:**

- Consumes: existing `securitySettingSchema` (line 4)
- Produces: `resetSecuritySettingsRoute` — used by API handler (Task 5) and gateway (Task 7)

- [ ] **Step 1: Add route definition**

In `src/shared/routes/settings.ts`, add after the `deleteSecuritySettingRoute` definition (after line 46):

```typescript
export const resetSecuritySettingsRoute = defineRoute({
  method: "POST",
  path: "/api/settings/security/reset",
  description: "Reset all security settings for a package manager to registry defaults",
  params: z.object({}),
  body: z.object({ packageManager: z.string() }),
  response: z.object({ items: z.array(securitySettingSchema), total: z.number() })
});
```

- [ ] **Step 2: Run tests**

Run: `yarn test`
Expected: All tests pass (route definition is just data, no behavior).

- [ ] **Step 3: Commit**

```bash
git add src/shared/routes/settings.ts
git commit -m "feat: add resetSecuritySettingsRoute definition"
```

---

### Task 5: Implement reset API handler + test

**Files:**

- Modify: `src/api/routes/settings.ts`
- Modify: `src/api/routes/__tests__/settings.test.ts`

**Interfaces:**

- Consumes: `resetSecuritySettingsRoute` from Task 4, `SECURITY_FIELD_REGISTRY`, `pmSecuritySettings` schema
- Produces: `POST /api/settings/security/reset` endpoint

- [ ] **Step 1: Write failing test**

In `src/api/routes/__tests__/settings.test.ts`, add a new describe block after the DELETE describe (after line 208):

```typescript
describe("POST /api/settings/security/reset", () => {
  it("deletes existing settings and creates defaults from registry", async () => {
    await app.inject({
      method: "POST",
      url: "/api/settings/security",
      payload: {
        packageManager: "yarn",
        fieldName: "enableScripts",
        expectedValue: "true"
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/settings/security/reset",
      payload: { packageManager: "yarn" }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items).toHaveLength(4);
    expect(body.total).toBe(4);
    expect(body.items.map((i: { fieldName: string }) => i.fieldName).sort()).toEqual([
      "approvedGitRepositories",
      "enableScripts",
      "npmMinimalAgeGate",
      "npmPreapprovedPackages"
    ]);
    expect(
      body.items.find((i: { fieldName: string }) => i.fieldName === "enableScripts").expectedValue
    ).toBe("false");
  });

  it("returns 400 for unknown package manager", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/settings/security/reset",
      payload: { packageManager: "bun" }
    });

    expect(response.statusCode).toBe(400);
  });

  it("works when no existing settings (creates all defaults)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/settings/security/reset",
      payload: { packageManager: "yarn" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(4);
  });

  it("returns empty items for PM with no registry fields", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/settings/security/reset",
      payload: { packageManager: "npm" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/api/routes/__tests__/settings.test.ts`
Expected: FAIL — route not found, 404.

- [ ] **Step 3: Implement handler**

In `src/api/routes/settings.ts`, add import for `resetSecuritySettingsRoute` (line 10):

```typescript
import {
  listSecuritySettingsRoute,
  createSecuritySettingRoute,
  updateSecuritySettingRoute,
  deleteSecuritySettingRoute,
  resetSecuritySettingsRoute
} from "#shared/routes/index.js";
```

Add handler after the `deleteSecuritySettingRoute` handler (after line 141, before the closing `}`):

```typescript
registerRoute(app, resetSecuritySettingsRoute, {}, async (request, reply) => {
  const { packageManager } = request.body;

  const fields = SECURITY_FIELD_REGISTRY[packageManager as keyof typeof SECURITY_FIELD_REGISTRY];
  if (!fields) {
    sendError(reply, 400, `Unknown package manager: ${packageManager}`);
    return;
  }

  await databaseClient.db
    .delete(pmSecuritySettings)
    .where(eq(pmSecuritySettings.packageManager, packageManager))
    .run();

  const rows = fields.map(field => ({
    id: generateId(),
    packageManager,
    configFile: field.configFile,
    fieldName: field.fieldName,
    expectedValue: field.defaultExpectedValue
  }));

  if (rows.length > 0) {
    await databaseClient.db.insert(pmSecuritySettings).values(rows).run();
  }

  sendList(reply, rows, rows.length);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/api/routes/__tests__/settings.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/settings.ts src/api/routes/__tests__/settings.test.ts
git commit -m "feat: add POST /api/settings/security/reset endpoint"
```

---

### Task 6: Add `resetDefaults` to gateway abstraction + impl

**Files:**

- Modify: `src/ui/features/settings/abstractions/SecuritySettingsGateway.ts:11-19`
- Modify: `src/ui/features/settings/SecuritySettingsGateway.ts`

**Interfaces:**

- Consumes: `resetSecuritySettingsRoute` from Task 4
- Produces: `ISecuritySettingsGateway.resetDefaults(pm: string): Promise<ISecuritySetting[]>` — used by Task 7

- [ ] **Step 1: Add method to abstraction**

In `src/ui/features/settings/abstractions/SecuritySettingsGateway.ts`, add after `remove(id: string): Promise<void>;` (line 19):

```typescript
resetDefaults(packageManager: string): Promise<ISecuritySetting[]>;
```

- [ ] **Step 2: Implement in gateway**

In `src/ui/features/settings/SecuritySettingsGateway.ts`, add import for `resetSecuritySettingsRoute` (update the import block at lines 3-8):

```typescript
import {
  listSecuritySettingsRoute,
  createSecuritySettingRoute,
  updateSecuritySettingRoute,
  deleteSecuritySettingRoute,
  resetSecuritySettingsRoute
} from "#shared/routes/index.js";
```

Add method to `SecuritySettingsGatewayImpl` class, after the `remove` method:

```typescript
public async resetDefaults(packageManager: string): Promise<Abstraction.SecuritySetting[]> {
    const response = await this.httpClient.request(resetSecuritySettingsRoute, {
        params: {},
        body: { packageManager }
    });
    return response.items;
}
```

- [ ] **Step 3: Run tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/ui/features/settings/abstractions/SecuritySettingsGateway.ts src/ui/features/settings/SecuritySettingsGateway.ts
git commit -m "feat: add resetDefaults to SecuritySettingsGateway"
```

---

### Task 7: Create ResetSecuritySettingsUseCase + register in DI

**Files:**

- Create: `src/ui/presentation/settings/useCases/abstractions/ResetSecuritySettingsUseCase.ts`
- Create: `src/ui/presentation/settings/useCases/ResetSecuritySettingsUseCase.ts`
- Modify: `src/ui/presentation/settings/useCases/feature.ts`

**Interfaces:**

- Consumes: `SecuritySettingsGateway.resetDefaults()` from Task 6, `SecuritySettingsRepository.setSettings()`
- Produces: `IResetSecuritySettingsUseCase.execute(pm: string): Promise<void>` — used by presenter in Task 8

- [ ] **Step 1: Create abstraction**

Create `src/ui/presentation/settings/useCases/abstractions/ResetSecuritySettingsUseCase.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IResetSecuritySettingsUseCase {
  execute(packageManager: string): Promise<void>;
}

export const ResetSecuritySettingsUseCase = createAbstraction<IResetSecuritySettingsUseCase>(
  "Ui/ResetSecuritySettingsUseCase"
);

export namespace ResetSecuritySettingsUseCase {
  export type Interface = IResetSecuritySettingsUseCase;
}
```

- [ ] **Step 2: Create implementation**

Create `src/ui/presentation/settings/useCases/ResetSecuritySettingsUseCase.ts`:

```typescript
import { ResetSecuritySettingsUseCase as Abstraction } from "./abstractions/ResetSecuritySettingsUseCase.js";
import { SecuritySettingsGateway } from "../../../features/settings/abstractions/SecuritySettingsGateway.js";
import { SecuritySettingsRepository } from "../../../features/settings/abstractions/SecuritySettingsRepository.js";

class ResetSecuritySettingsUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: SecuritySettingsGateway.Interface,
    private readonly repository: SecuritySettingsRepository.Interface
  ) {}

  public execute = async (packageManager: string): Promise<void> => {
    const settings = await this.gateway.resetDefaults(packageManager);
    const existing = this.repository.getSettings();
    const otherPmSettings = existing.filter(s => s.packageManager !== packageManager);
    this.repository.setSettings([...otherPmSettings, ...settings]);
  };
}

export const ResetSecuritySettingsUseCase = Abstraction.createImplementation({
  implementation: ResetSecuritySettingsUseCaseImpl,
  dependencies: [SecuritySettingsGateway, SecuritySettingsRepository]
});
```

- [ ] **Step 3: Register in DI feature**

In `src/ui/presentation/settings/useCases/feature.ts`, add import after line 7:

```typescript
import { ResetSecuritySettingsUseCase } from "./ResetSecuritySettingsUseCase.js";
```

Add registration inside `register()`, after line 16:

```typescript
container.register(ResetSecuritySettingsUseCase);
```

- [ ] **Step 4: Run tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/settings/useCases/
git commit -m "feat: add ResetSecuritySettingsUseCase"
```

---

### Task 8: Add `resetToDefaults` + `canReset` to presenter abstraction, impl + test

**Files:**

- Modify: `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts`
- Modify: `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts`
- Modify: `src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts`

**Interfaces:**

- Consumes: `ResetSecuritySettingsUseCase` from Task 7
- Produces: `ISecuritySettingsPresenter.resetToDefaults(): Promise<void>`, `ISecuritySettingsViewModel.canReset: boolean`

- [ ] **Step 1: Update presenter abstraction**

In `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts`:

Add to `ISecuritySettingsViewModel` (after line 26, `addingField: string | null;`):

```typescript
canReset: boolean;
```

Add to `ISecuritySettingsPresenter` (after line 39, `remove: (id: string) => Promise<void>;`):

```typescript
resetToDefaults: () => Promise<void>;
```

- [ ] **Step 2: Implement in presenter**

In `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts`:

Add import for `ResetSecuritySettingsUseCase` (after line 6):

```typescript
import { ResetSecuritySettingsUseCase } from "../useCases/abstractions/ResetSecuritySettingsUseCase.js";
```

Add constructor parameter (after `private readonly removeUseCase`, line 21):

```typescript
private readonly resetUseCase: ResetSecuritySettingsUseCase.Interface,
```

Add `canReset` to VM return (after `addingField: this.addingField,` at line 60):

```typescript
canReset: registry.length > 0,
```

Add method after `remove` (after line 149):

```typescript
public resetToDefaults = async (): Promise<void> => {
    this.error = null;
    this.editingId = null;
    this.addingField = null;
    this.loading = true;
    try {
        await this.resetUseCase.execute(this.selectedPm);
    } catch (err) {
        runInAction(() => {
            this.error = err instanceof Error ? err.message : "Failed to reset settings";
        });
    } finally {
        runInAction(() => {
            this.loading = false;
        });
    }
};
```

Update dependencies array (add after `RemoveSecuritySettingUseCase`):

```typescript
export const SecuritySettingsPresenter = Abstraction.createImplementation({
  implementation: SecuritySettingsPresenterImpl,
  dependencies: [
    LoadSecuritySettingsUseCase,
    CreateSecuritySettingUseCase,
    UpdateSecuritySettingUseCase,
    RemoveSecuritySettingUseCase,
    ResetSecuritySettingsUseCase,
    SecuritySettingsRepository
  ]
});
```

- [ ] **Step 3: Write tests**

In `src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts`:

Add `resetSecuritySettingsRoute` to the import from `#shared/routes/index.js` (line 5).

Add `let resetResult: unknown[];` to the test variables (after line 26).

In the mock HTTPClient `request` switch, add a case (after the `deleteSecuritySettingRoute` case):

```typescript
case resetSecuritySettingsRoute:
    return { items: resetResult, total: resetResult.length } as T;
```

Initialize in `beforeEach`:

```typescript
resetResult = [];
```

Add tests after the last existing test:

```typescript
it("canReset is true for yarn (has registry fields), false for npm (empty registry)", () => {
  const presenter = createPresenter();

  expect(presenter.vm.canReset).toBe(true);

  presenter.selectPackageManager("npm");

  expect(presenter.vm.canReset).toBe(false);
});

it("resetToDefaults calls reset endpoint and replaces settings for selected PM", async () => {
  listResult = [
    {
      id: "s1",
      packageManager: "yarn",
      configFile: ".yarnrc.yml",
      fieldName: "enableScripts",
      expectedValue: "true"
    }
  ];
  resetResult = [
    {
      id: "r1",
      packageManager: "yarn",
      configFile: ".yarnrc.yml",
      fieldName: "npmPreapprovedPackages",
      expectedValue: "*"
    },
    {
      id: "r2",
      packageManager: "yarn",
      configFile: ".yarnrc.yml",
      fieldName: "npmMinimalAgeGate",
      expectedValue: "0d"
    },
    {
      id: "r3",
      packageManager: "yarn",
      configFile: ".yarnrc.yml",
      fieldName: "enableScripts",
      expectedValue: "false"
    },
    {
      id: "r4",
      packageManager: "yarn",
      configFile: ".yarnrc.yml",
      fieldName: "approvedGitRepositories",
      expectedValue: "exists"
    }
  ];

  const presenter = createPresenter();
  await presenter.load();
  calls = [];

  await presenter.resetToDefaults();

  expect(calls).toEqual([
    {
      route: resetSecuritySettingsRoute,
      args: { params: {}, body: { packageManager: "yarn" } }
    }
  ]);
  expect(presenter.vm.settings).toHaveLength(4);
  expect(presenter.vm.settings.find(s => s.fieldName === "enableScripts")?.expectedValue).toBe(
    "false"
  );
  expect(presenter.vm.availableFields).toHaveLength(0);
  expect(presenter.vm.loading).toBe(false);
});

it("resetToDefaults clears editing and adding state", async () => {
  const presenter = createPresenter();
  presenter.startAdd("enableScripts");

  resetResult = [];
  await presenter.resetToDefaults();

  expect(presenter.vm.addingField).toBeNull();
  expect(presenter.vm.editingId).toBeNull();
});
```

- [ ] **Step 4: Run tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/settings/SecuritySettings/
git commit -m "feat: add resetToDefaults and canReset to SecuritySettingsPresenter"
```

---

### Task 9: Add "Reset to Defaults" button to SecuritySettingsPage

**Files:**

- Modify: `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx`

**Interfaces:**

- Consumes: `presenter.resetToDefaults()` and `vm.canReset` from Task 8

- [ ] **Step 1: Add button**

In `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx`, find the "Add Setting" button section (lines 185-203). Replace the block:

```tsx
{
  vm.availableFields.length > 0 && !vm.addingField && (
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
  );
}
```

with:

```tsx
<Group gap="sm">
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
  {vm.canReset && (
    <Button variant="light" color="orange" onClick={() => presenter.resetToDefaults()}>
      Reset to Defaults
    </Button>
  )}
</Group>
```

- [ ] **Step 2: Run tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx
git commit -m "feat: add Reset to Defaults button to SecuritySettingsPage"
```

---

## Feature 3: Orphaned Row Warning Badge

### Task 10: Add `isOrphaned` to presenter VM abstraction + impl + test

**Files:**

- Modify: `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts:4-10`
- Modify: `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts:33-42`
- Modify: `src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts`

**Interfaces:**

- Consumes: `SECURITY_FIELD_REGISTRY` lookup (already in presenter)
- Produces: `ISecuritySettingViewModel.isOrphaned: boolean`

- [ ] **Step 1: Add `isOrphaned` to VM interface**

In `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts`, add after line 9 (`expectedValue: string;`):

```typescript
isOrphaned: boolean;
```

- [ ] **Step 2: Compute `isOrphaned` in presenter**

In `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts`, in the `vm` getter's settings mapping (around lines 33-42), update to:

```typescript
const settings: Abstraction.SettingViewModel[] = pmSettings.map(s => {
  const def = registry.find(f => f.fieldName === s.fieldName);
  return {
    id: s.id,
    fieldName: s.fieldName,
    configFile: s.configFile,
    description: def?.description ?? s.fieldName,
    expectedValue: s.expectedValue,
    isOrphaned: !def
  };
});
```

- [ ] **Step 3: Write test**

In `src/ui/presentation/settings/SecuritySettings/__tests__/SecuritySettingsPresenter.test.ts`, add test:

```typescript
it("marks settings as orphaned when fieldName is not in the registry", async () => {
  listResult = [
    {
      id: "s1",
      packageManager: "yarn",
      configFile: ".yarnrc.yml",
      fieldName: "enableScripts",
      expectedValue: "false"
    },
    {
      id: "s2",
      packageManager: "yarn",
      configFile: ".yarnrc.yml",
      fieldName: "removedField",
      expectedValue: "something"
    }
  ];

  const presenter = createPresenter();
  await presenter.load();

  const scripts = presenter.vm.settings.find(s => s.fieldName === "enableScripts");
  const orphaned = presenter.vm.settings.find(s => s.fieldName === "removedField");

  expect(scripts?.isOrphaned).toBe(false);
  expect(orphaned?.isOrphaned).toBe(true);
  expect(orphaned?.description).toBe("removedField");
});
```

- [ ] **Step 4: Run tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/settings/SecuritySettings/
git commit -m "feat: add isOrphaned to SecuritySettingsPresenter VM"
```

---

### Task 11: Render orphaned badge in SecuritySettingsPage

**Files:**

- Modify: `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx`

**Interfaces:**

- Consumes: `setting.isOrphaned` from Task 10

- [ ] **Step 1: Add Mantine imports**

In `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx`, update the Mantine import (lines 3-17) to include `Badge` and `Tooltip`:

```tsx
import {
  ActionIcon,
  Alert,
  Badge,
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
  Title,
  Tooltip
} from "@mantine/core";
```

- [ ] **Step 2: Update row rendering**

In the settings table body, find the field name cell (lines 92-94):

```tsx
<Table.Td>
  <Text size="sm">{setting.description}</Text>
</Table.Td>
```

Replace with:

```tsx
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
```

- [ ] **Step 3: Add row background for orphaned rows**

Update the `Table.Tr` for settings (line 91):

```tsx
<Table.Tr key={setting.id}>
```

to:

```tsx
<Table.Tr key={setting.id} bg={setting.isOrphaned ? "orange.0" : undefined}>
```

- [ ] **Step 4: Run tests**

Run: `yarn test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx
git commit -m "feat: add orphaned row warning badge in SecuritySettingsPage"
```

---

## Task Dependency Map

Tasks that can run in parallel (no dependency between them):

```
Feature 1:  Task 1 → Task 2 (parallel with Task 3)
                   → Task 3 (parallel with Task 2)

Feature 2:  Task 4 → Task 5 (parallel with Task 6)
                   → Task 6 → Task 7 → Task 8 → Task 9

Feature 3:  Task 10 → Task 11

All three features are independent — Feature 1, 2, and 3 can run fully in parallel.
Within Feature 1: Tasks 2 and 3 are parallel after Task 1.
Within Feature 2: Tasks 5 and 6 are parallel after Task 4.
```

## Final Verification

After all tasks:

```bash
yarn full
```

Expected: adio + lint + format + build + all tests pass.
