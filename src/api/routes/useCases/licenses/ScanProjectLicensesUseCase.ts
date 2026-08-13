import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects } from "#api/db/schema.js";
import { ScanProjectLicensesUseCase as Abstraction } from "./abstractions/ScanProjectLicensesUseCase.js";

class ScanProjectLicensesUseCaseImpl implements Abstraction.Interface {
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
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }

        if (!project) {
            return Result.fail({ statusCode: 404, message: "Project not found" });
        }

        try {
            const jobId = await this.jobWorker.enqueue({
                referenceId: params.projectId,
                referenceType: "project",
                type: "scan"
            });
            return Result.ok({ jobId });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const ScanProjectLicensesUseCase = Abstraction.createImplementation({
    implementation: ScanProjectLicensesUseCaseImpl,
    dependencies: [DatabaseClient, JobWorker]
});
