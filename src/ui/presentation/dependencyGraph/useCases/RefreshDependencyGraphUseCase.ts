import { RefreshDependencyGraphUseCase as Abstraction } from "./abstractions/RefreshDependencyGraphUseCase.js";
import { DependencyGraphGateway } from "../../../features/dependencyGraph/abstractions/DependencyGraphGateway.js";
import { DependencyGraphRepository } from "../../../features/dependencyGraph/abstractions/DependencyGraphRepository.js";

class RefreshDependencyGraphUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: DependencyGraphGateway.Interface,
        private readonly repository: DependencyGraphRepository.Interface
    ) {}

    public execute = async (projectId: string): Promise<void> => {
        await this.gateway.refresh(projectId);

        const [graph, stats] = await Promise.all([
            this.gateway.getGraph(projectId),
            this.gateway.getStats(projectId)
        ]);

        this.repository.setGraph(graph);
        this.repository.setStats(stats);
    };
}

export const RefreshDependencyGraphUseCase = Abstraction.createImplementation({
    implementation: RefreshDependencyGraphUseCaseImpl,
    dependencies: [DependencyGraphGateway, DependencyGraphRepository]
});
