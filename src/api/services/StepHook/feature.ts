import { createFeature } from "#shared/index.js";
import { StepHookService } from "./StepHookService.js";

export const StepHookFeature = createFeature({
    name: "Api/StepHookFeature",
    register(container) {
        container.register(StepHookService).inSingletonScope();
    }
});
