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
import { SecurityService } from "./services/SecurityService.js";
import { RegistryCacheService } from "./services/RegistryCacheService.js";
import { ScanService } from "./services/ScanService.js";
import { UpgradeService } from "./services/UpgradeService.js";
import { ChangelogService } from "./services/ChangelogService.js";
import { GitHubReleasesResolver } from "./services/changelogResolvers/GitHubReleasesResolver.js";
import { ChangelogFileResolver } from "./services/changelogResolvers/ChangelogFileResolver.js";
import { NpmReadmeResolver } from "./services/changelogResolvers/NpmReadmeResolver.js";
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
import { PackageManagerService } from "./services/PackageManagerService.js";
import { AuditParserService } from "./services/AuditParserService.js";
import { OsvCacheService } from "./services/OsvCacheService.js";
import { VulnerabilityService } from "./services/VulnerabilityService.js";
import { LicenseCheckerService } from "./services/LicenseCheckerService.js";
import { LicensePolicyService } from "./services/LicensePolicyService.js";
import { PackageManagerDriverFeature } from "./services/packageManagers/feature.js";
import { JobExecutorRegistry } from "./services/jobExecutors/JobExecutorRegistry.js";
import { JobWorker } from "./services/JobWorker.js";
import { JobWorker as JobWorkerAbstraction } from "./services/abstractions/JobWorker.js";
import { JobWorkerProvider } from "./services/abstractions/JobWorkerProvider.js";
import { WebSocketBroadcaster } from "./websocket/WebSocketBroadcaster.js";
import { GitService } from "./services/GitService.js";
import { ForgeService } from "./services/ForgeService.js";
import { UpgradeSessionService } from "./services/UpgradeSessionService.js";
import { UpgradeSessionStepResolverRegistry } from "./services/stepResolvers/StepResolverRegistry.js";
import { SelectPackagesResolver } from "./services/stepResolvers/SelectPackagesResolver.js";
import { BranchResolver } from "./services/stepResolvers/BranchResolver.js";
import { UpgradeResolver } from "./services/stepResolvers/UpgradeResolver.js";
import { RefreshTransientResolver } from "./services/stepResolvers/RefreshTransientResolver.js";
import { CommitResolver } from "./services/stepResolvers/CommitResolver.js";
import { PushResolver } from "./services/stepResolvers/PushResolver.js";
import { PrResolver } from "./services/stepResolvers/PrResolver.js";
import { AppLogService } from "./services/AppLogService.js";
import { ErrorReporter } from "./services/ErrorReporter.js";
import { ScanSchedulerService } from "./services/ScanSchedulerService.js";
import { EventBusFeature } from "./services/EventBus/index.js";
import { StepHookService } from "./services/StepHookService.js";
import { FileConfigService } from "./services/FileConfigService.js";
import { PackageJsonService } from "./services/PackageJsonService.js";
import { AutoFixSettingsService } from "./services/AutoFixSettingsService.js";
import { AutoFixPrService } from "./services/AutoFixPrService.js";
import { LockfileParserService } from "./services/LockfileParserService.js";
import { DependencyGraphService } from "./services/DependencyGraphService.js";
import { SbomService } from "./services/SbomService.js";
import { DependencyChangeService } from "./services/DependencyChangeService.js";
import { EncryptionFeature } from "./services/Encryption/index.js";
import { SbomFormatterRegistry } from "#api/services/sbomFormatters/SbomFormatterRegistry.js";
import { CycloneDxFormatter } from "#api/services/sbomFormatters/CycloneDxFormatter.js";
import { SpdxFormatter } from "#api/services/sbomFormatters/SpdxFormatter.js";
import { UserService } from "./services/UserService.js";
import { AuthService } from "./services/AuthService.js";
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
        container.register(SecurityService).inSingletonScope();
        container.register(RegistryCacheService).inSingletonScope();
        container.register(ScanService).inSingletonScope();
        container.register(UpgradeService).inSingletonScope();
        container.register(GitHubReleasesResolver);
        container.register(ChangelogFileResolver);
        container.register(NpmReadmeResolver);
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
        container.register(ChangelogService).inSingletonScope();
        container.register(GitService).inSingletonScope();
        PackageManagerDriverFeature.register(container);
        container.register(AuditParserService).inSingletonScope();
        container.register(OsvCacheService).inSingletonScope();
        container.register(VulnerabilityService).inSingletonScope();
        container.register(LicenseCheckerService).inSingletonScope();
        container.register(LicensePolicyService).inSingletonScope();
        container.register(PackageManagerService).inSingletonScope();
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
        container.register(AppLogService).inSingletonScope();
        container.register(ErrorReporter).inSingletonScope();
        container.register(ForgeService).inSingletonScope();
        container.register(SbomService).inSingletonScope();
        container.register(DependencyChangeService).inSingletonScope();
        container.register(ScanSchedulerService).inSingletonScope();
        container.register(CycloneDxFormatter);
        container.register(SpdxFormatter);
        container.register(SbomFormatterRegistry).inSingletonScope();
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
        container.register(FileConfigService).inSingletonScope();
        container.register(PackageJsonService).inSingletonScope();
        container.register(StepHookService).inSingletonScope();
        container.register(AutoFixSettingsService).inSingletonScope();
        container.register(AutoFixPrService).inSingletonScope();
        container.register(LockfileParserService).inSingletonScope();
        container.register(DependencyGraphService).inSingletonScope();

        container.register(SelectPackagesResolver);
        container.register(BranchResolver);
        container.register(UpgradeResolver);
        container.register(RefreshTransientResolver);
        container.register(CommitResolver);
        container.register(PushResolver);
        container.register(PrResolver);

        container.register(UpgradeSessionStepResolverRegistry);
        container.register(UpgradeSessionService).inSingletonScope();

        container.register(UserService).inSingletonScope();
        EmailFeature.register(container);
        container.register(AuthService).inSingletonScope();
    }
});
