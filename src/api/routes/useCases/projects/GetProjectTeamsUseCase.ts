import { eq } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teams, teamProjects } from "#api/db/schema.js";
import { GetProjectTeamsUseCase as Abstraction } from "./abstractions/GetProjectTeamsUseCase.js";

class GetProjectTeamsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const items = await db
                .select({ id: teams.id, name: teams.name, color: teams.color })
                .from(teamProjects)
                .innerJoin(teams, eq(teamProjects.teamId, teams.id))
                .where(eq(teamProjects.projectId, params.id))
                .all();

            return Result.ok({ items, total: items.length });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetProjectTeamsUseCase = Abstraction.createImplementation({
    implementation: GetProjectTeamsUseCaseImpl,
    dependencies: [DatabaseClient]
});
