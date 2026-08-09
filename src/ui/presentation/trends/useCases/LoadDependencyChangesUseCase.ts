import { LoadDependencyChangesUseCase as Abstraction } from "./abstractions/LoadDependencyChangesUseCase.js";
import { TrendsGateway } from "../../../features/Trends/abstractions/TrendsGateway.js";
import { TrendsRepository } from "../../../features/Trends/abstractions/TrendsRepository.js";

class LoadDependencyChangesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: TrendsGateway.Interface,
        private readonly repository: TrendsRepository.Interface
    ) {}

    public execute = async (filters?: TrendsGateway.DependencyChangesFilters): Promise<void> => {
        const response = await this.gateway.getDependencyChanges(filters);
        this.repository.setDependencyChanges(response.items, response.total);
    };
}

export const LoadDependencyChangesUseCase = Abstraction.createImplementation({
    implementation: LoadDependencyChangesUseCaseImpl,
    dependencies: [TrendsGateway, TrendsRepository]
});
