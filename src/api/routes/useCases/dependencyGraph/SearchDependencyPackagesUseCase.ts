import { Result } from "#shared/index.js";
import { DependencyGraphService } from "#api/services/DependencyGraph/index.js";
import { SearchDependencyPackagesUseCase as Abstraction } from "./abstractions/SearchDependencyPackagesUseCase.js";

class SearchDependencyPackagesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly dependencyGraphService: DependencyGraphService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const packages = await this.dependencyGraphService.searchPackages({
                projectId: params.projectId,
                query: params.query,
                ...(params.limit === undefined ? {} : { limit: params.limit })
            });

            return Result.ok({ packages });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const SearchDependencyPackagesUseCase = Abstraction.createImplementation({
    implementation: SearchDependencyPackagesUseCaseImpl,
    dependencies: [DependencyGraphService]
});
