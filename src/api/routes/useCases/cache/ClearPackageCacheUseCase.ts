import { Result } from "#shared/index.js";
import { RegistryCacheService } from "#api/services/RegistryCache/index.js";
import { ClearPackageCacheUseCase as Abstraction } from "./abstractions/ClearPackageCacheUseCase.js";

class ClearPackageCacheUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly registryCacheService: RegistryCacheService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            await this.registryCacheService.clearPackage(params.packageName);
            return Result.ok({ success: true });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const ClearPackageCacheUseCase = Abstraction.createImplementation({
    implementation: ClearPackageCacheUseCaseImpl,
    dependencies: [RegistryCacheService]
});
