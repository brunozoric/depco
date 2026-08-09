import { createFeature } from "#shared/index.js";
import { AutoFixFeature } from "../../../features/AutoFix/feature.js";
import { LoadAutoFixUseCase } from "./LoadAutoFixUseCase.js";
import { UpdateAutoFixSettingsUseCase } from "./UpdateAutoFixSettingsUseCase.js";
import { GenerateAutoFixPrsUseCase } from "./GenerateAutoFixPrsUseCase.js";

export const AutoFixUseCasesFeature = createFeature({
    name: "Ui/AutoFixUseCases",
    dependencies: [AutoFixFeature],
    register(container) {
        container.register(LoadAutoFixUseCase);
        container.register(UpdateAutoFixSettingsUseCase);
        container.register(GenerateAutoFixPrsUseCase);
    }
});
