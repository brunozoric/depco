import { eq } from "drizzle-orm";
import { Result, unexpectedError, projectNotFoundError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { PackageManagerService } from "#api/services/PackageManager/index.js";
import { projects } from "#api/db/schema.js";
import { UpdatePackageManagerUseCase as Abstraction } from "./abstractions/UpdatePackageManagerUseCase.js";

class UpdatePackageManagerUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly jobWorker: JobWorker.Interface,
        private readonly packageManagerService: PackageManagerService.Interface
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

        let packageManager: string;
        try {
            packageManager =
                project.packageManager ?? (await this.packageManagerService.detect(project.path));
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }

        let currentVersion: string;
        try {
            currentVersion = await this.packageManagerService.getVersion(
                project.path,
                packageManager
            );
        } catch {
            currentVersion = project.pmVersion ?? "unknown";
        }

        try {
            const jobId = await this.jobWorker.enqueue({
                referenceId: params.id,
                referenceType: "project",
                type: "packageManager",
                packages: { from: currentVersion, to: params.version }
            });

            return Result.ok({ jobId });
        } catch (error) {
            return Result.fail({
                code: "ENQUEUE_FORBIDDEN",
                statusCode: 403,
                message: (error as Error).message
            });
        }
    }
}

export const UpdatePackageManagerUseCase = Abstraction.createImplementation({
    implementation: UpdatePackageManagerUseCaseImpl,
    dependencies: [DatabaseClient, JobWorker, PackageManagerService]
});
