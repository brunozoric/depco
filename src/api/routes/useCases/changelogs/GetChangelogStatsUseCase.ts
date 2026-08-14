import { Result, unexpectedError } from "#shared/index.js";
import { ChangelogService } from "#api/services/Changelog/index.js";
import { GetChangelogStatsUseCase as Abstraction } from "./abstractions/GetChangelogStatsUseCase.js";

class GetChangelogStatsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly changelogService: ChangelogService.Interface) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const stats = await this.changelogService.getStats();

            return Result.ok(stats);
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetChangelogStatsUseCase = Abstraction.createImplementation({
    implementation: GetChangelogStatsUseCaseImpl,
    dependencies: [ChangelogService]
});
