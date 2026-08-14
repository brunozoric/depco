import { sql } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { appLogs } from "#api/db/schema.js";
import { buildLogConditions } from "./logsHelper.js";
import { ListLogsUseCase as Abstraction } from "./abstractions/ListLogsUseCase.js";

interface ICountRow {
    count: number;
}

class ListLogsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const where = buildLogConditions(params);

            const parsedLimit = params.limit ? parseInt(params.limit, 10) : 100;
            const parsedOffset = params.offset ? parseInt(params.offset, 10) : 0;

            const [items, countResult] = await Promise.all([
                db
                    .select()
                    .from(appLogs)
                    .where(where)
                    .orderBy(sql`${appLogs.createdAt} DESC`)
                    .limit(parsedLimit)
                    .offset(parsedOffset)
                    .all(),
                db
                    .select({ count: sql<number>`COUNT(*)` })
                    .from(appLogs)
                    .where(where)
                    .get() as ICountRow | undefined
            ]);

            return Result.ok({ items, total: countResult?.count ?? 0 });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const ListLogsUseCase = Abstraction.createImplementation({
    implementation: ListLogsUseCaseImpl,
    dependencies: [DatabaseClient]
});
