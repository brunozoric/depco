import { and, sql } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { autoFixPullRequests } from "#api/db/schema.js";
import { ListAutoFixPullRequestsUseCase as Abstraction } from "./abstractions/ListAutoFixPullRequestsUseCase.js";
import { buildAutoFixPullRequestConditions } from "./autoFixPullRequestConditions.js";
import { rowToPullRequestListItem } from "./autoFixPullRequestMapper.js";

interface ICountRow {
    count: number;
}

class ListAutoFixPullRequestsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const page = params.page ?? 1;
            const pageSize = params.pageSize ?? 50;
            const offset = (page - 1) * pageSize;

            const conditions = buildAutoFixPullRequestConditions(params);
            const where = conditions.length > 0 ? and(...conditions) : undefined;

            const countResult = (await db
                .select({ count: sql<number>`count(*)` })
                .from(autoFixPullRequests)
                .where(where)
                .get()) as ICountRow | undefined;
            const total = countResult?.count ?? 0;

            const rows = await db
                .select()
                .from(autoFixPullRequests)
                .where(where)
                .limit(pageSize)
                .offset(offset)
                .all();
            const items = rows.map(rowToPullRequestListItem);

            return Result.ok({ items, total });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const ListAutoFixPullRequestsUseCase = Abstraction.createImplementation({
    implementation: ListAutoFixPullRequestsUseCaseImpl,
    dependencies: [DatabaseClient]
});
