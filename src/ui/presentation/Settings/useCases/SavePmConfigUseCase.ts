import { SavePmConfigUseCase as Abstraction } from "./abstractions/SavePmConfigUseCase.js";
import { PmSettingsGateway } from "../../../features/Settings/abstractions/PmSettingsGateway.js";
import { PmSettingsRepository } from "../../../features/Settings/abstractions/PmSettingsRepository.js";

class SavePmConfigUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: PmSettingsGateway.Interface,
        private readonly repository: PmSettingsRepository.Interface
    ) {}

    public execute = async (
        pm: string,
        settings: PmSettingsGateway.UpdatePmConfigBody
    ): Promise<void> => {
        const updatedItem = await this.gateway.updatePmConfig(pm, settings);
        const currentConfigs = this.repository.getPmConfigs();
        const updatedConfigs = currentConfigs.map(config =>
            config.packageManager === pm ? updatedItem : config
        );
        this.repository.setPmConfigs(updatedConfigs);
    };
}

export const SavePmConfigUseCase = Abstraction.createImplementation({
    implementation: SavePmConfigUseCaseImpl,
    dependencies: [PmSettingsGateway, PmSettingsRepository]
});
