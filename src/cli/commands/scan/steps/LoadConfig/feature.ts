import { createFeature } from "#shared/index.js";
import { LoadConfigStep } from "./LoadConfigStep.js";

export const LoadConfigStepFeature = createFeature({
    name: "Cli/LoadConfigStep",
    register(container) {
        container.register(LoadConfigStep).inSingletonScope();
    }
});
