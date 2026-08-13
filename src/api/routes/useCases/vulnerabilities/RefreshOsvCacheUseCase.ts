import { Result } from "#shared/index.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import { RefreshOsvCacheUseCase as Abstraction } from "./abstractions/RefreshOsvCacheUseCase.js";

class RefreshOsvCacheUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly vulnerabilityService: VulnerabilityService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const invalidated = await this.vulnerabilityService.forceOsvRefresh(params);
            return Result.ok({ invalidated });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const RefreshOsvCacheUseCase = Abstraction.createImplementation({
    implementation: RefreshOsvCacheUseCaseImpl,
    dependencies: [VulnerabilityService]
});
