import { and, eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { autoFixPullRequests } from "#api/db/schema.js";
import { GetProjectAutoFixPullRequestsUseCase as Abstraction } from "./abstractions/GetProjectAutoFixPullRequestsUseCase.js";
import { rowToPullRequestListItem } from "./autoFixPullRequestMapper.js";

class GetProjectAutoFixPullRequestsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const conditions = [eq(autoFixPullRequests.projectId, params.projectId)];
            if (params.status) {
                conditions.push(eq(autoFixPullRequests.status, params.status));
            }

            const rows = await db
                .select()
                .from(autoFixPullRequests)
                .where(and(...conditions))
                .all();
            const items = rows.map(rowToPullRequestListItem);

            return Result.ok({ items, total: items.length });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const GetProjectAutoFixPullRequestsUseCase = Abstraction.createImplementation({
    implementation: GetProjectAutoFixPullRequestsUseCaseImpl,
    dependencies: [DatabaseClient]
});
