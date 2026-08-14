import { Result, unexpectedError } from "#shared/index.js";
import { RegistryCacheService } from "#api/services/RegistryCache/index.js";
import { ClearCacheUseCase as Abstraction } from "./abstractions/ClearCacheUseCase.js";

class ClearCacheUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly registryCacheService: RegistryCacheService.Interface) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            await this.registryCacheService.clearAll();
            return Result.ok({ success: true });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ClearCacheUseCase = Abstraction.createImplementation({
    implementation: ClearCacheUseCaseImpl,
    dependencies: [RegistryCacheService]
});
