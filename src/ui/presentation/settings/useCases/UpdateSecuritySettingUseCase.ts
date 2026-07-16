import { UpdateSecuritySettingUseCase as Abstraction } from "./abstractions/UpdateSecuritySettingUseCase.js";
import { PmSettingsGateway } from "../../../features/settings/abstractions/PmSettingsGateway.js";
import { PmSettingsRepository } from "../../../features/settings/abstractions/PmSettingsRepository.js";

class UpdateSecuritySettingUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: PmSettingsGateway.Interface,
        private readonly repository: PmSettingsRepository.Interface
    ) {}

    public execute = async (id: string, expectedValue: string): Promise<void> => {
        await this.gateway.update(id, expectedValue);
        this.repository.updateSetting(id, expectedValue);
    };
}

export const UpdateSecuritySettingUseCase = Abstraction.createImplementation({
    implementation: UpdateSecuritySettingUseCaseImpl,
    dependencies: [PmSettingsGateway, PmSettingsRepository]
});
