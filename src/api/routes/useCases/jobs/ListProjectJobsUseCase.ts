import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects } from "#api/db/schema.js";
import { ListProjectJobsUseCase as Abstraction } from "./abstractions/ListProjectJobsUseCase.js";

class ListProjectJobsUseCaseImpl implements Abstraction.Interface {
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

        const jobs = await this.jobWorker.getJobsForReference(params.projectId);

        return Result.ok({ items: jobs, total: jobs.length });
    }
}

export const ListProjectJobsUseCase = Abstraction.createImplementation({
    implementation: ListProjectJobsUseCaseImpl,
    dependencies: [DatabaseClient, JobWorker]
});
