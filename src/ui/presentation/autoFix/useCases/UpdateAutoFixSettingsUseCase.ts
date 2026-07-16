import { UpdateAutoFixSettingsUseCase as Abstraction } from "./abstractions/UpdateAutoFixSettingsUseCase.js";
import { AutoFixGateway } from "../../../features/autoFix/abstractions/AutoFixGateway.js";
import { AutoFixRepository } from "../../../features/autoFix/abstractions/AutoFixRepository.js";

class UpdateAutoFixSettingsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: AutoFixGateway.Interface,
        private readonly repository: AutoFixRepository.Interface
    ) {}

    public execute = async (
        projectId: string,
        input: AutoFixGateway.UpdateSettingsInput
    ): Promise<void> => {
        const settings = await this.gateway.updateSettings(projectId, input);
        this.repository.setSettings(settings);
    };
}

export const UpdateAutoFixSettingsUseCase = Abstraction.createImplementation({
    implementation: UpdateAutoFixSettingsUseCaseImpl,
    dependencies: [AutoFixGateway, AutoFixRepository]
});
