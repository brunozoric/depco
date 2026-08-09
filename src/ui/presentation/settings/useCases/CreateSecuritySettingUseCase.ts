import { CreateSecuritySettingUseCase as Abstraction } from "./abstractions/CreateSecuritySettingUseCase.js";
import { PmSettingsGateway } from "../../../features/Settings/abstractions/PmSettingsGateway.js";
import { PmSettingsRepository } from "../../../features/Settings/abstractions/PmSettingsRepository.js";

class CreateSecuritySettingUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: PmSettingsGateway.Interface,
        private readonly repository: PmSettingsRepository.Interface
    ) {}

    public execute = async (
        packageManager: string,
        fieldName: string,
        expectedValue: string
    ): Promise<void> => {
        const setting = await this.gateway.create(packageManager, fieldName, expectedValue);
        this.repository.addSetting(setting);
    };
}

export const CreateSecuritySettingUseCase = Abstraction.createImplementation({
    implementation: CreateSecuritySettingUseCaseImpl,
    dependencies: [PmSettingsGateway, PmSettingsRepository]
});
