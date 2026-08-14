import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects, scanResults } from "#api/db/schema.js";
import { UpgradeJobUseCase as Abstraction } from "./abstractions/UpgradeJobUseCase.js";

class UpgradeJobUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly jobWorker: JobWorker.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const { db } = this.databaseClient;

        let project;
        let packagesWithFrom;
        try {
            project = await db
                .select()
                .from(projects)
                .where(eq(projects.id, params.projectId))
                .get();
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
            const scanned = await db
                .select()
                .from(scanResults)
                .where(eq(scanResults.projectId, params.projectId))
                .all();

            packagesWithFrom = params.packages.map(pkg => {
                const found = scanned.find(dep => dep.name === pkg.name);
                return {
                    name: pkg.name,
                    from: found?.currentVersion ?? "unknown",
                    to: pkg.targetVersion
                };
            });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }

        try {
            const jobId = await this.jobWorker.enqueue({
                referenceId: params.projectId,
                referenceType: "project",
                type: "dependency",
                packages: packagesWithFrom,
                refreshTransient: params.refreshTransient === true
            });

            return Result.ok({ jobId });
        } catch (error) {
            return Result.fail({
                code: "ENQUEUE_FAILED",
                statusCode: 403,
                message: (error as Error).message
            });
        }
    }
}

export const UpgradeJobUseCase = Abstraction.createImplementation({
    implementation: UpgradeJobUseCaseImpl,
    dependencies: [DatabaseClient, JobWorker]
});
