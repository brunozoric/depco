import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SbomService } from "#api/services/Sbom/index.js";
import { SbomFormatterRegistry } from "#api/services/Sbom/index.js";
import { projects } from "#api/db/schema.js";
import { ExportProjectSbomUseCase as Abstraction } from "./abstractions/ExportProjectSbomUseCase.js";

class ExportProjectSbomUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly sbomService: SbomService.Interface,
        private readonly sbomFormatterRegistry: SbomFormatterRegistry.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const project = await this.databaseClient.db
                .select()
                .from(projects)
                .where(eq(projects.id, params.projectId))
                .get();
            if (!project) {
                return Result.fail({
                    code: "PROJECT_NOT_FOUND",
                    statusCode: 404,
                    message: "Project not found"
                });
            }

            const formatter = this.sbomFormatterRegistry.get(params.format);
            const data = await this.sbomService.collectForProject(params.projectId);
            const result = formatter.format(data);

            return Result.ok(result);
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const ExportProjectSbomUseCase = Abstraction.createImplementation({
    implementation: ExportProjectSbomUseCaseImpl,
    dependencies: [DatabaseClient, SbomService, SbomFormatterRegistry]
});
