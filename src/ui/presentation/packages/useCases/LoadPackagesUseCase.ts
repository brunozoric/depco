import { LoadPackagesUseCase as Abstraction } from "./abstractions/LoadPackagesUseCase.js";
import { PackagesGateway } from "../../../features/packages/abstractions/PackagesGateway.js";
import { PackagesRepository } from "../../../features/packages/abstractions/PackagesRepository.js";

class LoadPackagesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly packagesGateway: PackagesGateway.Interface,
        private readonly packagesRepository: PackagesRepository.Interface
    ) {}

    public execute = async (filters?: PackagesGateway.Filters): Promise<void> => {
        const response = await this.packagesGateway.list(filters);
        this.packagesRepository.setPackages(response.items, response.total);
    };
}

export const LoadPackagesUseCase = Abstraction.createImplementation({
    implementation: LoadPackagesUseCaseImpl,
    dependencies: [PackagesGateway, PackagesRepository]
});
