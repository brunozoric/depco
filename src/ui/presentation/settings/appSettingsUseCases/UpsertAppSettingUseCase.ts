import { UpsertAppSettingUseCase as Abstraction } from "./abstractions/UpsertAppSettingUseCase.js";
import { AppSettingsGateway } from "../../../features/appSettings/abstractions/AppSettingsGateway.js";
import { AppSettingsRepository } from "../../../features/appSettings/abstractions/AppSettingsRepository.js";

class UpsertAppSettingUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: AppSettingsGateway.Interface,
        private readonly repository: AppSettingsRepository.Interface
    ) {}

    public execute = async (key: string, value: string): Promise<void> => {
        const setting = await this.gateway.upsert(key, value);
        this.repository.upsertSetting(setting);
    };
}

export const UpsertAppSettingUseCase = Abstraction.createImplementation({
    implementation: UpsertAppSettingUseCaseImpl,
    dependencies: [AppSettingsGateway, AppSettingsRepository]
});
