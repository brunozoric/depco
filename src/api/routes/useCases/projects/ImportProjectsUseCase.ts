import { inArray } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SecurityService } from "#api/services/Security/index.js";
import { PackageManagerService } from "#api/services/PackageManager/index.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { registerProject } from "#api/utils/registerProject.js";
import { projects } from "#api/db/schema.js";
import { ImportProjectsUseCase as Abstraction } from "./abstractions/ImportProjectsUseCase.js";

class ImportProjectsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly packageManagerService: PackageManagerService.Interface,
        private readonly securityService: SecurityService.Interface,
        private readonly jobWorker: JobWorker.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const { db } = this.databaseClient;

        let existingPaths;
        try {
            const requestedPaths = params.items.map(item => item.path);
            const existingRows = await db
                .select({ path: projects.path })
                .from(projects)
                .where(inArray(projects.path, requestedPaths))
                .all();
            existingPaths = new Set(existingRows.map(row => row.path));
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }

        const results: Abstraction.ImportResult[] = [];

        for (const { path: projectPath } of params.items) {
            if (existingPaths.has(projectPath)) {
                results.push({ path: projectPath, status: "skipped" });
                continue;
            }

            try {
                const registered = await registerProject({
                    projectPath,
                    databaseClient: this.databaseClient,
                    packageManagerService: this.packageManagerService
                });

                void this.securityService.check(registered.id, projectPath);
                void this.jobWorker.enqueue({
                    referenceId: registered.id,
                    referenceType: "project",
                    type: "scan"
                });

                results.push({ path: projectPath, status: "added" });
            } catch (error) {
                results.push({
                    path: projectPath,
                    status: "failed",
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return Result.ok({ items: results, total: results.length });
    }
}

export const ImportProjectsUseCase = Abstraction.createImplementation({
    implementation: ImportProjectsUseCaseImpl,
    dependencies: [DatabaseClient, PackageManagerService, SecurityService, JobWorker]
});
