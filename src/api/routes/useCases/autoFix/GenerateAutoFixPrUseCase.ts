import { eq } from "drizzle-orm";
import { Result, unexpectedError, projectNotFoundError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects } from "#api/db/schema.js";
import { GenerateAutoFixPrUseCase as Abstraction } from "./abstractions/GenerateAutoFixPrUseCase.js";

class GenerateAutoFixPrUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly jobWorker: JobWorker.Interface
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
            const jobId = await this.jobWorker.enqueue({
                referenceId: params.projectId,
                referenceType: "project",
                type: "auto-fix-pr"
            });
            return Result.ok({ jobId });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GenerateAutoFixPrUseCase = Abstraction.createImplementation({
    implementation: GenerateAutoFixPrUseCaseImpl,
    dependencies: [DatabaseClient, JobWorker]
});
