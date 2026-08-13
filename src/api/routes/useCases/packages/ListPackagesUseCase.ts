import { Result } from "#shared/index.js";
import { PackageQueryService } from "#api/services/Package/index.js";
import { ListPackagesUseCase as Abstraction } from "./abstractions/ListPackagesUseCase.js";

class ListPackagesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly packageQueryService: PackageQueryService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const result = await this.packageQueryService.listPackages(params);
            return Result.ok(result);
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const ListPackagesUseCase = Abstraction.createImplementation({
    implementation: ListPackagesUseCaseImpl,
    dependencies: [PackageQueryService]
});
