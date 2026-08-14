import { Result, unexpectedError } from "#shared/index.js";
import { ChangelogService } from "#api/services/Changelog/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { ReResolveAllChangelogsUseCase as Abstraction } from "./abstractions/ReResolveAllChangelogsUseCase.js";
import { enqueueChangelogIfNeeded } from "./changelogEnqueue.js";

class ReResolveAllChangelogsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly changelogService: ChangelogService.Interface,
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly jobWorker: JobWorker.Interface
    ) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const resetPackages = await this.changelogService.resetAllFailed();
            const deps = { db: this.databaseClient.db, jobWorker: this.jobWorker };

            for (const { packageName, maxVersion } of resetPackages) {
                await enqueueChangelogIfNeeded({
                    deps,
                    packageName,
                    from: "0.0.0",
                    to: maxVersion
                });
            }

            return Result.ok({ packageCount: resetPackages.length });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ReResolveAllChangelogsUseCase = Abstraction.createImplementation({
    implementation: ReResolveAllChangelogsUseCaseImpl,
    dependencies: [ChangelogService, DatabaseClient, JobWorker]
});
