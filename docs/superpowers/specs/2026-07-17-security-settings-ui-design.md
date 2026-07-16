# Security Settings UI — Design Spec

## Overview

A `/settings` page for managing `pmSecuritySettings` — the security check configuration that determines which config-file fields are verified per package manager before upgrades are allowed.

## Shared Field Definitions

### Location: `src/shared/security/`

Each PM gets its own file defining available security fields with Zod validation schemas.

```
src/shared/security/
  types.ts          — SecurityFieldDefinition, PackageManagerId
  yarn.ts           — yarn field definitions
  npm.ts            — npm field definitions
  pnpm.ts           — pnpm field definitions
  index.ts          — barrel + SECURITY_FIELD_REGISTRY
```

### `types.ts`

```ts
import type { z } from "zod";

// Canonical definition — API's TPackageManager will be changed to re-export this.
export type PackageManagerId = "yarn" | "npm" | "pnpm";

export interface SecurityFieldDefinition {
  fieldName: string;
  configFile: string;
  description: string;
  expectedValueSchema: z.ZodType<string>;
  defaultExpectedValue: string;
}
```

**Note:** `TPackageManager` is currently defined in `src/api/services/abstractions/PackageManagerService.ts`. This is the same union. Move the canonical definition to `src/shared/security/types.ts` as `PackageManagerId`, and change `TPackageManager` in the API to re-export it: `export type { PackageManagerId as TPackageManager } from "#shared/security/index.js"`. This avoids `#shared` → `#api` import.

### Per-PM Files (e.g. `yarn.ts`)

Each exports `const YARN_SECURITY_FIELDS: SecurityFieldDefinition[]` containing the available fields for that PM, with Zod schemas for validating expected values.

Yarn fields (from existing seed data):

- `npmPreapprovedPackages` (.yarnrc.yml) — default `"*"`
- `npmMinimalAgeGate` (.yarnrc.yml) — default `"0d"`
- `enableScripts` (.yarnrc.yml) — default `"false"`
- `approvedGitRepositories` (.yarnrc.yml) — default `"exists"`

NPM and PNPM start with empty arrays — the user will populate as needed.

### `index.ts`

Exports `SECURITY_FIELD_REGISTRY: Record<PackageManagerId, SecurityFieldDefinition[]>` combining all PM files.

**Relationship with SecurityService:** The field registry and SecurityService serve different purposes. The registry defines _which fields exist_ per PM (metadata for the settings UI). SecurityService reads the _enabled settings_ from the `pmSecuritySettings` DB table and checks project config files against them. SecurityService does not need to reference the registry — it operates purely on DB rows. No duplication.

**Invariant:** `fieldName` is unique per PM within the registry. Each PM has one primary config file, so `fieldName` alone is sufficient for lookup within a PM. The DB enforces `(packageManager, configFile, fieldName)` uniqueness, but the registry is stricter — no duplicate fieldNames per PM.

## API Routes

### Shared route definitions: `src/shared/routes/settings.ts`

Four routes following existing `defineRoute` pattern with Zod schemas for params, body, and response (same as `src/shared/routes/projects.ts`, `cache.ts`, etc.):

| Route                        | Method | Path                         | Body                                         | Response         |
| ---------------------------- | ------ | ---------------------------- | -------------------------------------------- | ---------------- |
| `listSecuritySettingsRoute`  | GET    | `/api/settings/security`     | —                                            | `{items, total}` |
| `createSecuritySettingRoute` | POST   | `/api/settings/security`     | `{packageManager, fieldName, expectedValue}` | `{item}`         |
| `updateSecuritySettingRoute` | PUT    | `/api/settings/security/:id` | `{expectedValue}`                            | `{item}`         |
| `deleteSecuritySettingRoute` | DELETE | `/api/settings/security/:id` | —                                            | (no body, 204)   |

POST body validated in the route handler against the field registry — rejects unknown PM (400), unknown field name for that PM (400), or invalid expected value per field's `expectedValueSchema` (400). The handler derives `configFile` from the registry (not sent by client). Before insert, check for existing `(packageManager, fieldName)` — return 409 Conflict if duplicate.

PUT handler: look up setting by id first — return 404 if not found. Then look up the field definition from the registry using the existing setting's packageManager + fieldName. If field definition is missing from registry (orphaned DB row), skip schema validation and accept any string — the setting was created when the field was known, so allow editing it even if the registry no longer lists it. Otherwise validate new expectedValue against that field's `expectedValueSchema`. Return 400 on validation failure.

### API route handler: `src/api/routes/settings.ts`

Registered via `registerRoute` using `sendOne`, `sendList`, `sendNone`, `sendError`. Direct DB access (Drizzle queries on `pmSecuritySettings` table) — no separate service needed; CRUD is straightforward.

### Registration

- Export `settingsRoutes` plugin function from `src/api/routes/settings.ts`
- Register in `src/api/routes/index.ts` barrel export
- Register in `src/api/server.ts` alongside existing route plugins
- Export all route definitions from `src/shared/routes/index.ts`

## UI Layer

### Feature structure (MVP pattern)

```
src/ui/
  features/settings/
    abstractions/
      SecuritySettingsGateway.ts
      SecuritySettingsRepository.ts
    SecuritySettingsGateway.ts
    SecuritySettingsRepository.ts
    feature.ts
  presentation/settings/
    SecuritySettings/
      abstractions/
        SecuritySettingsPresenter.ts
      SecuritySettingsPresenter.ts
      SecuritySettingsProvider.tsx
      components/
        SecuritySettingsPage.tsx
      __tests__/
        SecuritySettingsPresenter.test.ts
    useCases/
      abstractions/
        LoadSecuritySettingsUseCase.ts
        CreateSecuritySettingUseCase.ts
        UpdateSecuritySettingUseCase.ts
        RemoveSecuritySettingUseCase.ts
      LoadSecuritySettingsUseCase.ts
      CreateSecuritySettingUseCase.ts
      UpdateSecuritySettingUseCase.ts
      RemoveSecuritySettingUseCase.ts
      feature.ts
```

### Gateway

`SecuritySettingsGateway` — HTTP calls via `HTTPClient.request(route, args)`.

Methods:

- `list(): Promise<SecuritySetting[]>` — GET all settings
- `create(packageManager: PackageManagerId, fieldName: string, expectedValue: string): Promise<SecuritySetting>` — POST
- `update(id: string, expectedValue: string): Promise<SecuritySetting>` — PUT
- `remove(id: string): Promise<void>` — DELETE

`SecuritySetting` type: `{ id, packageManager, configFile, fieldName, expectedValue }`.

### Repository

`SecuritySettingsRepository` — holds `SecuritySetting[]` in memory. Methods: `getSettings()`, `setSettings(settings: SecuritySetting[])`, `addSetting(setting: SecuritySetting)`, `updateSetting(id: string, expectedValue: string)`, `removeSetting(id: string)`.

### Use Cases

- `LoadSecuritySettingsUseCase` — fetches all settings, stores in repository
- `CreateSecuritySettingUseCase` — creates a new setting (params: packageManager, fieldName, expectedValue). Optimistic update: appends returned item to repository list (same pattern as `AddProjectUseCase`)
- `UpdateSecuritySettingUseCase` — updates expected value (params: id, expectedValue). Optimistic update: replaces item in repository list with returned item
- `RemoveSecuritySettingUseCase` — deletes via gateway. Optimistic update: removes item from repository list by id

### Presenter

`SecuritySettingsPresenter` — MobX `makeAutoObservable`, computed `vm` getter. Default `selectedPackageManager` is `"yarn"`.

The presenter enriches DB rows with `description` from `SECURITY_FIELD_REGISTRY` by looking up the field definition using `(packageManager, fieldName)`. For orphaned rows (field removed from registry), description falls back to the raw fieldName.

ViewModel:

```ts
interface SecuritySettingsViewModel {
  loading: boolean;
  error: string | null; // validation or server error message
  selectedPackageManager: PackageManagerId;
  settings: SecuritySettingViewModel[]; // settings for selected PM
  availableFields: AvailableFieldViewModel[]; // fields not yet added for selected PM
  editingId: string | null; // id of row being edited
  addingField: string | null; // field name of new row being added
}

interface SecuritySettingViewModel {
  id: string;
  fieldName: string;
  configFile: string;
  description: string;
  expectedValue: string;
}

interface AvailableFieldViewModel {
  fieldName: string;
  configFile: string;
  description: string;
  defaultExpectedValue: string;
}
```

The `vm` getter is a MobX `computed`. `settings` and `availableFields` are derived from `selectedPackageManager` — when PM changes, both recompute automatically. `availableFields` = registry fields for selected PM minus fields already present in `settings`.

`editingId` and `addingField` are mutually exclusive — setting one clears the other. `selectPackageManager()` clears both (cancels any in-progress edit/add).

Error is cleared at the start of every mutation (`confirmAdd`, `confirmEdit`, `remove`) and on `selectPackageManager`. Set on failure. Cancel methods (`cancelAdd`, `cancelEdit`) do not clear error — it persists until the next mutation or PM switch.

Public methods:

- `load()` — fetch all settings
- `selectPackageManager(pm)` — switch PM tab, cancel any edit/add, clear error
- `startAdd(fieldName)` — begin adding a field (cancels any edit)
- `confirmAdd(expectedValue)` — clear error, validate against schema, save new setting
- `cancelAdd()` — cancel add
- `startEdit(id)` — begin editing a row (cancels any add)
- `confirmEdit(expectedValue)` — clear error, validate against schema, save edited setting
- `cancelEdit()` — cancel edit
- `remove(id)` — clear error, delete setting

### Components

`SecuritySettingsPage`:

- Segmented control for PM selection (yarn / npm / pnpm)
- Table: Field Name | Config File | Expected Value | Actions (edit / delete icons)
- "Add Setting" button with dropdown of available (not-yet-added) fields — selecting a field calls `startAdd(fieldName)`, which inserts an inline editable row at the bottom of the table (no modal). User fills in expected value and confirms or cancels.
- Inline editing: expected value becomes a TextInput when editing (click edit icon → `startEdit(id)`)
- Validation feedback from Zod schema on expected value

## Routing

- New path: `/settings`
- Link added to app header ("Settings" text link next to title)
- Exact match `path === "/settings"` in `AppRoutes` — checked before the `PROJECT_DETAIL_PATH_PATTERN` regex

## App Registration

All new features must be added to the `ALL_FEATURES` array in `src/ui/App.tsx`:

- `SecuritySettingsFeature` (gateway + repository — `src/ui/features/settings/feature.ts`)
- `SecuritySettingsUseCasesFeature` (use cases — `src/ui/presentation/settings/useCases/feature.ts`)
- `SecuritySettingsPresentationFeature` (presenter — `src/ui/presentation/settings/SecuritySettings/feature.ts`)

## Testing

### API tests

- CRUD operations on pmSecuritySettings via route tests
- Validation: reject unknown PM, reject unknown field, reject invalid expected value
- Duplicate detection: POST returns 409 for existing (packageManager, fieldName)
- Orphaned row: PUT on a setting whose field was removed from registry accepts any expectedValue string

### UI tests

- SecuritySettingsPresenter tests (mock HTTPClient at DI level)
- Load settings, switch PM, add/edit/delete, available fields computation
