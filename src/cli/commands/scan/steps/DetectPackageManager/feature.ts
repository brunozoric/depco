import { createFeature } from "#shared/index.js";
import { DetectPackageManagerStep } from "./DetectPackageManagerStep.js";

export const DetectPackageManagerStepFeature = createFeature({
    name: "Cli/DetectPackageManagerStep",
    register(container) {
        container.register(DetectPackageManagerStep).inSingletonScope();
    }
});
