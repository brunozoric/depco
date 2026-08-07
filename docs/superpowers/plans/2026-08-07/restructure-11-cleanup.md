# Restructure Batch 11: Cleanup

> **For agentic workers:** Final batch. Run AFTER all other batches complete.

**Goal:** Delete old directories, move utilities/workers, rewrite top-level feature.ts, verify build.

## Global Constraints

This batch depends on ALL prior batches being complete.

---

### Task 1: Move registerProject.ts to utils/

```bash
mkdir -p src/api/utils
mv src/api/services/registerProject.ts src/api/utils/registerProject.ts
```

Update all imports:
- `src/api/routes/projects.ts` — update registerProject import path
- `src/api/services/jobExecutors/CloneJobExecutor.ts` — update path (now at `../../utils/registerProject.js` from `JobExecution/executors/`)

**Commit:** `refactor: move registerProject to api/utils`

---

### Task 2: Move workers/ to api/workers/

```bash
mv src/api/services/workers src/api/workers
```

Update the import path in ScanSchedulerService (now at `ScanScheduler/ScanSchedulerService.ts`) — the worker path is passed as a string to bree, so find the string reference and update it.

**Commit:** `refactor: move workers to api/workers`

---

### Task 3: Delete old directories

Verify all files moved:
```bash
ls src/api/services/abstractions/  # should only have index.ts left (or be empty)
ls src/api/services/__tests__/     # should be empty
ls src/api/services/changelogResolvers/  # should be empty
ls src/api/services/sbomFormatters/      # should be empty
ls src/api/services/stepResolvers/       # should be empty
ls src/api/services/jobExecutors/        # should be empty
ls src/api/services/packageManagers/     # should be empty (renamed to PackageManager)
```

Delete them:
```bash
rm -rf src/api/services/abstractions
rm -rf src/api/services/__tests__
rm -rf src/api/services/changelogResolvers
rm -rf src/api/services/sbomFormatters
rm -rf src/api/services/stepResolvers
rm -rf src/api/services/jobExecutors
rm -rf src/api/services/packageManagers
rm -rf src/api/services/workers
```

**Commit:** `refactor: delete old services directories`

---

### Task 4: Rewrite top-level feature.ts

Replace the monolithic `src/api/feature.ts` with the compositor pattern. Import only sub-features:

```typescript
import { ConsoleLoggerConfig, ConsoleLoggerFeature } from "@webiny/stdlib";
import {
    DirectoryToolFeature,
    FileToolFeature,
    JsonFileToolFeature,
    ProcessEnvFeature
} from "@webiny/stdlib/node";
import { createFeature } from "#shared/index.js";
import { DatabaseClient } from "./db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "./websocket/WebSocketBroadcaster.js";

import { AppLogFeature } from "./services/AppLog/index.js";
import { AuthFeature } from "./services/Auth/index.js";
import { AutoFixFeature } from "./services/AutoFix/index.js";
import { ChangelogFeature } from "./services/Changelog/index.js";
import { CommandRunnerFeature } from "./services/CommandRunner/index.js";
import { DependencyChangeFeature } from "./services/DependencyChange/index.js";
import { DependencyGraphFeature } from "./services/DependencyGraph/index.js";
import { EmailFeature } from "./services/Email/index.js";
import { EncryptionFeature } from "./services/Encryption/index.js";
import { ErrorReporterFeature } from "./services/ErrorReporter/index.js";
import { EventBusFeature } from "./services/EventBus/index.js";
import { FileConfigFeature } from "./services/FileConfig/index.js";
import { GitFeature } from "./services/Git/index.js";
import { JobExecutionFeature } from "./services/JobExecution/index.js";
import { LicenseFeature } from "./services/License/index.js";
import { PackageJsonFeature } from "./services/PackageJson/index.js";
import { PackageManagerFeature } from "./services/PackageManager/index.js";
import { RegistryCacheFeature } from "./services/RegistryCache/index.js";
import { SbomFeature } from "./services/Sbom/index.js";
import { ScanFeature } from "./services/Scan/index.js";
import { ScanSchedulerFeature } from "./services/ScanScheduler/index.js";
import { SecurityFeature } from "./services/Security/index.js";
import { StepHookFeature } from "./services/StepHook/index.js";
import { UpgradeFeature } from "./services/Upgrade/index.js";
import { UpgradeSessionFeature } from "./services/UpgradeSession/index.js";
import { VulnerabilityFeature } from "./services/Vulnerability/index.js";

interface IApiFeatureContext {
    databaseClient: DatabaseClient.Interface;
}

export const ApiFeature = createFeature<IApiFeatureContext>({
    name: "Api",
    register(container, context) {
        ProcessEnvFeature.register(container);
        container.registerInstance(DatabaseClient, context.databaseClient);

        container.registerInstance(ConsoleLoggerConfig, {
            getConfig: () => ({ logLevel: "error" })
        });
        ConsoleLoggerFeature.register(container);
        DirectoryToolFeature.register(container);
        FileToolFeature.register(container);
        JsonFileToolFeature.register(container);

        container.register(WebSocketBroadcaster).inSingletonScope();

        EncryptionFeature.register(container);
        EventBusFeature.register(container);
        CommandRunnerFeature.register(container);
        EmailFeature.register(container);
        AppLogFeature.register(container);
        ErrorReporterFeature.register(container);
        PackageJsonFeature.register(container);
        FileConfigFeature.register(container);
        SecurityFeature.register(container);
        StepHookFeature.register(container);
        RegistryCacheFeature.register(container);
        UpgradeFeature.register(container);
        DependencyChangeFeature.register(container);
        ScanFeature.register(container);
        ScanSchedulerFeature.register(container);
        PackageManagerFeature.register(container);
        ChangelogFeature.register(container);
        SbomFeature.register(container);
        GitFeature.register(container);
        AutoFixFeature.register(container);
        LicenseFeature.register(container);
        VulnerabilityFeature.register(container);
        DependencyGraphFeature.register(container);
        UpgradeSessionFeature.register(container);
        AuthFeature.register(container);
        JobExecutionFeature.register(container);
    }
});
```

**Commit:** `refactor: rewrite feature.ts to compose sub-features`

---

### Task 5: Verify

```bash
yarn full
```

Fix any remaining broken imports. Iterate until clean.

**Commit:** `refactor: fix remaining import paths after restructure`

---

### Task 6: Update AGENTS.md

Update the project structure section to reflect new folder layout.

**Commit:** `docs: update AGENTS.md for new services structure`
