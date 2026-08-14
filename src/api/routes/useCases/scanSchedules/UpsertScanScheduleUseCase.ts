import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { ScanSchedulerService } from "#api/services/ScanScheduler/index.js";
import { scanSchedules } from "#api/db/schema.js";
import { toScanScheduleResponse } from "./scanScheduleHelper.js";
import { UpsertScanScheduleUseCase as Abstraction } from "./abstractions/UpsertScanScheduleUseCase.js";

class UpsertScanScheduleUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly scanSchedulerService: ScanSchedulerService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const now = Date.now();

            const existing = await db
                .select()
                .from(scanSchedules)
                .where(eq(scanSchedules.projectId, params.projectId))
                .get();

            if (existing) {
                await db
                    .update(scanSchedules)
                    .set({ interval: params.interval, updatedAt: now })
                    .where(eq(scanSchedules.projectId, params.projectId))
                    .run();

                await this.scanSchedulerService.scheduleProject(params.projectId);

                return Result.ok(
                    toScanScheduleResponse({
                        ...existing,
                        interval: params.interval,
                        updatedAt: now
                    })
                );
            }

            const row = {
                id: generateId(),
                projectId: params.projectId,
                interval: params.interval,
                lastRunAt: null,
                nextRunAt: null,
                enabled: 1 as const,
                createdAt: now,
                updatedAt: now
            };

            await db.insert(scanSchedules).values(row).run();
            await this.scanSchedulerService.scheduleProject(params.projectId);

            return Result.ok(toScanScheduleResponse(row));
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const UpsertScanScheduleUseCase = Abstraction.createImplementation({
    implementation: UpsertScanScheduleUseCaseImpl,
    dependencies: [DatabaseClient, ScanSchedulerService]
});
