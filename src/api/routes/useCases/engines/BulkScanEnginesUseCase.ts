import { inArray } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EngineService } from "#api/services/Engine/index.js";
import { projects } from "#api/db/schema.js";
import { BulkScanEnginesUseCase as Abstraction } from "./abstractions/BulkScanEnginesUseCase.js";

class BulkScanEnginesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly engineService: EngineService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const projectRows = await db
                .select()
                .from(projects)
                .where(inArray(projects.id, params.projectIds))
                .all();

            let scannedCount = 0;
            for (const project of projectRows) {
                await this.engineService.scan({
                    projectId: project.id,
                    projectPath: project.path
                });
                scannedCount++;
            }

            return Result.ok({ scannedCount });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const BulkScanEnginesUseCase = Abstraction.createImplementation({
    implementation: BulkScanEnginesUseCaseImpl,
    dependencies: [DatabaseClient, EngineService]
});
