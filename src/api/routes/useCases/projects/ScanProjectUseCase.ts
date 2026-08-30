import { eq } from "drizzle-orm";
import { Result, unexpectedError, projectNotFoundError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects } from "#api/db/schema.js";
import { ScanProjectUseCase as Abstraction } from "./abstractions/ScanProjectUseCase.js";

class ScanProjectUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly jobWorker: JobWorker.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const { db } = this.databaseClient;

        let project;
        try {
            project = await db.select().from(projects).where(eq(projects.id, params.id)).get();
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }

        if (!project) {
            return Result.fail(projectNotFoundError());
        }

        try {
            const force = params.force === "true";
            const jobId = await this.jobWorker.enqueue({
                referenceId: project.id,
                referenceType: "project",
                type: "scan",
                packages: JSON.stringify({ force })
            });

            return Result.ok({ jobId });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ScanProjectUseCase = Abstraction.createImplementation({
    implementation: ScanProjectUseCaseImpl,
    dependencies: [DatabaseClient, JobWorker]
});
