# API Services Restructure — Specification

## Goal

Reorganize `src/api/services/` from a flat file layout with a shared `abstractions/` directory into a consistent folder-per-service structure where each service (or domain) owns its abstraction, implementation, feature registration, tests, and barrel export.

**This is a pure file-move refactor. No code logic changes. No merging of services. No renaming of classes or interfaces.**

## Current State

`src/api/services/` contains:

- **33 service implementation files** in the root directory
- **1 shared `abstractions/` directory** (36 abstraction files + barrel `index.ts`)
- **1 shared `__tests__/` directory** (33 test files)
- **5 subdirectories** already partially organized: `changelogResolvers/`, `jobExecutors/`, `packageManagers/`, `sbomFormatters/`, `stepResolvers/`
- **1 `workers/` directory** with `scanWorker.js`
- **1 standalone helper** `registerProject.ts`
- **1 monolithic `ApiFeature`** in `src/api/feature.ts` importing every implementation directly

Only `packageManagers/` has its own `feature.ts` and `index.ts`.

## Target State

Every service lives in a PascalCase, singular-named folder under `src/api/services/`. Each folder contains:

```
ServiceName/
  abstractions/
    ServiceName.ts           # createAbstraction + interface
  ServiceName.ts             # createImplementation (impl file)
  feature.ts                 # createFeature — registers implementation(s)
  index.ts                   # re-exports abstractions + feature ONLY (never implementations)
  __tests__/
    ServiceName.test.ts      # tests
```

Domain folders (multiple related services) follow the same pattern but contain multiple implementation files and multiple abstraction files. They may also contain subfolders for strategies/drivers.

The top-level `src/api/feature.ts` becomes a compositor that imports and calls each sub-feature's `register()`. It never imports implementations directly.

## Folder Classification

### Domain Folders

These folders contain multiple related services/classes:

| Folder             | Services Moved In                                         | Notes                                                                                               |
| ------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `AutoFix/`         | AutoFixSettingsService, AutoFixPrService                  |                                                                                                     |
| `License/`         | LicenseCheckerService, LicensePolicyService               |                                                                                                     |
| `Vulnerability/`   | VulnerabilityService, OsvCacheService, AuditParserService |                                                                                                     |
| `Git/`             | GitService, ForgeService                                  |                                                                                                     |
| `PackageManager/`  | PackageManagerService (from root), drivers, registry      | PackageManagerService moves in from services root. Drivers stay in `drivers/` subfolder             |
| `Sbom/`            | SbomService, formatters (CycloneDx, Spdx, registry)       | Formatters stay in `formatters/` subfolder                                                          |
| `Changelog/`       | ChangelogService, resolvers (GitHub, File, Npm)           | Resolvers stay in `resolvers/` subfolder. Includes helpers (extractOwnerRepo, parseVersionSections) |
| `JobExecution/`    | JobWorker, JobExecutorRegistry, all 13 executors          | JobWorker moves in from root. Executors organized in subfolders                                     |
| `Auth/`            | AuthService, UserService                                  |                                                                                                     |
| `DependencyGraph/` | DependencyGraphService, LockfileParserService             | LockfileParserService moves in from root                                                            |
| `UpgradeSession/`  | UpgradeSessionService, stepResolvers/                     | stepResolvers/ becomes a subfolder inside                                                           |

### Service Folders (standalone)

Each contains a single service:

| Folder              | Service                 |
| ------------------- | ----------------------- |
| `AppLog/`           | AppLogService           |
| `CommandRunner/`    | CommandRunner           |
| `DependencyChange/` | DependencyChangeService |
| `Encryption/`       | EncryptionService       |
| `ErrorReporter/`    | ErrorReporter           |
| `EventBus/`         | EventBus                |
| `FileConfig/`       | FileConfigService       |
| `PackageJson/`      | PackageJsonService      |
| `RegistryCache/`    | RegistryCacheService    |
| `Scan/`             | ScanService             |
| `ScanScheduler/`    | ScanSchedulerService    |
| `Security/`         | SecurityService         |
| `StepHook/`         | StepHookService         |
| `Upgrade/`          | UpgradeService          |
| `Email/`            | ConsoleEmailService     |

### Shared Infrastructure (outside services/)

| Location           | Contents             |
| ------------------ | -------------------- |
| `src/api/utils/`   | `registerProject.ts` |
| `src/api/workers/` | `scanWorker.js`      |

## Import Path Changes

### Before

Routes, server.ts, and other consumers import abstractions from the shared directory:

```typescript
import { ScanService } from "#api/services/abstractions/ScanService.js";
import { ScanService } from "./services/abstractions/ScanService.js";
```

The monolithic `feature.ts` imports implementations directly:

```typescript
import { ScanService } from "./services/ScanService.js";
```

### After

All external consumers import from the folder's barrel `index.ts`:

```typescript
import { ScanService } from "#api/services/Scan/index.js";
import { ScanService } from "./services/Scan/index.js";
```

The top-level `feature.ts` imports only features:

```typescript
import { ScanFeature } from "./services/Scan/index.js";
```

Cross-service imports (service A depending on service B's abstraction) also go through barrel exports:

```typescript
import { RegistryCacheService } from "#api/services/RegistryCache/index.js";
```

## Rules

1. **Implementation files never leave their folder.** No external file may import an implementation directly.
2. **`index.ts` exports abstractions + feature only.** Never implementations.
3. **Abstractions live inside each service folder** in an `abstractions/` subfolder.
4. **The shared `src/api/services/abstractions/` directory is deleted** once all abstractions are moved.
5. **The shared `src/api/services/__tests__/` directory is deleted** once all tests are moved.
6. **Each folder has a `feature.ts`** using `createFeature()` for DI registration.
7. **Top-level `src/api/feature.ts`** composes all sub-features. No implementation imports.
8. **PascalCase, singular naming** for all folders.
9. **No code logic changes.** Only file moves, import path updates, and feature.ts creation.
10. **`compareVersions.test.ts`** — standalone test in shared `__tests__/`. Tests `compareVersions()` exported by ChangelogService. Move to `Changelog/__tests__/compareVersions.test.ts`.

## Detailed Folder Structures

### Domain: AutoFix/

```
AutoFix/
  abstractions/
    AutoFixSettingsService.ts    ← from services/abstractions/
    AutoFixPrService.ts          ← from services/abstractions/
  AutoFixSettingsService.ts      ← from services/ root
  AutoFixPrService.ts            ← from services/ root
  feature.ts                     ← NEW
  index.ts                       ← NEW
  __tests__/
    AutoFixSettingsService.test.ts  ← from services/__tests__/
    AutoFixPrService.test.ts        ← from services/__tests__/
```

### Domain: License/

```
License/
  abstractions/
    LicenseCheckerService.ts     ← from services/abstractions/
    LicensePolicyService.ts      ← from services/abstractions/
  LicenseCheckerService.ts       ← from services/ root
  LicensePolicyService.ts        ← from services/ root
  feature.ts                     ← NEW
  index.ts                       ← NEW
  __tests__/
    LicenseCheckerService.test.ts   ← from services/__tests__/
    LicensePolicyService.test.ts    ← from services/__tests__/
```

### Domain: Vulnerability/

```
Vulnerability/
  abstractions/
    VulnerabilityService.ts      ← from services/abstractions/
    OsvCacheService.ts           ← from services/abstractions/
    AuditParserService.ts        ← from services/abstractions/
  VulnerabilityService.ts        ← from services/ root
  OsvCacheService.ts             ← from services/ root
  AuditParserService.ts          ← from services/ root
  feature.ts                     ← NEW
  index.ts                       ← NEW
  __tests__/
    VulnerabilityService.test.ts    ← from services/__tests__/
    OsvCacheService.test.ts         ← from services/__tests__/
    AuditParserService.test.ts      ← from services/__tests__/
```

### Domain: Git/

```
Git/
  abstractions/
    GitService.ts                ← from services/abstractions/
    ForgeService.ts              ← from services/abstractions/
  GitService.ts                  ← from services/ root
  ForgeService.ts                ← from services/ root
  feature.ts                     ← NEW
  index.ts                       ← NEW
  __tests__/
    GitService.test.ts              ← from services/__tests__/
    ForgeService.test.ts            ← from services/__tests__/
```

### Domain: PackageManager/

```
PackageManager/
  abstractions/
    PackageManagerDriver.ts         ← from packageManagers/abstractions/
    PackageManagerDriverRegistry.ts ← from packageManagers/abstractions/
    PackageManagerService.ts        ← from services/abstractions/
  drivers/
    YarnDriver.ts                   ← from packageManagers/
    NpmDriver.ts                    ← from packageManagers/
    PnpmDriver.ts                   ← from packageManagers/
    BunDriver.ts                    ← from packageManagers/
  PackageManagerDriverRegistry.ts   ← from packageManagers/
  PackageManagerService.ts          ← from services/ root
  normalizeRepoUrl.ts               ← from packageManagers/
  parseLicense.ts                   ← from packageManagers/
  registrySchema.ts                 ← from packageManagers/
  feature.ts                        ← UPDATE existing packageManagers/feature.ts (add PackageManagerService registration)
  index.ts                          ← UPDATE existing packageManagers/index.ts (add PackageManagerService export)
  __tests__/
    PackageManagerService.test.ts   ← from services/__tests__/
    YarnDriver.test.ts              ← from packageManagers/__tests__/
    NpmDriver.test.ts               ← from packageManagers/__tests__/
    PnpmDriver.test.ts              ← from packageManagers/__tests__/
    BunDriver.test.ts               ← from packageManagers/__tests__/
    PackageManagerDriverRegistry.test.ts ← from packageManagers/__tests__/
    normalizeRepoUrl.test.ts        ← from packageManagers/__tests__/
```

### Domain: Sbom/

```
Sbom/
  abstractions/
    SbomService.ts                  ← from services/abstractions/
    SbomFormatter.ts                ← from services/abstractions/
    SbomFormatterRegistry.ts        ← from services/abstractions/
  formatters/
    CycloneDxFormatter.ts           ← from sbomFormatters/
    SpdxFormatter.ts                ← from sbomFormatters/
  SbomService.ts                    ← from services/ root
  SbomFormatterRegistry.ts          ← from sbomFormatters/
  feature.ts                        ← NEW
  index.ts                          ← NEW
  __tests__/
    SbomService.test.ts             ← from services/__tests__/
    CycloneDxFormatter.test.ts      ← from sbomFormatters/__tests__/
    SpdxFormatter.test.ts           ← from sbomFormatters/__tests__/
    SbomFormatterRegistry.test.ts   ← from sbomFormatters/__tests__/
```

### Domain: Changelog/

```
Changelog/
  abstractions/
    ChangelogService.ts             ← from services/abstractions/
    ChangelogResolver.ts            ← from changelogResolvers/abstractions/
  resolvers/
    GitHubReleasesResolver.ts       ← from changelogResolvers/
    ChangelogFileResolver.ts        ← from changelogResolvers/
    NpmReadmeResolver.ts            ← from changelogResolvers/
  ChangelogService.ts               ← from services/ root
  extractOwnerRepo.ts               ← from changelogResolvers/
  parseVersionSections.ts           ← from changelogResolvers/
  feature.ts                        ← NEW
  index.ts                          ← NEW
  __tests__/
    ChangelogService.test.ts        ← from services/__tests__/
    GitHubReleasesResolver.test.ts  ← from changelogResolvers/__tests__/
    ChangelogFileResolver.test.ts   ← from changelogResolvers/__tests__/
    NpmReadmeResolver.test.ts       ← from changelogResolvers/__tests__/
    compareVersions.test.ts         ← from services/__tests__/
```

### Domain: JobExecution/

```
JobExecution/
  abstractions/
    JobWorker.ts                    ← from services/abstractions/
    JobWorkerProvider.ts            ← from services/abstractions/
    JobExecutor.ts                  ← from jobExecutors/abstractions/
    JobExecutorRegistry.ts          ← from jobExecutors/abstractions/
    AutoFixPrJobExecutor.ts         ← from jobExecutors/abstractions/
    ChangelogJobExecutor.ts         ← from jobExecutors/abstractions/
    CloneJobExecutor.ts             ← from jobExecutors/abstractions/
    DependencyJobExecutor.ts        ← from jobExecutors/abstractions/
    GraphRefreshJobExecutor.ts      ← from jobExecutors/abstractions/
    InstallJobExecutor.ts           ← from jobExecutors/abstractions/
    LicenseScanJobExecutor.ts       ← from jobExecutors/abstractions/
    PackageManagerJobExecutor.ts    ← from jobExecutors/abstractions/
    PackageScanJobExecutor.ts       ← from jobExecutors/abstractions/
    ScanJobExecutor.ts              ← from jobExecutors/abstractions/
    TransientJobExecutor.ts         ← from jobExecutors/abstractions/
    TransitiveResolveJobExecutor.ts ← from jobExecutors/abstractions/
    VulnerabilityScanJobExecutor.ts ← from jobExecutors/abstractions/
  executors/
    AutoFixPrJobExecutor.ts         ← from jobExecutors/
    ChangelogJobExecutor.ts         ← from jobExecutors/
    CloneJobExecutor.ts             ← from jobExecutors/
    DependencyJobExecutor.ts        ← from jobExecutors/
    GraphRefreshJobExecutor.ts      ← from jobExecutors/
    InstallJobExecutor.ts           ← from jobExecutors/
    LicenseScanJobExecutor.ts       ← from jobExecutors/
    PackageManagerJobExecutor.ts    ← from jobExecutors/
    PackageScanJobExecutor.ts       ← from jobExecutors/
    ScanJobExecutor.ts              ← from jobExecutors/
    TransientJobExecutor.ts         ← from jobExecutors/
    TransitiveResolveJobExecutor.ts ← from jobExecutors/
    VulnerabilityScanJobExecutor.ts ← from jobExecutors/
  JobWorker.ts                      ← from services/ root
  JobExecutorRegistry.ts            ← from jobExecutors/
  feature.ts                        ← NEW
  index.ts                          ← NEW
  __tests__/
    JobWorker.test.ts               ← from services/__tests__/
    AutoFixPrJobExecutor.test.ts    ← from jobExecutors/__tests__/
    ChangelogJobExecutor.test.ts    ← from jobExecutors/__tests__/
    CloneJobExecutor.test.ts        ← from jobExecutors/__tests__/
    GraphRefreshJobExecutor.test.ts ← from jobExecutors/__tests__/
    InstallJobExecutor.test.ts      ← from jobExecutors/__tests__/
    LicenseScanJobExecutor.test.ts  ← from jobExecutors/__tests__/
    PackageScanJobExecutor.test.ts  ← from jobExecutors/__tests__/
    ScanJobExecutor.test.ts         ← from jobExecutors/__tests__/
    TransitiveResolveJobExecutor.test.ts ← from jobExecutors/__tests__/
    VulnerabilityScanJobExecutor.test.ts ← from jobExecutors/__tests__/
    # NOTE: DependencyJobExecutor, PackageManagerJobExecutor, TransientJobExecutor have no test files (none exist in codebase)
```

### Domain: Auth/

```
Auth/
  abstractions/
    AuthService.ts               ← from services/abstractions/
    UserService.ts               ← from services/abstractions/
  AuthService.ts                 ← from services/ root
  UserService.ts                 ← from services/ root
  feature.ts                     ← NEW
  index.ts                       ← NEW
  __tests__/
    AuthService.test.ts          ← from services/__tests__/
    UserService.test.ts          ← from services/__tests__/
```

### Domain: DependencyGraph/

```
DependencyGraph/
  abstractions/
    DependencyGraphService.ts    ← from services/abstractions/
    LockfileParserService.ts     ← from services/abstractions/
  DependencyGraphService.ts      ← from services/ root
  LockfileParserService.ts       ← from services/ root
  feature.ts                     ← NEW
  index.ts                       ← NEW
  __tests__/
    DependencyGraphService.test.ts  ← from services/__tests__/
    LockfileParserService.test.ts   ← from services/__tests__/
```

### Domain: UpgradeSession/

```
UpgradeSession/
  abstractions/
    UpgradeSessionService.ts        ← from services/abstractions/
  stepResolvers/
    abstractions/
      StepResolver.ts               ← from stepResolvers/abstractions/
      CustomStepConfig.ts           ← from stepResolvers/abstractions/
      UpgradeSessionStepResolverRegistry.ts ← from stepResolvers/abstractions/
    BranchResolver.ts               ← from stepResolvers/
    CommitResolver.ts               ← from stepResolvers/
    CustomStepResolver.ts           ← from stepResolvers/
    PrResolver.ts                   ← from stepResolvers/
    PushResolver.ts                 ← from stepResolvers/
    RefreshTransientResolver.ts     ← from stepResolvers/
    SelectPackagesResolver.ts       ← from stepResolvers/
    UpgradeResolver.ts              ← from stepResolvers/
    StepResolverRegistry.ts         ← from stepResolvers/ (impl of UpgradeSessionStepResolverRegistry)
    stepPipeline.ts                 ← from stepResolvers/
    __tests__/
      BranchResolver.test.ts        ← from stepResolvers/__tests__/
      CommitResolver.test.ts        ← from stepResolvers/__tests__/
      CustomStepResolver.test.ts    ← from stepResolvers/__tests__/
      PrResolver.test.ts            ← from stepResolvers/__tests__/
      PushResolver.test.ts          ← from stepResolvers/__tests__/
      RefreshTransientResolver.test.ts ← from stepResolvers/__tests__/
      SelectPackagesResolver.test.ts   ← from stepResolvers/__tests__/
      UpgradeResolver.test.ts       ← from stepResolvers/__tests__/
      getNextStep.test.ts           ← from stepResolvers/__tests__/
      stepPipeline.test.ts          ← from stepResolvers/__tests__/
  UpgradeSessionService.ts          ← from services/ root
  feature.ts                        ← NEW
  index.ts                          ← NEW
  __tests__/
    UpgradeSessionService.test.ts   ← from services/__tests__/
```

### Standalone Services (same pattern for each)

Example — `AppLog/`:

```
AppLog/
  abstractions/
    AppLogService.ts             ← from services/abstractions/
  AppLogService.ts               ← from services/ root
  feature.ts                     ← NEW
  index.ts                       ← NEW
  __tests__/
    AppLogService.test.ts        ← from services/__tests__/
```

Repeat for: `CommandRunner/`, `DependencyChange/`, `Encryption/`, `ErrorReporter/`, `EventBus/`, `FileConfig/`, `PackageJson/`, `RegistryCache/`, `Scan/`, `ScanScheduler/`, `Security/`, `StepHook/`, `Upgrade/`, `Email/`.

**Note on `Email/`:** The abstraction is `EmailService.ts` (interface), implementation is `ConsoleEmailService.ts`. Email is its own service — `EmailService` abstraction lives in `Email/abstractions/EmailService.ts`, Auth imports it via `Email/index.js` barrel.

```
Email/
  abstractions/
    EmailService.ts              ← from services/abstractions/
  ConsoleEmailService.ts         ← from services/ root
  feature.ts                     ← NEW
  index.ts                       ← NEW
  __tests__/
    ConsoleEmailService.test.ts  ← from services/__tests__/
```

### Shared Infrastructure

```
src/api/utils/
  registerProject.ts             ← from services/ root

src/api/workers/
  scanWorker.js                  ← from services/workers/
```

## Deletion Targets

After all moves complete:

- `src/api/services/abstractions/` — entire directory (all files moved to per-service folders)
- `src/api/services/__tests__/` — entire directory (all tests moved to per-service folders)
- `src/api/services/changelogResolvers/` — absorbed into `Changelog/`
- `src/api/services/jobExecutors/` — absorbed into `JobExecution/`
- `src/api/services/packageManagers/` — renamed to `PackageManager/`
- `src/api/services/sbomFormatters/` — absorbed into `Sbom/`
- `src/api/services/stepResolvers/` — absorbed into `UpgradeSession/`
- `src/api/services/workers/` — moved to `src/api/workers/`

## Top-Level feature.ts Transformation

The monolithic `src/api/feature.ts` changes from importing ~70 implementation files to importing ~26 sub-features:

```typescript
import { AppLogFeature } from "./services/AppLog/index.js";
import { AutoFixFeature } from "./services/AutoFix/index.js";
import { AuthFeature } from "./services/Auth/index.js";
import { ChangelogFeature } from "./services/Changelog/index.js";
// ... etc

export const ApiFeature = createFeature<IApiFeatureContext>({
  name: "Api",
  register(container, context) {
    ProcessEnvFeature.register(container);
    container.registerInstance(DatabaseClient, context.databaseClient);

    // Compose all service features
    AppLogFeature.register(container);
    AutoFixFeature.register(container);
    AuthFeature.register(container);
    ChangelogFeature.register(container);
    CommandRunnerFeature.register(container);
    DependencyChangeFeature.register(container);
    DependencyGraphFeature.register(container);
    EmailFeature.register(container);
    EncryptionFeature.register(container);
    ErrorReporterFeature.register(container);
    EventBusFeature.register(container);
    FileConfigFeature.register(container);
    GitFeature.register(container);
    JobExecutionFeature.register(container);
    LicenseFeature.register(container);
    PackageJsonFeature.register(container);
    PackageManagerFeature.register(container);
    RegistryCacheFeature.register(container);
    SbomFeature.register(container);
    ScanFeature.register(container);
    ScanSchedulerFeature.register(container);
    SecurityFeature.register(container);
    StepHookFeature.register(container);
    UpgradeFeature.register(container);
    UpgradeSessionFeature.register(container);
    VulnerabilityFeature.register(container);

    // Infrastructure that doesn't belong to a service
    container.registerInstance(ConsoleLoggerConfig, {
      getConfig: () => ({ logLevel: "error" })
    });
    ConsoleLoggerFeature.register(container);
    DirectoryToolFeature.register(container);
    FileToolFeature.register(container);
    JsonFileToolFeature.register(container);

    // WebSocket broadcaster stays at top level (not a service)
    container.register(WebSocketBroadcaster).inSingletonScope();
  }
});
```

**Special case — JobWorkerProvider factory:** The `registerFactory` call for `JobWorkerProvider` moves into `JobExecution/feature.ts` since it's a DI wiring concern for the JobWorker circular dependency.

## Import Update Scope

Files that need import path updates (by category):

1. **Routes** (~25 files in `src/api/routes/`) — import abstractions for DI resolution
2. **Route tests** (~20 files in `src/api/routes/__tests__/`) — import abstractions for test setup
3. **Server** (`src/api/server.ts`) — imports abstractions for startup wiring
4. **Middleware** (`src/api/middleware/authHook.ts`) — imports AuthService abstraction
5. **WebSocket** (`src/api/websocket/WebSocketPlugin.ts`) — imports AuthService abstraction
6. **Cross-service imports** — service implementations importing other services' abstractions
7. **Top-level feature.ts** — complete rewrite of imports
8. **Testing helpers** (`src/testing/helpers/`) — if any reference service abstractions

## Critical: Internal Import Depth Adjustment

When a file moves from `services/X.ts` to `services/X/X.ts`, it is now one directory level deeper. ALL relative imports WITHIN that file change:

- `./abstractions/Y.js` → `../abstractions/Y.js` (if Y is still in shared abstractions/)
- `./abstractions/Y.js` → `../Y/index.js` (if Y has already been moved to its own folder)
- `./Y.ts` → `../Y.ts` (any sibling import)

**After every file move, run grep within the moved file(s) to fix all relative imports:**

```bash
grep -n "from \"\." <moved-file>
```

Adjust every relative path for the new directory depth.

This is bidirectional — imports TO the moved service AND imports WITHIN the moved service both need updating.

## Execution Strategy

Work in small chunks by service folder. Each chunk:

1. Create the folder structure
2. Move files (abstraction, implementation, tests)
3. Create `feature.ts` and `index.ts`
4. Update all import paths referencing moved files
5. Commit

Order matters due to cross-service dependencies. Start with services that have zero or few dependents (leaf services), work toward core services (JobExecution, Scan) last.

Suggested order (least dependents first):

1. Infrastructure standalone: `EventBus/`, `CommandRunner/`, `Encryption/`, `Email/`
2. Utility standalone: `AppLog/`, `ErrorReporter/`, `PackageJson/`, `FileConfig/`
3. Domain: `Git/`, `AutoFix/`, `DependencyChange/`
4. Domain: `License/`, `Vulnerability/`
5. Core standalone: `RegistryCache/`, `Security/`, `Upgrade/`, `StepHook/`
6. Domain: `PackageManager/`, `Changelog/`, `Sbom/`
7. Domain: `DependencyGraph/`, `UpgradeSession/`, `Auth/`
8. Core standalone: `Scan/`, `ScanScheduler/`
9. Domain: `JobExecution/` (largest, most dependents)
10. Cleanup: delete shared `abstractions/`, shared `__tests__/`, old subdirectories
11. Rewrite top-level `feature.ts`
12. Move `registerProject.ts` to `src/api/utils/`
13. Move `workers/` to `src/api/workers/`
