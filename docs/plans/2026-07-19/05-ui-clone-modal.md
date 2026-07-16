# UI Clone Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend AddProjectModal with a "Clone from GitHub" tab. Includes FolderBrowser component, CloneProjectUseCase, and presenter changes.

**Architecture:** New use case calls `ProjectsGateway.clone()`. Presenter manages clone VM fields and folder browsing state. FolderBrowser is a dumb React component (breadcrumb + directory list). Modal uses Mantine Tabs.

**Tech Stack:** React 19, Mantine UI (Tabs, TextInput, Button, ScrollArea, Breadcrumbs), MobX presenters, `@webiny/di`

## Global Constraints

- DI conventions: abstraction in `abstractions/` dir, implementation separate
- React components are `observer()` wrapped, read `presenter.vm` only
- Presenter methods are arrow properties (for MobX binding)
- Build before test: `yarn build`

## Dependencies on Prior Plans

- Plan 03 (clone route) must be completed first
- Plan 04 (FilesystemGateway) must be completed first

---

### Task 1: ProjectsGateway.clone + CloneProjectUseCase

**Files:**

- Modify: `src/ui/features/projects/abstractions/ProjectsGateway.ts` — add `clone` method
- Modify: `src/ui/features/projects/ProjectsGateway.ts` — implement `clone`
- Create: `src/ui/presentation/projects/useCases/abstractions/CloneProjectUseCase.ts`
- Create: `src/ui/presentation/projects/useCases/CloneProjectUseCase.ts`
- Modify: `src/ui/presentation/projects/useCases/feature.ts` — register use case
- Create: `src/ui/presentation/projects/useCases/__tests__/CloneProjectUseCase.test.ts`

**Interfaces:**

- Consumes: `ProjectsGateway.Interface`, `cloneProjectRoute` from `#shared/routes/index.js`, `HTTPClient.Interface`
- Produces: `CloneProjectUseCase.Interface` with `execute(url, destination, folderName?): Promise<string>`

- [ ] **Step 1: Add clone to ProjectsGateway abstraction**

In `src/ui/features/projects/abstractions/ProjectsGateway.ts`, add to `IProjectsGateway`:

```typescript
    clone(url: string, destination: string, folderName?: string): Promise<IScanJob>;
```

- [ ] **Step 2: Implement clone in ProjectsGateway**

In `src/ui/features/projects/ProjectsGateway.ts`, add the method. Add `cloneProjectRoute` to the existing import from `#shared/routes/index.js`:

```typescript
    public async clone(
        url: string,
        destination: string,
        folderName?: string
    ): Promise<Abstraction.ScanJob> {
        const body: Record<string, string> = { url, destination };
        if (folderName) {
            body.folderName = folderName;
        }
        const response = await this.httpClient.request<{ item: Abstraction.ScanJob }>(
            cloneProjectRoute,
            { body }
        );
        return response.item;
    }
```

- [ ] **Step 3: Write CloneProjectUseCase abstraction**

```typescript
// src/ui/presentation/projects/useCases/abstractions/CloneProjectUseCase.ts
import { createAbstraction } from "#shared/index.js";

export interface ICloneProjectUseCase {
  execute(url: string, destination: string, folderName?: string): Promise<string>;
}

export const CloneProjectUseCase =
  createAbstraction<ICloneProjectUseCase>("Ui/CloneProjectUseCase");

export namespace CloneProjectUseCase {
  export type Interface = ICloneProjectUseCase;
}
```

- [ ] **Step 4: Write CloneProjectUseCase implementation**

```typescript
// src/ui/presentation/projects/useCases/CloneProjectUseCase.ts
import { CloneProjectUseCase as Abstraction } from "./abstractions/CloneProjectUseCase.js";
import { ProjectsGateway } from "../../../features/projects/abstractions/ProjectsGateway.js";

class CloneProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly projectsGateway: ProjectsGateway.Interface) {}

  public execute = async (
    url: string,
    destination: string,
    folderName?: string
  ): Promise<string> => {
    const result = await this.projectsGateway.clone(url, destination, folderName);
    return result.jobId;
  };
}

export const CloneProjectUseCase = Abstraction.createImplementation({
  implementation: CloneProjectUseCaseImpl,
  dependencies: [ProjectsGateway]
});
```

- [ ] **Step 5: Register in use cases feature**

In `src/ui/presentation/projects/useCases/feature.ts`, import and register:

```typescript
import { CloneProjectUseCase } from "./CloneProjectUseCase.js";
// in register():
container.register(CloneProjectUseCase);
```

- [ ] **Step 6: Write test**

```typescript
// src/ui/presentation/projects/useCases/__tests__/CloneProjectUseCase.test.ts
import { describe, it, expect, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "../../../../httpClient/feature.js";
import { ProjectsFeature } from "../../../../features/projects/feature.js";
import { cloneProjectRoute } from "#shared/routes/index.js";
import { CloneProjectUseCase } from "../abstractions/CloneProjectUseCase.js";
import { CloneProjectUseCase as CloneProjectUseCaseReg } from "../CloneProjectUseCase.js";

describe("CloneProjectUseCase", () => {
  it("calls clone gateway with url, destination, and folderName", async () => {
    const calls: unknown[] = [];
    const container = createContainer();

    HTTPClientFeature.register(container);
    container.registerInstance(HTTPClient, {
      request: async <T>(route: unknown, args: unknown): Promise<T> => {
        calls.push({ route, args });
        return { item: { jobId: "job-123" } } as T;
      }
    });

    ProjectsFeature.register(container);
    container.register(CloneProjectUseCaseReg);

    const useCase = container.resolve(CloneProjectUseCase);
    const jobId = await useCase.execute(
      "https://github.com/org/repo.git",
      "/tmp/projects",
      "my-repo"
    );

    expect(jobId).toBe("job-123");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      route: cloneProjectRoute,
      args: {
        body: {
          url: "https://github.com/org/repo.git",
          destination: "/tmp/projects",
          folderName: "my-repo"
        }
      }
    });
  });
});
```

- [ ] **Step 7: Build and test**

Run: `yarn build && yarn vitest run src/ui/presentation/projects/useCases/__tests__/CloneProjectUseCase.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/ui/features/projects/abstractions/ProjectsGateway.ts \
  src/ui/features/projects/ProjectsGateway.ts \
  src/ui/presentation/projects/useCases/abstractions/CloneProjectUseCase.ts \
  src/ui/presentation/projects/useCases/CloneProjectUseCase.ts \
  src/ui/presentation/projects/useCases/__tests__/CloneProjectUseCase.test.ts \
  src/ui/presentation/projects/useCases/feature.ts
git commit -m "feat: CloneProjectUseCase — UI use case for clone flow"
```

---

### Task 2: Presenter Clone VM Fields + Folder Browsing

**Files:**

- Modify: `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts` — add clone/browse VM fields and methods
- Modify: `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts` — implement
- Modify: `src/ui/presentation/projects/ProjectList/feature.ts` — add new dependencies
- Modify: `src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts` — add clone tests

**Interfaces:**

- Consumes: `CloneProjectUseCase.Interface`, `FilesystemGateway.Interface`
- Produces: Updated `IProjectListPresenter` with clone/browse VM and methods

- [ ] **Step 1: Update presenter abstraction**

In `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`:

Add to `IProjectListViewModel`:

```typescript
cloneUrl: string;
cloneFolderName: string;
cloneLoading: boolean;
cloneError: string | null;
browsePath: string;
browseItems: {
  name: string;
  path: string;
}
[];
browseLoading: boolean;
```

Add to `IProjectListPresenter`:

```typescript
    setCloneUrl: (url: string) => void;
    setCloneFolderName: (name: string) => void;
    browseTo: (path: string) => Promise<void>;
    cloneProject: () => Promise<void>;
```

- [ ] **Step 2: Implement in presenter**

Add private fields initialized to defaults. Add the four methods. `setCloneUrl` parses repo name from URL:

```typescript
    public setCloneUrl = (url: string): void => {
        this.cloneUrl = url;
        const match = url.match(/\/([^/]+?)(?:\.git)?$/);
        if (match) {
            this.cloneFolderName = match[1]!;
        }
    };
```

Implement the remaining three methods:

```typescript
    public setCloneFolderName = (name: string): void => {
        this.cloneFolderName = name;
    };

    public browseTo = async (path: string): Promise<void> => {
        this.browseLoading = true;
        try {
            const items = await this.filesystemGateway.browse(path);
            runInAction(() => {
                this.browsePath = path;
                this.browseItems = items;
                this.browseLoading = false;
            });
        } catch {
            runInAction(() => {
                this.browseLoading = false;
            });
        }
    };

    public cloneProject = async (): Promise<void> => {
        this.cloneLoading = true;
        this.cloneError = null;
        try {
            await this.cloneProjectUseCase.execute(
                this.cloneUrl,
                this.browsePath,
                this.cloneFolderName || undefined
            );
            runInAction(() => {
                this.cloneLoading = false;
                this.cloneUrl = "";
                this.cloneFolderName = "";
            });
            await this.load();
        } catch (error) {
            runInAction(() => {
                this.cloneLoading = false;
                this.cloneError = (error as Error).message;
            });
        }
    };
```

Add `CloneProjectUseCase` and `FilesystemGateway` to constructor deps and `dependencies` array.

Update `src/ui/presentation/projects/ProjectList/feature.ts`:

- Import `FilesystemFeature` from `"../../../../features/filesystem/feature.js"` and call `FilesystemFeature.register(container)` before the presenter registration
- Import `CloneProjectUseCase` registration — it's already registered by `ProjectsUseCasesFeature` (added in Task 1 Step 5)

- [ ] **Step 3: Write presenter tests**

Add to the presenter test file:

```typescript
it("setCloneUrl auto-derives folder name from https URL", () => {
  const presenter = createPresenter();
  presenter.setCloneUrl("https://github.com/org/my-repo.git");
  expect(presenter.vm.cloneUrl).toBe("https://github.com/org/my-repo.git");
  expect(presenter.vm.cloneFolderName).toBe("my-repo");
});

it("setCloneUrl auto-derives folder name from URL without .git", () => {
  const presenter = createPresenter();
  presenter.setCloneUrl("https://github.com/org/my-repo");
  expect(presenter.vm.cloneFolderName).toBe("my-repo");
});

it("browseTo fetches directory listing and updates VM", async () => {
  const presenter = createPresenter();
  await presenter.browseTo("/some/path");
  expect(presenter.vm.browsePath).toBe("/some/path");
  expect(presenter.vm.browseItems).toBeDefined();
});

it("clone VM fields initialize to defaults", () => {
  const presenter = createPresenter();
  expect(presenter.vm.cloneUrl).toBe("");
  expect(presenter.vm.cloneFolderName).toBe("");
  expect(presenter.vm.cloneLoading).toBe(false);
  expect(presenter.vm.cloneError).toBeNull();
});
```

Mock `FilesystemGateway` and `CloneProjectUseCase` at DI level in the test setup.

- [ ] **Step 4: Build and test**

Run: `yarn build && yarn vitest run src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts \
  src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts \
  src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts \
  src/ui/presentation/projects/ProjectList/feature.ts
git commit -m "feat: presenter clone/browse VM fields and methods"
```

---

### Task 3: FolderBrowser Component + AddProjectModal Tabs

**Files:**

- Create: `src/ui/presentation/projects/ProjectList/components/FolderBrowser.tsx`
- Modify: `src/ui/presentation/projects/ProjectList/components/AddProjectModal.tsx` — add tabs

**Interfaces:**

- Consumes: `ProjectListPresenter.Interface` (vm fields: `browsePath`, `browseItems`, `browseLoading`, `cloneUrl`, `cloneFolderName`, `cloneLoading`, `cloneError`)
- Produces: Updated `AddProjectModal` with two tabs, `FolderBrowser` component

- [ ] **Step 1: Create FolderBrowser component**

```tsx
// src/ui/presentation/projects/ProjectList/components/FolderBrowser.tsx
import type React from "react";
import { Breadcrumbs, Anchor, ScrollArea, Stack, Group, Text, UnstyledButton } from "@mantine/core";
import { IconFolder } from "@tabler/icons-react";

interface FolderBrowserProps {
  currentPath: string;
  items: { name: string; path: string }[];
  onNavigate: (path: string) => void;
  loading: boolean;
}

export function FolderBrowser({
  currentPath,
  items,
  onNavigate,
  loading
}: FolderBrowserProps): React.ReactNode {
  const segments = currentPath.split("/").filter(Boolean);

  return (
    <Stack gap="xs">
      <Breadcrumbs>
        <Anchor onClick={() => onNavigate("/")} size="sm">
          /
        </Anchor>
        {segments.map((segment, index) => {
          const segmentPath = "/" + segments.slice(0, index + 1).join("/");
          return (
            <Anchor key={segmentPath} onClick={() => onNavigate(segmentPath)} size="sm">
              {segment}
            </Anchor>
          );
        })}
      </Breadcrumbs>
      <ScrollArea h={200}>
        {loading ? (
          <Text size="sm" c="dimmed">
            Loading...
          </Text>
        ) : items.length === 0 ? (
          <Text size="sm" c="dimmed">
            Empty directory
          </Text>
        ) : (
          <Stack gap={2}>
            {items.map(item => (
              <UnstyledButton
                key={item.path}
                onClick={() => onNavigate(item.path)}
                p="xs"
                style={{ borderRadius: 4 }}
              >
                <Group gap="xs">
                  <IconFolder size={16} />
                  <Text size="sm">{item.name}</Text>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}
      </ScrollArea>
    </Stack>
  );
}
```

- [ ] **Step 2: Update AddProjectModal with tabs**

Replace `AddProjectModal` content with Mantine `Tabs`:

```tsx
// Updated AddProjectModal.tsx
import type React from "react";
import { Button, Modal, Stack, Tabs, Text, TextInput } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { ProjectListPresenter } from "../abstractions/ProjectListPresenter.js";
import { FolderBrowser } from "./FolderBrowser.js";

interface AddProjectModalProps {
  presenter: ProjectListPresenter.Interface;
  opened: boolean;
  onClose: () => void;
}

export const AddProjectModal = observer(function AddProjectModal({
  presenter,
  opened,
  onClose
}: AddProjectModalProps): React.ReactNode {
  const { vm } = presenter;

  return (
    <Modal opened={opened} onClose={onClose} title="Add Project" size="lg">
      <Tabs defaultValue="local">
        <Tabs.List>
          <Tabs.Tab value="local">Local Path</Tabs.Tab>
          <Tabs.Tab value="clone">Clone from GitHub</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="local" pt="sm">
          <Stack gap="sm">
            <TextInput
              label="Project Path"
              placeholder="/path/to/project"
              value={vm.addProjectPath}
              onChange={event => presenter.setAddProjectPath(event.currentTarget.value)}
              error={vm.addProjectError}
              disabled={vm.addProjectLoading}
            />
            <Button onClick={() => presenter.addProject()} loading={vm.addProjectLoading}>
              Add
            </Button>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="clone" pt="sm">
          <Stack gap="sm">
            <TextInput
              label="Repository URL"
              placeholder="https://github.com/org/repo"
              value={vm.cloneUrl}
              onChange={event => presenter.setCloneUrl(event.currentTarget.value)}
              disabled={vm.cloneLoading}
            />
            <Text size="sm" fw={500}>
              Clone Destination
            </Text>
            <FolderBrowser
              currentPath={vm.browsePath}
              items={vm.browseItems}
              onNavigate={path => presenter.browseTo(path)}
              loading={vm.browseLoading}
            />
            <TextInput
              label="Folder Name"
              value={vm.cloneFolderName}
              onChange={event => presenter.setCloneFolderName(event.currentTarget.value)}
              disabled={vm.cloneLoading}
            />
            {vm.browsePath && vm.cloneFolderName && (
              <Text size="xs" c="dimmed">
                Will clone to: {vm.browsePath}/{vm.cloneFolderName}
              </Text>
            )}
            {vm.cloneError && (
              <Text size="sm" c="red">
                {vm.cloneError}
              </Text>
            )}
            <Button
              onClick={() => presenter.cloneProject()}
              loading={vm.cloneLoading}
              disabled={!vm.cloneUrl || !vm.browsePath || !vm.cloneFolderName}
            >
              Clone
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
});
```

- [ ] **Step 3: Check for @tabler/icons-react dependency**

Run: `grep "@tabler/icons-react" package.json`

If not present, add it: `yarn add @tabler/icons-react`
If already present, skip.

- [ ] **Step 4: Build and verify no errors**

Run: `yarn build && yarn lint && yarn format:fix`
Expected: No errors

- [ ] **Step 5: Run full test suite**

Run: `yarn test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/projects/ProjectList/components/FolderBrowser.tsx \
  src/ui/presentation/projects/ProjectList/components/AddProjectModal.tsx
git commit -m "feat: Clone from GitHub tab in Add Project modal with folder browser"
```
