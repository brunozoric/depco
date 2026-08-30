import { eq } from "drizzle-orm";
import { Result, unexpectedError, projectNotFoundError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { DependencyGraphService } from "#api/services/DependencyGraph/index.js";
import { projects } from "#api/db/schema.js";
import { RefreshDependencyGraphUseCase as Abstraction } from "./abstractions/RefreshDependencyGraphUseCase.js";

class RefreshDependencyGraphUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly dependencyGraphService: DependencyGraphService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const project = await db
                .select()
                .from(projects)
                .where(eq(projects.id, params.projectId))
                .get();
            if (!project) {
                return Result.fail(projectNotFoundError());
            }
            if (!project.packageManager) {
                return Result.fail({
                    code: "NO_PACKAGE_MANAGER",
                    statusCode: 400,
                    message: "Project has no detected package manager"
                });
            }

            const edgeCount = await this.dependencyGraphService.refreshGraph(
                params.projectId,
                project.path,
                project.packageManager
            );

            return Result.ok({ edgeCount });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const RefreshDependencyGraphUseCase = Abstraction.createImplementation({
    implementation: RefreshDependencyGraphUseCaseImpl,
    dependencies: [DatabaseClient, DependencyGraphService]
});
