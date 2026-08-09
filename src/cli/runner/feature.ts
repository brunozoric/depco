import { createFeature } from "#shared/index.js";
import { StepRunner } from "./StepRunner.js";

export const StepRunnerFeature = createFeature({
    name: "Cli/StepRunner",
    register(container) {
        container.register(StepRunner).inSingletonScope();
    }
});
