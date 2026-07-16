# Smart Scan Depth Part 2: UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add depth input to Scan tab and show scan mode indicator ("Resolved from workspaces" or "Scanned to depth N") after scan completes.

**Architecture:** FilesystemGateway `scan` method gets `depth` parameter. Presenter passes depth through. ScanTab gets a number stepper and mode indicator text.

**Tech Stack:** TypeScript, React, MobX, Mantine, Vitest

## Global Constraints

- Named interfaces only, no inline structural types
- yarn for all package management
- After all changes: `yarn format:fix && yarn lint:fix`
- Commit directly to main
- Depends on: smart-scan-depth-01-backend plan

---

### Task 1: Gateway and Presenter — depth and mode Support

**Files:**

- Modify: `src/ui/features/filesystem/abstractions/FilesystemGateway.ts` — add `depth` param to `scan`, `mode` to result
- Modify: `src/ui/features/filesystem/FilesystemGateway.ts` — pass depth in query, parse mode from response
- Modify: `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts` — add `scanDepth`, `scanMode` to view model, `depth` param to `scanDirectory`
- Modify: `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts` — wire depth through

**Interfaces:**

- Consumes:
  - `scanFilesystemRoute` response — now includes `mode: "workspaces" | "depth"` (from backend plan)
  - `scanFilesystemRoute` querystring — now includes `depth` (from backend plan)
- Produces:
  - `IFilesystemGateway.scan(path, depth?)` — optional depth parameter
  - `IScanResult.mode: "workspaces" | "depth"` — scan strategy used
  - `IProjectListViewModel.scanMode: "workspaces" | "depth" | null`
  - `IProjectListViewModel.scanDepth: number`
  - `IProjectListPresenter.setScanDepth(depth: number): void`

- [ ] **Step 1: Update FilesystemGateway abstraction**

In `src/ui/features/filesystem/abstractions/FilesystemGateway.ts`, update:

```typescript
export interface IScanResult {
  items: IBrowseItem[];
  scannedPath: string;
  scannedCount: number;
  filteredCount: number;
  total: number;
  mode: "workspaces" | "depth";
}

export interface IFilesystemGateway {
  browse(path?: string, showHidden?: boolean): Promise<IBrowseResult>;
  scan(path: string, depth?: number): Promise<IScanResult>;
}
```

- [ ] **Step 2: Update FilesystemGateway implementation**

In `src/ui/features/filesystem/FilesystemGateway.ts`, update `scan`:

```typescript
public async scan(path: string, depth?: number): Promise<Abstraction.ScanResult> {
    const query: Record<string, string> = { path };
    if (depth !== undefined && depth > 1) {
        query["depth"] = String(depth);
    }

    const response = await this.httpClient.request(scanFilesystemRoute, {
        params: {},
        query
    });

    return {
        items: response.items,
        scannedPath: response.scannedPath,
        scannedCount: response.scannedCount,
        filteredCount: response.filteredCount,
        total: response.total,
        mode: response.mode
    };
}
```

- [ ] **Step 3: Update ProjectListPresenter abstraction**

In `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`:

Add to `IScanSummary`:

```typescript
export interface IScanSummary {
  scannedPath: string;
  scannedCount: number;
  filteredCount: number;
  mode: "workspaces" | "depth";
}
```

Add to `IProjectListViewModel`:

```typescript
export interface IProjectListViewModel {
  // ... existing fields ...
  scanDepth: number;
}
```

Add to `IProjectListPresenter`:

```typescript
export interface IProjectListPresenter {
  // ... existing methods ...
  setScanDepth: (depth: number) => void;
}
```

- [ ] **Step 4: Update ProjectListPresenter implementation**

In `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`:

Add `scanDepth` private field:

```typescript
private scanDepth = 1;
```

Add to `vm` getter:

```typescript
scanDepth: this.scanDepth,
```

Add setter:

```typescript
public setScanDepth = (depth: number): void => {
    this.scanDepth = Math.max(1, Math.min(5, depth));
};
```

Update `scanDirectory` — pass `this.scanDepth` and capture `mode` in summary:

```typescript
public scanDirectory = async (): Promise<void> => {
    this.scanLoading = true;
    try {
        const result = await this.filesystemGateway.scan(this.browsePath, this.scanDepth);
        runInAction(() => {
            this.scanResults = result.items;
            this.scanSummary = {
                scannedPath: result.scannedPath,
                scannedCount: result.scannedCount,
                filteredCount: result.filteredCount,
                mode: result.mode
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
```

- [ ] **Step 5: Run format and lint**

Run: `yarn format:fix && yarn lint:fix`

- [ ] **Step 6: Run full test suite**

Run: `yarn vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/filesystem/abstractions/FilesystemGateway.ts src/ui/features/filesystem/FilesystemGateway.ts src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts
git commit -m "feat: wire scan depth and mode through gateway and presenter"
```

---

### Task 2: ScanTab UI — Depth Input and Mode Indicator

**Files:**

- Modify: `src/ui/presentation/projects/ProjectList/components/ScanTab.tsx` — add depth stepper, mode indicator

**Interfaces:**

- Consumes:
  - `IProjectListViewModel.scanDepth` from Task 1
  - `IProjectListViewModel.scanSummary.mode` from Task 1
  - `IProjectListPresenter.setScanDepth` from Task 1
- Produces:
  - Updated Scan tab with depth input before scan button
  - Mode indicator text after scan results

- [ ] **Step 1: Add depth input to scan phase**

In `src/ui/presentation/projects/ProjectList/components/ScanTab.tsx`, add to the pre-scan view (the `return` block when `!vm.scanSummary`):

```typescript
// Add import:
import { Button, Checkbox, Group, NumberInput, ScrollArea, Stack, Text } from "@mantine/core";

// In the pre-scan return block, add NumberInput before the Scan button:
<Group justify="space-between" align="flex-end">
    <NumberInput
        label="Scan depth"
        description="How many directory levels to search"
        value={vm.scanDepth}
        onChange={value => typeof value === "number" && presenter.setScanDepth(value)}
        min={1}
        max={5}
        step={1}
        w={120}
    />
    <Button
        onClick={() => presenter.scanDirectory()}
        loading={vm.scanLoading}
        disabled={!vm.browsePath}
    >
        Scan
    </Button>
</Group>
```

- [ ] **Step 2: Add mode indicator to results view**

In the results view (when `vm.scanSummary` exists), update the summary text:

```typescript
<Text size="sm" c="dimmed">
    {vm.scanSummary.mode === "workspaces"
        ? `Resolved ${vm.scanSummary.filteredCount} new project${vm.scanSummary.filteredCount !== 1 ? "s" : ""} from workspaces in ${vm.scanSummary.scannedPath}`
        : `Found ${vm.scanSummary.filteredCount} new project${vm.scanSummary.filteredCount !== 1 ? "s" : ""} in ${vm.scanSummary.scannedPath} (scanned ${vm.scanSummary.scannedCount} directories to depth ${vm.scanDepth})`}
</Text>
```

- [ ] **Step 3: Run format and lint**

Run: `yarn format:fix && yarn lint:fix`

- [ ] **Step 4: Run full test suite**

Run: `yarn vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/projects/ProjectList/components/ScanTab.tsx
git commit -m "feat: scan tab depth input and workspace/depth mode indicator"
```
