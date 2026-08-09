import { createFeature } from "#shared/index.js";
import { AppSettingsFeature } from "../../../features/AppSettings/feature.js";
import { LoadAppSettingsUseCase } from "./LoadAppSettingsUseCase.js";
import { UpsertAppSettingUseCase } from "./UpsertAppSettingUseCase.js";

export const AppSettingsUseCasesFeature = createFeature({
    name: "Ui/AppSettingsUseCases",
    dependencies: [AppSettingsFeature],
    register(container) {
        container.register(LoadAppSettingsUseCase);
        container.register(UpsertAppSettingUseCase);
    }
});
