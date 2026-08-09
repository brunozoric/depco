import { LoadDependencyGraphUseCase as Abstraction } from "./abstractions/LoadDependencyGraphUseCase.js";
import { DependencyGraphGateway } from "../../../features/DependencyGraph/abstractions/DependencyGraphGateway.js";
import { DependencyGraphRepository } from "../../../features/DependencyGraph/abstractions/DependencyGraphRepository.js";

class LoadDependencyGraphUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: DependencyGraphGateway.Interface,
        private readonly repository: DependencyGraphRepository.Interface
    ) {}

    public execute = async (projectId: string): Promise<void> => {
        const [graph, stats] = await Promise.all([
            this.gateway.getGraph(projectId),
            this.gateway.getStats(projectId)
        ]);

        this.repository.setGraph(graph);
        this.repository.setStats(stats);
    };
}

export const LoadDependencyGraphUseCase = Abstraction.createImplementation({
    implementation: LoadDependencyGraphUseCaseImpl,
    dependencies: [DependencyGraphGateway, DependencyGraphRepository]
});
