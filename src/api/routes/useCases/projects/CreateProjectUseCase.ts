import { existsSync } from "fs";
import { join } from "path";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SecurityService } from "#api/services/Security/index.js";
import { PackageManagerService } from "#api/services/PackageManager/index.js";
import { registerProject } from "#api/utils/registerProject.js";
import { CreateProjectUseCase as Abstraction } from "./abstractions/CreateProjectUseCase.js";

class CreateProjectUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly packageManagerService: PackageManagerService.Interface,
        private readonly securityService: SecurityService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        let registered;
        try {
            registered = await registerProject({
                projectPath: params.projectPath,
                databaseClient: this.databaseClient,
                packageManagerService: this.packageManagerService
            });
        } catch (error) {
            return Result.fail({
                code: "REGISTRATION_FAILED",
                statusCode: 400,
                message: (error as Error).message
            });
        }

        void this.securityService.check(registered.id, params.projectPath);

        try {
            return Result.ok({
                ...registered,
                lastScannedAt: null,
                hasNodeModules: existsSync(join(registered.path, "node_modules"))
            });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const CreateProjectUseCase = Abstraction.createImplementation({
    implementation: CreateProjectUseCaseImpl,
    dependencies: [DatabaseClient, PackageManagerService, SecurityService]
});
