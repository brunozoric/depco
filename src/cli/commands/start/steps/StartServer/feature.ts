import { createFeature } from "#shared/index.js";
import { StartServerStep } from "./StartServerStep.js";

export const StartServerStepFeature = createFeature({
    name: "Cli/StartServerStep",
    register(container) {
        container.register(StartServerStep).inSingletonScope();
    }
});
