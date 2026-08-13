import { createFeature } from "#shared/index.js";
import { InstallProjectUseCase } from "./InstallProjectUseCase.js";
import { GetInstallOptionsUseCase } from "./GetInstallOptionsUseCase.js";

export const InstallUseCasesFeature = createFeature({
    name: "Api/InstallUseCasesFeature",
    register(container) {
        container.register(InstallProjectUseCase);
        container.register(GetInstallOptionsUseCase);
    }
});
