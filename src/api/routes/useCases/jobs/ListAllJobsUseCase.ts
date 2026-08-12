import { sql } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { upgradeJobs } from "#api/db/schema.js";
import { ListAllJobsUseCase as Abstraction } from "./abstractions/ListAllJobsUseCase.js";
import { buildJobConditions, type ICountRow } from "./jobConditions.js";

class ListAllJobsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const { db } = this.databaseClient;
        const where = buildJobConditions(params);

        const parsedLimit = params.limit ? parseInt(params.limit, 10) : 50;
        const parsedOffset = params.offset ? parseInt(params.offset, 10) : 0;

        const [items, countResult] = await Promise.all([
            db
                .select()
                .from(upgradeJobs)
                .where(where)
                .orderBy(
                    sql`CASE WHEN ${upgradeJobs.startedAt} IS NULL THEN 1 ELSE 0 END`,
                    sql`${upgradeJobs.startedAt} DESC`
                )
                .limit(parsedLimit)
                .offset(parsedOffset)
                .all(),
            db
                .select({ count: sql<number>`COUNT(*)` })
                .from(upgradeJobs)
                .where(where)
                .get() as ICountRow | undefined
        ]);

        return Result.ok({ items, total: countResult?.count ?? 0 });
    }
}

export const ListAllJobsUseCase = Abstraction.createImplementation({
    implementation: ListAllJobsUseCaseImpl,
    dependencies: [DatabaseClient]
});
