# Restructure Batch 10: JobExecution Domain

> **For agentic workers:** Largest domain. JobWorker moves from root, jobExecutors/ becomes subfolder.

**Goal:** Create JobExecution/ domain folder containing JobWorker, JobExecutorRegistry, and all 13 executors.

## Global Constraints

Same as prior batches.

---

### Task 1: JobExecution Domain

**Move:**
- `abstractions/JobWorker.ts` → `JobExecution/abstractions/JobWorker.ts`
- `abstractions/JobWorkerProvider.ts` → `JobExecution/abstractions/JobWorkerProvider.ts`
- `JobWorker.ts` → `JobExecution/JobWorker.ts`
- `__tests__/JobWorker.test.ts` → `JobExecution/__tests__/JobWorker.test.ts`
- `jobExecutors/` → `JobExecution/executors/` (entire directory: all 13 executors + registry + abstractions + tests)

**Rename executors directory:**
```bash
mv src/api/services/jobExecutors src/api/services/JobExecution_temp_executors
mkdir -p src/api/services/JobExecution/abstractions
mkdir -p src/api/services/JobExecution/__tests__
mv src/api/services/JobExecution_temp_executors src/api/services/JobExecution/executors
```

**Move root-level files:**
```bash
mv src/api/services/abstractions/JobWorker.ts src/api/services/JobExecution/abstractions/JobWorker.ts
mv src/api/services/abstractions/JobWorkerProvider.ts src/api/services/JobExecution/abstractions/JobWorkerProvider.ts
mv src/api/services/JobWorker.ts src/api/services/JobExecution/JobWorker.ts
mv src/api/services/__tests__/JobWorker.test.ts src/api/services/JobExecution/__tests__/JobWorker.test.ts
```

**Directory structure after:**
```
JobExecution/
  abstractions/
    JobWorker.ts
    JobWorkerProvider.ts
  executors/
    abstractions/
      JobExecutor.ts
      JobExecutorRegistry.ts
      AutoFixPrJobExecutor.ts
      ChangelogJobExecutor.ts
      CloneJobExecutor.ts
      DependencyJobExecutor.ts
      GraphRefreshJobExecutor.ts
      InstallJobExecutor.ts
      LicenseScanJobExecutor.ts
      PackageManagerJobExecutor.ts
      PackageScanJobExecutor.ts
      ScanJobExecutor.ts
      TransientJobExecutor.ts
      TransitiveResolveJobExecutor.ts
      VulnerabilityScanJobExecutor.ts
      index.ts
    AutoFixPrJobExecutor.ts
    ChangelogJobExecutor.ts
    CloneJobExecutor.ts
    DependencyJobExecutor.ts
    GraphRefreshJobExecutor.ts
    InstallJobExecutor.ts
    JobExecutorRegistry.ts
    LicenseScanJobExecutor.ts
    PackageManagerJobExecutor.ts
    PackageScanJobExecutor.ts
    ScanJobExecutor.ts
    TransientJobExecutor.ts
    TransitiveResolveJobExecutor.ts
    VulnerabilityScanJobExecutor.ts
    __tests__/
      (all executor test files)
  JobWorker.ts
  feature.ts
  index.ts
  __tests__/
    JobWorker.test.ts
```

**feature.ts:**
```typescript
import { createFeature } from "#shared/index.js";
import { JobWorker } from "./JobWorker.js";
import { JobWorker as JobWorkerAbstraction } from "./abstractions/JobWorker.js";
import { JobWorkerProvider } from "./abstractions/JobWorkerProvider.js";
import { JobExecutorRegistry } from "./executors/JobExecutorRegistry.js";
import { ChangelogJobExecutor } from "./executors/ChangelogJobExecutor.js";
import { DependencyJobExecutor } from "./executors/DependencyJobExecutor.js";
import { TransientJobExecutor } from "./executors/TransientJobExecutor.js";
import { PackageManagerJobExecutor } from "./executors/PackageManagerJobExecutor.js";
import { InstallJobExecutor } from "./executors/InstallJobExecutor.js";
import { CloneJobExecutor } from "./executors/CloneJobExecutor.js";
import { AutoFixPrJobExecutor } from "./executors/AutoFixPrJobExecutor.js";
import { ScanJobExecutor } from "./executors/ScanJobExecutor.js";
import { TransitiveResolveJobExecutor } from "./executors/TransitiveResolveJobExecutor.js";
import { PackageScanJobExecutor } from "./executors/PackageScanJobExecutor.js";
import { VulnerabilityScanJobExecutor } from "./executors/VulnerabilityScanJobExecutor.js";
import { LicenseScanJobExecutor } from "./executors/LicenseScanJobExecutor.js";
import { GraphRefreshJobExecutor } from "./executors/GraphRefreshJobExecutor.js";

export const JobExecutionFeature = createFeature({
    name: "Api/JobExecutionFeature",
    register(container) {
        container.register(ChangelogJobExecutor);
        container.register(DependencyJobExecutor);
        container.register(TransientJobExecutor);
        container.register(PackageManagerJobExecutor);
        container.register(InstallJobExecutor);
        container.register(CloneJobExecutor);
        container.register(AutoFixPrJobExecutor);
        container.register(ScanJobExecutor);
        container.register(TransitiveResolveJobExecutor);
        container.register(PackageScanJobExecutor);
        container.register(VulnerabilityScanJobExecutor);
        container.register(LicenseScanJobExecutor);
        container.register(GraphRefreshJobExecutor);
        container.register(JobExecutorRegistry).inSingletonScope();
        container.register(JobWorker).inSingletonScope();
        container.registerFactory(JobWorkerProvider, () => ({
            get: () => container.resolve(JobWorkerAbstraction)
        }));
    }
});
```

**index.ts:**
```typescript
export { JobWorker } from "./abstractions/JobWorker.js";
export { JobWorkerProvider } from "./abstractions/JobWorkerProvider.js";
export { JobExecutionFeature } from "./feature.js";
```

**Import updates for JobWorker abstraction:**
- `src/api/server.ts:14` — `./services/abstractions/JobWorker.js` → `./services/JobExecution/index.js`
- `src/api/routes/licenses.ts:16` — `#api/services/abstractions/JobWorker.js` → `#api/services/JobExecution/index.js`
- All route files and tests importing `JobWorker` from `abstractions/JobWorker.js`

**Import updates for executor abstractions:** Since executors moved from `jobExecutors/` to `JobExecution/executors/`, all internal imports within executors that reference `../abstractions/X.js` (other service abstractions) need path adjustment. Run:
```bash
grep -rn "from.*abstractions/" src/api/services/jobExecutors --include="*.ts" | grep -v "./abstractions/"
grep -rn "from.*abstractions/JobWorker" src/api --include="*.ts"
grep -rn 'from.*services/JobWorker"' src/api --include="*.ts"
grep -rn "from.*jobExecutors/" src/api --include="*.ts" | grep -v "src/api/services/jobExecutors/"
```
Cross-service imports like `../abstractions/ScanService.js` become `../../Scan/index.js` (if Scan already moved) — the executor files are one directory level deeper than before.

**Import updates for JobExecutorRegistry:** Files importing from `jobExecutors/JobExecutorRegistry.js` → `JobExecution/executors/JobExecutorRegistry.js`.

**Internal executor imports:** Each executor imports its own abstraction from `./abstractions/X.js`. Since the abstractions moved WITH the executors, these relative paths stay valid.

**JobWorkerProvider factory:** The `registerFactory` call moves from top-level `feature.ts` into `JobExecution/feature.ts`.

**Commit:** `refactor: restructure JobExecution domain folder`
