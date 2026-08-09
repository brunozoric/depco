import { LoadPmConfigUseCase as Abstraction } from "./abstractions/LoadPmConfigUseCase.js";
import { PmSettingsGateway } from "../../../features/Settings/abstractions/PmSettingsGateway.js";
import { PmSettingsRepository } from "../../../features/Settings/abstractions/PmSettingsRepository.js";

class LoadPmConfigUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: PmSettingsGateway.Interface,
        private readonly repository: PmSettingsRepository.Interface
    ) {}

    public execute = async (): Promise<void> => {
        const result = await this.gateway.listPmConfig();
        this.repository.setPmConfigs(result.items);
    };
}

export const LoadPmConfigUseCase = Abstraction.createImplementation({
    implementation: LoadPmConfigUseCaseImpl,
    dependencies: [PmSettingsGateway, PmSettingsRepository]
});
