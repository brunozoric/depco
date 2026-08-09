import { ResetSecuritySettingsUseCase as Abstraction } from "./abstractions/ResetSecuritySettingsUseCase.js";
import { PmSettingsGateway } from "../../../features/Settings/abstractions/PmSettingsGateway.js";
import { PmSettingsRepository } from "../../../features/Settings/abstractions/PmSettingsRepository.js";

class ResetSecuritySettingsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: PmSettingsGateway.Interface,
        private readonly repository: PmSettingsRepository.Interface
    ) {}

    public execute = async (packageManager: string): Promise<void> => {
        const settings = await this.gateway.resetDefaults(packageManager);
        const existing = this.repository.getSettings();
        const otherPmSettings = existing.filter(s => s.packageManager !== packageManager);
        this.repository.setSettings([...otherPmSettings, ...settings]);
    };
}

export const ResetSecuritySettingsUseCase = Abstraction.createImplementation({
    implementation: ResetSecuritySettingsUseCaseImpl,
    dependencies: [PmSettingsGateway, PmSettingsRepository]
});
