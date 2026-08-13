import { createFeature } from "#shared/index.js";
import { ListStepHooksUseCase } from "./ListStepHooksUseCase.js";
import { CreateStepHookUseCase } from "./CreateStepHookUseCase.js";
import { UpdateStepHookUseCase } from "./UpdateStepHookUseCase.js";
import { DeleteStepHookUseCase } from "./DeleteStepHookUseCase.js";

export const StepHooksUseCasesFeature = createFeature({
    name: "Api/StepHooksUseCasesFeature",
    register(container) {
        container.register(ListStepHooksUseCase);
        container.register(CreateStepHookUseCase);
        container.register(UpdateStepHookUseCase);
        container.register(DeleteStepHookUseCase);
    }
});
