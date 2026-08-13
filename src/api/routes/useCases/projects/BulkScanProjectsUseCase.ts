import { eq, and, inArray } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { upgradeJobs } from "#api/db/schema.js";
import { BulkScanProjectsUseCase as Abstraction } from "./abstractions/BulkScanProjectsUseCase.js";

class BulkScanProjectsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly jobWorker: JobWorker.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            let enqueuedCount = 0;
            let skippedCount = 0;

            for (const projectId of params.projectIds) {
                const activeJob = await db
                    .select()
                    .from(upgradeJobs)
                    .where(
                        and(
                            eq(upgradeJobs.referenceId, projectId),
                            eq(upgradeJobs.type, "scan"),
                            inArray(upgradeJobs.status, ["pending", "running"])
                        )
                    )
                    .get();

                if (activeJob && !params.force) {
                    skippedCount++;
                    continue;
                }

                await this.jobWorker.enqueue({
                    referenceId: projectId,
                    referenceType: "project",
                    type: "scan"
                });
                enqueuedCount++;
            }

            return Result.ok({ enqueuedCount, skippedCount });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const BulkScanProjectsUseCase = Abstraction.createImplementation({
    implementation: BulkScanProjectsUseCaseImpl,
    dependencies: [DatabaseClient, JobWorker]
});
