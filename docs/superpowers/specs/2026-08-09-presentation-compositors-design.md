# Per-Domain Presentation Compositors Design

## Overview

Extract per-domain compositor `feature.ts` files in each `src/ui/presentation/<Domain>/` folder. Each compositor groups that domain's presentation + use-case sub-features. PresentationFeature shrinks from 38 flat entries to 18 domain compositors.

## Current State

`src/ui/presentation/feature.ts` (PresentationFeature) lists 38 sub-features flat — every presentation page feature and use-case feature individually. No domain-level grouping exists.

## Change

Create `feature.ts` in each domain folder under `src/ui/presentation/`. Each compositor:

- Uses `createFeature` with `dependencies: [...]` listing that domain's sub-features
- Has empty `register() {}` (pure aggregator, same pattern as current PresentationFeature)
- Named `"Ui/Presentation/<Domain>"` following existing convention

### Domain Compositors (18 total)

| Domain          | Compositor Name              | Sub-features                                                                                                               |
| --------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Auth            | AuthPresentationFeature      | LoginPageFeature                                                                                                           |
| AutoFix         | AutoFixPresentationFeature   | AutoFixUseCasesFeature                                                                                                     |
| Backup          | BackupDomainFeature          | BackupPresentationFeature, BackupUseCasesFeature                                                                           |
| Dashboard       | DashboardDomainFeature       | DashboardPresentationFeature, DashboardUseCasesFeature                                                                     |
| DependencyGraph | DependencyGraphDomainFeature | DependencyGraphPageFeature, DependencyGraphUseCasesFeature                                                                 |
| Jobs            | JobsDomainFeature            | JobManagerPresentationFeature, JobManagerUseCasesFeature, JobProgressFeature                                               |
| Licenses        | LicensesDomainFeature        | LicenseListFeature, LicensesUseCasesFeature                                                                                |
| Logs            | LogsDomainFeature            | LogBrowserPresentationFeature, AppLogsUseCasesFeature                                                                      |
| Packages        | PackagesDomainFeature        | PackageListFeature, PackagesUseCasesFeature                                                                                |
| Projects        | ProjectsDomainFeature        | ProjectListFeature, ProjectDetailFeature, StepHooksPresentationFeature, UpgradeWizardFeature, ProjectsUseCasesFeature      |
| Sbom            | SbomDomainFeature            | SbomPageFeature, SbomUseCasesFeature                                                                                       |
| ScanSchedules   | ScanSchedulesDomainFeature   | ScanSchedulesUseCasesFeature                                                                                               |
| Settings        | SettingsDomainFeature        | PmSettingsPresentationFeature, AppSettingsPresentationFeature, SecuritySettingsUseCasesFeature, AppSettingsUseCasesFeature |
| Teams           | TeamsDomainFeature           | TeamsPageFeature, TeamDetailFeature, TeamsUseCasesFeature                                                                  |
| Trends          | TrendsDomainFeature          | TrendsPageFeature, TrendsUseCasesFeature                                                                                   |
| Upgrades        | UpgradesDomainFeature        | UpgradesUseCasesFeature                                                                                                    |
| Users           | UsersDomainFeature           | UserListFeature, UsersUseCasesFeature                                                                                      |
| Vulnerabilities | VulnerabilitiesDomainFeature | VulnerabilityListFeature, VulnerabilityDetailFeature, VulnerabilitiesUseCasesFeature                                       |

### Naming Convention

- Domains with only use-cases or only one sub-feature: `<Domain>PresentationFeature` (Auth, AutoFix) or `<Domain>DomainFeature` for multi-sub-feature domains
- Single-purpose domains (Auth has only LoginPage, AutoFix has only useCases): still get a compositor for consistency

### Updated PresentationFeature

```typescript
export const PresentationFeature = createFeature({
  name: "Ui/Presentation",
  dependencies: [
    AuthPresentationFeature,
    AutoFixPresentationFeature,
    BackupDomainFeature,
    DashboardDomainFeature,
    DependencyGraphDomainFeature,
    JobsDomainFeature,
    LicensesDomainFeature,
    LogsDomainFeature,
    PackagesDomainFeature,
    ProjectsDomainFeature,
    SbomDomainFeature,
    ScanSchedulesDomainFeature,
    SettingsDomainFeature,
    TeamsDomainFeature,
    TrendsDomainFeature,
    UpgradesDomainFeature,
    UsersDomainFeature,
    VulnerabilitiesDomainFeature
  ],
  register() {}
});
```

18 entries instead of 38. Imports drop from 42 to 18.

## Files Changed

- **Create:** 18 new `feature.ts` files (one per domain folder)
- **Modify:** `src/ui/presentation/feature.ts` (replace 38 flat entries with 18 domain imports)

## Testing

No logic changes — pure structural refactor. `yarn full` must pass (all 1950 tests). Feature registration order doesn't matter since `registerFeatures` does topological sort.

## No Breaking Changes

All sub-features remain registered. No import paths change for consumers outside `src/ui/presentation/`. Only PresentationFeature's internal wiring changes.
