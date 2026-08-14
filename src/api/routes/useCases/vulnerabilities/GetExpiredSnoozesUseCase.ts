import { Result, unexpectedError } from "#shared/index.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import { GetExpiredSnoozesUseCase as Abstraction } from "./abstractions/GetExpiredSnoozesUseCase.js";

class GetExpiredSnoozesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly vulnerabilityService: VulnerabilityService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const expired = await this.vulnerabilityService.getRecentlyExpiredSnoozes(params.since);
            const packageNames = [
                ...new Set(expired.map(vulnerability => vulnerability.packageName))
            ];
            return Result.ok({ count: expired.length, packageNames });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetExpiredSnoozesUseCase = Abstraction.createImplementation({
    implementation: GetExpiredSnoozesUseCaseImpl,
    dependencies: [VulnerabilityService]
});
