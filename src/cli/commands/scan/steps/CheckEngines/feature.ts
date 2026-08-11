import { createFeature } from "#shared/index.js";
import { CheckEnginesStep } from "./CheckEnginesStep.js";

export const CheckEnginesStepFeature = createFeature({
    name: "Cli/CheckEnginesStep",
    register(container) {
        container.register(CheckEnginesStep).inSingletonScope();
    }
});
