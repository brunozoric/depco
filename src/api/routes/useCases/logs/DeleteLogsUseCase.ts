import { sql } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { appLogs } from "#api/db/schema.js";
import { buildLogConditions } from "./logsHelper.js";
import { DeleteLogsUseCase as Abstraction } from "./abstractions/DeleteLogsUseCase.js";

interface ICountRow {
    count: number;
}

class DeleteLogsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const where = buildLogConditions(params);

            const countResult = (await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(appLogs)
                .where(where)
                .get()) as ICountRow | undefined;

            const deleted = countResult?.count ?? 0;

            if (where) {
                await db.delete(appLogs).where(where).run();
            } else {
                await db.delete(appLogs).run();
            }

            return Result.ok({ deleted });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const DeleteLogsUseCase = Abstraction.createImplementation({
    implementation: DeleteLogsUseCaseImpl,
    dependencies: [DatabaseClient]
});
