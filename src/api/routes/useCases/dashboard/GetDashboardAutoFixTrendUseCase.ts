import { sql } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";
import { GetDashboardAutoFixTrendUseCase as Abstraction } from "./abstractions/GetDashboardAutoFixTrendUseCase.js";
import { daysToCutoff } from "./dashboardTrendHelper.js";

class GetDashboardAutoFixTrendUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const { days, teamId } = params;
            const dateFilter = daysToCutoff(days);
            const dateCondition = dateFilter
                ? sql`AND DATE(updated_at/1000, 'unixepoch') >= ${dateFilter}`
                : sql``;
            const teamCondition = teamId ? sql`AND project_id IN ${teamProjectIds(teamId)}` : sql``;

            const rows = await db.all<Abstraction.Point>(sql`
                SELECT
                    DATE(updated_at/1000, 'unixepoch') AS date,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN status = 'created' THEN 1 ELSE 0 END) AS created,
                    SUM(CASE WHEN status = 'merged' THEN 1 ELSE 0 END) AS merged,
                    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
                FROM auto_fix_pull_requests
                WHERE 1=1 ${dateCondition} ${teamCondition}
                GROUP BY DATE(updated_at/1000, 'unixepoch')
                ORDER BY date ASC
            `);

            return Result.ok({ points: rows });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const GetDashboardAutoFixTrendUseCase = Abstraction.createImplementation({
    implementation: GetDashboardAutoFixTrendUseCaseImpl,
    dependencies: [DatabaseClient]
});
