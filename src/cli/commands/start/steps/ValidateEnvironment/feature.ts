import { createFeature } from "#shared/index.js";
import { ValidateEnvironmentStep } from "./ValidateEnvironmentStep.js";

export const ValidateEnvironmentStepFeature = createFeature({
    name: "Cli/ValidateEnvironmentStep",
    register(container) {
        container.register(ValidateEnvironmentStep).inSingletonScope();
    }
});
