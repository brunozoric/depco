import { BulkRescanVulnerabilitiesUseCase as Abstraction } from "./abstractions/BulkRescanVulnerabilitiesUseCase.js";
import { VulnerabilitiesGateway } from "../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";

class BulkRescanVulnerabilitiesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: VulnerabilitiesGateway.Interface) {}

    public execute = async (ids: string[]): Promise<number> => {
        const { projectsQueued } = await this.gateway.bulkRescan(ids);
        return projectsQueued;
    };
}

export const BulkRescanVulnerabilitiesUseCase = Abstraction.createImplementation({
    implementation: BulkRescanVulnerabilitiesUseCaseImpl,
    dependencies: [VulnerabilitiesGateway]
});
