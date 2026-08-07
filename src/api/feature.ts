import { ConsoleLoggerConfig, ConsoleLoggerFeature } from "@webiny/stdlib";
import {
    DirectoryToolFeature,
    FileToolFeature,
    JsonFileToolFeature,
    ProcessEnvFeature
} from "@webiny/stdlib/node";
import { createFeature } from "#shared/index.js";
import { DatabaseClient } from "./db/abstractions/DatabaseClient.js";
import { CommandRunnerFeature } from "./services/CommandRunner/index.js";
import { SecurityFeature } from "./services/Security/index.js";
import { RegistryCacheFeature } from "./services/RegistryCache/index.js";
import { ScanFeature } from "./services/Scan/index.js";
import { UpgradeFeature } from "./services/Upgrade/index.js";
import { ChangelogFeature } from "./services/Changelog/index.js";
import { ChangelogJobExecutor } from "./services/jobExecutors/ChangelogJobExecutor.js";
import { DependencyJobExecutor } from "./services/jobExecutors/DependencyJobExecutor.js";
import { TransientJobExecutor } from "./services/jobExecutors/TransientJobExecutor.js";
import { PackageManagerJobExecutor } from "./services/jobExecutors/PackageManagerJobExecutor.js";
import { InstallJobExecutor } from "./services/jobExecutors/InstallJobExecutor.js";
import { CloneJobExecutor } from "./services/jobExecutors/CloneJobExecutor.js";
import { AutoFixPrJobExecutor } from "./services/jobExecutors/AutoFixPrJobExecutor.js";
import { ScanJobExecutor } from "./services/jobExecutors/ScanJobExecutor.js";
import { TransitiveResolveJobExecutor } from "./services/jobExecutors/TransitiveResolveJobExecutor.js";
import { PackageScanJobExecutor } from "./services/jobExecutors/PackageScanJobExecutor.js";
import { VulnerabilityScanJobExecutor } from "./services/jobExecutors/VulnerabilityScanJobExecutor.js";
import { LicenseScanJobExecutor } from "./services/jobExecutors/LicenseScanJobExecutor.js";
import { GraphRefreshJobExecutor } from "./services/jobExecutors/GraphRefreshJobExecutor.js";

import { VulnerabilityFeature } from "./services/Vulnerability/index.js";
import { LicenseFeature } from "./services/License/index.js";

import { PackageManagerFeature } from "./services/PackageManager/index.js";
import { JobExecutorRegistry } from "./services/jobExecutors/JobExecutorRegistry.js";
import { JobWorker } from "./services/JobWorker.js";
import { JobWorker as JobWorkerAbstraction } from "./services/abstractions/JobWorker.js";
import { JobWorkerProvider } from "./services/abstractions/JobWorkerProvider.js";
import { WebSocketBroadcaster } from "./websocket/WebSocketBroadcaster.js";
import { GitFeature } from "./services/Git/index.js";
import { UpgradeSessionFeature } from "./services/UpgradeSession/index.js";
import { AppLogFeature } from "./services/AppLog/index.js";
import { ErrorReporterFeature } from "./services/ErrorReporter/index.js";
import { ScanSchedulerFeature } from "./services/ScanScheduler/index.js";
import { EventBusFeature } from "./services/EventBus/index.js";
import { StepHookFeature } from "./services/StepHook/index.js";
import { FileConfigFeature } from "./services/FileConfig/index.js";
import { PackageJsonFeature } from "./services/PackageJson/index.js";
import { AutoFixFeature } from "./services/AutoFix/index.js";

import { DependencyGraphFeature } from "./services/DependencyGraph/index.js";
import { SbomFeature } from "./services/Sbom/index.js";
import { DependencyChangeFeature } from "./services/DependencyChange/index.js";
import { EncryptionFeature } from "./services/Encryption/index.js";

import { AuthFeature } from "./services/Auth/index.js";
import { EmailFeature } from "./services/Email/index.js";

interface IApiFeatureContext {
    databaseClient: DatabaseClient.Interface;
}

export const ApiFeature = createFeature<IApiFeatureContext>({
    name: "Api",
    register(container, context) {
        ProcessEnvFeature.register(container);
        container.registerInstance(DatabaseClient, context.databaseClient);
        EncryptionFeature.register(container);
        EventBusFeature.register(container);
        CommandRunnerFeature.register(container);
        SecurityFeature.register(container);
        RegistryCacheFeature.register(container);
        ScanFeature.register(container);
        UpgradeFeature.register(container);
        ChangelogFeature.register(container);
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
        GitFeature.register(container);
        PackageManagerFeature.register(container);
        VulnerabilityFeature.register(container);
        LicenseFeature.register(container);
        container.register(JobExecutorRegistry).inSingletonScope();
        container.register(JobWorker).inSingletonScope();
        // ScanJobExecutor needs to enqueue/await child jobs via JobWorker, but
        // JobWorker's constructor depends (transitively, through
        // JobExecutorRegistry) on ScanJobExecutor itself. Registering this as
        // a factory — rather than a normal class dependency — means resolving
        // it never triggers a nested resolve() of JobWorker; it just hands
        // back a `get()` closure that ScanJobExecutor calls at execute() time,
        // well after JobWorker is already a cached singleton. See
        // JobWorkerProvider.ts for details.
        container.registerFactory(JobWorkerProvider, () => ({
            get: () => container.resolve(JobWorkerAbstraction)
        }));
        container.register(WebSocketBroadcaster).inSingletonScope();
        AppLogFeature.register(container);
        ErrorReporterFeature.register(container);
        // ForgeService registered via GitFeature
        SbomFeature.register(container);
        DependencyChangeFeature.register(container);
        ScanSchedulerFeature.register(container);
        // "error" suppresses ConsoleLogger's default "debug" verbosity — in
        // particular FileTool.readFile's warn() when a config file is absent,
        // which is the common, expected case for global/project config lookups.
        container.registerInstance(ConsoleLoggerConfig, {
            getConfig: () => ({ logLevel: "error" })
        });
        ConsoleLoggerFeature.register(container);
        DirectoryToolFeature.register(container);
        FileToolFeature.register(container);
        JsonFileToolFeature.register(container);
        FileConfigFeature.register(container);
        PackageJsonFeature.register(container);
        StepHookFeature.register(container);
        AutoFixFeature.register(container);
        DependencyGraphFeature.register(container);
        UpgradeSessionFeature.register(container);
        EmailFeature.register(container);
        AuthFeature.register(container);
    }
});
