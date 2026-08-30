import { eq } from "drizzle-orm";
import { Result, unexpectedError, projectNotFoundError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SecurityService } from "#api/services/Security/index.js";
import { projects } from "#api/db/schema.js";
import { CheckProjectSecurityUseCase as Abstraction } from "./abstractions/CheckProjectSecurityUseCase.js";

class CheckProjectSecurityUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly securityService: SecurityService.Interface
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

        try {
            const result = await this.securityService.check(project.id, project.path);
            return Result.ok(result);
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const CheckProjectSecurityUseCase = Abstraction.createImplementation({
    implementation: CheckProjectSecurityUseCaseImpl,
    dependencies: [DatabaseClient, SecurityService]
});
