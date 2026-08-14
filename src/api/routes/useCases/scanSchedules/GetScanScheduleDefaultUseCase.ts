import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { appSettings } from "#api/db/schema.js";
import { SCAN_SCHEDULE_DEFAULT_KEY } from "./scanScheduleHelper.js";
import { GetScanScheduleDefaultUseCase as Abstraction } from "./abstractions/GetScanScheduleDefaultUseCase.js";

class GetScanScheduleDefaultUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const row = await db
                .select()
                .from(appSettings)
                .where(eq(appSettings.key, SCAN_SCHEDULE_DEFAULT_KEY))
                .get();

            return Result.ok({ interval: row?.value ?? "disabled" });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const GetScanScheduleDefaultUseCase = Abstraction.createImplementation({
    implementation: GetScanScheduleDefaultUseCaseImpl,
    dependencies: [DatabaseClient]
});
