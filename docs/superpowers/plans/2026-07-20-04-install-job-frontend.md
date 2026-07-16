# Install Job — Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build install dialog with PM-specific option components, node_modules badge on project cards, and auto-refresh after install completes.

**Architecture:** `InstallDialog` modal renders PM-specific options component via registry lookup. Each PM component (`NpmInstallOptions`, `YarnInstallOptions`, etc.) renders switches for its flags, fetched from `GET /api/install-options/:pm`. Gateway handles API calls. `ProjectRow` shows node_modules badge. WS `install:complete` triggers list refresh.

**Tech Stack:** TypeScript, React, Mantine, MobX, Vitest

## Global Constraints

- oxfmt formatting (4-space indent for .ts/.tsx files)
- oxlint linting
- Bun runtime
- MVP layers: Gateway -> Repository -> UseCase -> Presenter -> React
- All abstractions in `abstractions/` dirs with barrel index.ts
- Run `bun run build` after each task to verify compilation

## Prerequisite

Plan 3 (Install Job Backend) must be completed first. This plan depends on:

- `POST /api/projects/:id/install` route
- `GET /api/install-options/:packageManager` route
- `install:complete` WS event type
- `hasNodeModules` field on project API responses
- `installProjectRoute` and `getInstallOptionsRoute` shared route definitions

---

### Task 1: UI gateway and types for install

**Files:**

- Modify: `src/ui/features/projects/abstractions/ProjectsGateway.ts`
- Modify: `src/ui/features/projects/ProjectsGateway.ts`

**Interfaces:**

- Consumes: `installProjectRoute`, `getInstallOptionsRoute` from `#shared/routes/index.js`
- Produces:
  - `install(id: string, flags: string[]): Promise<IScanJob>` on `IProjectsGateway`
  - `getInstallOptions(packageManager: string): Promise<IInstallFlagDefinition[]>` on `IProjectsGateway`
  - `hasNodeModules: boolean` on `IProject`

- [ ] **Step 1: Add hasNodeModules and install methods to gateway abstraction**

In `src/ui/features/projects/abstractions/ProjectsGateway.ts`:

1. Add `hasNodeModules` to `IProject`:

```ts
hasNodeModules: boolean;
```

2. Re-export shared install flag type:

```ts
import type { IInstallFlagDefinition } from "#shared/install/types.js";
export type { IInstallFlagDefinition };
```

3. Add methods to `IProjectsGateway`:

```ts
    install(id: string, flags?: string[]): Promise<IScanJob>;
    getInstallOptions(packageManager: string): Promise<IInstallFlagDefinition[]>;
```

4. Add to namespace:

```ts
export type InstallFlagDefinition = IInstallFlagDefinition;
```

- [ ] **Step 2: Implement in ProjectsGateway**

In `src/ui/features/projects/ProjectsGateway.ts`:

1. Add imports:

```ts
import {
  // ... existing imports ...
  installProjectRoute,
  getInstallOptionsRoute
} from "#shared/routes/index.js";
```

2. Update `toProject` function to include `hasNodeModules`:

```ts
function toProject(item: {
  // ... existing fields ...
  hasNodeModules?: boolean;
}): IProject {
  return {
    // ... existing fields ...
    hasNodeModules: item.hasNodeModules ?? false
  };
}
```

3. Add methods to `ProjectsGatewayImpl`:

```ts
    public async install(id: string, flags: string[] = []): Promise<Abstraction.ScanJob> {
        const response = await this.httpClient.request(installProjectRoute, {
            params: { id },
            body: { flags }
        });
        return response.item;
    }

    public async getInstallOptions(
        packageManager: string
    ): Promise<Abstraction.InstallFlagDefinition[]> {
        const response = await this.httpClient.request(getInstallOptionsRoute, {
            params: { packageManager }
        });
        return response.items;
    }
```

- [ ] **Step 3: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 4: Run tests**

Run: `bun run test`
Expected: existing gateway tests may need `hasNodeModules` in mock data. Fix any failures.

- [ ] **Step 5: Commit**

```bash
git add src/ui/features/projects/abstractions/ProjectsGateway.ts \
  src/ui/features/projects/ProjectsGateway.ts
git commit -m "feat: add install and getInstallOptions to projects gateway, hasNodeModules on IProject"
```

---

### Task 2: node_modules badge on project list

**Files:**

- Modify: `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectList/components/ProjectRow.tsx`
- Modify: `src/ui/presentation/projects/ProjectList/components/ProjectListPage.tsx`

**Interfaces:**

- Consumes: `hasNodeModules` from `IProject`, `install:complete` WS event
- Produces: "Installed"/"Not Installed" badge on project rows, auto-refresh on install:complete

- [ ] **Step 1: Add hasNodeModules to ProjectListItem**

In `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`, add to `IProjectListItem`:

```ts
hasNodeModules: boolean;
```

- [ ] **Step 2: Map hasNodeModules in presenter**

In `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`, update the `vm` getter's project mapping to include:

```ts
    hasNodeModules: project.hasNodeModules ?? false,
```

- [ ] **Step 3: Listen for install:complete WS event**

In `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`, add in the constructor alongside existing WS listeners:

```ts
this.webSocketListener.on("install:complete", () => {
  void this.loadProjectsUseCase.execute();
});
```

- [ ] **Step 4: Add badge to ProjectRow**

In `src/ui/presentation/projects/ProjectList/components/ProjectRow.tsx`:

Add a new `Table.Td` after the Package Manager column (before Security):

```tsx
<Table.Td>
  <Badge size="sm" color={project.hasNodeModules ? "green" : "gray"}>
    {project.hasNodeModules ? "Installed" : "Not Installed"}
  </Badge>
</Table.Td>
```

- [ ] **Step 5: Add table header for new column**

In `src/ui/presentation/projects/ProjectList/components/ProjectListPage.tsx`, add a new `Table.Th` after "Package Manager":

```tsx
<Table.Th>Dependencies</Table.Th>
```

- [ ] **Step 6: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 7: Run full test suite**

Run: `bun run test`
Expected: all tests pass. Update any ProjectListPresenter test mocks to include `hasNodeModules`.

- [ ] **Step 8: Commit**

```bash
git add src/ui/presentation/projects/ProjectList/
git commit -m "feat: add node_modules installed/not-installed badge to project list"
```

---

### Task 3: PM option components

**Files:**

- Create: `src/ui/presentation/projects/ProjectDetail/components/install/NpmInstallOptions.tsx`
- Create: `src/ui/presentation/projects/ProjectDetail/components/install/YarnInstallOptions.tsx`
- Create: `src/ui/presentation/projects/ProjectDetail/components/install/PnpmInstallOptions.tsx`
- Create: `src/ui/presentation/projects/ProjectDetail/components/install/BunInstallOptions.tsx`
- Create: `src/ui/presentation/projects/ProjectDetail/components/install/registry.ts`
- Create: `src/ui/presentation/projects/ProjectDetail/components/install/index.ts`

**Interfaces:**

- Consumes: `IInstallFlagDefinition` from projects gateway
- Produces:
  - `InstallOptionsProps` — `{ flags: IInstallFlagDefinition[]; selected: string[]; onToggle: (flag: string) => void }`
  - `INSTALL_OPTIONS_COMPONENTS` — `Record<PackageManagerId, React.ComponentType<InstallOptionsProps>>`

- [ ] **Step 1: Create InstallOptionsProps and registry**

Create `src/ui/presentation/projects/ProjectDetail/components/install/registry.ts`:

```ts
import type React from "react";
import type { PackageManagerId } from "#shared/security/index.js";
import type { ProjectsGateway } from "#ui/features/projects/abstractions/ProjectsGateway.js";

export interface InstallOptionsProps {
  flags: ProjectsGateway.InstallFlagDefinition[];
  selected: string[];
  onToggle: (flag: string) => void;
}

export type InstallOptionsComponent = React.ComponentType<InstallOptionsProps>;

export const INSTALL_OPTIONS_COMPONENTS: Record<PackageManagerId, InstallOptionsComponent | null> =
  {
    npm: null,
    yarn: null,
    pnpm: null,
    bun: null
  };
```

We'll fill in the component references after creating them.

- [ ] **Step 2: Create NpmInstallOptions component**

Create `src/ui/presentation/projects/ProjectDetail/components/install/NpmInstallOptions.tsx`:

```tsx
import type React from "react";
import { Stack, Switch, Text } from "@mantine/core";
import type { InstallOptionsProps } from "./registry.js";

export function NpmInstallOptions({
  flags,
  selected,
  onToggle
}: InstallOptionsProps): React.ReactNode {
  return (
    <Stack gap="xs">
      {flags.map(flag => (
        <Switch
          key={flag.flag}
          label={flag.label}
          description={flag.description}
          checked={selected.includes(flag.flag)}
          onChange={() => onToggle(flag.flag)}
        />
      ))}
      {flags.length === 0 && (
        <Text size="sm" c="dimmed">
          No options available
        </Text>
      )}
    </Stack>
  );
}
```

- [ ] **Step 3: Create YarnInstallOptions, PnpmInstallOptions, BunInstallOptions**

Each follows the same pattern as NpmInstallOptions. Create:

`src/ui/presentation/projects/ProjectDetail/components/install/YarnInstallOptions.tsx`:

```tsx
import type React from "react";
import { Stack, Switch, Text } from "@mantine/core";
import type { InstallOptionsProps } from "./registry.js";

export function YarnInstallOptions({
  flags,
  selected,
  onToggle
}: InstallOptionsProps): React.ReactNode {
  return (
    <Stack gap="xs">
      {flags.map(flag => (
        <Switch
          key={flag.flag}
          label={flag.label}
          description={flag.description}
          checked={selected.includes(flag.flag)}
          onChange={() => onToggle(flag.flag)}
        />
      ))}
      {flags.length === 0 && (
        <Text size="sm" c="dimmed">
          No options available
        </Text>
      )}
    </Stack>
  );
}
```

`src/ui/presentation/projects/ProjectDetail/components/install/PnpmInstallOptions.tsx`:

```tsx
import type React from "react";
import { Stack, Switch, Text } from "@mantine/core";
import type { InstallOptionsProps } from "./registry.js";

export function PnpmInstallOptions({
  flags,
  selected,
  onToggle
}: InstallOptionsProps): React.ReactNode {
  return (
    <Stack gap="xs">
      {flags.map(flag => (
        <Switch
          key={flag.flag}
          label={flag.label}
          description={flag.description}
          checked={selected.includes(flag.flag)}
          onChange={() => onToggle(flag.flag)}
        />
      ))}
      {flags.length === 0 && (
        <Text size="sm" c="dimmed">
          No options available
        </Text>
      )}
    </Stack>
  );
}
```

`src/ui/presentation/projects/ProjectDetail/components/install/BunInstallOptions.tsx`:

```tsx
import type React from "react";
import { Stack, Switch, Text } from "@mantine/core";
import type { InstallOptionsProps } from "./registry.js";

export function BunInstallOptions({
  flags,
  selected,
  onToggle
}: InstallOptionsProps): React.ReactNode {
  return (
    <Stack gap="xs">
      {flags.map(flag => (
        <Switch
          key={flag.flag}
          label={flag.label}
          description={flag.description}
          checked={selected.includes(flag.flag)}
          onChange={() => onToggle(flag.flag)}
        />
      ))}
      {flags.length === 0 && (
        <Text size="sm" c="dimmed">
          No options available
        </Text>
      )}
    </Stack>
  );
}
```

- [ ] **Step 4: Update registry with component references**

Update `src/ui/presentation/projects/ProjectDetail/components/install/registry.ts`:

```ts
import type React from "react";
import type { PackageManagerId } from "#shared/security/index.js";
import type { ProjectsGateway } from "#ui/features/projects/abstractions/ProjectsGateway.js";
import { NpmInstallOptions } from "./NpmInstallOptions.js";
import { YarnInstallOptions } from "./YarnInstallOptions.js";
import { PnpmInstallOptions } from "./PnpmInstallOptions.js";
import { BunInstallOptions } from "./BunInstallOptions.js";

export interface InstallOptionsProps {
  flags: ProjectsGateway.InstallFlagDefinition[];
  selected: string[];
  onToggle: (flag: string) => void;
}

export type InstallOptionsComponent = React.ComponentType<InstallOptionsProps>;

export const INSTALL_OPTIONS_COMPONENTS: Record<PackageManagerId, InstallOptionsComponent> = {
  npm: NpmInstallOptions,
  yarn: YarnInstallOptions,
  pnpm: PnpmInstallOptions,
  bun: BunInstallOptions
};
```

- [ ] **Step 5: Create barrel export**

Create `src/ui/presentation/projects/ProjectDetail/components/install/index.ts`:

```ts
export {
  type InstallOptionsProps,
  type InstallOptionsComponent,
  INSTALL_OPTIONS_COMPONENTS
} from "./registry.js";
```

- [ ] **Step 6: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 7: Commit**

```bash
git add src/ui/presentation/projects/ProjectDetail/components/install/
git commit -m "feat: add PM-specific install option components with registry"
```

---

### Task 4: InstallDialog modal

**Files:**

- Create: `src/ui/presentation/projects/ProjectDetail/components/InstallDialog.tsx`
- Modify: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`
- Modify: `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`

**Interfaces:**

- Consumes: `INSTALL_OPTIONS_COMPONENTS`, `ProjectsGateway.install`, `ProjectsGateway.getInstallOptions`, `ProjectDetailPresenter`
- Produces: `InstallDialog` component, `install()` method on presenter

- [ ] **Step 1: Add install method to presenter abstraction**

In `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`, add to `IProjectDetailPresenter`:

```ts
install: (flags?: string[]) => Promise<void>;
```

- [ ] **Step 2: Implement install on presenter**

In `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`:

1. Add `install` method:

```ts
    public install = async (flags: string[] = []): Promise<void> => {
        if (!this.currentProjectId) {
            return;
        }
        await this.projectsGateway.install(this.currentProjectId, flags);
    };
```

2. Add install:complete WS listener in constructor:

```ts
this.webSocketListener.on("install:complete", data => {
  if (data.projectId === this.currentProjectId) {
    void this.load(data.projectId);
  }
});
```

Note: `projectsGateway` is already a dependency. Check the constructor — if it's named differently (e.g. `gateway`), match the existing name.

- [ ] **Step 3: Create InstallDialog component**

Create `src/ui/presentation/projects/ProjectDetail/components/InstallDialog.tsx`:

```tsx
import type React from "react";
import { useState, useEffect } from "react";
import { Button, Group, Loader, Modal, Stack, Text } from "@mantine/core";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import type { ProjectsGateway } from "#ui/features/projects/abstractions/ProjectsGateway.js";
import type { PackageManagerId } from "#shared/security/index.js";
import { INSTALL_OPTIONS_COMPONENTS } from "./install/index.js";

interface InstallDialogProps {
  opened: boolean;
  onClose: () => void;
  project: ProjectDetailPresenter.ProjectViewModel;
  gateway: ProjectsGateway.Interface;
  onInstall: (flags: string[]) => Promise<void>;
}

export function InstallDialog({
  opened,
  onClose,
  project,
  gateway,
  onInstall
}: InstallDialogProps): React.ReactNode {
  const [flags, setFlags] = useState<ProjectsGateway.InstallFlagDefinition[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (opened && project.packageManager) {
      setLoading(true);
      setSelected([]);
      gateway
        .getInstallOptions(project.packageManager)
        .then(items => {
          setFlags(items);
          setLoading(false);
        })
        .catch(() => {
          setFlags([]);
          setLoading(false);
        });
    }
  }, [opened, project.packageManager, gateway]);

  const handleToggle = (flag: string): void => {
    setSelected(prev => (prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]));
  };

  const handleInstall = async (): Promise<void> => {
    setInstalling(true);
    try {
      await onInstall(selected);
      onClose();
    } finally {
      setInstalling(false);
    }
  };

  const pm = project.packageManager as PackageManagerId | null;
  const OptionsComponent = pm ? INSTALL_OPTIONS_COMPONENTS[pm] : null;

  return (
    <Modal opened={opened} onClose={onClose} title={`Install — ${project.name}`} size="md">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Package manager: {project.packageManager ?? "Unknown"}
        </Text>

        {loading ? (
          <Loader size="sm" />
        ) : OptionsComponent ? (
          <OptionsComponent flags={flags} selected={selected} onToggle={handleToggle} />
        ) : (
          <Text size="sm" c="dimmed">
            No options available for this package manager
          </Text>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInstall} loading={installing}>
            Install
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
```

- [ ] **Step 4: Add Install button and dialog to ProjectDetailPage**

In `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`:

1. Add imports:

```tsx
import { InstallDialog } from "./InstallDialog.js";
import { useFeature } from "#ui/shared/di/useFeature.js";
```

2. Add state for dialog:

```tsx
const [installDialogOpened, setInstallDialogOpened] = useState(false);
```

3. Add "Install" button in the action group (alongside Scan, Upgrade Selected, etc.):

```tsx
<Button
  variant="light"
  onClick={() => setInstallDialogOpened(true)}
  disabled={!vm.project?.packageManager}
>
  Install
</Button>
```

4. Add dialog before closing `</Stack>`:

```tsx
{
  vm.project && (
    <InstallDialog
      opened={installDialogOpened}
      onClose={() => setInstallDialogOpened(false)}
      project={vm.project}
      gateway={/* need gateway access — see note below */}
      onInstall={flags => presenter.install(flags)}
    />
  );
}
```

**Note on gateway access:** The `InstallDialog` needs the gateway to fetch install options. The cleanest approach: have the presenter expose a `getInstallOptions` method that delegates to the gateway. Add to the presenter interface:

```ts
getInstallOptions: (packageManager: string) => Promise<IInstallFlagDefinition[]>;
```

Then the dialog receives `presenter.getInstallOptions` instead of the raw gateway. Update `InstallDialog` props accordingly:

```tsx
interface InstallDialogProps {
  opened: boolean;
  onClose: () => void;
  project: ProjectDetailPresenter.ProjectViewModel;
  getInstallOptions: (pm: string) => Promise<ProjectsGateway.InstallFlagDefinition[]>;
  onInstall: (flags: string[]) => Promise<void>;
}
```

And usage:

```tsx
<InstallDialog
  opened={installDialogOpened}
  onClose={() => setInstallDialogOpened(false)}
  project={vm.project}
  getInstallOptions={presenter.getInstallOptions}
  onInstall={flags => presenter.install(flags)}
/>
```

- [ ] **Step 5: Add `useState` import if missing**

Ensure `useState` is imported from React in ProjectDetailPage.

- [ ] **Step 6: Build to verify**

Run: `bun run build`
Expected: clean build

- [ ] **Step 7: Run full test suite**

Run: `bun run test`
Expected: all tests pass. Update any ProjectDetailPresenter test mocks to include `install` and `getInstallOptions` methods.

- [ ] **Step 8: Commit**

```bash
git add src/ui/presentation/projects/ProjectDetail/components/InstallDialog.tsx \
  src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts \
  src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts \
  src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx
git commit -m "feat: add InstallDialog with PM-specific options and Install button on project detail"
```
