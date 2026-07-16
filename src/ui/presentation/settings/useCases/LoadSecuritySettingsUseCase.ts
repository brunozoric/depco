import { LoadSecuritySettingsUseCase as Abstraction } from "./abstractions/LoadSecuritySettingsUseCase.js";
import { PmSettingsGateway } from "../../../features/settings/abstractions/PmSettingsGateway.js";
import { PmSettingsRepository } from "../../../features/settings/abstractions/PmSettingsRepository.js";

class LoadSecuritySettingsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: PmSettingsGateway.Interface,
        private readonly repository: PmSettingsRepository.Interface
    ) {}

    public execute = async (): Promise<void> => {
        const result = await this.gateway.list();
        this.repository.setSettings(result.settings);
        this.repository.setConfigSource(result.configSource);
        this.repository.setFileManagedPms(result.fileManagedPms);
        this.repository.setConfigError(result.configError ?? null);
    };
}

export const LoadSecuritySettingsUseCase = Abstraction.createImplementation({
    implementation: LoadSecuritySettingsUseCaseImpl,
    dependencies: [PmSettingsGateway, PmSettingsRepository]
});
