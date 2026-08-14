import { Result } from "#shared/index.js";
import { ChangelogService } from "#api/services/Changelog/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { GetChangelogsUseCase as Abstraction } from "./abstractions/GetChangelogsUseCase.js";
import { enqueueChangelogIfNeeded } from "./changelogEnqueue.js";

class GetChangelogsUseCaseImpl implements Abstraction.Interface {
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

            const entries = await this.changelogService.getChangelogs(packageName, from, to);
            const hasUnfetched = entries.some(entry => entry.content === null);

            let resolving = false;
            if (hasUnfetched) {
                await enqueueChangelogIfNeeded({
                    deps: { db: this.databaseClient.db, jobWorker: this.jobWorker },
                    packageName,
                    from,
                    to
                });
                resolving = true;
            }

            return Result.ok({ items: entries, total: entries.length, resolving });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const GetChangelogsUseCase = Abstraction.createImplementation({
    implementation: GetChangelogsUseCaseImpl,
    dependencies: [ChangelogService, DatabaseClient, JobWorker]
});
