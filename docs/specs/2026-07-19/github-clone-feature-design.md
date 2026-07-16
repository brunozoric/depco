# GitHub Clone Feature — Design Spec

Add projects from a GitHub URL by cloning into a user-selected local directory. Extends the existing Add Project modal with a "Clone from GitHub" tab.

## API: Filesystem Browser

**Endpoint:** `GET /api/filesystem/browse?path=/some/dir&showHidden=true`

**Response:** `{ items: [{ name: string, path: string, type: "directory" }], total: number }`

Returns only directories (not files). Sorted alphabetically. Hidden directories (dotfiles) filtered by default; `showHidden=true` includes them. Returns 400 for nonexistent paths.

Default path when omitted: `process.cwd()`.

**Security:** All paths canonicalized with `path.resolve()` + `fs.realpath()` before reading. Rejects paths containing `..` segments after resolution. Symlinks resolved to real paths to prevent escape.

**Implementation:** New route file `src/api/routes/filesystem.ts`. Uses `fs.readdir` with `withFileTypes`. No DI dependencies. Route definition in `src/shared/routes/filesystem.ts`.

## API: Clone Route

**Endpoint:** `POST /api/projects/clone`

**Request body:**

```json
{
  "url": "https://github.com/org/repo.git",
  "destination": "/Users/someone/projects",
  "folderName": "custom-name" // optional, defaults to repo name from URL
}
```

**Response:** `{ item: { jobId: string } }`

**Behavior:**

1. Validate URL matches `https://` or `git@` scheme only (reject `file://`, `git+ssh://` and other schemes)
2. Extract repo name from URL (`https://github.com/org/repo.git` or `https://github.com/org/repo` or `git@github.com:org/repo.git` — all yield `repo`)
3. Use `folderName` if provided, otherwise use extracted repo name
4. Resolve final clone path: `destination/folderName`
5. Validate destination directory exists
6. Check final clone path is not already registered as a project
7. Enqueue a `"clone"` job with packages: `{ url, destination: finalPath }`
8. Return the job ID

No security gate on enqueue (clone doesn't modify existing projects).

**Route definition** in `src/shared/routes/projects.ts` alongside existing project routes.

## Job Type: Clone

**Job type:** `"clone"`

**Packages JSON schema (Zod):**

```typescript
z.object({
  url: z.string(),
  destination: z.string()
});
```

### CloneJobExecutor

**File:** `src/api/services/jobExecutors/CloneJobExecutor.ts`

**Dependencies:** `CommandRunner`, `PackageManagerService`, `SecurityService`, `DatabaseClient`

No dependency on `JobWorker` (would create circular: JobWorker -> Registry -> CloneExecutor -> JobWorker). Scan enqueue happens in the clone route handler after job completion, not inside the executor.

**Execute flow:**

1. Parse and validate packages JSON with Zod
2. Run `git clone <url> <destination>` via `CommandRunner.runStreaming` — streams stdout/stderr to `appendLog`
3. After successful clone, register the project using shared `registerProject` helper (extracted from the create-project route handler):
   - Read `package.json` from cloned directory to derive project name (fallback: directory basename)
   - Detect package manager via `PackageManagerService.detect()`
   - Detect PM version via `PackageManagerService.getVersion()`
   - Insert project into `projects` table (unique constraint on `path` prevents races)
   - Run `SecurityService.check()` on the new project
4. Store the new project ID in the job's `packages` field (as JSON `{ ...original, projectId }`) so the route/UI can enqueue a scan after clone completes

**Shared helper:** Extract project registration logic (name detection, PM detection, DB insert) into `src/api/services/registerProject.ts` — used by both the create-project route and CloneJobExecutor.

**Error handling:** If git clone fails, job fails with git error in logs. If clone succeeds but PM detection fails, project is still registered with `packageManager: null`. No cleanup of partial clones (user can delete manually). Each step after clone is wrapped individually so partial registration doesn't lose the clone.

### Registration

- Add `"clone"` to `CreateJobInput.type` union in `src/api/services/abstractions/JobWorker.ts`
- Register `CloneJobExecutor` in `JobExecutorRegistry` constructor

## UI: Extended Add Project Modal

### Tab Structure

Two tabs in `AddProjectModal.tsx`: **"Local Path"** and **"Clone from GitHub"**.

**Local Path tab:** Existing behavior unchanged — text input for path, Add button.

**Clone from GitHub tab:**

- **URL input:** TextInput, placeholder `https://github.com/org/repo`
- **Destination browser:** Breadcrumb showing current path (clickable segments to navigate up), flat directory list below (click to navigate into). Starts at `process.cwd()`.
- **Folder name:** TextInput, auto-derived from URL when URL changes (e.g. `repo`), editable. Helper text below shows resolved full path: `/picked/path/repo-name`.
- **Clone button:** Enqueues clone job, closes modal. Job progress visible in the job progress panel.

### New Component: FolderBrowser

**File:** `src/ui/presentation/projects/ProjectList/components/FolderBrowser.tsx`

**Props:**

- `currentPath: string` — the directory being displayed
- `items: { name: string, path: string }[]` — subdirectories
- `onNavigate: (path: string) => void` — called when user clicks a directory or breadcrumb segment
- `loading: boolean`

Renders a breadcrumb bar + scrollable list of folder entries. Each entry shows a folder icon + name. Click navigates into that folder.

### Gateway

New method on `ProjectsGateway`:

```typescript
clone(url: string, destination: string, folderName?: string): Promise<{ jobId: string }>
```

### Use Case

**New:** `CloneProjectUseCase` with abstraction + implementation following DI conventions.

```typescript
interface ICloneProjectUseCase {
  execute(url: string, destination: string, folderName?: string): Promise<string>; // returns jobId
}
```

### Presenter Changes

`ProjectListPresenter` gains clone-related VM fields (all initialized to safe defaults):

- `cloneUrl: string` — `""`
- `cloneDestination: string` — `""` (current browse path)
- `cloneFolderName: string` — `""` (auto-derived or user-edited)
- `cloneLoading: boolean` — `false`
- `cloneError: string | null` — `null`
- `browsePath: string` — `process.cwd()` equivalent (fetched from browse API on first open)
- `browseItems: { name: string, path: string }[]` — `[]`
- `browseLoading: boolean` — `false`

New presenter methods:

- `setCloneUrl(url: string)` — sets URL, auto-derives folder name
- `setCloneFolderName(name: string)` — manual override
- `browseTo(path: string)` — loads directory contents via HTTP
- `cloneProject()` — calls use case, handles loading/error states

### Filesystem Browse Gateway

New gateway: `FilesystemGateway` with abstraction + implementation.

```typescript
interface IFilesystemGateway {
  browse(path: string, showHidden?: boolean): Promise<{ name: string; path: string }[]>;
}
```

Registered in a new `FilesystemFeature` or directly in the projects presentation feature.

## Testing

### API Tests

**`filesystem.test.ts`:**

- Browse returns directories sorted alphabetically
- Hidden directories filtered by default, included with `showHidden=true`
- Returns 400 for nonexistent path
- Returns empty items for empty directory
- Rejects paths with `..` traversal attempts
- Resolves symlinks to real paths

**`CloneJobExecutor` (in JobWorker.test.ts or own file):**

- Mock `CommandRunner` — verify `git clone` command and args
- Verify project registration after clone (row in projects table)
- Verify scan job enqueued after clone
- Verify security check runs after clone
- Verify error handling when git clone fails

**Clone route (in projects.test.ts):**

- Enqueues clone job, returns jobId
- Rejects empty URL
- Rejects `file://` scheme URLs
- Rejects nonexistent destination directory
- Rejects path already registered as a project
- Handles git clone success but missing package.json gracefully

### UI Tests

**`CloneProjectUseCase.test.ts`:**

- Mock HTTPClient, verify gateway call with correct params

**`ProjectListPresenter` additions:**

- Clone VM fields initialize correctly
- `setCloneUrl` auto-derives folder name
- `browseTo` updates browse items
- `cloneProject` calls use case, handles errors

## File Structure

```
src/shared/routes/filesystem.ts                          # route definition
src/api/routes/filesystem.ts                              # browse endpoint handler
src/api/routes/__tests__/filesystem.test.ts               # API tests
src/api/services/registerProject.ts                        # shared helper (create-project + clone)
src/api/services/jobExecutors/CloneJobExecutor.ts         # executor
src/api/services/abstractions/JobWorker.ts                # add "clone" to type union
src/api/services/jobExecutors/JobExecutorRegistry.ts      # register CloneJobExecutor
src/ui/features/filesystem/
  abstractions/FilesystemGateway.ts                       # abstraction
  FilesystemGateway.ts                                    # implementation
  feature.ts                                              # DI registration
src/ui/presentation/projects/
  useCases/abstractions/CloneProjectUseCase.ts            # abstraction
  useCases/CloneProjectUseCase.ts                         # implementation
  ProjectList/components/AddProjectModal.tsx               # extend with tabs
  ProjectList/components/FolderBrowser.tsx                 # new component
  ProjectList/ProjectListPresenter.ts                     # add clone VM fields
  ProjectList/abstractions/ProjectListPresenter.ts        # update interface
```
