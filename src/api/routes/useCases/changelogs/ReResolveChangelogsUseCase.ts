import { Result, unexpectedError } from "#shared/index.js";
import { ChangelogService } from "#api/services/Changelog/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { ReResolveChangelogsUseCase as Abstraction } from "./abstractions/ReResolveChangelogsUseCase.js";
import { enqueueChangelogIfNeeded } from "./changelogEnqueue.js";

class ReResolveChangelogsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly changelogService: ChangelogService.Interface,
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly jobWorker: JobWorker.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { packageName, from, to } = params;

            if (from === to) {
                return Result.ok({ items: [], total: 0, resolving: false });
            }

            await this.changelogService.resetFailed(packageName);

            await enqueueChangelogIfNeeded({
                deps: { db: this.databaseClient.db, jobWorker: this.jobWorker },
                packageName,
                from,
                to
            });

            const entries = await this.changelogService.getChangelogs(packageName, from, to);

            return Result.ok({ items: entries, total: entries.length, resolving: true });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ReResolveChangelogsUseCase = Abstraction.createImplementation({
    implementation: ReResolveChangelogsUseCaseImpl,
    dependencies: [ChangelogService, DatabaseClient, JobWorker]
});
