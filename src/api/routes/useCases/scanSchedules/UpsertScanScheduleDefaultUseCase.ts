import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { ScanSchedulerService } from "#api/services/ScanScheduler/index.js";
import { appSettings } from "#api/db/schema.js";
import { SCAN_SCHEDULE_DEFAULT_KEY } from "./scanScheduleHelper.js";
import { UpsertScanScheduleDefaultUseCase as Abstraction } from "./abstractions/UpsertScanScheduleDefaultUseCase.js";

class UpsertScanScheduleDefaultUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly scanSchedulerService: ScanSchedulerService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            await db
                .insert(appSettings)
                .values({ key: SCAN_SCHEDULE_DEFAULT_KEY, value: params.interval })
                .onConflictDoUpdate({
                    target: appSettings.key,
                    set: { value: params.interval }
                })
                .run();

            await this.scanSchedulerService.onGlobalDefaultChanged();

            return Result.ok({ interval: params.interval });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const UpsertScanScheduleDefaultUseCase = Abstraction.createImplementation({
    implementation: UpsertScanScheduleDefaultUseCaseImpl,
    dependencies: [DatabaseClient, ScanSchedulerService]
});
