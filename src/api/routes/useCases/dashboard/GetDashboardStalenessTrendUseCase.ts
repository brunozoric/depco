import { sql } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";
import { GetDashboardStalenessTrendUseCase as Abstraction } from "./abstractions/GetDashboardStalenessTrendUseCase.js";
import { daysToCutoff } from "./dashboardTrendHelper.js";

class GetDashboardStalenessTrendUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const { days, teamId } = params;
            const dateFilter = daysToCutoff(days);
            const dateCondition = dateFilter ? sql`AND date >= ${dateFilter}` : sql``;
            const teamCondition = teamId ? sql`AND project_id IN ${teamProjectIds(teamId)}` : sql``;

            const rows = await db.all<Abstraction.Point>(sql`
                SELECT
                    date,
                    SUM(patch_outdated) AS patchOutdated,
                    SUM(minor_outdated) AS minorOutdated,
                    SUM(major_outdated) AS majorOutdated,
                    SUM(total_packages) AS totalPackages
                FROM health_snapshots
                WHERE 1=1 ${dateCondition} ${teamCondition}
                GROUP BY date
                ORDER BY date ASC
            `);

            return Result.ok({ points: rows });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const GetDashboardStalenessTrendUseCase = Abstraction.createImplementation({
    implementation: GetDashboardStalenessTrendUseCaseImpl,
    dependencies: [DatabaseClient]
});
