import { Result } from "#shared/index.js";
import { DependencyGraphService } from "#api/services/DependencyGraph/index.js";
import { GetDependencyGraphUseCase as Abstraction } from "./abstractions/GetDependencyGraphUseCase.js";

class GetDependencyGraphUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly dependencyGraphService: DependencyGraphService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            if (params.packageName) {
                const paths = await this.dependencyGraphService.findPaths({
                    projectId: params.projectId,
                    packageName: params.packageName
                });
                return Result.ok({ paths });
            }

            const graph = await this.dependencyGraphService.getGraph(params.projectId);
            return Result.ok(graph);
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const GetDependencyGraphUseCase = Abstraction.createImplementation({
    implementation: GetDependencyGraphUseCaseImpl,
    dependencies: [DependencyGraphService]
});
