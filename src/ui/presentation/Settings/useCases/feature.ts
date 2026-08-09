import { createFeature } from "#shared/index.js";
import { PmSettingsFeature } from "../../../features/Settings/feature.js";
import { LoadSecuritySettingsUseCase } from "./LoadSecuritySettingsUseCase.js";
import { LoadPmConfigUseCase } from "./LoadPmConfigUseCase.js";
import { SavePmConfigUseCase } from "./SavePmConfigUseCase.js";
import { CreateSecuritySettingUseCase } from "./CreateSecuritySettingUseCase.js";
import { UpdateSecuritySettingUseCase } from "./UpdateSecuritySettingUseCase.js";
import { ToggleSecuritySettingUseCase } from "./ToggleSecuritySettingUseCase.js";
import { ResetSecuritySettingsUseCase } from "./ResetSecuritySettingsUseCase.js";

export const SecuritySettingsUseCasesFeature = createFeature({
    name: "Ui/SecuritySettingsUseCases",
    dependencies: [PmSettingsFeature],
    register(container) {
        container.register(LoadSecuritySettingsUseCase);
        container.register(LoadPmConfigUseCase);
        container.register(SavePmConfigUseCase);
        container.register(CreateSecuritySettingUseCase);
        container.register(UpdateSecuritySettingUseCase);
        container.register(ToggleSecuritySettingUseCase);
        container.register(ResetSecuritySettingsUseCase);
    }
});
