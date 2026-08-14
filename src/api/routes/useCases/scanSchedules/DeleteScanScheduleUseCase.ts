import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { ScanSchedulerService } from "#api/services/ScanScheduler/index.js";
import { scanSchedules } from "#api/db/schema.js";
import { DeleteScanScheduleUseCase as Abstraction } from "./abstractions/DeleteScanScheduleUseCase.js";

class DeleteScanScheduleUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly scanSchedulerService: ScanSchedulerService.Interface
    ) {}

    public async execute(params: Abstraction.Params): Promise<Result<void, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            await db
                .delete(scanSchedules)
                .where(eq(scanSchedules.projectId, params.projectId))
                .run();

            await this.scanSchedulerService.scheduleProject(params.projectId);

            return Result.ok();
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const DeleteScanScheduleUseCase = Abstraction.createImplementation({
    implementation: DeleteScanScheduleUseCaseImpl,
    dependencies: [DatabaseClient, ScanSchedulerService]
});
