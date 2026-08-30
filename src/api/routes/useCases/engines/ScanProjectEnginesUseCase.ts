import { eq } from "drizzle-orm";
import { Result, unexpectedError, projectNotFoundError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EngineService } from "#api/services/Engine/index.js";
import { projects } from "#api/db/schema.js";
import { ScanProjectEnginesUseCase as Abstraction } from "./abstractions/ScanProjectEnginesUseCase.js";

class ScanProjectEnginesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly engineService: EngineService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        let project;
        try {
            const { db } = this.databaseClient;
            project = await db
                .select()
                .from(projects)
                .where(eq(projects.id, params.projectId))
                .get();
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }

        if (!project) {
            return Result.fail(projectNotFoundError());
        }

        try {
            const result = await this.engineService.scan({
                projectId: params.projectId,
                projectPath: project.path,
                ...(params.warnMaintenance !== undefined && {
                    warnMaintenance: params.warnMaintenance
                })
            });
            return Result.ok(result);
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ScanProjectEnginesUseCase = Abstraction.createImplementation({
    implementation: ScanProjectEnginesUseCaseImpl,
    dependencies: [DatabaseClient, EngineService]
});
