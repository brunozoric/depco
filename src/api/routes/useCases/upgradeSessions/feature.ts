import { createFeature } from "#shared/index.js";
import { CreateUpgradeSessionUseCase } from "./CreateUpgradeSessionUseCase.js";
import { GetUpgradeSessionUseCase } from "./GetUpgradeSessionUseCase.js";
import { ExecuteUpgradeStepUseCase } from "./ExecuteUpgradeStepUseCase.js";
import { SkipUpgradeStepUseCase } from "./SkipUpgradeStepUseCase.js";
import { AbortUpgradeSessionUseCase } from "./AbortUpgradeSessionUseCase.js";

export const UpgradeSessionsUseCasesFeature = createFeature({
    name: "Api/UpgradeSessionsUseCasesFeature",
    register(container) {
        container.register(CreateUpgradeSessionUseCase);
        container.register(GetUpgradeSessionUseCase);
        container.register(ExecuteUpgradeStepUseCase);
        container.register(SkipUpgradeStepUseCase);
        container.register(AbortUpgradeSessionUseCase);
    }
});
