import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import { projects } from "#api/db/schema.js";
import { ScanVulnerabilitiesUseCase as Abstraction } from "./abstractions/ScanVulnerabilitiesUseCase.js";

class ScanVulnerabilitiesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly vulnerabilityService: VulnerabilityService.Interface
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

        if (!project.packageManager) {
            return Result.fail({
                code: "NO_PACKAGE_MANAGER",
                statusCode: 422,
                message: "Project has no detected package manager. Run a dependency scan first."
            });
        }

        try {
            const result = await this.vulnerabilityService.scan({
                projectId: params.projectId,
                projectPath: project.path,
                packageManager: project.packageManager
            });
            return Result.ok({ total: result.total, counts: result.counts });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const ScanVulnerabilitiesUseCase = Abstraction.createImplementation({
    implementation: ScanVulnerabilitiesUseCaseImpl,
    dependencies: [DatabaseClient, VulnerabilityService]
});
