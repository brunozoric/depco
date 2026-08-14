import { eq } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects, scanSchedules, appSettings } from "#api/db/schema.js";
import { SCAN_SCHEDULE_DEFAULT_KEY } from "./scanScheduleHelper.js";
import type { IResolvedScanScheduleResponse } from "./scanScheduleHelper.js";
import { ListScanSchedulesUseCase as Abstraction } from "./abstractions/ListScanSchedulesUseCase.js";

class ListScanSchedulesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const allProjects = await db.select().from(projects).all();
            const overrides = await db.select().from(scanSchedules).all();
            const overrideMap = new Map(overrides.map(override => [override.projectId, override]));

            const globalRow = await db
                .select()
                .from(appSettings)
                .where(eq(appSettings.key, SCAN_SCHEDULE_DEFAULT_KEY))
                .get();
            const globalDefault = globalRow?.value ?? "disabled";

            const items: IResolvedScanScheduleResponse[] = allProjects.map(project => {
                const override = overrideMap.get(project.id);
                return {
                    projectId: project.id,
                    projectName: project.name,
                    interval: override?.interval ?? globalDefault,
                    source: override ? "project" : "default",
                    lastRunAt: override?.lastRunAt ?? null,
                    nextRunAt: override?.nextRunAt ?? null
                };
            });

            return Result.ok({ items, globalDefault });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ListScanSchedulesUseCase = Abstraction.createImplementation({
    implementation: ListScanSchedulesUseCaseImpl,
    dependencies: [DatabaseClient]
});
