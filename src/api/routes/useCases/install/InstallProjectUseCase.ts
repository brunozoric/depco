import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects } from "#api/db/schema.js";
import { InstallProjectUseCase as Abstraction } from "./abstractions/InstallProjectUseCase.js";

class InstallProjectUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly jobWorker: JobWorker.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const project = await db
                .select()
                .from(projects)
                .where(eq(projects.id, params.id))
                .get();
            if (!project) {
                return Result.fail({
                    code: "PROJECT_NOT_FOUND",
                    statusCode: 404,
                    message: "Project not found"
                });
            }
            if (!project.packageManager) {
                return Result.fail({
                    code: "NO_PACKAGE_MANAGER",
                    statusCode: 400,
                    message: "No package manager detected for this project"
                });
            }

            const jobId = await this.jobWorker.enqueue({
                referenceId: params.id,
                referenceType: "project",
                type: "install",
                packages: JSON.stringify({ flags: params.flags })
            });

            return Result.ok({ jobId });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const InstallProjectUseCase = Abstraction.createImplementation({
    implementation: InstallProjectUseCaseImpl,
    dependencies: [DatabaseClient, JobWorker]
});
