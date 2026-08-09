import { LoadVulnerabilitiesUseCase as Abstraction } from "./abstractions/LoadVulnerabilitiesUseCase.js";
import { VulnerabilitiesGateway } from "../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";
import { VulnerabilitiesRepository } from "../../../features/Vulnerabilities/abstractions/VulnerabilitiesRepository.js";

class LoadVulnerabilitiesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: VulnerabilitiesGateway.Interface,
        private readonly repository: VulnerabilitiesRepository.Interface
    ) {}

    public execute = async (filters?: VulnerabilitiesGateway.ListFilters): Promise<void> => {
        const response = await this.gateway.list(filters);
        this.repository.setVulnerabilities(response.items, response.total);
    };
}

export const LoadVulnerabilitiesUseCase = Abstraction.createImplementation({
    implementation: LoadVulnerabilitiesUseCaseImpl,
    dependencies: [VulnerabilitiesGateway, VulnerabilitiesRepository]
});
