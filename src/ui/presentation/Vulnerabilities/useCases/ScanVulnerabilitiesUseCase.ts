import { ScanVulnerabilitiesUseCase as Abstraction } from "./abstractions/ScanVulnerabilitiesUseCase.js";
import { VulnerabilitiesGateway } from "../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";

class ScanVulnerabilitiesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: VulnerabilitiesGateway.Interface) {}

    public execute = async (projectId: string): Promise<VulnerabilitiesGateway.ScanResult> => {
        return this.gateway.scan(projectId);
    };
}

export const ScanVulnerabilitiesUseCase = Abstraction.createImplementation({
    implementation: ScanVulnerabilitiesUseCaseImpl,
    dependencies: [VulnerabilitiesGateway]
});
