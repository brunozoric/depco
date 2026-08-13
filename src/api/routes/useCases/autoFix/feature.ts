import { createFeature } from "#shared/index.js";
import { GetAutoFixSettingsUseCase } from "./GetAutoFixSettingsUseCase.js";
import { UpdateAutoFixSettingsUseCase } from "./UpdateAutoFixSettingsUseCase.js";
import { ListAutoFixPullRequestsUseCase } from "./ListAutoFixPullRequestsUseCase.js";
import { GetProjectAutoFixPullRequestsUseCase } from "./GetProjectAutoFixPullRequestsUseCase.js";
import { GenerateAutoFixPrUseCase } from "./GenerateAutoFixPrUseCase.js";
import { DeleteAutoFixPullRequestUseCase } from "./DeleteAutoFixPullRequestUseCase.js";

export const AutoFixUseCasesFeature = createFeature({
    name: "Api/AutoFixUseCasesFeature",
    register(container) {
        container.register(GetAutoFixSettingsUseCase);
        container.register(UpdateAutoFixSettingsUseCase);
        container.register(ListAutoFixPullRequestsUseCase);
        container.register(GetProjectAutoFixPullRequestsUseCase);
        container.register(GenerateAutoFixPrUseCase);
        container.register(DeleteAutoFixPullRequestUseCase);
    }
});
