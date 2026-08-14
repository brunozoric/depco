import { Result } from "#shared/index.js";
import { DependencyGraphService } from "#api/services/DependencyGraph/index.js";
import { GetDependencyGraphStatsUseCase as Abstraction } from "./abstractions/GetDependencyGraphStatsUseCase.js";

class GetDependencyGraphStatsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly dependencyGraphService: DependencyGraphService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const graph = await this.dependencyGraphService.getGraph(params.projectId);

            return Result.ok({
                totalPackages: graph.totalPackages,
                maxDepth: graph.maxDepth,
                rootCount: graph.rootPackages.length,
                edgeCount: graph.edgeCount
            });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const GetDependencyGraphStatsUseCase = Abstraction.createImplementation({
    implementation: GetDependencyGraphStatsUseCaseImpl,
    dependencies: [DependencyGraphService]
});
