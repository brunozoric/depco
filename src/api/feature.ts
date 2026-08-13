import { ConsoleLoggerConfig, ConsoleLoggerFeature } from "@webiny/stdlib";
import {
    DirectoryToolFeature,
    FileToolFeature,
    JsonFileToolFeature,
    ProcessEnvFeature
} from "@webiny/stdlib/node";
import { createFeature } from "#shared/index.js";
import { SharedVulnerabilityFeature } from "#shared/vulnerabilities/feature.js";
import { DatabaseClient } from "./db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "./websocket/WebSocketBroadcaster.js";

import { AppLogFeature } from "./services/AppLog/index.js";
import { AuthFeature } from "./services/Auth/index.js";
import { AutoFixFeature } from "./services/AutoFix/index.js";
import { AutoFixUseCasesFeature } from "./routes/useCases/autoFix/index.js";
import { CacheUseCasesFeature } from "./routes/useCases/cache/index.js";
import { ChangelogFeature } from "./services/Changelog/index.js";
import { CommandRunnerFeature } from "./services/CommandRunner/index.js";
import { DependencyChangeFeature } from "./services/DependencyChange/index.js";
import { DependencyGraphFeature } from "./services/DependencyGraph/index.js";
import { EmailFeature } from "./services/Email/index.js";
import { EncryptionFeature } from "./services/Encryption/index.js";
import { EngineFeature } from "./services/Engine/index.js";
import { EnginesUseCasesFeature } from "./routes/useCases/engines/index.js";
import { ErrorReporterFeature } from "./services/ErrorReporter/index.js";
import { EventBusFeature } from "./services/EventBus/index.js";
import { FileConfigFeature } from "./services/FileConfig/index.js";
import { GitFeature } from "./services/Git/index.js";
import { JobExecutionFeature } from "./services/JobExecution/index.js";
import { AuthUseCasesFeature } from "./routes/useCases/auth/index.js";
import { BackupUseCasesFeature } from "./routes/useCases/backup/index.js";
import { ChangelogsUseCasesFeature } from "./routes/useCases/changelogs/index.js";
import { DashboardUseCasesFeature } from "./routes/useCases/dashboard/index.js";
import { DependencyGraphUseCasesFeature } from "./routes/useCases/dependencyGraph/index.js";
import { FilesystemUseCasesFeature } from "./routes/useCases/filesystem/index.js";
import { InstallUseCasesFeature } from "./routes/useCases/install/index.js";
import { JobsUseCasesFeature } from "./routes/useCases/jobs/index.js";
import { LogsUseCasesFeature } from "./routes/useCases/logs/index.js";
import { PackageManagerUseCasesFeature } from "./routes/useCases/packageManager/index.js";
import { PackagesUseCasesFeature } from "./routes/useCases/packages/index.js";
import { ProjectsUseCasesFeature } from "./routes/useCases/projects/index.js";
import { SbomUseCasesFeature } from "./routes/useCases/sbom/index.js";
import { ScanSchedulesUseCasesFeature } from "./routes/useCases/scanSchedules/index.js";
import { SettingsUseCasesFeature } from "./routes/useCases/settings/index.js";
import { StepHooksUseCasesFeature } from "./routes/useCases/stepHooks/index.js";
import { TeamsUseCasesFeature } from "./routes/useCases/teams/index.js";
import { UpgradeSessionsUseCasesFeature } from "./routes/useCases/upgradeSessions/index.js";
import { UsersUseCasesFeature } from "./routes/useCases/users/index.js";
import { LicenseFeature } from "./services/License/index.js";
import { LicensesUseCasesFeature } from "./routes/useCases/licenses/index.js";
import { PackageFeature } from "./services/Package/index.js";
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
import { VulnerabilitiesUseCasesFeature } from "./routes/useCases/vulnerabilities/index.js";

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
        PackageFeature.register(container);
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
        AutoFixUseCasesFeature.register(container);
        CacheUseCasesFeature.register(container);
        LicenseFeature.register(container);
        LicensesUseCasesFeature.register(container);
        SharedVulnerabilityFeature.register(container);
        VulnerabilityFeature.register(container);
        VulnerabilitiesUseCasesFeature.register(container);
        EngineFeature.register(container);
        DependencyGraphFeature.register(container);
        UpgradeSessionFeature.register(container);
        AuthFeature.register(container);
        AuthUseCasesFeature.register(container);
        BackupUseCasesFeature.register(container);
        JobExecutionFeature.register(container);
        JobsUseCasesFeature.register(container);
        LogsUseCasesFeature.register(container);
        DashboardUseCasesFeature.register(container);
        TeamsUseCasesFeature.register(container);
        ProjectsUseCasesFeature.register(container);
        ScanSchedulesUseCasesFeature.register(container);
        SettingsUseCasesFeature.register(container);
        ChangelogsUseCasesFeature.register(container);
        StepHooksUseCasesFeature.register(container);
        UsersUseCasesFeature.register(container);
        EnginesUseCasesFeature.register(container);
        DependencyGraphUseCasesFeature.register(container);
        FilesystemUseCasesFeature.register(container);
        InstallUseCasesFeature.register(container);
        PackageManagerUseCasesFeature.register(container);
        PackagesUseCasesFeature.register(container);
        SbomUseCasesFeature.register(container);
        UpgradeSessionsUseCasesFeature.register(container);
    }
});
