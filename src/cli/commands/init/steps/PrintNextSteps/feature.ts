import { createFeature } from "#shared/index.js";
import { PrintNextStepsStep } from "./PrintNextStepsStep.js";

export const PrintNextStepsStepFeature = createFeature({
    name: "Cli/PrintNextStepsStep",
    register(container) {
        container.register(PrintNextStepsStep).inSingletonScope();
    }
});
