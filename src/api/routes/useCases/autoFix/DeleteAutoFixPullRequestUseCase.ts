import { eq } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { autoFixPullRequests } from "#api/db/schema.js";
import { DeleteAutoFixPullRequestUseCase as Abstraction } from "./abstractions/DeleteAutoFixPullRequestUseCase.js";

class DeleteAutoFixPullRequestUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            await db.delete(autoFixPullRequests).where(eq(autoFixPullRequests.id, params.id)).run();
            return Result.ok({ deleted: true });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const DeleteAutoFixPullRequestUseCase = Abstraction.createImplementation({
    implementation: DeleteAutoFixPullRequestUseCaseImpl,
    dependencies: [DatabaseClient]
});
