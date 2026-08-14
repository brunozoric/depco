import { existsSync } from "fs";
import { join } from "path";
import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects } from "#api/db/schema.js";
import { GetProjectUseCase as Abstraction } from "./abstractions/GetProjectUseCase.js";

class GetProjectUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const { db } = this.databaseClient;

        let project;
        try {
            project = await db.select().from(projects).where(eq(projects.id, params.id)).get();
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }

        if (!project) {
            return Result.fail({
                code: "PROJECT_NOT_FOUND",
                statusCode: 404,
                message: "Project not found"
            });
        }

        try {
            return Result.ok({
                ...project,
                hasNodeModules: existsSync(join(project.path, "node_modules"))
            });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const GetProjectUseCase = Abstraction.createImplementation({
    implementation: GetProjectUseCaseImpl,
    dependencies: [DatabaseClient]
});
