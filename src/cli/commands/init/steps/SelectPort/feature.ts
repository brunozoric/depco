import { createFeature } from "#shared/index.js";
import { SelectPortStep } from "./SelectPortStep.js";

export const SelectPortStepFeature = createFeature({
    name: "Cli/SelectPortStep",
    register(container) {
        container.register(SelectPortStep).inSingletonScope();
    }
});
