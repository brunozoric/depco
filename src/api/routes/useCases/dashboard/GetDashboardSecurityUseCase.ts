import { sql } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";
import { GetDashboardSecurityUseCase as Abstraction } from "./abstractions/GetDashboardSecurityUseCase.js";

class GetDashboardSecurityUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const { teamId } = params;
            const teamCondition = teamId
                ? sql`AND sc.project_id IN ${teamProjectIds(teamId)}`
                : sql``;

            const rows = await db.all<Abstraction.Project>(sql`
                SELECT
                    sc.project_id AS projectId,
                    p.name AS projectName,
                    json_array_length(sc.results) AS totalChecks,
                    sc.passes AS passingChecks
                FROM security_checks sc
                INNER JOIN projects p ON sc.project_id = p.id
                WHERE sc.checked_at = (
                    SELECT MAX(sc2.checked_at)
                    FROM security_checks sc2
                    WHERE sc2.project_id = sc.project_id
                )
                ${teamCondition}
                ORDER BY
                    CASE WHEN json_array_length(sc.results) = 0 THEN 2
                    ELSE CAST(sc.passes AS REAL) / json_array_length(sc.results) END ASC
            `);

            return Result.ok({ items: rows });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetDashboardSecurityUseCase = Abstraction.createImplementation({
    implementation: GetDashboardSecurityUseCaseImpl,
    dependencies: [DatabaseClient]
});
