import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { PackageManagerService } from "#api/services/PackageManager/index.js";
import { projects } from "#api/db/schema.js";
import { GetPackageManagerUseCase as Abstraction } from "./abstractions/GetPackageManagerUseCase.js";

class GetPackageManagerUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly packageManagerService: PackageManagerService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const project = await db
                .select()
                .from(projects)
                .where(eq(projects.id, params.id))
                .get();
            if (!project) {
                return Result.fail({ statusCode: 404, message: "Project not found" });
            }

            const packageManager =
                project.packageManager ?? (await this.packageManagerService.detect(project.path));
            const version = await this.packageManagerService.getVersion(
                project.path,
                packageManager
            );

            return Result.ok({ version });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const GetPackageManagerUseCase = Abstraction.createImplementation({
    implementation: GetPackageManagerUseCaseImpl,
    dependencies: [DatabaseClient, PackageManagerService]
});
