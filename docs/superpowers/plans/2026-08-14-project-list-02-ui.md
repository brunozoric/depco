# Project List Enhancements — UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sortable column headers, engine status filter, page size selector, rename modal, and editable project name to the project list and detail pages.

**Architecture:** Gateway and IProject gain `engineStatus` + `rootEnginesNode` fields (now returned by API). Presenter reads sort/filter/pageSize from URL via `urlFilterService`, passes to gateway. Engine data sourced from project records, not from separate engine summary. UI adds filter bar, sortable headers, rename modal, and page size dropdown.

**Tech Stack:** React, MobX, Mantine UI, vitest

**Spec:** `docs/superpowers/specs/2026-08-14-project-list-enhancements-design.md`

**Depends on:** `docs/superpowers/plans/2026-08-14-project-list-01-backend.md` (all 4 tasks must be completed first)

## Global Constraints

- Named interfaces with `I` prefix — never inline structural types
- Use full words in identifiers — never abbreviate
- Run `yarn format:fix && yarn lint:fix` before each commit
- Run `yarn full` to verify after each commit
- All filtering via URL query params (shareable URLs)
- Never start dev server — user manages it

---

### Task 5: Gateway + Repository — Engine Fields and Update Method

**Files:**
- Modify: `src/ui/features/Projects/abstractions/ProjectsGateway.ts` (add `engineStatus` + `rootEnginesNode` to `IProject`, add `IListProjectsParams` sort/filter fields, add `update` method)
- Modify: `src/ui/features/Projects/ProjectsGateway.ts` (implement `update`, pass sort/filter to API, map new fields)
- Modify: `src/ui/features/Projects/abstractions/ProjectsRepository.ts` (add `updateProject` method)
- Modify: `src/ui/features/Projects/ProjectsRepository.ts` (implement `updateProject`)

**Interfaces:**
- Consumes: `updateProjectRoute` from `src/shared/routes/projects.ts`, `UpdateProjectResponse` from `src/shared/responses/projects.ts` (from backend plan)
- Produces: `IProject` with `engineStatus: string | null` and `rootEnginesNode: string | null`; `update(id, params)` method; `IListProjectsParams` with `sortBy`, `sortOrder`, `engineStatus` — used by Tasks 6, 7

- [ ] **Step 1: Update IProject interface**

In `src/ui/features/Projects/abstractions/ProjectsGateway.ts`, add to `IProject`:

```typescript
export interface IProject {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
    addedAt: number;
    lastScannedAt: number | null;
    security?: ISecurityStatus | null;
    hasNodeModules: boolean;
    teams?: IProjectTeam[];
    engineStatus: string | null;
    rootEnginesNode: string | null;
}
```

Add sort/filter fields to `IListProjectsParams`:

```typescript
export interface IListProjectsParams {
    page?: number | undefined;
    pageSize?: number | undefined;
    search?: string | undefined;
    teamId?: string | undefined;
    sortBy?: "name" | "addedAt" | "lastScannedAt" | "engineStatus" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    engineStatus?: string | undefined;
}
```

Add `update` method to `IProjectsGateway`:

```typescript
export interface IProjectsGateway {
    // ... existing methods ...
    update(id: string, params: { name: string }): Promise<IProject>;
}
```

- [ ] **Step 2: Update gateway implementation**

In `src/ui/features/Projects/ProjectsGateway.ts`:

Add import for `updateProjectRoute`:

```typescript
import { updateProjectRoute } from "#shared/routes/index.js";
```

Update `toProject` to include new fields:

```typescript
function toProject(item: {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
    addedAt: number;
    lastScannedAt: number | null;
    security?: Abstraction.SecurityStatus | null | undefined;
    hasNodeModules?: boolean;
    teams?: Array<{ id: string; name: string; color: string }> | undefined;
    engineStatus?: string | null | undefined;
    rootEnginesNode?: string | null | undefined;
}): IProject {
    return {
        id: item.id,
        name: item.name,
        path: item.path,
        packageManager: item.packageManager,
        pmVersion: item.pmVersion,
        addedAt: item.addedAt,
        lastScannedAt: item.lastScannedAt,
        security: item.security ?? null,
        hasNodeModules: item.hasNodeModules ?? false,
        teams: item.teams ?? [],
        engineStatus: item.engineStatus ?? null,
        rootEnginesNode: item.rootEnginesNode ?? null
    };
}
```

Update `list` to pass sort/filter params:

```typescript
public async list(params?: Abstraction.ListParams): Promise<Abstraction.ListResponse> {
    const response = await this.httpClient.request(listProjectsRoute, {
        params: {},
        query: {
            page: params?.page,
            pageSize: params?.pageSize,
            search: params?.search,
            teamId: params?.teamId,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            engineStatus: params?.engineStatus
        }
    });
    return { items: response.items.map(toProject), total: response.total };
}
```

Add `update` method:

```typescript
public async update(id: string, params: { name: string }): Promise<Abstraction.Project> {
    const response = await this.httpClient.request(updateProjectRoute, {
        params: { id },
        body: { name: params.name }
    });
    return toProject(response.item);
}
```

- [ ] **Step 3: Add updateProject to ProjectsRepository**

In `src/ui/features/Projects/abstractions/ProjectsRepository.ts`, add to `IProjectsRepository`:

```typescript
updateProject(project: ProjectsGateway.Project): void;
```

In `src/ui/features/Projects/ProjectsRepository.ts`, implement:

```typescript
public updateProject(project: Abstraction.Project): void {
    const index = this.projects.findIndex(p => p.id === project.id);
    if (index !== -1) {
        this.projects[index] = project;
    }
}
```

- [ ] **Step 4: Run full build**

Run: `yarn full > /tmp/build-output.txt 2>&1`

Check for type errors — other files that reference `IProject` may need updating if they destructure or assert shape. Fix any.

- [ ] **Step 5: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/ui/features/Projects/
git commit -m "feat: add engine fields, update method, and updateProject to ProjectsGateway and Repository"
```

---

### Task 6: Presenter — Sort/Filter State, Engine Data from Project, Rename

**Files:**
- Modify: `src/ui/presentation/Projects/ProjectList/abstractions/ProjectListPresenter.ts` (add sort/filter/rename to view model + interface)
- Modify: `src/ui/presentation/Projects/ProjectList/ProjectListPresenter.ts` (remove in-memory engine mapping, read sort/filter from URL, pass to gateway, add rename method)
- Modify: `src/ui/presentation/Projects/ProjectList/__tests__/ProjectListPresenter.crud.test.ts` (update expectations)

**Interfaces:**
- Consumes: `IProject.engineStatus`, `IProject.rootEnginesNode`, `IListProjectsParams.sortBy/sortOrder/engineStatus` from Task 5
- Produces: `IProjectListViewModel` with `sortBy`, `sortOrder`, `engineStatusFilter`, `addedAt` on items; `renameProject` method — used by Task 7

- [ ] **Step 1: Update presenter abstraction**

In `src/ui/presentation/Projects/ProjectList/abstractions/ProjectListPresenter.ts`:

Add `addedAt` to `IProjectListItem`:

```typescript
export interface IProjectListItem {
    id: string;
    name: string;
    path: string;
    pmVersion: string | null;
    packageManager: string | null;
    securityPasses: boolean | null;
    securityChecks: Record<string, boolean> | null;
    lastScannedAt: number | null;
    addedAt: number;
    scanStatus: ProjectScanStatus;
    hasNodeModules: boolean;
    teams: IProjectTeamBadge[];
    engineStatus: EngineStatus | null;
    engineVersion: string | null;
}
```

Add sort/filter fields to `IProjectListViewModel`:

```typescript
export interface IProjectListViewModel {
    // ... existing fields ...
    sortBy: string | null;
    sortOrder: string | null;
    engineStatusFilter: string[];
}
```

Add methods to `IProjectListPresenter`:

```typescript
export interface IProjectListPresenter {
    // ... existing methods ...
    setSortBy: (column: string | null) => void;
    setEngineStatusFilter: (statuses: string[]) => void;
    renameProject: (id: string, name: string) => Promise<void>;
}
```

- [ ] **Step 2: Update presenter implementation**

In `src/ui/presentation/Projects/ProjectList/ProjectListPresenter.ts`:

Remove the in-memory `engineInfoByProjectId` mapping from `get vm()`. Instead, read engine data from the project record:

```typescript
projects: projects.map((project): Abstraction.ProjectListItem => ({
    // ... existing fields ...
    addedAt: project.addedAt,
    engineStatus: (project.engineStatus as EngineStatus) ?? null,
    engineVersion: project.rootEnginesNode ?? null
})),
```

Add sort/filter to `get vm()`:

```typescript
const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
// ... existing ...
return {
    // ... existing fields ...
    sortBy: urlFilters.sortBy ?? null,
    sortOrder: urlFilters.sortOrder ?? null,
    engineStatusFilter: urlFilters.engineStatus ? urlFilters.engineStatus.split(",") : []
};
```

Update `loadProjects` to pass sort/filter params:

```typescript
private loadProjects = async (): Promise<void> => {
    const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
    const teamId = this.teamFilterService.selectedTeamId;
    await this.loadProjectsUseCase.execute({
        page: urlFilters.page ?? 1,
        pageSize: urlFilters.pageSize ?? DEFAULT_PAGE_SIZE,
        search: urlFilters.search ?? undefined,
        teamId: teamId ?? undefined,
        sortBy: urlFilters.sortBy ?? undefined,
        sortOrder: urlFilters.sortOrder ?? undefined,
        engineStatus: urlFilters.engineStatus ?? undefined
    });
};
```

Add `setSortBy` method:

```typescript
public setSortBy = (column: string | null): void => {
    const { sortBy, sortOrder } = this.urlFilterService.read(FILTER_SCHEMA);
    if (column === null || (sortBy === column && sortOrder === "desc")) {
        // Third click or explicit clear — reset to default
        this.urlFilterService.update(FILTER_SCHEMA, {
            sortBy: null,
            sortOrder: null,
            page: null
        });
    } else if (sortBy === column && sortOrder !== "desc") {
        // Second click — toggle to desc
        this.urlFilterService.update(FILTER_SCHEMA, {
            sortBy: column,
            sortOrder: "desc",
            page: null
        });
    } else {
        // First click on new column — asc
        this.urlFilterService.update(FILTER_SCHEMA, {
            sortBy: column,
            sortOrder: "asc",
            page: null
        });
    }
};
```

Add `setEngineStatusFilter` method:

```typescript
public setEngineStatusFilter = (statuses: string[]): void => {
    this.urlFilterService.update(FILTER_SCHEMA, {
        engineStatus: statuses.length > 0 ? statuses.join(",") : null,
        page: null
    });
};
```

Add `renameProject` method:

```typescript
public renameProject = async (id: string, name: string): Promise<void> => {
    try {
        const updated = await this.projectsGateway.update(id, { name });
        runInAction(() => {
            this.projectsRepository.updateProject(updated);
        });
    } catch (error) {
        notifications.show({
            color: "red",
            title: "Rename failed",
            message: getErrorMessage(error, "Failed to rename project")
        });
        throw error;
    }
};
```

`projectsRepository.updateProject` was added in Task 5 Step 3.

- [ ] **Step 3: Update LoadProjectsUseCase to pass sort/filter**

Check `src/ui/presentation/Projects/ProjectList/useCases/abstractions/LoadProjectsUseCase.ts` — its `execute` params need `sortBy`, `sortOrder`, `engineStatus`. Update if needed. Also update the implementation to pass them through to `projectsGateway.list()`.

- [ ] **Step 4: Update test expectations**

In `src/ui/presentation/Projects/ProjectList/__tests__/ProjectListPresenter.crud.test.ts`, add new fields to all `expect(presenter.vm.projects).toEqual([...])` assertions:

- Add `addedAt: expect.any(Number)` to each item
- Add `sortBy: null`, `sortOrder: null`, `engineStatusFilter: []` to vm expectations
- Ensure existing `engineStatus: null` and `engineVersion: null` remain

Also update `expect(presenter.vm).toEqual({...})` in the "starts with an empty, idle view model" test to include `sortBy: null`, `sortOrder: null`, `engineStatusFilter: []`.

- [ ] **Step 5: Run full build**

Run: `yarn full > /tmp/build-output.txt 2>&1`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/ui/presentation/Projects/ProjectList/
git commit -m "feat: add sort, filter, and rename to ProjectListPresenter"
```

---

### Task 7: UI Components — Filter Bar, Sortable Headers, Rename Modal, Page Size

**Files:**
- Modify: `src/ui/presentation/Projects/ProjectList/components/ProjectListPage.tsx` (filter bar, sortable headers, page size dropdown)
- Modify: `src/ui/presentation/Projects/ProjectList/components/ProjectRow.tsx` (rename menu item, Added column)
- Create: `src/ui/presentation/Projects/ProjectList/components/RenameProjectModal.tsx`
- Create: `src/ui/presentation/Projects/ProjectList/components/SortableColumnHeader.tsx`
- Modify: `src/ui/presentation/Projects/ProjectDetail/components/ProjectDetailHeader.tsx` (editable name)
- Modify: `src/ui/presentation/Projects/ProjectDetail/components/ProjectDetailPage.tsx` (pass rename handler)
- Modify: `src/ui/presentation/Projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts` (add rename method if not present)
- Modify: `src/ui/presentation/Projects/ProjectDetail/ProjectDetailPresenter.ts` (implement rename)

**Interfaces:**
- Consumes: `vm.sortBy`, `vm.sortOrder`, `vm.engineStatusFilter`, `vm.pageSize`, `presenter.setSortBy`, `presenter.setEngineStatusFilter`, `presenter.renameProject` from Task 6
- Produces: fully interactive project list UI

- [ ] **Step 1: Create SortableColumnHeader component**

Create `src/ui/presentation/Projects/ProjectList/components/SortableColumnHeader.tsx`:

```tsx
import type React from "react";
import { Group, Table, UnstyledButton, Text } from "@mantine/core";

interface SortableColumnHeaderProps {
    label: string;
    column: string;
    activeSortBy: string | null;
    activeSortOrder: string | null;
    onSort: (column: string | null) => void;
}

function getSortIndicator(
    column: string,
    activeSortBy: string | null,
    activeSortOrder: string | null
): string {
    if (activeSortBy !== column) return "";
    return activeSortOrder === "desc" ? " ▼" : " ▲";
}

export function SortableColumnHeader({
    label,
    column,
    activeSortBy,
    activeSortOrder,
    onSort
}: SortableColumnHeaderProps): React.ReactNode {
    return (
        <Table.Th>
            <UnstyledButton onClick={() => onSort(column)}>
                <Group gap={4} wrap="nowrap">
                    <Text size="sm" fw={600}>
                        {label}
                    </Text>
                    <Text size="sm" c="dimmed">
                        {getSortIndicator(column, activeSortBy, activeSortOrder)}
                    </Text>
                </Group>
            </UnstyledButton>
        </Table.Th>
    );
}
```

- [ ] **Step 2: Create RenameProjectModal component**

Create `src/ui/presentation/Projects/ProjectList/components/RenameProjectModal.tsx`:

```tsx
import type React from "react";
import { useState } from "react";
import { Button, Group, Modal, TextInput } from "@mantine/core";

interface RenameProjectModalProps {
    opened: boolean;
    currentName: string;
    onRename: (name: string) => Promise<void>;
    onClose: () => void;
}

export function RenameProjectModal({
    opened,
    currentName,
    onRename,
    onClose
}: RenameProjectModalProps): React.ReactNode {
    const [name, setName] = useState(currentName);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (): Promise<void> => {
        const trimmed = name.trim();
        if (!trimmed || trimmed.length > 100) return;
        setLoading(true);
        setError(null);
        try {
            await onRename(trimmed);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to rename");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal opened={opened} onClose={onClose} title="Rename Project">
            <TextInput
                label="Project name"
                value={name}
                onChange={event => setName(event.currentTarget.value)}
                error={error}
                maxLength={100}
                onKeyDown={event => {
                    if (event.key === "Enter") {
                        void handleSubmit();
                    }
                }}
            />
            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    loading={loading}
                    disabled={!name.trim() || name.trim().length > 100}
                    onClick={() => void handleSubmit()}
                >
                    Save
                </Button>
            </Group>
        </Modal>
    );
}
```

- [ ] **Step 3: Update ProjectListPage with filter bar, sortable headers, page size**

In `src/ui/presentation/Projects/ProjectList/components/ProjectListPage.tsx`:

Add imports:

```typescript
import { MultiSelect, Select } from "@mantine/core";
import { SortableColumnHeader } from "./SortableColumnHeader.js";
```

Replace the search TextInput with a filter bar group:

```tsx
<Group gap="sm" align="flex-end">
    <TextInput
        placeholder="Search projects..."
        value={vm.searchQuery}
        onChange={event => presenter.setSearchQuery(event.currentTarget.value)}
        style={{ flex: 1 }}
    />
    <MultiSelect
        label="Engine Status"
        placeholder="All"
        data={[
            { value: "eol", label: "EOL" },
            { value: "maintenance", label: "Maintenance" },
            { value: "active-lts", label: "Active LTS" },
            { value: "current", label: "Current" },
            { value: "unknown", label: "Unknown" }
        ]}
        value={vm.engineStatusFilter}
        onChange={values => presenter.setEngineStatusFilter(values)}
        clearable
        w={250}
    />
    <Select
        label="Per page"
        data={["10", "25", "50", "100"]}
        value={String(vm.pageSize)}
        onChange={value => {
            if (value) {
                presenter.setPage(1);
                presenter.setSearchQuery(vm.searchQuery);
            }
        }}
        w={90}
    />
</Group>
```

Wait — page size needs to go through urlFilterService. Use:

```tsx
<Select
    label="Per page"
    data={["10", "25", "50", "100"]}
    value={String(vm.pageSize)}
    onChange={value => {
        if (value) {
            // Write through presenter — it updates URL
            // Need a setPageSize method or direct URL update
        }
    }}
    w={90}
/>
```

Since there's no `setPageSize` method (per spec review — pageSize is managed via urlFilterService directly), add one to the presenter:

Actually, add `setPageSize` to the presenter for clean API:

```typescript
public setPageSize = (size: number): void => {
    this.urlFilterService.update(FILTER_SCHEMA, {
        pageSize: size !== DEFAULT_PAGE_SIZE ? size : null,
        page: null
    });
};
```

Then in the component:

```tsx
<Select
    label="Per page"
    data={["10", "25", "50", "100"]}
    value={String(vm.pageSize)}
    onChange={value => {
        if (value) presenter.setPageSize(Number(value));
    }}
    w={90}
/>
```

Replace static `<Table.Th>Name</Table.Th>` etc. with sortable headers:

```tsx
<SortableColumnHeader
    label="Name"
    column="name"
    activeSortBy={vm.sortBy}
    activeSortOrder={vm.sortOrder}
    onSort={presenter.setSortBy}
/>
<Table.Th>Path</Table.Th>
<Table.Th>Package Manager</Table.Th>
<Table.Th>Dependencies</Table.Th>
<SortableColumnHeader
    label="Node.js"
    column="engineStatus"
    activeSortBy={vm.sortBy}
    activeSortOrder={vm.sortOrder}
    onSort={presenter.setSortBy}
/>
<Table.Th>Security</Table.Th>
<SortableColumnHeader
    label="Last Scanned"
    column="lastScannedAt"
    activeSortBy={vm.sortBy}
    activeSortOrder={vm.sortOrder}
    onSort={presenter.setSortBy}
/>
<SortableColumnHeader
    label="Added"
    column="addedAt"
    activeSortBy={vm.sortBy}
    activeSortOrder={vm.sortOrder}
    onSort={presenter.setSortBy}
/>
<Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
```

Also pass `onRename` to `ProjectRow`.

- [ ] **Step 4: Update ProjectRow with rename and Added column**

In `src/ui/presentation/Projects/ProjectList/components/ProjectRow.tsx`:

Add `onRename` prop:

```typescript
interface ProjectRowProps {
    // ... existing ...
    onRename: (project: ProjectListPresenter.ProjectListItem) => void;
}
```

Add "Rename" to the dropdown menu:

```tsx
<Menu.Item onClick={() => onRename(project)}>Rename</Menu.Item>
```

Add "Added" column cell:

```tsx
<Table.Td>
    <Text size="sm">{formatRelativeTime(project.addedAt)}</Text>
</Table.Td>
```

Add `formatRelativeTime` function:

```typescript
function formatRelativeTime(timestamp: number): string {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
}
```

- [ ] **Step 5: Wire rename modal into ProjectListPage**

Add state and modal to `ProjectListPage`:

```tsx
const [renameTarget, setRenameTarget] = useState<ProjectListPresenter.ProjectListItem | null>(null);

// In ProjectRow:
onRename={setRenameTarget}

// After InstallDialog:
{renameTarget && (
    <RenameProjectModal
        opened={true}
        currentName={renameTarget.name}
        onRename={async (name) => {
            await presenter.renameProject(renameTarget.id, name);
            setRenameTarget(null);
        }}
        onClose={() => setRenameTarget(null)}
    />
)}
```

- [ ] **Step 6: Make project name editable on detail page**

In `src/ui/presentation/Projects/ProjectDetail/components/ProjectDetailHeader.tsx`, add editable name:

```tsx
import type React from "react";
import { useState } from "react";
import { ActionIcon, Group, Stack, Text, TextInput, Title } from "@mantine/core";

interface ProjectDetailHeaderProps {
    projectName: string;
    projectPath: string;
    packageManager: string | null;
    packageManagerVersion: string | null;
    loading: boolean;
    scanning: boolean;
    onBack: () => void;
    onRefresh: () => void;
    onRename?: (name: string) => Promise<void>;
}

export function ProjectDetailHeader({
    projectName,
    projectPath,
    packageManager,
    packageManagerVersion,
    loading,
    scanning,
    onBack,
    onRefresh,
    onRename
}: ProjectDetailHeaderProps): React.ReactNode {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(projectName);

    const handleSave = async (): Promise<void> => {
        const trimmed = editValue.trim();
        if (!trimmed || trimmed === projectName || !onRename) {
            setEditing(false);
            setEditValue(projectName);
            return;
        }
        try {
            await onRename(trimmed);
            setEditing(false);
        } catch {
            setEditValue(projectName);
            setEditing(false);
        }
    };

    return (
        <>
            <Group gap="sm">
                <ActionIcon variant="subtle" size="lg" onClick={onBack}>
                    &larr;
                </ActionIcon>
                {editing ? (
                    <TextInput
                        value={editValue}
                        onChange={event => setEditValue(event.currentTarget.value)}
                        onBlur={() => void handleSave()}
                        onKeyDown={event => {
                            if (event.key === "Enter") void handleSave();
                            if (event.key === "Escape") {
                                setEditing(false);
                                setEditValue(projectName);
                            }
                        }}
                        autoFocus
                        maxLength={100}
                        size="lg"
                    />
                ) : (
                    <Title
                        order={2}
                        style={{ cursor: onRename ? "pointer" : "default" }}
                        onClick={() => {
                            if (onRename) {
                                setEditing(true);
                                setEditValue(projectName);
                            }
                        }}
                    >
                        {projectName}
                    </Title>
                )}
                <ActionIcon
                    variant="subtle"
                    size="lg"
                    onClick={onRefresh}
                    loading={loading || scanning}
                >
                    &#x21bb;
                </ActionIcon>
            </Group>
            <Stack gap={4}>
                <Text c="dimmed" size="sm">
                    {projectPath}
                </Text>
                <Text size="sm">
                    {packageManager
                        ? `${packageManager.charAt(0).toUpperCase()}${packageManager.slice(1)} ${packageManagerVersion ?? ""}`.trim()
                        : `Package Manager: ${packageManagerVersion ?? "Unknown"}`}
                </Text>
            </Stack>
        </>
    );
}
```

In `ProjectDetailPage.tsx`, pass `onRename` to the header. This requires a rename method on `ProjectDetailPresenter`. Add `renameProject` to the detail presenter abstraction and implementation — it calls `projectsGateway.update()` and reloads the project.

```tsx
<ProjectDetailHeader
    projectName={project.name}
    projectPath={project.path}
    packageManager={project.packageManager}
    packageManagerVersion={project.pmVersion}
    loading={vm.loading}
    scanning={vm.scanning}
    onBack={() => navigate("/projects")}
    onRefresh={() => presenter.load(projectId)}
    onRename={async (name) => presenter.renameProject(name)}
/>
```

- [ ] **Step 7: Add setPageSize to presenter abstraction and implementation**

In `src/ui/presentation/Projects/ProjectList/abstractions/ProjectListPresenter.ts`:

```typescript
setPageSize: (size: number) => void;
```

In `ProjectListPresenter.ts`:

```typescript
public setPageSize = (size: number): void => {
    this.urlFilterService.update(FILTER_SCHEMA, {
        pageSize: size !== DEFAULT_PAGE_SIZE ? size : null,
        page: null
    });
};
```

- [ ] **Step 8: Run full build**

Run: `yarn full > /tmp/build-output.txt 2>&1`

Read tail. Fix any type errors or test failures. Common issues:
- Test harness may need updating for new presenter methods/vm fields
- ProjectRow component tests may need `onRename` prop
- Detail presenter may need `renameProject` added

- [ ] **Step 9: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/ui/
git commit -m "feat: add filter bar, sortable headers, page size, and project rename to UI"
```
