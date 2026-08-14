import { sql } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";
import { GetDashboardActivityUseCase as Abstraction } from "./abstractions/GetDashboardActivityUseCase.js";

class GetDashboardActivityUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const { teamId } = params;
            const teamCondition = teamId
                ? sql`WHERE reference_type = 'project' AND reference_id IN ${teamProjectIds(teamId)}`
                : sql``;

            const rows = await db.all<Abstraction.Job>(sql`
                SELECT
                    id, type, reference_id AS referenceId, reference_type AS referenceType,
                    status, started_at AS startedAt, completed_at AS completedAt
                FROM upgrade_jobs
                ${teamCondition}
                ORDER BY started_at DESC
                LIMIT 20
            `);

            return Result.ok({ items: rows });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetDashboardActivityUseCase = Abstraction.createImplementation({
    implementation: GetDashboardActivityUseCaseImpl,
    dependencies: [DatabaseClient]
});
