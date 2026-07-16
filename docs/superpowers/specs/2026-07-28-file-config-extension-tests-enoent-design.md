# File Config Extension, Test Coverage, ENOENT Narrowing

## 1. Extend `.dependency-upgrader.json` Schema

### Schema

```json
{
  "stepHooks": [
    {
      "position": "pre:upgrade",
      "name": "Lint",
      "command": "yarn lint",
      "executionType": "command",
      "required": true
    }
  ],
  "settings": {
    "branchTemplate": "chore/deps-${YYYY}-${MM}-${DD}",
    "commitTemplate": "chore: deps ${YYYY}-${MM}-${DD}",
    "logLevel": "info"
  }
}
```

Both `stepHooks` and `settings` are optional at schema level (`.optional()` on both). All `settings` keys are also optional. `logLevel` validated as `"error" | "warn" | "info"`.

#### `IFileSettings` Interface

```typescript
interface IFileSettings {
  branchTemplate?: string;
  commitTemplate?: string;
  logLevel?: "error" | "warn" | "info";
}
```

#### Zod Schema

```typescript
// fileStepHookSchema already exists in FileConfigService.ts (unchanged)

const fileSettingsSchema = z.object({
  branchTemplate: z.string().optional(),
  commitTemplate: z.string().optional(),
  logLevel: z.enum(["error", "warn", "info"]).optional()
});

const projectFileConfigSchema = z.object({
  stepHooks: z.array(fileStepHookSchema).optional(),
  settings: fileSettingsSchema.optional()
});
```

**Implication of optional `stepHooks`**: `StepHookService` currently assumes `fileConfig.stepHooks` always exists when `fileConfig` is non-null. With `stepHooks` now optional, `StepHookService.getStepConfig` must check `fileConfig?.stepHooks` — if file exists but has no `stepHooks` key (e.g., global file with only `settings`), fall back to DB hooks.

### Two Scopes, One Format

- **Global file** (`CWD/.dependency-upgrader.json`): `settings` section applies app-wide. `stepHooks` in global file ignored.
- **Per-project file** (`projectPath/.dependency-upgrader.json`): `stepHooks` apply to that project (existing behavior). `settings` in per-project files ignored.
- **Both exist**: no conflict. Global file owns `settings`, per-project owns `stepHooks`. Each file is read independently by its respective consumer.

### API Changes

#### FileConfigService

- `IProjectFileConfig.stepHooks` becomes optional (`stepHooks?: IFileStepHook[]`).
- `IProjectFileConfig` gains optional `settings?: IFileSettings`.
- New `IFileSettings` interface (see schema section above).
- New method `readGlobalSettings(): Promise<IFileSettings | null>` reads from `process.cwd()` (evaluated per call, keeps it testable). Returns parsed `settings` section or `null` if no file / no settings key.
- **Error handling for `readGlobalSettings`**: ENOENT returns `null`. Invalid JSON or schema validation errors throw (same as `readConfig`). Callers (AppSettings route, BranchStep, CommitStep, AppLogService) let errors propagate — broken config files should surface, not silently fall back to DB.
- Zod schema updated: `projectFileConfigSchema` adds optional `settings` field.

#### AppSettings Route

- `GET /api/settings/app` checks `FileConfigService.readGlobalSettings()`.
- Response gains `configSource: "db" | "file"` and `fileManaged: string[]` (keys present in file config).
- File-managed keys return file values; remaining keys from DB as before.

#### StepHooks Route (existing, no changes needed)

StepHooks route already returns `configSource: "db" | "file"` and `discoveredScripts`. No changes from this spec — `configSource` is determined by per-project file config, which is independent of global settings.

#### Consumers of App Settings

- **BranchStep / CommitStep**: resolve template by checking global file settings first, then DB `app_settings`.
- **AppLogService**: `logLevel` check reads global file settings first, then DB.

### UI Changes

- AppSettings page receives `configSource` and `fileManaged` from API.
- File-managed keys shown read-only (disabled input).
- Banner displayed when any key is file-managed: "Some settings managed by .dependency-upgrader.json".

## 2. Test Coverage

### API — stepHooks route (`stepHooks.test.ts`)

- Scripts filtered by existing DB hook names: create hook named "test", verify "test" script excluded from `discoveredScripts`.
- Scripts filtered by file config hook names: file config has hook "lint", verify "lint" excluded from `discoveredScripts`.
- Empty `discoveredScripts` when project has no package.json scripts section.
- All scripts returned when no hooks configured.

### API — filesystem route (`filesystem.test.ts`)

- `**` glob pattern: `packages/**` matches nested dirs with package.json.
- `!` exclude patterns: `["packages/*", "!packages/excluded"]` skips excluded.
- `workspaces.packages` object form: `{ workspaces: { packages: ["apps/*"] } }`.
- Dedup across overlapping workspace patterns: same dir matched by two patterns appears once.

### API — appSettings route (`appSettings.test.ts`)

- Returns `configSource: "db"` and empty `fileManaged` when no global file config exists.
- Returns `configSource: "file"` and `fileManaged: ["branchTemplate"]` when global file has `settings.branchTemplate`.
- File-managed keys return file values; non-file keys return DB values.
- Invalid global config file throws (does not silently fall back to DB).

### FileConfigService (`FileConfigService.test.ts`)

- `readGlobalSettings` returns `null` when no file exists.
- `readGlobalSettings` returns parsed settings when file has `settings` key.
- `readGlobalSettings` returns `null` when file exists but has no `settings` key (stepHooks only).
- `readGlobalSettings` throws on malformed JSON.
- `readGlobalSettings` throws on invalid `logLevel` value.
- `readGlobalSettings` throws on non-ENOENT filesystem error (e.g., permission denied).

### Consumer integration

- BranchStep resolves template from file settings when global config exists.
- CommitStep resolves template from file settings when global config exists.
- AppLogService reads `logLevel` from file settings when global config exists.
- All three fall back to DB when global config has no relevant setting.

### Service unit tests

- `globWorkspacePattern` tests: `*`, `**`, literal segments, empty results. Tested via filesystem route or extracted function.
- `PackageJsonService.test.ts`: verify existing coverage for missing package.json, malformed JSON, no scripts key, empty scripts, alphabetical sort.

### UI — presenter/repository tests

- `StepHooksPresenter.test.ts`: load populates `discoveredScripts` in VM, `openFormWithDefaults` pre-fills form, `configSource: "file"` reflected in VM.
- `StepHooksRepository.test.ts`: verify get/set for `discoveredScripts` (may already be covered).

## 3. Narrow FileConfigService Catch-All to ENOENT

### Current Behavior

```typescript
try {
  raw = await readFile(join(projectPath, CONFIG_FILENAME), "utf-8");
} catch {
  return null; // swallows permission errors, I/O errors, etc.
}
```

### New Behavior

```typescript
} catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return null;
    }
    throw error;
}
```

Only ENOENT returns `null`. All other errors (EACCES, EIO, etc.) propagate to caller.

Same pattern applied to `readGlobalSettings()`.

### Tests

- Existing test "returns null when file does not exist" unchanged.
- New test: non-ENOENT error (e.g., read a directory path instead of file) throws instead of returning `null`.
