# Security File Config, Cache, and Validation Errors

Three features extending the file config system: security settings in `.dependency-upgrader.json`, validation error surfacing, and FileConfigService-level caching.

## 1. File Config Security Settings

### Shape

New optional `securitySettings` section in `.dependency-upgrader.json`, nested by package manager:

```json
{
  "settings": { "branchTemplate": "upgrade/${PROJECT}" },
  "securitySettings": {
    "pnpm": {
      "ignoreScripts": "true",
      "strictSsl": "true",
      "minimumReleaseAge": "4320"
    },
    "yarn": {
      "npmMinimalAgeGate": "3d"
    }
  }
}
```

Keys are `fieldName`s from `SECURITY_FIELD_REGISTRY`. Values are `expectedValue` strings. Presence = enabled.

### Override behavior

Full replace per PM. If file defines security settings for `pnpm`, ALL pnpm security settings come from file. DB `pmSecuritySettings` rows for that PM are ignored. Other PMs not in file still use DB.

### Schema validation

Zod schema validates:

- PM keys must be valid `PackageManagerId` (`yarn | npm | pnpm | bun`)
- Field names must exist in `SECURITY_FIELD_REGISTRY` for that PM
- Values validated against each field's `expectedValueSchema`

Invalid PM, unknown field, or bad value rejects at parse time.

### Interface

New type in `FileConfigService` abstraction:

```typescript
interface IFileSecuritySettings {
  [packageManager: string]: {
    [fieldName: string]: string;
  };
}
```

`IProjectFileConfig` gains `securitySettings?: IFileSecuritySettings`.

## 2. Validation Error Surfacing

### Problem

FileConfigService throws on malformed JSON or schema violations. Routes have no try/catch. Fastify returns 500.

### Solution

FileConfigService returns a result type instead of throwing:

```typescript
interface IFileConfigError {
  type: "json" | "schema";
  message: string;
}

interface IFileConfigResult {
  config: IProjectFileConfig | null;
  error?: IFileConfigError;
}

interface IFileSettingsResult {
  settings: IFileSettings | null;
  error?: IFileConfigError;
}
```

`readGlobalConfig()` — new method, returns `IFileConfigResult` (full config including `securitySettings`).
`readGlobalSettings()` — stays as convenience, returns `IFileSettingsResult`, delegates internally.
`readConfig(projectPath)` — unchanged, returns `IProjectFileConfig | null`, throws on errors. Per-project config errors during step execution should fail hard.

### JsonFileTool

Replace manual `readFile` + `JSON.parse` + `zod.parse` with DI-injected `JsonFileTool` from `@webiny/stdlib/node`:

- Register `JsonFileToolFeature` in `ApiFeature` (`feature.ts`)
- Add `JsonFileTool` as dependency of `FileConfigService`
- `readJson(path, { schema })` returns `null` (ENOENT) or validated config
- Throws on bad JSON / schema failure
- Wrap in try/catch to build error result
- Removes `isEnoent` helper, `readFile` import

### API response

Routes catch errors from result and return structured response:

```json
{
  "items": ["...db rows (fallback)..."],
  "configSource": "error",
  "fileManaged": [],
  "configError": { "type": "schema", "message": "Expected string at settings.logLevel" }
}
```

`configSource` gains third value: `"error"` (alongside `"db"` and `"file"`).

### UI

Warning banner when `configError` present. DB values remain editable (fallback mode). File-managed indicators hidden since file is broken.

## 3. FileConfigService Cache

### Problem

`readGlobalSettings()` reads file from disk on every call. AppLogService has its own 10s cache, but other consumers (appSettings route, security settings route) have none.

### Solution

Cache at FileConfigService level:

- Private `cachedResult: IFileConfigResult | null` + `cachedAt: number`
- TTL: 10,000ms (matches AppLogService's prior cache)
- Both `readGlobalConfig()` and `readGlobalSettings()` go through cache
- Cache stores error results too (stale error better than re-reading broken file every call)
- `readConfig(projectPath)` stays uncached (per-project, called infrequently)

AppLogService: remove private `cachedLevel` / `cachedAt`. Delegates entirely to FileConfigService.

## 4. Security Settings Route Changes

`listSecuritySettingsRoute` handler gains file config awareness:

1. Resolve FileConfigService, call `readGlobalConfig()`
2. If result has `securitySettings` for a PM:
   - Skip DB rows for that PM
   - Synthesize rows from file: `id` generated, `configFile` from registry, `enabled: true`
3. Response gains `configSource`, `fileManagedPms: string[]`, optional `configError`

## 5. Security Settings UI Changes

Gateway, Repository, Presenter extended:

- `list()` response carries `configSource`, `fileManagedPms`, `configError`
- Repository stores all three
- Presenter VM exposes them; per-setting `isFileManaged` computed from PM membership
- Page: read-only banner for file-managed PMs (same pattern as AppSettings). Edit/toggle/add/reset disabled. Warning banner on `configError`.

## 6. Testing

### FileConfigService

- `securitySettings` parsed correctly (nested by PM, multiple PMs)
- Unknown PM rejected
- Unknown field for known PM rejected
- Invalid field value rejected
- Cache: second call within TTL returns cached, no re-read
- Cache: call after TTL re-reads
- Result type: JSON parse error returns `{ config: null, error: { type: "json" } }`
- Result type: Zod error returns `{ config: null, error: { type: "schema" } }`
- Cache stores error results

### appSettings route

- `configSource: "error"` + `configError` when file invalid
- DB rows still returned as fallback
- `fileManaged: []` on error

### Security settings route

- File-managed PM: DB rows replaced with file-derived rows
- Non-file-managed PM: DB rows unchanged
- Mixed: pnpm file-managed, yarn from DB
- `fileManagedPms` populated correctly
- `configError` surfaced

### AppLogService

- Private cache removed, delegates to FileConfigService

### UI presenters

- AppSettingsPresenter: `configError` in VM
- SecuritySettingsPresenter: `fileManagedPms` + `configError` in VM

## Files touched

### New

- (none — all changes extend existing files)

### Modified

- `src/api/feature.ts` — register `JsonFileToolFeature`
- `src/api/services/abstractions/FileConfigService.ts` — new types, `readGlobalConfig()` method
- `src/api/services/FileConfigService.ts` — JsonFileTool DI dependency, cache, result types, schema extension
- `src/api/routes/appSettings.ts` — error handling, `configError` in response
- `src/api/routes/settings.ts` — file config awareness, `fileManagedPms`
- `src/api/services/AppLogService.ts` — remove private cache
- `src/shared/routes/` — response schemas extended with `configError`
- `src/ui/features/settings/abstractions/SecuritySettingsGateway.ts` — response types
- `src/ui/features/settings/SecuritySettingsGateway.ts` — pass through new fields
- `src/ui/features/settings/abstractions/SecuritySettingsRepository.ts` — store new fields
- `src/ui/features/settings/SecuritySettingsRepository.ts` — implement storage
- `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts` — VM types
- `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts` — expose new fields
- `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx` — read-only + warning
- `src/ui/features/appSettings/abstractions/AppSettingsGateway.ts` — `configError` type
- `src/ui/features/appSettings/AppSettingsGateway.ts` — pass through
- `src/ui/features/appSettings/abstractions/AppSettingsRepository.ts` — store `configError`
- `src/ui/features/appSettings/AppSettingsRepository.ts` — implement
- `src/ui/presentation/settings/AppSettings/abstractions/AppSettingsPresenter.ts` — VM type
- `src/ui/presentation/settings/AppSettings/AppSettingsPresenter.ts` — expose
- `src/ui/presentation/settings/AppSettings/components/AppSettingsPage.tsx` — warning banner
- Test files for all above
