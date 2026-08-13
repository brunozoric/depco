import { eq, and } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { ScanSchedulerService } from "#api/services/ScanScheduler/index.js";
import { projects, upgradeJobs, securityChecks, scanResults } from "#api/db/schema.js";
import { DeleteProjectUseCase as Abstraction } from "./abstractions/DeleteProjectUseCase.js";

class DeleteProjectUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly scanSchedulerService: ScanSchedulerService.Interface
    ) {}

    public async execute(params: Abstraction.Params): Promise<Result<void, Abstraction.Error>> {
        const { db } = this.databaseClient;

        let runningJob;
        try {
            runningJob = await db
                .select()
                .from(upgradeJobs)
                .where(
                    and(eq(upgradeJobs.referenceId, params.id), eq(upgradeJobs.status, "running"))
                )
                .get();
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }

        if (runningJob) {
            return Result.fail({
                statusCode: 409,
                message: "Cannot delete project with running jobs"
            });
        }

        try {
            await this.scanSchedulerService.unscheduleProject(params.id);

            await db.delete(scanResults).where(eq(scanResults.projectId, params.id)).run();
            await db.delete(securityChecks).where(eq(securityChecks.projectId, params.id)).run();
            await db.delete(upgradeJobs).where(eq(upgradeJobs.referenceId, params.id)).run();
            await db.delete(projects).where(eq(projects.id, params.id)).run();

            return Result.ok();
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const DeleteProjectUseCase = Abstraction.createImplementation({
    implementation: DeleteProjectUseCaseImpl,
    dependencies: [DatabaseClient, ScanSchedulerService]
});
