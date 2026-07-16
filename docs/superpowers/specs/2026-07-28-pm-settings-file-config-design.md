# PM Settings File Config

Consolidate all per-package-manager configuration under a single `pmSettings` key in `.dependency-upgrader.json`. Replaces the existing `securitySettings` key (clean break, unreleased). Adds install flags, registry URL, and upgrade strategy per PM.

## 1. File Config Schema

### Shape

```json
{
  "settings": { "branchTemplate": "...", "logLevel": "info" },
  "pmSettings": {
    "pnpm": {
      "security": { "ignoreScripts": "true", "strictSsl": "true" },
      "installFlags": { "--frozen-lockfile": true, "--ignore-scripts": true },
      "registryUrl": "https://registry.npmmirror.com",
      "upgradeStrategy": "caret"
    },
    "yarn": {
      "security": { "npmMinimalAgeGate": "3d" },
      "installFlags": { "--immutable": true },
      "upgradeStrategy": "exact"
    }
  }
}
```

### Migration

Remove `securitySettings` from schema entirely. Replace with `pmSettings`. All code reading `config.securitySettings` changes to `config.pmSettings?.{pm}?.security`. Clean break — feature is unreleased.

### Per-PM sub-schemas

- `security`: same validation as before (field names + values against `SECURITY_FIELD_REGISTRY`)
- `installFlags`: CLI flag strings as keys, boolean values. Validated against `INSTALL_FLAG_REGISTRY` per PM
- `registryUrl`: `z.string().url().optional()`
- `upgradeStrategy`: `z.enum(["caret", "tilde", "exact", "latest"]).optional()`

### Override behavior

Same full-replace-per-PM semantics. If file defines `pmSettings.pnpm`, ALL pnpm settings come from file. DB rows for that PM ignored.

## 2. Interfaces

```typescript
interface IFilePmSettings {
  security?: { [fieldName: string]: string };
  installFlags?: { [cliFlag: string]: boolean };
  registryUrl?: string;
  upgradeStrategy?: "caret" | "tilde" | "exact" | "latest";
}

interface IFileAllPmSettings {
  [packageManager: string]: IFilePmSettings;
}
```

`IProjectFileConfig` gains `pmSettings?: IFileAllPmSettings`, loses `securitySettings?: IFileSecuritySettings`.

`IFileSecuritySettings` type and its namespace export (`FileConfigService.SecuritySettings`) removed (replaced by `IFilePmSettings.security`).

## 3. Install Flag Registry

Existing `src/shared/install/types.ts` already defines `IInstallFlagDefinition` with `{ flag, label, description, exclusive? }`. Drivers already return `IInstallFlagDefinition[]` from their `installFlags()` method.

### Approach

Add a `defaultEnabled: boolean` field to `IInstallFlagDefinition`. Build an `INSTALL_FLAG_REGISTRY` (like `SECURITY_FIELD_REGISTRY`) that maps PM to flag arrays — extracted from the existing driver `installFlags()` methods. Drivers' `installFlags()` methods become thin wrappers returning the registry entry for their PM.

Update `getInstallOptionsRoute` response schema (`src/shared/routes/install.ts`) to include `defaultEnabled: z.boolean()` in the flag object schema.

The file config `installFlags` section uses the `flag` string (e.g. `"--frozen-lockfile"`) as the key, with `true/false` value. This keeps the file config format close to the actual CLI flags users know.

```json
"installFlags": { "--frozen-lockfile": true, "--ignore-scripts": true, "--force": false }
```

### Per-PM known flags (from existing drivers)

**yarn**: `--immutable`, `--production`, `--force`, `--ignore-scripts`

**npm**: `--omit=dev`, `--force`, `--legacy-peer-deps`, `--ignore-scripts`

**pnpm**: `--frozen-lockfile`, `--prod`, `--force`, `--ignore-scripts`

**bun**: `--frozen-lockfile`, `--production`, `--force`, `--dry-run`, `--ignore-scripts`

### Validation

Zod `superRefine` on the `pmSettings` schema validates per PM:

- `security` fields: same existing validation against `SECURITY_FIELD_REGISTRY`
- `installFlags` keys: validated against `INSTALL_FLAG_REGISTRY[pm].map(f => f.flag)`. Unknown flags rejected.
- `registryUrl`: standard URL validation via `z.string().url()`
- `upgradeStrategy`: enum validation via `z.enum(["caret", "tilde", "exact", "latest"])`

All validation happens in a single `superRefine` callback on the `pmSettings` record, iterating PM keys then each sub-field.

### Registry location

Extend `src/shared/install/`:

- `src/shared/install/types.ts` — add `defaultEnabled` to `IInstallFlagDefinition`
- `src/shared/install/yarn.ts`, `npm.ts`, `pnpm.ts`, `bun.ts` — flag arrays extracted from drivers
- `src/shared/install/index.ts` — `INSTALL_FLAG_REGISTRY` export

```typescript
export const INSTALL_FLAG_REGISTRY: Record<PackageManagerId, IInstallFlagDefinition[]> = {
  yarn: YARN_INSTALL_FLAGS,
  npm: NPM_INSTALL_FLAGS,
  pnpm: PNPM_INSTALL_FLAGS,
  bun: BUN_INSTALL_FLAGS
};
```

## 4. API and Driver Consumption

### Security settings route

Update to read from `config.pmSettings?.{pm}?.security` instead of `config.securitySettings?.{pm}`. Same full-replace-per-PM logic.

### Install flow

1. `InstallJobExecutor` resolves file config via `FileConfigService.readGlobalConfig()`
2. Extracts `pmSettings.{pm}.installFlags` for project's PM
3. Merges with `INSTALL_FLAG_REGISTRY` defaults — file config wins, missing flags use default
4. Passes resolved CLI flag strings to driver's `installCommand()`
5. Driver's `installFlags()` becomes a thin wrapper returning `INSTALL_FLAG_REGISTRY[pm]`
6. Install route (`src/api/routes/install.ts`) continues calling `driver.installFlags()` for available flags — unchanged

### Registry URL

Drivers consume `pmSettings.{pm}.registryUrl` in `registryInfoCommand()`. Passed through resolved config. Falls back to PM default (no flag) when not configured.

### Upgrade strategy

Consumed in upgrade flow when writing version to package.json. `pmSettings.{pm}.upgradeStrategy` determines prefix: `caret` = `^`, `tilde` = `~`, `exact` = no prefix, `latest` = `*`. Default: `caret` (current behavior).

### AppSettings route

No change. `pmSettings` is separate from `settings`.

## 5. UI — PM Settings Page

Rename SecuritySettings to PM Settings throughout. Add tabbed interface.

### Structure

- PM selector stays at top (existing `selectedPackageManager` dropdown)
- `configError` warning banner at page level (above tabs)
- Tab bar: **Security** | **Install** | **General**

### Security tab

Existing security settings UI. Unchanged behavior. Reads from `pmSettings.{pm}.security` via API.

### Install tab

Per-PM install flag display from file config. All read-only when file-managed. Shows:

- Flag name (human-readable from registry)
- CLI flag string
- Current value (true/false)
- Default value from registry

Empty state when no `pmSettings.{pm}.installFlags` in file.

### General tab

Registry URL and upgrade strategy per PM. Read-only when file-managed. Shows:

- Registry URL (or "default" when not configured)
- Upgrade strategy (or "caret (default)" when not configured)

Empty state when neither configured.

### File-managed behavior

All tabs respect `fileManagedPms`. Read-only banner when PM is file-managed. Controls disabled.

## 6. Testing

### FileConfigService

- `pmSettings` parsed correctly (security + installFlags + registryUrl + upgradeStrategy)
- Unknown install flag for known PM rejected
- Invalid upgradeStrategy value rejected
- `securitySettings` key rejected (old format gone)
- Existing security tests migrated to `pmSettings.{pm}.security` path

### Security settings route

- Tests updated from `securitySettings` to `pmSettings` format
- Same scenarios: file-managed PM, non-file-managed, error, db-only

### Install flag registry

- All PMs have entries
- Flag names match driver CLI flags
- No duplicate flag names per PM

### Driver tests

- `installCommand()` with custom flags from file config
- `installCommand()` with default flags when no file config
- Registry URL override

### UI presenter tests

- SecuritySettings tests use new response shape
- PM Settings tabs show correct data per category

## Files Touched

### New

- `src/shared/install/yarn.ts` — `YARN_INSTALL_FLAGS` (extracted from YarnDriver)
- `src/shared/install/npm.ts` — `NPM_INSTALL_FLAGS` (extracted from NpmDriver)
- `src/shared/install/pnpm.ts` — `PNPM_INSTALL_FLAGS` (extracted from PnpmDriver)
- `src/shared/install/bun.ts` — `BUN_INSTALL_FLAGS` (extracted from BunDriver)
- `src/shared/install/__tests__/installFlags.test.ts`

### Modified

- `src/shared/install/types.ts` — add `defaultEnabled` to `IInstallFlagDefinition`
- `src/shared/install/index.ts` — add `INSTALL_FLAG_REGISTRY` export
- `src/api/services/abstractions/FileConfigService.ts` — `IFilePmSettings`, `IFileAllPmSettings`, remove `IFileSecuritySettings`, update `IProjectFileConfig`
- `src/api/services/FileConfigService.ts` — new Zod schema for `pmSettings`, remove `securitySettings` schema
- `src/api/services/__tests__/FileConfigService.test.ts` — migrate tests to `pmSettings`
- `src/api/routes/settings.ts` — read from `pmSettings.security`
- `src/api/routes/__tests__/settings.test.ts` — update test data
- `src/api/services/packageManagers/YarnDriver.ts` — `installFlags()` returns `INSTALL_FLAG_REGISTRY.yarn`
- `src/api/services/packageManagers/NpmDriver.ts` — same pattern
- `src/api/services/packageManagers/PnpmDriver.ts` — same pattern
- `src/api/services/packageManagers/BunDriver.ts` — same pattern
- `src/api/services/jobExecutors/InstallJobExecutor.ts` — resolve install flags from file config, merge with registry defaults
- `src/api/services/UpgradeService.ts` (or `UpgradeResolver.ts`) — consume upgrade strategy
- UI: rename SecuritySettings to PM Settings, add tabs, update gateway/repository/presenter for new data shape
- `src/ui/presentation/settings/SecuritySettings/` — rename/restructure to PM Settings
- `src/shared/routes/settings.ts` — extend `listSecuritySettingsRoute` response with `installFlags` and `generalSettings` per PM, OR add new `listPmSettingsRoute` returning all per-PM config (install flags, registry URL, upgrade strategy) for the Install and General tabs
- `src/shared/routes/install.ts` — add `defaultEnabled: z.boolean()` to install flag schema
