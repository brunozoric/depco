import { sql } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";
import { GetDashboardStalenessUseCase as Abstraction } from "./abstractions/GetDashboardStalenessUseCase.js";

class GetDashboardStalenessUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const { teamId } = params;
            const teamCondition = teamId ? sql`WHERE id IN ${teamProjectIds(teamId)}` : sql``;

            const rows = await db.all<Abstraction.Project>(sql`
                SELECT
                    id AS projectId,
                    name AS projectName,
                    last_scanned_at AS lastScannedAt
                FROM projects
                ${teamCondition}
                ORDER BY
                    CASE WHEN last_scanned_at IS NULL THEN 0 ELSE 1 END ASC,
                    last_scanned_at ASC
            `);

            return Result.ok({ items: rows });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const GetDashboardStalenessUseCase = Abstraction.createImplementation({
    implementation: GetDashboardStalenessUseCaseImpl,
    dependencies: [DatabaseClient]
});
