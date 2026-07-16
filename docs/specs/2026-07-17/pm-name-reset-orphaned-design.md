# PM Name Display, Reset to Defaults, Orphaned Row Badge

Date: 2026-07-17

Three features for the security settings and project detail pages.

## Feature 1: Show Detected PM Name

### Problem

ProjectDetailPage shows `"Package Manager: 4.1.0"` — version only. The API already returns `packageManager` (e.g. `"yarn"`) in the project response, but the UI gateway drops it. Users see a version with no context about which PM it belongs to.

### Design

Thread `packageManager` field through the existing data path:

1. **Gateway abstraction** (`IProject`): add `packageManager: string | null`
2. **Gateway impl** (`toProject()`): map `packageManager` from API response
3. **ProjectDetail VM** (`IProjectDetailProjectViewModel`): add `packageManager: string | null`
4. **ProjectDetail presenter**: map from repository project data
5. **ProjectDetailPage**: display as `"{pmName} {pmVersion}"` — e.g. "Yarn 4.1.0"
6. **ProjectList VM** (`IProjectListItem`): add `packageManager: string | null`
7. **ProjectList presenter**: map from repository project data

Display format: capitalize PM name — "Yarn", "NPM", "PNPM". Add a `formatPmName(pm: string): string` helper in `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx` (inline, not shared). Uses the same `ACRONYMS` set pattern from `src/ui/presentation/projects/ProjectDetail/components/SecurityPanel.tsx`: if PM is a known acronym, upper-case it; otherwise title-case.

### Files

- `src/ui/features/projects/abstractions/ProjectsGateway.ts`
- `src/ui/features/projects/ProjectsGateway.ts`
- `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`
- `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`
- `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`
- `src/ui/presentation/projects/ProjectList/abstractions/ProjectListPresenter.ts`
- `src/ui/presentation/projects/ProjectList/ProjectListPresenter.ts`
- Presenter tests for both

## Feature 2: Reset to Defaults

### Problem

No way to reset security settings for a PM back to registry defaults. Users must manually delete each setting and re-add from the dropdown.

### Design

#### API

New route: `POST /api/settings/security/reset`

- Body: `{ packageManager: string }`
- Response: `{ items: SecuritySettingRow[] }` — the newly created default rows
- Handler: in a single transaction, delete all `pmSecuritySettings` rows for the PM, then insert one per `SECURITY_FIELD_REGISTRY[pm]` entry with `defaultExpectedValue`. Return the created rows.
- Validates PM against `PackageManagerId`. Rejects unknown PMs.

Route definition in `src/shared/routes/settings.ts`.

#### UI

1. **Gateway**: add `resetDefaults(pm: string): Promise<ISecuritySetting[]>`
2. **ResetSecuritySettingsUseCase** (new): calls `gateway.resetDefaults(pm)`, replaces repository state by removing old PM settings and adding returned ones
3. **Presenter**: add `resetToDefaults()` method. Clears editing/adding state, calls use case.
4. **VM**: add `canReset: boolean` — true when the selected PM's registry is non-empty (npm/pnpm currently empty, so button hidden for them)
5. **Page**: "Reset to Defaults" button next to "Add Setting", disabled when `!vm.canReset`

### Files

- `src/shared/routes/settings.ts` — new route definition
- `src/api/routes/settings.ts` — handler
- `src/ui/features/settings/abstractions/SecuritySettingsGateway.ts` — add method
- `src/ui/features/settings/SecuritySettingsGateway.ts` — implement
- `src/ui/presentation/settings/useCases/abstractions/ResetSecuritySettingsUseCase.ts` — new
- `src/ui/presentation/settings/useCases/ResetSecuritySettingsUseCase.ts` — new
- `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts` — add to interface + VM
- `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts` — implement
- `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx` — button
- `src/ui/presentation/settings/useCases/feature.ts` — register ResetSecuritySettingsUseCase
- Tests: API route, presenter, use case

## Feature 3: Orphaned Row Warning Badge

### Problem

When a field is removed from `SECURITY_FIELD_REGISTRY`, existing DB rows for that field become orphaned. The settings page shows them with a fallback description (`s.fieldName`) but gives no visual signal that they are orphaned. Users cannot distinguish stale settings from valid ones.

### Design

Pure UI-side computation — no API changes.

1. **VM**: add `isOrphaned: boolean` to `ISecuritySettingViewModel`
2. **Presenter**: the `vm` getter already does `registry.find(f => f.fieldName === s.fieldName)`. When result is `undefined`, set `isOrphaned: true`.
3. **Page**: orphaned rows get:
   - Orange `Badge` with text "Orphaned" next to the field name
   - `Tooltip` on badge: "This field is no longer in the registry. You can edit or delete it."
   - Subtle row styling via Mantine `bg` prop on `Table.Tr` (light orange/warning tint)
4. Orphaned rows remain fully editable and deletable (existing rule).

### Files

- `src/ui/presentation/settings/SecuritySettings/abstractions/SecuritySettingsPresenter.ts`
- `src/ui/presentation/settings/SecuritySettings/SecuritySettingsPresenter.ts`
- `src/ui/presentation/settings/SecuritySettings/components/SecuritySettingsPage.tsx`
- Presenter tests

## Testing Strategy

- **Feature 1**: update existing ProjectDetailPresenter and ProjectListPresenter tests to assert `packageManager` flows through VM
- **Feature 2**: API route test (reset creates defaults, idempotent), presenter test (resetToDefaults clears state, canReset logic), use case test
- **Feature 3**: presenter test with a setting whose fieldName is not in the registry — assert `isOrphaned: true`
