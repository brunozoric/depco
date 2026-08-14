import { inArray } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import { projects } from "#api/db/schema.js";
import { BulkRescanVulnerabilitiesUseCase as Abstraction } from "./abstractions/BulkRescanVulnerabilitiesUseCase.js";

class BulkRescanVulnerabilitiesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly vulnerabilityService: VulnerabilityService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const projectIds = await this.vulnerabilityService.getProjectIdsForVulnerabilityIds(
                params.ids
            );

            const projectRows = await db
                .select()
                .from(projects)
                .where(inArray(projects.id, projectIds))
                .all();
            const projectMap = new Map(projectRows.map(project => [project.id, project]));

            let projectsQueued = 0;
            for (const projectId of projectIds) {
                const project = projectMap.get(projectId);
                if (project?.packageManager) {
                    await this.vulnerabilityService.scan({
                        projectId,
                        projectPath: project.path,
                        packageManager: project.packageManager
                    });
                    projectsQueued++;
                }
            }

            return Result.ok({ projectsQueued });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const BulkRescanVulnerabilitiesUseCase = Abstraction.createImplementation({
    implementation: BulkRescanVulnerabilitiesUseCaseImpl,
    dependencies: [DatabaseClient, VulnerabilityService]
});
