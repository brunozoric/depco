# Directory Scanner for Bulk Project Discovery

## Overview

Scan a directory's immediate subdirectories for `package.json` to discover and bulk-add projects. Browse to a target directory, scan, select which projects to add.

## Backend API

New endpoint: `GET /api/filesystem/scan?path=/some/dir`

Reads immediate subdirectories of `path`, checks each for `package.json` existence. Queries `projects` table to exclude paths already added. Returns only new, valid projects.

Response:

```json
{
  "items": [
    { "name": "project-a", "path": "/some/dir/project-a" },
    { "name": "project-b", "path": "/some/dir/project-b" }
  ],
  "total": 2,
  "scannedPath": "/some/dir",
  "scannedCount": 100,
  "filteredCount": 2
}
```

- `scannedCount` — total subdirectories checked
- `filteredCount` — how many had `package.json` and weren't already added
- `total` — same as `filteredCount`, included for consistency with other list endpoints
- `items` — only the new, valid project directories

Implementation lives in `src/api/routes/filesystem.ts` alongside existing `browse` route. Uses `readdir` + `access` check for `package.json`. Queries `projects` table for existing paths to exclude.

Route schema defined in `src/shared/routes/filesystem.ts` as `scanFilesystemRoute`.

Database access: scan endpoint needs `DatabaseClient` to query existing project paths. `filesystemRoutes` plugin updated to accept container and resolve `DatabaseClient`.

Existing project paths query: `SELECT path FROM projects` — results used as a Set for O(1) exclusion.

## UI — Scan Tab

New "Scan" tab (4th tab) in `AddProjectModal`. Two-phase flow:

### Phase 1: Navigate

Reuses existing `FolderBrowser` component to browse to target directory. "Scan" button at bottom triggers scan.

### Phase 2: Results

After scan, results replace the browser view:

- Summary line: "Found 12 new projects in /path (scanned 100 directories)"
- Checkbox list of discovered projects (name + path)
- Select All / Deselect All
- "Add Selected (N)" button
- "Back" button to return to navigation phase

### State Management

No new presenter. Extend `ProjectListPresenter` with:

- `scanDirectory()` method — calls `FilesystemGateway.scan(browsePath)`
- `scanResults` in VM — array of `{ name, path }`
- `scanSummary` in VM — `{ scannedCount, filteredCount, scannedPath }` or null
- `clearScan()` — resets to navigation phase

Adding selected projects uses existing `addProjects(paths)` method.

## FilesystemGateway Extension

New method on `IFilesystemGateway`:

```typescript
scan(path: string): Promise<IScanResult>
```

New `IScanResult` interface:

```typescript
interface IScanResult {
  items: IBrowseItem[];
  scannedPath: string;
  scannedCount: number;
  filteredCount: number;
  total: number;
}
```

Reuses existing `IBrowseItem` (`{ name, path }`).

## Scan Behavior

- Depth: one level only — immediate subdirectories of the chosen path
- Detection: checks for `package.json` file existence in each subdirectory
- Dedup: already-added projects (matching by path in DB) are excluded from results
- No node_modules scanning: skip directories named `node_modules` or `.git`

## Testing

- Route test: temp directories with real `package.json` files, verify scan returns correct items, excludes already-added projects
- Gateway test: mock HTTP client, verify scan method calls correct route
- Presenter: verify scanDirectory populates VM, clearScan resets state
