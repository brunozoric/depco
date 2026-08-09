import { createFeature } from "#shared/index.js";
import { DetectPackageManagerStepFeature } from "./steps/DetectPackageManager/index.js";
import { LoadConfigStepFeature } from "./steps/LoadConfig/index.js";
import { ParseLockfileStepFeature } from "./steps/ParseLockfile/index.js";
import { CheckLicensesStepFeature } from "./steps/CheckLicenses/index.js";
import { ScanCommand } from "./ScanCommand.js";

export const ScanCommandFeature = createFeature({
    name: "Cli/ScanCommand",
    dependencies: [
        DetectPackageManagerStepFeature,
        LoadConfigStepFeature,
        ParseLockfileStepFeature,
        CheckLicensesStepFeature
    ],
    register(container) {
        container.register(ScanCommand).inSingletonScope();
    }
});
