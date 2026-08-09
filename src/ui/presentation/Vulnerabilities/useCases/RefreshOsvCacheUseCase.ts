import { RefreshOsvCacheUseCase as Abstraction } from "./abstractions/RefreshOsvCacheUseCase.js";
import { VulnerabilitiesGateway } from "../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";

class RefreshOsvCacheUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: VulnerabilitiesGateway.Interface) {}

    public execute = async (
        options: VulnerabilitiesGateway.RefreshOptions
    ): Promise<{ invalidated: number }> => {
        return this.gateway.refreshOsvCache(options);
    };
}

export const RefreshOsvCacheUseCase = Abstraction.createImplementation({
    implementation: RefreshOsvCacheUseCaseImpl,
    dependencies: [VulnerabilitiesGateway]
});
