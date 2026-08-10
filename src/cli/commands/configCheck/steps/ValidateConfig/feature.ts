import { createFeature } from "#shared/index.js";
import { ValidateConfigStep } from "./ValidateConfigStep.js";

export const ValidateConfigStepFeature = createFeature({
    name: "Cli/ValidateConfigStep",
    register(container) {
        container.register(ValidateConfigStep).inSingletonScope();
    }
});
