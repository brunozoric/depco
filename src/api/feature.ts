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
import { ChangelogFeature } from "./services/Changelog/index.js";
import { CommandRunnerFeature } from "./services/CommandRunner/index.js";
import { DependencyChangeFeature } from "./services/DependencyChange/index.js";
import { DependencyGraphFeature } from "./services/DependencyGraph/index.js";
import { EmailFeature } from "./services/Email/index.js";
import { EncryptionFeature } from "./services/Encryption/index.js";
import { EngineFeature } from "./services/Engine/index.js";
import { ErrorReporterFeature } from "./services/ErrorReporter/index.js";
import { EventBusFeature } from "./services/EventBus/index.js";
import { FileConfigFeature } from "./services/FileConfig/index.js";
import { GitFeature } from "./services/Git/index.js";
import { JobExecutionFeature } from "./services/JobExecution/index.js";
import { JobsUseCasesFeature } from "./routes/useCases/jobs/index.js";
import { LicenseFeature } from "./services/License/index.js";
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
        LicenseFeature.register(container);
        SharedVulnerabilityFeature.register(container);
        VulnerabilityFeature.register(container);
        EngineFeature.register(container);
        DependencyGraphFeature.register(container);
        UpgradeSessionFeature.register(container);
        AuthFeature.register(container);
        JobExecutionFeature.register(container);
        JobsUseCasesFeature.register(container);
    }
});
