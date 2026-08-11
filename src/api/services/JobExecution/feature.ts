import { createFeature } from "#shared/index.js";
import { JobWorker } from "./JobWorker.js";
import { JobWorker as JobWorkerAbstraction } from "./abstractions/JobWorker.js";
import { JobWorkerProvider } from "./abstractions/JobWorkerProvider.js";
import { JobExecutionContextFactory } from "./JobExecutionContextFactory.js";
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
        container.register(JobExecutionContextFactory).inSingletonScope();
        container.register(JobWorker).inSingletonScope();
        container.registerFactory(JobWorkerProvider, () => ({
            get: () => container.resolve(JobWorkerAbstraction)
        }));
    }
});
