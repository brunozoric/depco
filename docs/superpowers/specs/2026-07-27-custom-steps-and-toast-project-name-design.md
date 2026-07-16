# Custom Pre/Post Steps & Project Name in Toast

## Overview

Two features:

1. **Custom pre/post steps** for the upgrade wizard — users define custom steps that run before/after each built-in step
2. **Project name in toast notifications** — show project name in job notification toasts

---

## Feature 1: Custom Pre/Post Steps

### Config Sources

Three sources, merged at session creation:

1. **`.dependency-upgrader.json`** in project root (version-controlled defaults)
2. **`package.json` scripts** — auto-detected scripts matching naming convention (`preupgrade`, `postupgrade`, `prebranch`, `postcommit`, etc.)
3. **DB per-project settings** — configured via UI, overrides file config

Merge order: file config < package.json scripts < DB overrides. DB can disable file-defined steps by setting `enabled: false`.

### Config Schema

`.dependency-upgrader.json`:

```json
{
  "steps": {
    "pre:branch": [
      {
        "name": "Stop dev server",
        "command": "yarn stop",
        "executionType": "command",
        "required": false
      }
    ],
    "post:upgrade": [
      {
        "name": "Run lint fix",
        "command": "yarn lint:fix",
        "executionType": "command",
        "required": true
      }
    ],
    "post:commit": [
      {
        "name": "Notify team",
        "command": "./scripts/notify.sh",
        "executionType": "script",
        "required": false
      }
    ]
  }
}
```

Hook positions: `pre:<step-type>` and `post:<step-type>` for each of the 5 built-in steps (`select-packages`, `branch`, `upgrade`, `refresh-transient`, `commit`).

**Step type semantics in config:**

- `"command"` — raw shell command executed directly (e.g. `"yarn lint:fix"`)
- `"script"` — path to a shell script file relative to project root (e.g. `"./scripts/notify.sh"`)
- `"package-script"` — a script name from `package.json` `"scripts"` field, executed via the project's package manager (e.g. `yarn preupgrade`)

Package.json detection: scans for scripts matching these patterns:

- `pre-<step>` or `pre<step>` (e.g. `pre-upgrade`, `preupgrade`, `pre-branch`, `prebranch`)
- `post-<step>` or `post<step>` (e.g. `post-commit`, `postcommit`, `post-upgrade`, `postupgrade`)

For hyphenated step names (`select-packages`, `refresh-transient`), detection also checks concatenated forms: `preselectpackages`, `pre-select-packages`.

Mapped to corresponding hook positions (e.g. `pre-upgrade` maps to `pre:upgrade`). Added as type `"package-script"`, non-required by default.

### Dynamic Step Pipeline

`createDefaultSteps()` replaced by `createSessionSteps(config)` that interleaves custom steps with built-in ones.

Example resulting step order:

```
pre:select-packages:stop-server    (custom)
select-packages                     (built-in)
pre:upgrade:lint-check             (custom)
upgrade                            (built-in)
post:upgrade:lint-fix              (custom)
branch                             (built-in)
refresh-transient                  (built-in)
commit                             (built-in)
post:commit:notify-team            (custom)
```

Step type naming: custom steps use `pre:<built-in>:<slug>` / `post:<built-in>:<slug>` format. Built-in steps keep current names unchanged.

Slug derivation: the `name` field is kebab-cased (lowercased, spaces replaced with hyphens, non-alphanumeric characters stripped). Example: `"Run lint fix"` becomes `run-lint-fix`, full type becomes `post:upgrade:run-lint-fix`.

`STEP_ORDER` becomes per-session. Stored in session row alongside `steps` JSON. `getNextStep()` signature changes to accept step list:

```typescript
export function getNextStep(currentType: string, stepOrder: string[]): string | null {
  const index = stepOrder.indexOf(currentType);
  if (index === -1 || index === stepOrder.length - 1) {
    return null;
  }
  return stepOrder[index + 1]!;
}
```

Both built-in and custom step names are entries in the `stepOrder` array. No distinction needed at navigation level.

`IStepContext` gains `stepOrder` field so resolvers can compute next step:

```typescript
export interface IStepContext {
  steps: IStepState[];
  packageManager: string;
  stepOrder: string[];
}
```

All resolvers (built-in and custom) use `getNextStep(this.type, context.stepOrder)` instead of `getNextStep(this.type)`. `UpgradeSessionService` populates `context.stepOrder` from session's stored `stepOrder` column.

### CustomStepResolver

Single resolver class handling all custom steps. Its `type` property is set dynamically per instance — one `CustomStepResolver` instance created per custom step in the session, each with the full hierarchical name (e.g. `pre:upgrade:lint-check`) as its `type`.

The resolver receives its execution config (command, script path, type) via constructor, not from `IStepContext`. This keeps `IStepContext` unchanged:

```typescript
export class CustomStepResolver implements IStepResolver {
  public readonly type: string;
  public readonly required: boolean;

  public constructor(
    type: string,
    private readonly config: ICustomStepConfig,
    private readonly commandRunner: CommandRunner.Interface
  ) {
    this.type = type;
    this.required = config.required;
  }

  public async execute(
    projectPath: string,
    context: IStepContext,
    input: Record<string, unknown>,
    onProgress?: (log: string) => void
  ): Promise<IStepResult> {
    // Execute config.command / config.script via commandRunner
    // Stream output through onProgress
    // Return updatedStep with next step:
    //   nextStep: getNextStep(this.type, context.stepOrder)
  }
}
```

`ICustomStepConfig` interface:

```typescript
interface ICustomStepConfig {
  name: string;
  command: string; // shell command, script file path, or package.json script name
  executionType: "command" | "script" | "package-script";
  required: boolean;
}
```

Execution behavior by `executionType`:

- `"command"` — run `command` value as raw shell command via `CommandRunner`
- `"script"` — run `command` value as path relative to project root (e.g. `./scripts/notify.sh`) via `CommandRunner`
- `"package-script"` — run `command` value as package manager script (e.g. `yarn run <command>` or `npm run <command>`)

### Failure Handling

Configurable per step via `required` boolean:

- `required: true` — failure halts wizard (same as built-in steps, throws error)
- `required: false` — failure sets status to `"skipped"` with error details in result:
  ```typescript
  result: { error: errorMessage, exitCode: number }
  ```
  Pipeline continues to next step.

### StepResolverRegistry Changes

Registry stays a singleton with built-in resolvers. New method `createSessionRegistry(customResolvers)` returns a per-session registry instance that contains both built-in and custom resolvers.

`UpgradeSessionService.createSession()` flow:

1. Load step config from all three sources (file, package.json, DB)
2. Merge configs (file < package.json < DB)
3. Build `stepOrder` array interleaving custom and built-in steps
4. Create `CustomStepResolver` instances for each custom step
5. Call `registry.createSessionRegistry(customResolvers)` to get per-session registry
6. Store `stepOrder` in session row (new `stepOrder` column, JSON string)
7. `executeStep` uses session's `stepOrder` to find next step

The per-session registry is not persisted as a singleton. On each `executeStep` call, `UpgradeSessionService`:

1. Loads session row (which contains `stepOrder` and `steps` JSON)
2. Reads custom step configs from `project_step_hooks` table for the project
3. Creates `CustomStepResolver` instances for any custom step types present in `stepOrder`
4. Calls `registry.createSessionRegistry(customResolvers)` to get a registry with both built-in and custom resolvers
5. Uses that registry to resolve and execute the requested step

This rebuild is cheap (DB reads + object construction) and avoids stale state between steps.

### Session Schema Changes

`upgrade_sessions` table gets new column:

- `stepOrder TEXT` — JSON array of step type strings for this session

Session response type gains `stepOrder: string[]` field so UI knows full pipeline shape.

### Wizard UI Changes

**Dynamic stepper.** `STEP_DEFINITIONS` constant removed. Stepper labels built from session's `stepOrder` plus step metadata at render time.

**Step label derivation:**

- Built-in steps: same labels as today ("Select Packages", "Branch", etc.) via a `BUILT_IN_LABELS` map
- Custom steps: label stored in each step's `IStepState.input.name` field, populated by `createSessionSteps()` at session creation time. The `input` record for custom steps includes `{ name, command, executionType }` from config so the UI and resolver both have access without extra lookups

**Grouped rendering.** Custom steps nested visually under their parent built-in step in the stepper. Each built-in step acts as a group header; its pre/post custom steps appear as sub-steps.

**`CustomStep` component** — generic step UI showing:

- Step name and command being executed
- Live log output (same `stepLogs` pattern as `UpgradeStep`)
- Status indicator (pending/running/completed/failed/skipped)
- For non-required steps: "Skip" button

**Auto-execution.** Custom steps auto-execute when they become active (same pattern as `UpgradeStep`). No manual "Continue" button needed.

**Step rendering dispatch.** Switch/case replaced by type check:

- If step type exists in `BUILT_IN_LABELS` map, render corresponding built-in component
- Otherwise, render `CustomStep`

### Config UI

Located on project settings page. Capabilities:

1. **View merged config** — shows all steps from file + package.json + DB, with source indicated
2. **Add/edit/remove custom steps** — shell commands or script paths, assign to hook position, set required/optional
3. **Reorder** within same hook position
4. **Disable** file-defined steps without deleting from file (DB override)
5. **Detect package.json scripts** — auto-discovered scripts shown with "from package.json" badge, toggleable

### DB Schema

New `project_step_hooks` table:

| Column    | Type    | Description                                                                                                                        |
| --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| id        | TEXT PK | Unique identifier                                                                                                                  |
| projectId | TEXT FK | References projects(id)                                                                                                            |
| position  | TEXT    | Hook position, e.g. "pre:upgrade"                                                                                                  |
| name      | TEXT    | Display name                                                                                                                       |
| command   | TEXT    | Shell command, script path, or package.json script name                                                                            |
| type      | TEXT    | Maps to `executionType` in ICustomStepConfig: "command" (raw shell), "script" (file path), "package-script" (yarn/npm script name) |
| required  | INTEGER | 0 or 1                                                                                                                             |
| enabled   | INTEGER | 0 or 1 (to override file config)                                                                                                   |
| sortOrder | INTEGER | Ordering within same position                                                                                                      |
| source    | TEXT    | "db" (user-created), "file" (from .dependency-upgrader.json), "package-json" (auto-detected)                                       |
| createdAt | INTEGER | Timestamp                                                                                                                          |
| updatedAt | INTEGER | Timestamp                                                                                                                          |

New column on `upgrade_sessions`:

| Column    | Type | Description                                      |
| --------- | ---- | ------------------------------------------------ |
| stepOrder | TEXT | JSON array of step type strings for this session |

---

## Feature 2: Project Name in Toast

### Factory Pattern

`handleJobStatusNotification` replaced by `createJobStatusNotificationHandler` factory:

```typescript
import type { Container } from "@webiny/di";
import { ProjectsRepository } from "#ui/features/projects/abstractions/ProjectsRepository.js";

export function createJobStatusNotificationHandler(
  container: Container
): (data: WSJobStatus) => void {
  const projectsRepository = container.resolve(ProjectsRepository);

  return (data: WSJobStatus): void => {
    // ... existing terminal status check and config lookup ...

    const projectName = projectsRepository.getProject(data.projectId)?.name;
    const label = humanizeJobType(data.type);
    const suffix = projectName ? ` — ${projectName}` : "";
    const title = `${config.prefix} ${label} job ${data.status}${suffix}`;

    notifications.show({
      id: data.jobId,
      color: config.color,
      title,
      message: "Click to view jobs",
      autoClose: config.autoClose,
      style: { cursor: "pointer" },
      onClick: () => {
        navigate("/jobs");
        notifications.hide(data.jobId);
      }
    });
  };
}
```

Factory resolves `ProjectsRepository` once at creation time. Returned handler is a closure over the repository reference.

### Toast Title Format

With project name: `"✓ Dependency job completed — MyProject"`
Without (fallback): `"✓ Dependency job completed"`

Falls back when `ProjectsRepository.getProject(id)` returns `undefined` (projects not loaded yet). This is acceptable — no extra fetch triggered. Project name appears in toasts once projects have been loaded at least once during the session.

### Caller Changes

`JobNotificationListener` in App.tsx creates handler once via factory at component mount, uses returned function for WS `job:status` events. Called once, not per-event:

```typescript
const handler = useMemo(() => createJobStatusNotificationHandler(container), [container]);
// pass handler to WS listener
```

### Test Changes

Old `handleJobStatusNotification` removed as export. Tests create handler via factory with mock container containing stubbed `ProjectsRepository`:

```typescript
const mockContainer = {
  resolve: abstraction => {
    if (abstraction === ProjectsRepository) {
      return { getProject: id => ({ name: "TestProject" }) };
    }
  }
};
const handler = createJobStatusNotificationHandler(mockContainer);
handler(eventData);
```

Test cases:

- Existing 6 test cases updated to use factory (pass mock container with empty repository)
- New: toast title includes project name when repository returns project
- New: toast title omits project name when repository returns undefined
