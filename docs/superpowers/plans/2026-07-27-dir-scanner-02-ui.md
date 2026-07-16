# Directory Scanner Part 2: UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Scan" tab to AddProjectModal that lets users browse to a directory, scan for projects, and bulk-add selected ones.

**Architecture:** Extend `FilesystemGateway` with `scan()` method. Extend `ProjectListPresenter` with scan state and actions. Add new `ScanTab` component in AddProjectModal.

**Tech Stack:** TypeScript, React, Mantine, MobX, Vitest

## Global Constraints

- Named interfaces only, no inline structural types
- yarn for all package management
- After all changes: `yarn format:fix && yarn lint:fix`
- Commit directly to main

**Depends on:** `2026-07-27-dir-scanner-01-backend.md` — requires `scanFilesystemRoute` endpoint.

---

### Task 1: FilesystemGateway and Presenter Extension

**Files:**

- Modify: `src/ui/features/filesystem/abstractions/FilesystemGateway.ts` — add `IScanResult`, `scan()` method
- Modify: `src/ui/features/filesystem/FilesystemGateway.ts` — implement `scan()`
- Modify: `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts` — add scan VM fields and methods
- Modify: `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts` — implement scan methods

**Interfaces:**

- Consumes:
  - `scanFilesystemRoute` from `src/shared/routes/filesystem.ts`
  - `HTTPClient.Interface` for gateway
  - `FilesystemGateway.Interface` in presenter
- Produces:
  - `FilesystemGateway.scan(path: string): Promise<IScanResult>`
  - `IScanResult: { items: IBrowseItem[], scannedPath: string, scannedCount: number, filteredCount: number, total: number }`
  - `IProjectListPresenter.scanDirectory(): Promise<void>`
  - `IProjectListPresenter.clearScan(): void`
  - `IProjectListViewModel.scanResults: IBrowseItem[]`
  - `IProjectListViewModel.scanLoading: boolean`
  - `IProjectListViewModel.scanSummary: IScanSummary | null`

- [ ] **Step 1: Add IScanResult and scan() to FilesystemGateway abstraction**

In `src/ui/features/filesystem/abstractions/FilesystemGateway.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IBrowseItem {
  name: string;
  path: string;
}

export interface IBrowseResult {
  items: IBrowseItem[];
  currentPath: string;
}

export interface IScanResult {
  items: IBrowseItem[];
  scannedPath: string;
  scannedCount: number;
  filteredCount: number;
  total: number;
}

export interface IFilesystemGateway {
  browse(path?: string, showHidden?: boolean): Promise<IBrowseResult>;
  scan(path: string): Promise<IScanResult>;
}

export const FilesystemGateway = createAbstraction<IFilesystemGateway>("Ui/FilesystemGateway");

export namespace FilesystemGateway {
  export type Interface = IFilesystemGateway;
  export type BrowseItem = IBrowseItem;
  export type BrowseResult = IBrowseResult;
  export type ScanResult = IScanResult;
}
```

- [ ] **Step 2: Implement scan() in FilesystemGateway**

In `src/ui/features/filesystem/FilesystemGateway.ts`, add the `scan` method:

```typescript
public async scan(path: string): Promise<Abstraction.ScanResult> {
    const response = await this.httpClient.request(scanFilesystemRoute, {
        params: {},
        query: { path }
    });

    return {
        items: response.items,
        scannedPath: response.scannedPath,
        scannedCount: response.scannedCount,
        filteredCount: response.filteredCount,
        total: response.total
    };
}
```

Add `scanFilesystemRoute` to the import from `#shared/routes/index.js`.

- [ ] **Step 3: Add scan fields to ProjectListPresenter abstraction**

In `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`, add:

```typescript
export interface IScanSummary {
  scannedPath: string;
  scannedCount: number;
  filteredCount: number;
}
```

Add to `IProjectListViewModel`:

```typescript
scanResults: IBrowseItem[];
scanLoading: boolean;
scanSummary: IScanSummary | null;
```

Add to `IProjectListPresenter`:

```typescript
scanDirectory: () => Promise<void>;
clearScan: () => void;
```

Add to namespace:

```typescript
export type ScanSummary = IScanSummary;
```

- [ ] **Step 4: Implement scan methods in ProjectListPresenter**

In `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`, add private fields:

```typescript
private scanResults: Abstraction.BrowseItem[] = [];
private scanLoading = false;
private scanSummary: Abstraction.ScanSummary | null = null;
```

Add to `vm` getter return object:

```typescript
scanResults: this.scanResults,
scanLoading: this.scanLoading,
scanSummary: this.scanSummary
```

Add methods:

```typescript
public scanDirectory = async (): Promise<void> => {
    this.scanLoading = true;
    try {
        const result = await this.filesystemGateway.scan(this.browsePath);
        runInAction(() => {
            this.scanResults = result.items;
            this.scanSummary = {
                scannedPath: result.scannedPath,
                scannedCount: result.scannedCount,
                filteredCount: result.filteredCount
            };
        });
    } catch (error) {
        runInAction(() => {
            this.addProjectError =
                error instanceof Error ? error.message : "Failed to scan directory";
        });
    } finally {
        runInAction(() => {
            this.scanLoading = false;
        });
    }
};

public clearScan = (): void => {
    this.scanResults = [];
    this.scanSummary = null;
};
```

- [ ] **Step 5: Run type check**

Run: `yarn tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Run format, lint**

Run: `yarn format:fix && yarn lint:fix`

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/filesystem/ src/ui/presentation/projects/ProjectList/
git commit -m "feat: add scan method to FilesystemGateway and ProjectListPresenter"
```

---

### Task 2: Scan Tab Component

**Files:**

- Create: `src/ui/presentation/projects/ProjectList/components/ScanTab.tsx`
- Modify: `src/ui/presentation/projects/ProjectList/components/AddProjectModal.tsx` — add Scan tab

**Interfaces:**

- Consumes:
  - `ProjectListPresenter.Interface` — `vm.browsePath`, `vm.browseItems`, `vm.browseLoading`, `vm.scanResults`, `vm.scanLoading`, `vm.scanSummary`, `vm.addProjectLoading`, `vm.addProjectError`
  - `presenter.browseTo(path)`, `presenter.scanDirectory()`, `presenter.clearScan()`, `presenter.addProjects(paths)`
  - `FolderBrowser` component

- [ ] **Step 1: Create ScanTab component**

Create `src/ui/presentation/projects/ProjectList/components/ScanTab.tsx`:

```tsx
import type React from "react";
import { useCallback, useState } from "react";
import { Button, Checkbox, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { ProjectListPresenter } from "../abstractions/ProjectListPresenter.js";
import { FolderBrowser } from "./FolderBrowser.js";

interface ScanTabProps {
  presenter: ProjectListPresenter.Interface;
}

export const ScanTab = observer(function ScanTab({ presenter }: ScanTabProps): React.ReactNode {
  const { vm } = presenter;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleToggle = useCallback((path: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelected(new Set(vm.scanResults.map(item => item.path)));
  }, [vm.scanResults]);

  const handleDeselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleAddSelected = useCallback(async () => {
    await presenter.addProjects(Array.from(selected));
    setSelected(new Set());
    presenter.clearScan();
  }, [selected, presenter]);

  const handleBack = useCallback(() => {
    setSelected(new Set());
    presenter.clearScan();
  }, [presenter]);

  if (vm.scanSummary) {
    return (
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Found {vm.scanSummary.filteredCount} new project
          {vm.scanSummary.filteredCount !== 1 ? "s" : ""} in {vm.scanSummary.scannedPath} (scanned{" "}
          {vm.scanSummary.scannedCount} directories)
        </Text>

        {vm.scanResults.length === 0 ? (
          <Text size="sm" c="dimmed">
            No new projects found. All projects in this directory are already added.
          </Text>
        ) : (
          <>
            <Group gap="xs">
              <Button size="xs" variant="subtle" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button size="xs" variant="subtle" onClick={handleDeselectAll}>
                Deselect All
              </Button>
            </Group>

            <ScrollArea h={250}>
              <Stack gap={2}>
                {vm.scanResults.map(item => (
                  <Group key={item.path} gap="xs" p="xs">
                    <Checkbox
                      size="xs"
                      checked={selected.has(item.path)}
                      onChange={() => handleToggle(item.path)}
                    />
                    <Stack gap={0}>
                      <Text size="sm" fw={500}>
                        {item.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {item.path}
                      </Text>
                    </Stack>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          </>
        )}

        {vm.addProjectError && (
          <Text size="sm" c="red">
            {vm.addProjectError}
          </Text>
        )}

        <Group justify="space-between">
          <Button variant="subtle" onClick={handleBack}>
            Back
          </Button>
          {vm.scanResults.length > 0 && (
            <Button
              onClick={handleAddSelected}
              loading={vm.addProjectLoading}
              disabled={selected.size === 0}
            >
              Add Selected ({selected.size})
            </Button>
          )}
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Browse to a directory and scan for projects containing package.json.
      </Text>
      <FolderBrowser
        currentPath={vm.browsePath}
        items={vm.browseItems}
        onNavigate={path => presenter.browseTo(path)}
        loading={vm.browseLoading}
      />
      <Group justify="flex-end">
        <Button
          onClick={() => presenter.scanDirectory()}
          loading={vm.scanLoading}
          disabled={!vm.browsePath}
        >
          Scan
        </Button>
      </Group>
    </Stack>
  );
});
```

- [ ] **Step 2: Add Scan tab to AddProjectModal**

In `src/ui/presentation/projects/ProjectList/components/AddProjectModal.tsx`, add import:

```typescript
import { ScanTab } from "./ScanTab.js";
```

Add the new tab inside `<Tabs>`, after the Clone tab:

```tsx
<Tabs.Tab value="scan">Scan</Tabs.Tab>
```

Add the panel after the Clone panel:

```tsx
<Tabs.Panel value="scan" pt="sm">
  <ScanTab presenter={presenter} />
</Tabs.Panel>
```

Also reset scan state when modal opens — in the existing `useEffect`:

```typescript
useEffect(() => {
  if (opened) {
    void presenter.browseTo("");
    presenter.clearScan();
    setSelected(new Set());
  }
}, [opened, presenter]);
```

- [ ] **Step 3: Run type check and tests**

Run: `yarn tsc --noEmit && yarn vitest run`
Expected: No type errors, all tests pass

- [ ] **Step 4: Run format, lint**

Run: `yarn format:fix && yarn lint:fix`

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/projects/ProjectList/components/
git commit -m "feat: add Scan tab to AddProjectModal for bulk project discovery

Browse to directory, scan for package.json in subdirectories,
select and bulk-add discovered projects."
```
