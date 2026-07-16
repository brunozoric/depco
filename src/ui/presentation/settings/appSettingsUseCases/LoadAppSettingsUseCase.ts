import { LoadAppSettingsUseCase as Abstraction } from "./abstractions/LoadAppSettingsUseCase.js";
import { AppSettingsGateway } from "../../../features/appSettings/abstractions/AppSettingsGateway.js";
import { AppSettingsRepository } from "../../../features/appSettings/abstractions/AppSettingsRepository.js";

class LoadAppSettingsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: AppSettingsGateway.Interface,
        private readonly repository: AppSettingsRepository.Interface
    ) {}

    public execute = async (): Promise<void> => {
        const result = await this.gateway.list();
        this.repository.setSettings(result.settings);
        this.repository.setConfigSource(result.configSource);
        this.repository.setFileManaged(result.fileManaged);
        this.repository.setConfigError(result.configError ?? null);
        this.repository.setEncryptionAvailable(result.encryptionAvailable ?? false);
    };
}

export const LoadAppSettingsUseCase = Abstraction.createImplementation({
    implementation: LoadAppSettingsUseCaseImpl,
    dependencies: [AppSettingsGateway, AppSettingsRepository]
});
