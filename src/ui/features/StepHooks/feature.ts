import { createFeature } from "#shared/index.js";
import { StepHooksGateway } from "./StepHooksGateway.js";
import { StepHooksRepository } from "./StepHooksRepository.js";

export const StepHooksFeature = createFeature({
    name: "Ui/StepHooks",
    register(container) {
        container.register(StepHooksGateway).inSingletonScope();
        container.register(StepHooksRepository).inSingletonScope();
    }
});
