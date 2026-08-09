import { createFeature } from "#shared/index.js";
import { EnsureDataDirectoryStepFeature } from "./steps/EnsureDataDirectory/index.js";
import { RunMigrationsStepFeature } from "./steps/RunMigrations/index.js";
import { GenerateEncryptionKeyStepFeature } from "./steps/GenerateEncryptionKey/index.js";
import { SelectPortStepFeature } from "./steps/SelectPort/index.js";
import { CreateAdminUserStepFeature } from "./steps/CreateAdminUser/index.js";
import { WriteEnvFileStepFeature } from "./steps/WriteEnvFile/index.js";
import { PrintNextStepsStepFeature } from "./steps/PrintNextSteps/index.js";
import { InitCommand } from "./InitCommand.js";

export const InitCommandFeature = createFeature({
    name: "Cli/InitCommand",
    dependencies: [
        EnsureDataDirectoryStepFeature,
        RunMigrationsStepFeature,
        GenerateEncryptionKeyStepFeature,
        SelectPortStepFeature,
        CreateAdminUserStepFeature,
        WriteEnvFileStepFeature,
        PrintNextStepsStepFeature
    ],
    register(container) {
        container.register(InitCommand).inSingletonScope();
    }
});
