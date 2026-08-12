import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects } from "#api/db/schema.js";
import { CreateTransientJobUseCase as Abstraction } from "./abstractions/CreateTransientJobUseCase.js";

class CreateTransientJobUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly jobWorker: JobWorker.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const { db } = this.databaseClient;

        const project = await db
            .select()
            .from(projects)
            .where(eq(projects.id, params.projectId))
            .get();
        if (!project) {
            return Result.fail({ statusCode: 404, message: "Project not found" });
        }

        try {
            const jobId = await this.jobWorker.enqueue({
                referenceId: params.projectId,
                referenceType: "project",
                type: "transient"
            });

            return Result.ok({ jobId });
        } catch (error) {
            return Result.fail({ statusCode: 403, message: (error as Error).message });
        }
    }
}

export const CreateTransientJobUseCase = Abstraction.createImplementation({
    implementation: CreateTransientJobUseCaseImpl,
    dependencies: [DatabaseClient, JobWorker]
});
