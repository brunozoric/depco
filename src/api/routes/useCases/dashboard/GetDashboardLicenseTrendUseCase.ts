import { sql } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";
import { GetDashboardLicenseTrendUseCase as Abstraction } from "./abstractions/GetDashboardLicenseTrendUseCase.js";
import { daysToCutoff } from "./dashboardTrendHelper.js";

class GetDashboardLicenseTrendUseCaseImpl implements Abstraction.Interface {
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
                    SUM(compliant_count) AS compliantCount,
                    SUM(denied_count) AS deniedCount,
                    SUM(warned_count) AS warnedCount,
                    SUM(total_packages) AS totalPackages
                FROM license_snapshots
                WHERE 1=1 ${dateCondition} ${teamCondition}
                GROUP BY date
                ORDER BY date ASC
            `);

            return Result.ok({ points: rows });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetDashboardLicenseTrendUseCase = Abstraction.createImplementation({
    implementation: GetDashboardLicenseTrendUseCaseImpl,
    dependencies: [DatabaseClient]
});
