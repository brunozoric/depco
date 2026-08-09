import { ToggleSecuritySettingUseCase as Abstraction } from "./abstractions/ToggleSecuritySettingUseCase.js";
import { PmSettingsGateway } from "../../../features/Settings/abstractions/PmSettingsGateway.js";
import { PmSettingsRepository } from "../../../features/Settings/abstractions/PmSettingsRepository.js";

class ToggleSecuritySettingUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: PmSettingsGateway.Interface,
        private readonly repository: PmSettingsRepository.Interface
    ) {}

    public execute = async (id: string): Promise<void> => {
        const updated = await this.gateway.toggle(id);
        this.repository.updateSettingFromServer(id, updated);
    };
}

export const ToggleSecuritySettingUseCase = Abstraction.createImplementation({
    implementation: ToggleSecuritySettingUseCaseImpl,
    dependencies: [PmSettingsGateway, PmSettingsRepository]
});
