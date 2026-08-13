import { createFeature } from "#shared/index.js";
import { ListPmSettingsUseCase } from "./ListPmSettingsUseCase.js";
import { UpdatePmConfigUseCase } from "./UpdatePmConfigUseCase.js";
import { ListSecuritySettingsUseCase } from "./ListSecuritySettingsUseCase.js";
import { CreateSecuritySettingUseCase } from "./CreateSecuritySettingUseCase.js";
import { UpdateSecuritySettingUseCase } from "./UpdateSecuritySettingUseCase.js";
import { ToggleSecuritySettingUseCase } from "./ToggleSecuritySettingUseCase.js";
import { ResetSecuritySettingsUseCase } from "./ResetSecuritySettingsUseCase.js";
import { ListAppSettingsUseCase } from "./ListAppSettingsUseCase.js";
import { UpsertAppSettingUseCase } from "./UpsertAppSettingUseCase.js";

export const SettingsUseCasesFeature = createFeature({
    name: "Api/SettingsUseCasesFeature",
    register(container) {
        container.register(ListPmSettingsUseCase);
        container.register(UpdatePmConfigUseCase);
        container.register(ListSecuritySettingsUseCase);
        container.register(CreateSecuritySettingUseCase);
        container.register(UpdateSecuritySettingUseCase);
        container.register(ToggleSecuritySettingUseCase);
        container.register(ResetSecuritySettingsUseCase);
        container.register(ListAppSettingsUseCase);
        container.register(UpsertAppSettingUseCase);
    }
});
