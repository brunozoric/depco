# Config Error Toasts & Editable PM Settings

Two features: global toast notifications for file config errors, and editable UI controls for install flags / registry URL / upgrade strategy.

## Feature 1: Config Error Toast Notifications

### Goal

Surface `.dependency-upgrader.json` parse/validation errors as toast notifications globally, regardless of which page the user is on.

### Design

**`ConfigErrorNotifier`** — renderless component in `App.tsx`, alongside existing `JobNotificationListener`.

1. Resolves `PmSettingsGateway` from DI container via `useContainer()`
2. Calls `listPmConfig()` on mount
3. If response contains `configError` → fires `notifications.show()`:
   - Color: yellow
   - Title: "Config file error"
   - Message: error type (JSON parse / schema validation) + short message
   - Click navigates to `/settings/pm`
   - `autoClose: false` — stays until dismissed or clicked
   - ID: `"config-error"` — prevents duplicate toasts
4. Stores last-seen error message in ref — only re-toasts if error changes

**What stays unchanged:** Inline yellow `Alert` banners on PM Settings and App Settings pages remain as-is. Toast is complementary.

### New files

- `src/ui/shared/notifications/configErrorNotification.ts` — `showConfigErrorToast(error)` function

### Modified files

- `src/ui/App.tsx` — add `ConfigErrorNotifier` component

## Feature 2: Editable PM Settings UI

### Goal

Allow users to edit install flags, registry URL, and upgrade strategy from the PM Settings page, writing changes back to `.dependency-upgrader.json` with a confirmation dialog.

### API Layer

**FileConfigService extension:**

- Add `writeGlobalPmSettings(pm: PackageManagerId, settings: IFilePmSettings): Promise<void>` to abstraction and implementation
- Reads full file via `JsonFileTool.readJson()`, deep-merges the PM section under `pmSettings`, writes back via `JsonFileTool.writeJson()`
- If file doesn't exist, creates `{ pmSettings: { [pm]: settings } }`
- Invalidates cache after write (resets `cachedResult` and `cachedAt`)

**New route:**

- `PUT /api/settings/pm/:pm` — shared route definition in `src/shared/routes/pmSettings.ts`
- Params: `pm` (PackageManagerId)
- Body: partial `IFilePmSettings` — `{ installFlags?, registryUrl?, upgradeStrategy? }`
- Calls `FileConfigService.writeGlobalPmSettings()`, returns updated config for that PM
- Security fields excluded — those use existing DB-backed CRUD routes

### UI Layer

**Install tab changes:**

- Each install flag row: replace read-only `Badge` with `Switch` toggle
- Toggle fires save immediately (optimistic update, revert on error)
- Sends full `installFlags` record (all flags for that PM) on each toggle

**General tab changes:**

- Registry URL: `TextInput` with inline save button
- Upgrade Strategy: `Select` dropdown (`caret` / `tilde` / `exact` / `latest`) with inline save button
- Both save on explicit button click, not on change

**Confirmation dialog:**

- Mantine `Modal` shown before any file write
- Content: "This will modify `.dependency-upgrader.json`:" + JSON preview of changes
- When file doesn't exist: "This will create `.dependency-upgrader.json`"
- Confirm / Cancel buttons
- On confirm: fires the actual save

**Presenter changes:**

- `PmSettingsPresenter` gets new methods: `toggleInstallFlag(flag)`, `saveRegistryUrl(url)`, `saveUpgradeStrategy(strategy)`
- View model gets: `confirmDialog: { open: boolean, changes: object } | null`
- New `confirmSave()` and `cancelSave()` methods for dialog flow

**New use case:**

- `SavePmConfigUseCase` — calls `PmSettingsGateway.updatePmConfig()`, reloads config on success

**Gateway extension:**

- `PmSettingsGateway` abstraction + implementation: add `updatePmConfig(pm: PackageManagerId, settings: IFilePmSettings): Promise<void>`

### New files

- `src/ui/presentation/settings/useCases/SavePmConfigUseCase.ts` — use case implementation
- `src/ui/presentation/settings/useCases/abstractions/SavePmConfigUseCase.ts` — use case abstraction

### Modified files

- `src/shared/routes/pmSettings.ts` — add `updatePmConfigRoute` definition
- `src/api/routes/settings.ts` — add PUT handler alongside existing `listPmSettingsRoute` handler
- `src/api/services/abstractions/FileConfigService.ts` — add `writeGlobalPmSettings()` to interface
- `src/api/services/FileConfigService.ts` — implement write method
- `src/ui/features/settings/abstractions/PmSettingsGateway.ts` — add `updatePmConfig()` to interface
- `src/ui/features/settings/PmSettingsGateway.ts` — implement `updatePmConfig()`
- `src/ui/presentation/settings/PmSettings/abstractions/PmSettingsPresenter.ts` — add edit methods + confirm dialog to view model
- `src/ui/presentation/settings/PmSettings/PmSettingsPresenter.ts` — implement edit methods
- `src/ui/presentation/settings/PmSettings/components/PmSettingsPage.tsx` — interactive controls + confirmation modal
- `src/ui/presentation/settings/useCases/feature.ts` — register `SavePmConfigUseCase`

### Error handling

- File write failure: toast notification (red), revert optimistic update
- Validation: Zod schema validates on server before write
- Cache: invalidated after successful write so next read gets fresh data

### What's excluded

- Security field editing (already has DB-backed CRUD)
- Project-level config editing (only global `.dependency-upgrader.json`)
