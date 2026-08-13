import { sql } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teams } from "#api/db/schema.js";
import { ListTeamsUseCase as Abstraction } from "./abstractions/ListTeamsUseCase.js";
import { computeStatsByTeam, toTeamWithStats, zeroStats } from "./teamStatsHelper.js";

interface ICountRow {
    count: number;
}

class ListTeamsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const page = params.page ?? 1;
            const pageSize = params.pageSize ?? 50;
            const offset = (page - 1) * pageSize;

            const countResult = (await db
                .select({ count: sql<number>`count(*)` })
                .from(teams)
                .get()) as ICountRow | undefined;
            const total = countResult?.count ?? 0;

            const pagedTeams = await db.select().from(teams).limit(pageSize).offset(offset).all();

            const statsByTeam = await computeStatsByTeam(db);

            const items = pagedTeams.map(team =>
                toTeamWithStats(team, statsByTeam.get(team.id) ?? zeroStats())
            );

            return Result.ok({ items, total });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const ListTeamsUseCase = Abstraction.createImplementation({
    implementation: ListTeamsUseCaseImpl,
    dependencies: [DatabaseClient]
});
