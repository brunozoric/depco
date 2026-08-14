import { sql } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";
import { GetDashboardTrendUseCase as Abstraction } from "./abstractions/GetDashboardTrendUseCase.js";
import { RANGE_DAYS } from "./dashboardTrendHelper.js";

interface IRawTrendRow {
    projectId: string;
    projectName: string;
    date: string;
    score: number;
}

class GetDashboardTrendUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const range = params.range ?? "30d";
            const { teamId } = params;
            const days = RANGE_DAYS[range];

            const modifier = `-${days} days`;
            const dateFilter = days ? sql`AND hs.date >= DATE('now', ${modifier})` : sql``;
            const teamCondition = teamId
                ? sql`AND hs.project_id IN ${teamProjectIds(teamId)}`
                : sql``;

            const rows = await db.all<IRawTrendRow>(sql`
                SELECT
                    hs.project_id AS projectId,
                    p.name AS projectName,
                    hs.date,
                    hs.score
                FROM health_snapshots hs
                INNER JOIN projects p ON hs.project_id = p.id
                WHERE 1=1 ${dateFilter} ${teamCondition}
                ORDER BY p.name ASC, hs.date ASC
            `);

            const grouped = new Map<string, Abstraction.GroupItem>();
            for (const row of rows) {
                let entry = grouped.get(row.projectId);
                if (!entry) {
                    entry = {
                        projectId: row.projectId,
                        projectName: row.projectName,
                        snapshots: []
                    };
                    grouped.set(row.projectId, entry);
                }
                entry.snapshots.push({ date: row.date, score: row.score });
            }

            return Result.ok({ items: Array.from(grouped.values()) });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetDashboardTrendUseCase = Abstraction.createImplementation({
    implementation: GetDashboardTrendUseCaseImpl,
    dependencies: [DatabaseClient]
});
