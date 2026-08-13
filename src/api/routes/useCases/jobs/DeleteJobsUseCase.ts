import { sql } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { upgradeJobs } from "#api/db/schema.js";
import { DeleteJobsUseCase as Abstraction } from "./abstractions/DeleteJobsUseCase.js";
import { buildJobConditions, type ICountRow } from "./jobConditions.js";

class DeleteJobsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const where = buildJobConditions(params);

            const countResult = (await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(upgradeJobs)
                .where(where)
                .get()) as ICountRow | undefined;

            const deleted = countResult?.count ?? 0;

            if (where) {
                await db.delete(upgradeJobs).where(where).run();
            } else {
                await db.delete(upgradeJobs).run();
            }

            return Result.ok({ deleted });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const DeleteJobsUseCase = Abstraction.createImplementation({
    implementation: DeleteJobsUseCaseImpl,
    dependencies: [DatabaseClient]
});
