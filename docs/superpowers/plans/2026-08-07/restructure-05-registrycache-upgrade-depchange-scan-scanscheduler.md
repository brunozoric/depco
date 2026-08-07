# Restructure Batch 5: RegistryCache + Upgrade + DependencyChange + Scan + ScanScheduler

> **For agentic workers:** Use same pattern as batches 1-4. Each service: create folder, move abstraction+impl+test, create feature.ts+index.ts, update imports, commit.

**Goal:** Move remaining standalone services into PascalCase folders.

## Global Constraints

Same as batches 1-4. PascalCase singular folders. index.ts exports abstractions+feature only.

---

### Task 1: RegistryCache

**Move:**
- `abstractions/RegistryCacheService.ts` → `RegistryCache/abstractions/RegistryCacheService.ts`
- `RegistryCacheService.ts` → `RegistryCache/RegistryCacheService.ts`
- `__tests__/RegistryCacheService.test.ts` → `RegistryCache/__tests__/RegistryCacheService.test.ts`

**feature.ts:** Register `RegistryCacheService` in singleton scope.

**index.ts:** Export `RegistryCacheService` abstraction + `RegistryCacheFeature`.

**Import updates (abstraction — old → new):**
- `src/api/routes/packages.ts:9` — `../services/abstractions/RegistryCacheService.js` → `../services/RegistryCache/index.js`
- `src/api/routes/cache.ts:6` — `../services/abstractions/RegistryCacheService.js` → `../services/RegistryCache/index.js`
- `src/api/routes/__tests__/packages.test.ts:23` — `../../services/abstractions/RegistryCacheService.js` → `../../services/RegistryCache/index.js`
- `src/api/services/LicenseCheckerService.ts:3` — `./abstractions/RegistryCacheService.js` → `./RegistryCache/index.js`
- `src/api/services/ScanService.ts:6` — `./abstractions/RegistryCacheService.js` → `./RegistryCache/index.js`
- `src/api/services/jobExecutors/TransitiveResolveJobExecutor.ts:4` — `../abstractions/RegistryCacheService.js` → `../RegistryCache/index.js`
- `src/api/services/jobExecutors/__tests__/TransitiveResolveJobExecutor.test.ts:8` — `../../abstractions/RegistryCacheService.js` → `../../RegistryCache/index.js`
- `src/api/services/__tests__/ScanService.test.ts:7` — `../abstractions/RegistryCacheService.js` → `../RegistryCache/index.js`
- `src/api/services/__tests__/LicenseCheckerService.test.ts:2` — `#api/services/abstractions/RegistryCacheService.js` → `#api/services/RegistryCache/index.js`
- `src/api/services/changelogResolvers/NpmReadmeResolver.ts:2` — `../abstractions/RegistryCacheService.js` → `../RegistryCache/index.js`
- `src/api/services/changelogResolvers/__tests__/NpmReadmeResolver.test.ts:3` — `../../abstractions/RegistryCacheService.js` → `../../RegistryCache/index.js`

**Import updates (implementation — for DI in tests):**
- `src/api/routes/__tests__/cache.test.ts:12` — `../../services/RegistryCacheService.js` → `../../services/RegistryCache/RegistryCacheService.js`
- `src/api/routes/__tests__/jobs.test.ts:33` — `../../services/RegistryCacheService.js` → `../../services/RegistryCache/RegistryCacheService.js`
- `src/api/routes/__tests__/changelogs.test.ts:14` — `../../services/RegistryCacheService.js` → `../../services/RegistryCache/RegistryCacheService.js`
- `src/api/routes/__tests__/projects.test.ts:30` — `../../services/RegistryCacheService.js` → `../../services/RegistryCache/RegistryCacheService.js`
- `src/api/routes/__tests__/packageManager.test.ts:33` — `../../services/RegistryCacheService.js` → `../../services/RegistryCache/RegistryCacheService.js`

**feature.ts update:** Replace import + registration with `RegistryCacheFeature`.

**Commit:** `refactor: move RegistryCacheService into own service folder`

---

### Task 2: Upgrade

**Move:**
- `abstractions/UpgradeService.ts` → `Upgrade/abstractions/UpgradeService.ts`
- `UpgradeService.ts` → `Upgrade/UpgradeService.ts`
- `__tests__/UpgradeService.test.ts` → `Upgrade/__tests__/UpgradeService.test.ts`

**feature.ts:** Register `UpgradeService` in singleton scope.

**Import updates (abstraction):**
- `src/api/routes/__tests__/upgradeSessions.test.ts:23` — `#api/services/abstractions/UpgradeService.js` → `#api/services/Upgrade/index.js`
- `src/api/services/jobExecutors/DependencyJobExecutor.ts:4` — `../abstractions/UpgradeService.js` → `../Upgrade/index.js`
- `src/api/services/jobExecutors/AutoFixPrJobExecutor.ts:7` — `../abstractions/UpgradeService.js` → `../Upgrade/index.js`
- `src/api/services/jobExecutors/TransientJobExecutor.ts:3` — `../abstractions/UpgradeService.js` → `../Upgrade/index.js`
- `src/api/services/jobExecutors/__tests__/AutoFixPrJobExecutor.test.ts:10` — `../../abstractions/UpgradeService.js` → `../../Upgrade/index.js`
- `src/api/services/__tests__/UpgradeSessionService.test.ts:19` — `../abstractions/UpgradeService.js` → `../Upgrade/index.js`
- `src/api/services/stepResolvers/UpgradeResolver.ts:4` — `../abstractions/UpgradeService.js` → `../Upgrade/index.js`
- `src/api/services/stepResolvers/RefreshTransientResolver.ts:4` — `../abstractions/UpgradeService.js` → `../Upgrade/index.js`
- `src/api/services/stepResolvers/__tests__/UpgradeResolver.test.ts:5` — `../../abstractions/UpgradeService.js` → `../../Upgrade/index.js`
- `src/api/services/stepResolvers/__tests__/RefreshTransientResolver.test.ts:5` — `../../abstractions/UpgradeService.js` → `../../Upgrade/index.js`

**Import updates (implementation):**
- `src/api/routes/__tests__/jobs.test.ts:24` — `../../services/UpgradeService.js` → `../../services/Upgrade/UpgradeService.js`
- `src/api/routes/__tests__/projects.test.ts:31` — `../../services/UpgradeService.js` → `../../services/Upgrade/UpgradeService.js`
- `src/api/routes/__tests__/packageManager.test.ts:24` — `../../services/UpgradeService.js` → `../../services/Upgrade/UpgradeService.js`

**Commit:** `refactor: move UpgradeService into own service folder`

---

### Task 3: DependencyChange

**Move:**
- `abstractions/DependencyChangeService.ts` → `DependencyChange/abstractions/DependencyChangeService.ts`
- `DependencyChangeService.ts` → `DependencyChange/DependencyChangeService.ts`
- `__tests__/DependencyChangeService.test.ts` → `DependencyChange/__tests__/DependencyChangeService.test.ts`

**Import updates (abstraction):**
- `src/api/services/jobExecutors/PackageScanJobExecutor.ts:14` — `../abstractions/DependencyChangeService.js` → `../DependencyChange/index.js`

**Import updates (implementation):**
- `src/api/routes/__tests__/projects.test.ts:38` — `../../services/DependencyChangeService.js` → `../../services/DependencyChange/DependencyChangeService.js`
- `src/api/routes/__tests__/jobs.test.ts:41` — `../../services/DependencyChangeService.js` → `../../services/DependencyChange/DependencyChangeService.js`
- `src/api/routes/__tests__/packageManager.test.ts:41` — `../../services/DependencyChangeService.js` → `../../services/DependencyChange/DependencyChangeService.js`

**Commit:** `refactor: move DependencyChangeService into own service folder`

---

### Task 4: Scan

**Move:**
- `abstractions/ScanService.ts` → `Scan/abstractions/ScanService.ts`
- `ScanService.ts` → `Scan/ScanService.ts`
- `__tests__/ScanService.test.ts` → `Scan/__tests__/ScanService.test.ts`

**Import updates (abstraction):**
- `src/api/services/SbomService.ts:3` — `./abstractions/ScanService.js` → `./Scan/index.js` (imports `DependencyKind` type)
- `src/api/services/jobExecutors/PackageScanJobExecutor.ts:8` — `../abstractions/ScanService.js` → `../Scan/index.js`

Note: index.ts must also export the `DependencyKind` type and `IScanServiceDependency` and any other types consumers import from the abstraction.

**Import updates (implementation):**
- `src/api/routes/__tests__/jobs.test.ts:32` — `../../services/ScanService.js` → `../../services/Scan/ScanService.js`
- `src/api/routes/__tests__/projects.test.ts:22` — `../../services/ScanService.js` → `../../services/Scan/ScanService.js`
- `src/api/routes/__tests__/packageManager.test.ts:32` — `../../services/ScanService.js` → `../../services/Scan/ScanService.js`

**Commit:** `refactor: move ScanService into own service folder`

---

### Task 5: ScanScheduler

**Move:**
- `abstractions/ScanSchedulerService.ts` → `ScanScheduler/abstractions/ScanSchedulerService.ts`
- `ScanSchedulerService.ts` → `ScanScheduler/ScanSchedulerService.ts`
- `__tests__/ScanSchedulerService.test.ts` → `ScanScheduler/__tests__/ScanSchedulerService.test.ts`

**Import updates (abstraction):**
- `src/api/server.ts:15` — `./services/abstractions/ScanSchedulerService.js` → `./services/ScanScheduler/index.js`
- `src/api/routes/projects.ts:29` — `../services/abstractions/ScanSchedulerService.js` → `../services/ScanScheduler/index.js`
- `src/api/routes/scanSchedules.ts:15` — `#api/services/abstractions/ScanSchedulerService.js` → `#api/services/ScanScheduler/index.js`
- `src/api/routes/__tests__/scanSchedules.test.ts:9` — `#api/services/abstractions/ScanSchedulerService.js` → `#api/services/ScanScheduler/index.js`
- `src/api/routes/__tests__/jobs.test.ts:44` — `../../services/abstractions/ScanSchedulerService.js` → `../../services/ScanScheduler/index.js`
- `src/api/routes/__tests__/projects.test.ts:63` — `../../services/abstractions/ScanSchedulerService.js` → `../../services/ScanScheduler/index.js`
- `src/api/routes/__tests__/packageManager.test.ts:65` — `../../services/abstractions/ScanSchedulerService.js` → `../../services/ScanScheduler/index.js`
- `src/api/services/__tests__/JobWorker.test.ts:39` — `../abstractions/ScanSchedulerService.js` → `../ScanScheduler/index.js`

**Commit:** `refactor: move ScanSchedulerService into own service folder`
