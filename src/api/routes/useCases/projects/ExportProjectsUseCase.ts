import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects } from "#api/db/schema.js";
import { ExportProjectsUseCase as Abstraction } from "./abstractions/ExportProjectsUseCase.js";

class ExportProjectsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const allProjects = await db.select().from(projects).all();

            return Result.ok({
                items: allProjects.map(project => ({ path: project.path })),
                total: allProjects.length
            });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ExportProjectsUseCase = Abstraction.createImplementation({
    implementation: ExportProjectsUseCaseImpl,
    dependencies: [DatabaseClient]
});
